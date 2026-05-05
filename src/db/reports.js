import { getDb } from './client.js';
import { formatDateOnly, parseDateOnly } from './date.js';
import { normalizeReportRecord } from './shared.js';
import { ValidationStatus } from '../constants.js';

export async function findReportForDate(employeeId, reportDate) {
  return getDb().report.findUnique({
    where: {
      employee_id_report_date: {
        employee_id: employeeId,
        report_date: parseDateOnly(reportDate),
      },
    },
  });
}

export async function findReportForToday(employeeId, reportDate) {
  const date = reportDate || formatDateOnly(new Date());
  return findReportForDate(employeeId, date);
}

export async function upsertReport(employeeId, reportDate, fields) {
  const prisma = getDb();
  const parsedReportDate = parseDateOnly(reportDate);
  const existing = await findReportForDate(employeeId, reportDate);

  const payload = {
    data_utc: new Date(),
    report_date: parsedReportDate,
    employee_id: employeeId,
    cantiere_id: fields.cantiere_id ?? null,
    ore_lavorate: fields.ore_lavorate ?? null,
    ingresso: fields.ingresso ?? null,
    pausa_inizio: fields.pausa_inizio ?? null,
    pausa_fine: fields.pausa_fine ?? null,
    uscita: fields.uscita ?? null,
    attivita_svolte: fields.attivita_svolte ?? null,
    luogo_cantiere: fields.luogo_cantiere ?? null,
    problemi_riscontrati: fields.problemi_riscontrati ?? null,
    testo_originale: fields.testo_originale ?? null,
  };

  if (existing) {
    const updated = await prisma.report.update({
      where: { id: existing.id },
      data: {
        ...payload,
        cantiere_id: payload.cantiere_id ?? existing.cantiere_id,
      },
    });
    return updated.id;
  }

  const created = await prisma.report.create({ data: payload });
  return created.id;
}

export async function insertMessageLog(employeeId, messageType, rawText, extractedJson) {
  await getDb().messageLog.create({
    data: {
      timestamp_utc: new Date(),
      employee_id: employeeId,
      message_type: messageType,
      raw_text: rawText,
      extracted_json: extractedJson,
    },
  });
}

export async function getAuditLogs() {
  const logs = await getDb().messageLog.findMany({
    take: 200,
    orderBy: { timestamp_utc: 'desc' },
    include: { employee: true },
  });

  return logs.map((log) => ({
    ...log,
    nome: log.employee?.nome,
    cognome: log.employee?.cognome,
  }));
}

export async function listReports({ start, end } = {}) {
  const where = {};
  if (start && end) {
    where.report_date = { gte: parseDateOnly(start), lte: parseDateOnly(end) };
  } else if (start) {
    where.report_date = { gte: parseDateOnly(start) };
  } else if (end) {
    where.report_date = { lte: parseDateOnly(end) };
  }

  const reports = await getDb().report.findMany({
    where,
    orderBy: { data_utc: 'desc' },
    include: { employee: true },
  });

  return reports.map((report) => ({
    ...normalizeReportRecord(report),
    nome: report.employee?.nome,
    cognome: report.employee?.cognome,
    telegram_id: report.employee?.telegram_id,
  }));
}

export async function listReportsWithEntries({ start, end, employeeId } = {}) {
  const reports = await getDb().report.findMany({
    where: {
      ...(employeeId ? { employee_id: Number(employeeId) } : {}),
      ...(start || end
        ? {
            report_date: {
              ...(start ? { gte: parseDateOnly(start) } : {}),
              ...(end ? { lte: parseDateOnly(end) } : {}),
            },
          }
        : {}),
    },
    orderBy: { data_utc: 'desc' },
    include: { employee: true, entries: { orderBy: { id: 'asc' } } },
  });

  return reports.map((report) => ({
    ...normalizeReportRecord(report),
    nome: report.employee?.nome,
    cognome: report.employee?.cognome,
    telegram_id: report.employee?.telegram_id,
  }));
}

export async function ensureDailyReportHeader(employeeId, reportDate) {
  const prisma = getDb();
  const parsedReportDate = parseDateOnly(reportDate);
  const existing = await findReportForDate(employeeId, reportDate);

  if (existing) {
    await prisma.report.update({
      where: { id: existing.id },
      data: { data_utc: new Date() },
    });
    return existing.id;
  }

  const created = await prisma.report.create({
    data: {
      data_utc: new Date(),
      report_date: parsedReportDate,
      employee_id: employeeId,
      stato_validazione: ValidationStatus.PENDING,
    },
  });

  return created.id;
}

export async function updateReportCantiere(employeeId, reportDate, cantiereId) {
  await getDb().report.updateMany({
    where: {
      employee_id: employeeId,
      report_date: parseDateOnly(reportDate),
    },
    data: { cantiere_id: cantiereId },
  });
}

export async function createReportEntry(fields) {
  const prisma = getDb();
  const data = { ...fields };

  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (data.wbs_node_id == null && data.cantiere_id) {
    const wbs = await prisma.wbsNode.findFirst({
      where: { cantiere_id: data.cantiere_id, parent_id: null },
    });
    data.wbs_node_id = wbs ? wbs.id : null;
  }

  const created = await prisma.reportEntry.create({ data });
  return created.id;
}

export async function upsertReportEntry(fields) {
  const prisma = getDb();
  const { report_id, cantiere_id, fonte, ore_lavorate, ...rest } = fields;

  const existing = await prisma.reportEntry.findFirst({
    where: {
      report_id,
      cantiere_id: cantiere_id ?? null,
      fonte: fonte ?? null,
      NOT: { fonte: 'GPS' },
    },
  });

  if (existing) {
    const newOre = ore_lavorate != null
      ? (existing.ore_lavorate ?? 0) + ore_lavorate
      : existing.ore_lavorate;

    let wbs_node_id = rest.wbs_node_id ?? existing.wbs_node_id;
    if (cantiere_id && !rest.wbs_node_id) {
      const wbs = await prisma.wbsNode.findFirst({
        where: { cantiere_id, parent_id: null },
      });
      wbs_node_id = wbs ? wbs.id : null;
    }

    await prisma.reportEntry.update({
      where: { id: existing.id },
      data: {
        ore_lavorate: newOre,
        cantiere_id: cantiere_id ?? existing.cantiere_id,
        wbs_node_id,
        ingresso: rest.ingresso ?? existing.ingresso,
        pausa_inizio: rest.pausa_inizio ?? existing.pausa_inizio,
        pausa_fine: rest.pausa_fine ?? existing.pausa_fine,
        uscita: rest.uscita ?? existing.uscita,
        attivita_svolte: rest.attivita_svolte ?? existing.attivita_svolte,
        luogo_cantiere: rest.luogo_cantiere ?? existing.luogo_cantiere,
        problemi_riscontrati: rest.problemi_riscontrati ?? existing.problemi_riscontrati,
        testo_originale: rest.testo_originale ?? existing.testo_originale,
        fonte: fonte ?? existing.fonte,
      },
    });

    return existing.id;
  }

  return createReportEntry({ report_id, cantiere_id, fonte, ore_lavorate, ...rest });
}

export async function getReportEntryById(id) {
  return getDb().reportEntry.findUnique({ where: { id } });
}

export async function listReportEntriesByReportId(reportId) {
  return getDb().reportEntry.findMany({
    where: { report_id: reportId },
    orderBy: { id: 'asc' },
  });
}

export async function listReportEntriesByEmployeeAndDate(employeeId, reportDate) {
  const report = await getDb().report.findUnique({
    where: {
      employee_id_report_date: {
        employee_id: employeeId,
        report_date: parseDateOnly(reportDate),
      },
    },
    include: { entries: { orderBy: { id: 'asc' } } },
  });

  if (!report) return [];

  return report.entries.map((entry) => ({
    ...entry,
    report_date: formatDateOnly(report.report_date),
    employee_id: report.employee_id,
  }));
}

export async function updateReportEntry(id, fields) {
  const prisma = getDb();
  const allowed = ['cantiere_id', 'ore_lavorate', 'ingresso', 'pausa_inizio', 'pausa_fine', 'uscita', 'attivita_svolte', 'luogo_cantiere', 'problemi_riscontrati', 'testo_originale', 'stato_validazione', 'fonte', 'admin_note', 'modified_by_admin_at', 'wbs_node_id', 'task_id'];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (Object.keys(data).length > 0) {
    if (data.cantiere_id && !data.wbs_node_id) {
      const wbs = await prisma.wbsNode.findFirst({
        where: { cantiere_id: data.cantiere_id, parent_id: null },
      });
      data.wbs_node_id = wbs ? wbs.id : null;
    }

    await prisma.reportEntry.update({ where: { id }, data });
  }
}

export async function deleteReportEntry(id) {
  await getDb().reportEntry.delete({ where: { id } });
}

export async function deleteReportEntriesByReportId(reportId) {
  await getDb().reportEntry.deleteMany({ where: { report_id: reportId } });
}

export async function getReportById(id) {
  return getDb().report.findUnique({ where: { id } });
}

export async function updateReportHeader(id, fields) {
  const prisma = getDb();
  const allowed = ["data_utc", "report_date", "employee_id", "cantiere_id", "ore_lavorate", "ingresso", "pausa_inizio", "pausa_fine", "uscita", "attivita_svolte", "luogo_cantiere", "problemi_riscontrati", "testo_originale", "stato_validazione", "fonte", "input_method", "admin_note", "modified_by_admin_at"];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.data_utc) data.data_utc = new Date(data.data_utc);
  if (data.report_date) data.report_date = parseDateOnly(data.report_date);
  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (Object.keys(data).length > 0) {
    await prisma.report.update({ where: { id }, data });
  }
}
