import pkg from '@prisma/client';
const { PrismaClient, Prisma, Decimal } = pkg;
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import logger from '../logger.js';
import dotenv from 'dotenv';
import { ValidationStatus } from '../constants.js';

dotenv.config();

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseEnvInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Keep API JSON safe: BigInt stays lossless, Decimal stays numeric for the frontend.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

Decimal.prototype.toJSON = function () {
  return Number(this.toString());
};

export function parseDateOnly(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  if (typeof value === "string" && DATE_ONLY_RE.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data non valida: ${value}`);
  }

  return new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function formatDateOnly(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && DATE_ONLY_RE.test(value)) return value;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function decimalOrNull(value) {
  if (value == null || value === "") return null;
  return new Prisma.Decimal(value);
}

function decimalToNumber(value) {
  if (value == null || value === "") return null;
  return Number(value);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeUserRole(role, fallback = null) {
  if (typeof role !== "string") return fallback;
  const normalized = role.trim().toUpperCase();
  return normalized || fallback;
}

function normalizeReportRecord(report) {
  return {
    ...report,
    report_date: formatDateOnly(report.report_date),
  };
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.PRISMA_DB_URL,
  max: parseEnvInt(process.env.PG_POOL_MAX, 10),
  idleTimeoutMillis: parseEnvInt(process.env.PG_POOL_IDLE_MS, 10000),
  connectionTimeoutMillis: parseEnvInt(process.env.PG_POOL_CONNECT_TIMEOUT_MS, 10000),
});
const adapter = new PrismaPg(pool, {
  disposeExternalPool: true,
  onPoolError: (err) => logger.error({ err, event: "pg_pool_error" }, "pg_pool_error"),
  onConnectionError: (err) => logger.error({ err, event: "pg_connection_error" }, "pg_connection_error"),
});
const prisma = new PrismaClient({ adapter });
let prismaClosed = false;
prisma.close = async () => {
  if (prismaClosed) return;
  prismaClosed = true;
  await prisma.$disconnect();
};

export async function initDb() {
  await prisma.$connect();
  logger.info({ event: "db_ready" }, "db_ready (PostgreSQL Prisma)");
  return prisma;
}

export function getDb() {
  return prisma;
}

export async function findEmployeeByTelegramId(telegramId) {
  return prisma.employee.findUnique({ where: { telegram_id: BigInt(telegramId) } });
}

export async function createEmployee(telegramId, chatId) {
  return prisma.employee.create({
    data: {
      telegram_id: telegramId ? BigInt(telegramId) : null,
      chat_id: chatId ? BigInt(chatId) : null,
      attivo: 1,
      stato_registrazione: 'in_attesa_nome',
      gdpr_accettato: 0
    }
  });
}

export async function updateEmployee(id, fields) {
  if (Object.keys(fields).length === 0) return;

  // Clean fields if bigints are passed as strings
  const data = { ...fields };
  if (data.telegram_id) data.telegram_id = BigInt(data.telegram_id);
  if (data.chat_id) data.chat_id = BigInt(data.chat_id);

  await prisma.employee.update({
    where: { id },
    data
  });
}

export async function findReportForDate(employeeId, reportDate) {
  const parsedReportDate = parseDateOnly(reportDate);
  return prisma.report.findUnique({
    where: {
      employee_id_report_date: { employee_id: employeeId, report_date: parsedReportDate }
    }
  });
}

export async function findReportForToday(employeeId, reportDate) {
  const date = reportDate || formatDateOnly(new Date());
  return findReportForDate(employeeId, date);
}

export async function upsertReport(employeeId, reportDate, fields) {
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
        cantiere_id: payload.cantiere_id ?? existing.cantiere_id
      }
    });
    return updated.id;
  }

  const created = await prisma.report.create({ data: payload });
  return created.id;
}

export async function insertMessageLog(employeeId, messageType, rawText, extractedJson) {
  await prisma.messageLog.create({
    data: {
      timestamp_utc: new Date(),
      employee_id: employeeId,
      message_type: messageType,
      raw_text: rawText,
      extracted_json: extractedJson
    }
  });
}

export async function getAuditLogs() {
  const logs = await prisma.messageLog.findMany({
    take: 200,
    orderBy: { timestamp_utc: 'desc' },
    include: { employee: true }
  });
  return logs.map(m => ({ ...m, nome: m.employee?.nome, cognome: m.employee?.cognome }));
}

export async function listEmployees() {
  return prisma.employee.findMany();
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

  const reports = await prisma.report.findMany({
    where,
    orderBy: { data_utc: 'desc' },
    include: { employee: true }
  });

  return reports.map(r => ({
    ...normalizeReportRecord(r),
    nome: r.employee?.nome,
    cognome: r.employee?.cognome,
    telegram_id: r.employee?.telegram_id
  }));
}

export async function listReportsWithEntries({ start, end, employeeId } = {}) {
  const reports = await prisma.report.findMany({
    where: {
      ...(employeeId ? { employee_id: Number(employeeId) } : {}),
      ...(start || end
        ? {
            report_date: {
              ...(start ? { gte: parseDateOnly(start) } : {}),
              ...(end ? { lte: parseDateOnly(end) } : {})
            }
          }
        : {}),
    },
    orderBy: { data_utc: 'desc' },
    include: { employee: true, entries: { orderBy: { id: 'asc' } } }
  });

  return reports.map(r => ({
    ...normalizeReportRecord(r),
    nome: r.employee?.nome,
    cognome: r.employee?.cognome,
    telegram_id: r.employee?.telegram_id
  }));
}

export async function employeeHasTariffa(employeeId) {
  const count = await prisma.tariffa.count({ where: { employee_id: employeeId } });
  return count > 0;
}

export async function cantiereExists(cantiereId) {
  const c = await prisma.cantiere.findFirst({ where: { id: cantiereId, attivo: 1 } });
  return !!c;
}

export async function getCantieriAttivi() {
  return prisma.cantiere.findMany({
    where: { attivo: 1 },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' }
  });
}

export async function insertSpesa(employeeId, cantiereId, importo, fornitore, descrizione, fonte = "TELEGRAM", fattura_rif = null, extra = null) {
  if (typeof importo !== "number" || importo <= 0) {
    throw new Error("L'importo deve essere maggiore di zero.");
  }

  let pricebook_id = extra?.pricebook_id ?? null;
  let quantita = extra?.quantita ?? null;
  let stato_validazione = extra?.stato_validazione ?? ValidationStatus.PENDING;
  let wbs_node_id = extra?.wbs_node_id ?? null;
  let task_id = extra?.task_id ?? null;
  let documento_id = extra?.documento_id ?? null;

  if (pricebook_id != null && quantita == null) {
    quantita = 1;
  }

  const ok = await cantiereExists(cantiereId);
  if (!ok) throw new Error("Cantiere non valido o inattivo.");

  // Assign to root WBS directly for older logic
  if (wbs_node_id == null) {
    const rootWbs = await prisma.wbsNode.findFirst({
      where: { cantiere_id: cantiereId, parent_id: null }
    });
    wbs_node_id = rootWbs ? rootWbs.id : null;
  }

  const created = await prisma.spesa.create({
    data: {
      timestamp_utc: new Date(),
      employee_id: employeeId,
      cantiere_id: cantiereId,
      wbs_node_id,
      task_id,
      importo: decimalOrNull(importo),
      fornitore,
      descrizione,
      fonte,
      fattura_rif,
      documento_id,
      pricebook_id,
      quantita: decimalOrNull(quantita),
      stato_validazione
    }
  });

  return created.id;
}

async function getApprovedLaborCostByCantiere(prismaClient, cantiereIds) {
  if (cantiereIds.length === 0) return [];

  return prismaClient.$queryRaw(
    Prisma.sql`
      WITH latest_tariffe AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT
            employee_id,
            costo_orario,
            ROW_NUMBER() OVER (
              PARTITION BY employee_id
              ORDER BY valido_dal DESC, id DESC
            ) AS rn
          FROM "Tariffa"
          WHERE employee_id IS NOT NULL
        ) ranked_tariffe
        WHERE rn = 1
      )
      SELECT
        re.cantiere_id,
        COALESCE(SUM(COALESCE(re.ore_lavorate, 0) * COALESCE(lt.costo_orario, 0)), 0) AS costo_manodopera
      FROM "ReportEntry" re
      INNER JOIN "Report" r ON r.id = re.report_id
      LEFT JOIN latest_tariffe lt ON lt.employee_id = r.employee_id
      WHERE re.cantiere_id IN (${Prisma.join(cantiereIds)})
        AND re.stato_validazione = ${ValidationStatus.APPROVED}
      GROUP BY re.cantiere_id
    `
  );
}

function buildStatusMoneyMap(rows, getValue) {
  const map = new Map();

  for (const row of rows ?? []) {
    const cantiereId = Number(row?.cantiere_id);
    if (!Number.isInteger(cantiereId) || cantiereId <= 0) continue;
    map.set(cantiereId, roundMoney(decimalToNumber(getValue(row))));
  }

  return map;
}

export async function getCantieriStatus({ activeOnly = true } = {}, prismaClient = prisma) {
  const cantieri = await prismaClient.cantiere.findMany({
    ...(activeOnly ? { where: { attivo: 1 } } : {}),
    select: { id: true, nome: true, budget: true },
    orderBy: { nome: 'asc' }
  });

  const cantiereIds = cantieri.map((c) => c.id);
  if (cantiereIds.length === 0) return [];

  const [laborRows, expenseRows] = await Promise.all([
    getApprovedLaborCostByCantiere(prismaClient, cantiereIds),
    prismaClient.spesa.groupBy({
      by: ["cantiere_id"],
      where: {
        cantiere_id: { in: cantiereIds },
        NOT: { stato_validazione: ValidationStatus.REJECTED },
      },
      _sum: { importo: true },
    }),
  ]);

  const laborMap = buildStatusMoneyMap(laborRows, (row) => row.costo_manodopera);
  const expenseMap = buildStatusMoneyMap(expenseRows, (row) => row._sum?.importo);

  return cantieri.map(c => {
    const costo_manodopera = laborMap.get(c.id) ?? 0;
    const costo_materiali = expenseMap.get(c.id) ?? 0;
    return {
      id: c.id,
      nome: c.nome,
      budget: decimalToNumber(c.budget) || 0,
      costo_manodopera,
      costo_materiali,
      costo_totale: roundMoney(costo_manodopera + costo_materiali)
    };
  });
}

export async function getAllCantieri() {
  const cantieri = await prisma.cantiere.findMany({
    orderBy: [{ attivo: 'desc' }, { id: 'desc' }]
  });
  return cantieri.map((c) => ({
    ...c,
    budget: decimalToNumber(c.budget),
    valore_contratto: decimalToNumber(c.valore_contratto),
    budget_spese: decimalToNumber(c.budget_spese),
  }));
}

export async function createCantiere({ nome, indirizzo, lat, lng, budget, valore_contratto, budget_spese }) {
  const c = await prisma.cantiere.create({
    data: {
      nome,
      indirizzo: indirizzo || null,
      lat: lat || null,
      lng: lng || null,
      budget: decimalOrNull(budget),
      valore_contratto: decimalOrNull(valore_contratto),
      budget_spese: decimalOrNull(budget_spese),
      attivo: 1
    }
  });

  // ERP auto create wbs node
  await prisma.wbsNode.create({
    data: { cantiere_id: c.id, nome: "Fase Radice", budget_preventivato: decimalOrNull(budget ?? 0) }
  });

  return c.id;
}

export async function toggleCantiere(id) {
  const numericId = Number(id);
  const c = await prisma.cantiere.findUnique({ where: { id: numericId } });
  if (c) {
    await prisma.cantiere.update({
      where: { id: numericId },
      data: { attivo: c.attivo === 1 ? 0 : 1 }
    });
  }
}

export async function getCantieriConCoordinate() {
  return prisma.cantiere.findMany({
    where: { attivo: 1, lat: { not: null }, lng: { not: null } },
    select: { id: true, nome: true, lat: true, lng: true, raggio_tolleranza: true }
  });
}

export async function ensureDailyReportHeader(employeeId, reportDate) {
  const parsedReportDate = parseDateOnly(reportDate);
  const existing = await findReportForDate(employeeId, reportDate);
  if (existing) {
    await prisma.report.update({
      where: { id: existing.id },
      data: { data_utc: new Date() }
    });
    return existing.id;
  }

  const created = await prisma.report.create({
    data: {
      data_utc: new Date(),
      report_date: parsedReportDate,
      employee_id: employeeId,
      stato_validazione: ValidationStatus.PENDING
    }
  });
  return created.id;
}

export async function listEmployeesWithPendingDrafts() {
  return prisma.employee.findMany({
    where: {
      OR: [
        { pending_json: { not: null, not: "" } },
        { pending_text: { not: null, not: "" } }
      ]
    }
  });
}

export async function updateReportCantiere(employeeId, reportDate, cantiereId) {
  await prisma.report.updateMany({
    where: { employee_id: employeeId, report_date: parseDateOnly(reportDate) },
    data: { cantiere_id: cantiereId }
  });
}

export async function getEmployeesWithoutReport(reportDate) {
  const allEmps = await prisma.employee.findMany({
    where: { attivo: 1, chat_id: { not: null } }
  });
  const reports = await prisma.report.findMany({
    where: { report_date: parseDateOnly(reportDate) },
    select: { employee_id: true }
  });
  const reportedIds = new Set(reports.map(r => r.employee_id));
  return allEmps.filter(e => !reportedIds.has(e.id));
}

// Users
export async function findUserByUsername(username) {
  return prisma.user.findUnique({ where: { username } });
}
export async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}
export async function findUserByEmployeeId(employeeId) {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  return emp?.user ?? null;
}
export async function listUsers() {
  const users = await prisma.user.findMany({
    include: { employee: true },
    orderBy: { username: 'asc' }
  });
  return users.map(u => ({ ...u, nome: u.employee?.nome, cognome: u.employee?.cognome }));
}
export async function createUser({ username, password_hash, email, google_id, role, is_active = 1 }) {
  return prisma.user.create({
    data: {
      username,
      password_hash,
      email,
      google_id,
      role: normalizeUserRole(role, "WORKER"),
      is_active,
    }
  });
}
export async function updateUser(id, fields) {
  const allowed = ["username", "password_hash", "email", "google_id", "role", "is_active"];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.role !== undefined) {
    data.role = normalizeUserRole(data.role, "WORKER");
  }
  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id }, data });
  }
}
export async function updateUserLastLogin(id) {
  await prisma.user.update({ where: { id }, data: { last_login_at: new Date() } });
}
export async function deactivateUser(id) {
  await prisma.user.update({ where: { id }, data: { is_active: 0 } });
}
export async function deleteUserById(id) {
  await prisma.user.delete({ where: { id } });
}

// Report Entries
export async function createReportEntry(fields) {
  const data = { ...fields };
  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (data.wbs_node_id == null && data.cantiere_id) {
    const wbs = await prisma.wbsNode.findFirst({ where: { cantiere_id: data.cantiere_id, parent_id: null } });
    data.wbs_node_id = wbs ? wbs.id : null;
  }
  const created = await prisma.reportEntry.create({ data });
  return created.id;
}

/**
 * upsertReportEntry — Comportamento idempotente per i messaggi del bot.
 *
 * Cerca una ReportEntry esistente per (report_id, cantiere_id, fonte).
 * - Se trovata: accumula le ore e aggiorna i campi testuali (attivita_svolte, orari, note).
 * - Se non trovata: crea una nuova riga (delega a createReportEntry).
 *
 * Questo garantisce che ogni re-invio dell'utente aggiorni la entry del giorno
 * invece di creare entry duplicate nel tabulato.
 */
export async function upsertReportEntry(fields) {
  const { report_id, cantiere_id, fonte, ore_lavorate, ...rest } = fields;

  // Cerca entry esistente per questo report+cantiere+fonte
  const existing = await prisma.reportEntry.findFirst({
    where: {
      report_id,
      cantiere_id: cantiere_id ?? null,
      fonte: fonte ?? null,
      // Escludi le entry GPS (sempre nuove, sono timestamp di check-in)
      NOT: { fonte: 'GPS' },
    },
  });

  if (existing) {
    // Accumula ore se fornite
    const newOre = ore_lavorate != null
      ? (existing.ore_lavorate ?? 0) + ore_lavorate
      : existing.ore_lavorate;

    // Wbs: risolvi se cantiere è cambiato
    let wbs_node_id = rest.wbs_node_id ?? existing.wbs_node_id;
    if (cantiere_id && !rest.wbs_node_id) {
      const wbs = await prisma.wbsNode.findFirst({ where: { cantiere_id, parent_id: null } });
      wbs_node_id = wbs ? wbs.id : null;
    }

    await prisma.reportEntry.update({
      where: { id: existing.id },
      data: {
        ore_lavorate:          newOre,
        cantiere_id:           cantiere_id ?? existing.cantiere_id,
        wbs_node_id,
        ingresso:              rest.ingresso              ?? existing.ingresso,
        pausa_inizio:          rest.pausa_inizio          ?? existing.pausa_inizio,
        pausa_fine:            rest.pausa_fine            ?? existing.pausa_fine,
        uscita:                rest.uscita                ?? existing.uscita,
        attivita_svolte:       rest.attivita_svolte       ?? existing.attivita_svolte,
        luogo_cantiere:        rest.luogo_cantiere        ?? existing.luogo_cantiere,
        problemi_riscontrati:  rest.problemi_riscontrati  ?? existing.problemi_riscontrati,
        testo_originale:       rest.testo_originale       ?? existing.testo_originale,
        fonte:                 fonte                      ?? existing.fonte,
      },
    });
    return existing.id;
  }

  // Nessuna entry esistente → crea nuova
  return createReportEntry({ report_id, cantiere_id, fonte, ore_lavorate, ...rest });
}


export async function getReportEntryById(id) {
  return prisma.reportEntry.findUnique({ where: { id } });
}
export async function listReportEntriesByReportId(reportId) {
  return prisma.reportEntry.findMany({ where: { report_id: reportId }, orderBy: { id: 'asc' } });
}
export async function listReportEntriesByEmployeeAndDate(employeeId, reportDate) {
  const report = await prisma.report.findUnique({
    where: { employee_id_report_date: { employee_id: employeeId, report_date: parseDateOnly(reportDate) } },
    include: { entries: { orderBy: { id: 'asc' } } }
  });
  if (!report) return [];
  return report.entries.map(e => ({ ...e, report_date: formatDateOnly(report.report_date), employee_id: report.employee_id }));
}
export async function updateReportEntry(id, fields) {
  const allowed = ['cantiere_id', 'ore_lavorate', 'ingresso', 'pausa_inizio', 'pausa_fine', 'uscita', 'attivita_svolte', 'luogo_cantiere', 'problemi_riscontrati', 'testo_originale', 'stato_validazione', 'fonte', 'admin_note', 'modified_by_admin_at', 'wbs_node_id', 'task_id'];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (Object.keys(data).length > 0) {
    if (data.cantiere_id && !data.wbs_node_id) {
      const wbs = await prisma.wbsNode.findFirst({ where: { cantiere_id: data.cantiere_id, parent_id: null } });
      data.wbs_node_id = wbs ? wbs.id : null;
    }
    await prisma.reportEntry.update({ where: { id }, data });
  }
}
export async function deleteReportEntry(id) {
  await prisma.reportEntry.delete({ where: { id } });
}
export async function deleteReportEntriesByReportId(reportId) {
  await prisma.reportEntry.deleteMany({ where: { report_id: reportId } });
}

// Report Header
export async function getReportById(id) { return prisma.report.findUnique({ where: { id } }); }
export async function updateReportHeader(id, fields) {
  const allowed = ["data_utc", "report_date", "employee_id", "cantiere_id", "ore_lavorate", "ingresso", "pausa_inizio", "pausa_fine", "uscita", "attivita_svolte", "luogo_cantiere", "problemi_riscontrati", "testo_originale", "stato_validazione", "fonte", "input_method", "admin_note", "modified_by_admin_at"];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.data_utc) data.data_utc = new Date(data.data_utc);
  if (data.report_date) data.report_date = parseDateOnly(data.report_date);
  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (Object.keys(data).length > 0) await prisma.report.update({ where: { id }, data });
}

// Spese
export async function getSpesaById(id) { return prisma.spesa.findUnique({ where: { id } }); }
export async function updateSpesa(id, fields) {
  const allowed = ["timestamp_utc", "employee_id", "cantiere_id", "importo", "fornitore", "descrizione", "fonte", "fattura_rif", "pricebook_id", "quantita", "stato_validazione", "input_method", "admin_note", "modified_by_admin_at", "wbs_node_id", "task_id", "documento_id"];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.timestamp_utc) data.timestamp_utc = new Date(data.timestamp_utc);
  if (data.importo !== undefined) data.importo = decimalOrNull(data.importo);
  if (data.quantita !== undefined) data.quantita = decimalOrNull(data.quantita);
  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (Object.keys(data).length > 0) {
    if (data.cantiere_id && !data.wbs_node_id) {
      const wbs = await prisma.wbsNode.findFirst({ where: { cantiere_id: data.cantiere_id, parent_id: null } });
      data.wbs_node_id = wbs ? wbs.id : null;
    }
    await prisma.spesa.update({ where: { id }, data });
  }
}
export async function deleteSpesaById(id) { await prisma.spesa.delete({ where: { id } }); }

// Pricebook
export async function getPricebookById(id) { return prisma.pricebook.findUnique({ where: { id } }); }
export async function listPricebook() {
  const items = await prisma.pricebook.findMany({ orderBy: { nome: 'asc' } });
  return items.map((item) => ({
    ...item,
    costo_unitario: decimalToNumber(item.costo_unitario),
  }));
}
export async function createPricebookItem({ nome, unita = null, costo_unitario }) {
  return prisma.pricebook.create({ data: { nome, unita, costo_unitario: decimalOrNull(costo_unitario) } });
}
export async function updatePricebookItem(id, fields) {
  const allowed = ["nome", "unita", "costo_unitario"];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.costo_unitario !== undefined) data.costo_unitario = decimalOrNull(data.costo_unitario);
  if (Object.keys(data).length > 0) await prisma.pricebook.update({ where: { id }, data });
}
export async function deletePricebookItem(id) { await prisma.pricebook.delete({ where: { id } }); }

export async function createTariffa({ employee_id, costo_orario, valido_dal }) {
  return prisma.tariffa.create({
    data: {
      employee_id,
      costo_orario: decimalOrNull(costo_orario),
      valido_dal: parseDateOnly(valido_dal),
    }
  });
}

export async function updateCantiere(id, fields) {
  const allowed = ["nome", "indirizzo", "lat", "lng", "budget", "valore_contratto", "budget_spese", "raggio_tolleranza", "attivo"];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.budget !== undefined) data.budget = decimalOrNull(data.budget);
  if (data.valore_contratto !== undefined) data.valore_contratto = decimalOrNull(data.valore_contratto);
  if (data.budget_spese !== undefined) data.budget_spese = decimalOrNull(data.budget_spese);
  if (Object.keys(data).length > 0) {
    await prisma.cantiere.update({ where: { id }, data });
  }
}

// ─── WBS (Work Breakdown Structure) ─────────────────────────────────────────

export async function getWbsNodesByCantiere(cantiereId) {
  return prisma.wbsNode.findMany({
    where: { cantiere_id: Number(cantiereId) },
    orderBy: [{ parent_id: 'asc' }, { id: 'asc' }],
  });
}

export async function createWbsNode({ cantiere_id, nome, budget_preventivato = null, parent_id = null }) {
  return prisma.wbsNode.create({
    data: {
      cantiere_id: Number(cantiere_id),
      nome,
      budget_preventivato: decimalOrNull(budget_preventivato),
      parent_id: parent_id ? Number(parent_id) : null,
    },
  });
}

export async function updateWbsNode(id, fields) {
  const allowed = ['nome', 'budget_preventivato'];
  const data = {};
  for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
  if (data.budget_preventivato !== undefined) data.budget_preventivato = decimalOrNull(data.budget_preventivato);
  if (Object.keys(data).length > 0) {
    await prisma.wbsNode.update({ where: { id: Number(id) }, data });
  }
}

export async function deleteWbsNode(id) {
  const nodeId = Number(id);
  // Verifica dipendenze prima di eliminare
  const [entryCount, spesaCount, childCount] = await Promise.all([
    prisma.reportEntry.count({ where: { wbs_node_id: nodeId } }),
    prisma.spesa.count({ where: { wbs_node_id: nodeId } }),
    prisma.wbsNode.count({ where: { parent_id: nodeId } }),
  ]);
  if (entryCount > 0 || spesaCount > 0) {
    throw new Error(`Impossibile eliminare: il nodo ha ${entryCount} ore e ${spesaCount} spese collegate.`);
  }
  if (childCount > 0) {
    throw new Error(`Impossibile eliminare: il nodo ha ${childCount} sottofasi. Elimina prima le sottofasi.`);
  }
  await prisma.wbsNode.delete({ where: { id: nodeId } });
}

/**
 * Restituisce il burn data per ogni nodo WBS del cantiere.
 * Per ogni nodo calcola: ore_tot, costo_manodopera (ore × tariffa), costo_materiali (spese), totale.
 * Usa Tariffa più recente (valido_dal DESC) per la tariffa oraria.
 */
export async function getWbsBurnData(cantiereId) {
  const id = Number(cantiereId);

  // Carica tutte le ReportEntry verificate per questo cantiere
  const entries = await prisma.reportEntry.findMany({
    where: {
      cantiere_id: id,
      stato_validazione: { in: [ValidationStatus.APPROVED] },
      wbs_node_id: { not: null },
    },
    include: {
      report: {
        include: {
          employee: {
            include: { tariffe: { orderBy: { valido_dal: 'desc' }, take: 1 } },
          },
        },
      },
    },
  });

  // Carica tutte le Spese non rifiutate per questo cantiere
  const spese = await prisma.spesa.findMany({
    where: {
      cantiere_id: id,
      wbs_node_id: { not: null },
      NOT: { stato_validazione: ValidationStatus.REJECTED },
    },
  });

  // Aggrega per nodo
  const burnMap = new Map(); // wbs_node_id -> { ore_tot, costo_manodopera, costo_materiali }

  for (const entry of entries) {
    const nodeId = entry.wbs_node_id;
    const ore = entry.ore_lavorate ?? 0;
    const tariffa = decimalToNumber(entry.report?.employee?.tariffe?.[0]?.costo_orario) ?? 0;
    const costo = ore * tariffa;
    const cur = burnMap.get(nodeId) ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0 };
    cur.ore_tot += ore;
    cur.costo_manodopera += costo;
    burnMap.set(nodeId, cur);
  }

  for (const spesa of spese) {
    const nodeId = spesa.wbs_node_id;
    const importo = decimalToNumber(spesa.importo) ?? 0;
    const cur = burnMap.get(nodeId) ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0 };
    cur.costo_materiali += importo;
    burnMap.set(nodeId, cur);
  }

  // Converti in oggetto id->burn per il controller
  const result = {};
  for (const [nodeId, data] of burnMap.entries()) {
    result[nodeId] = {
      ore_tot: Math.round(data.ore_tot * 100) / 100,
      costo_manodopera: Math.round(data.costo_manodopera * 100) / 100,
      costo_materiali: Math.round(data.costo_materiali * 100) / 100,
      totale: Math.round((data.costo_manodopera + data.costo_materiali) * 100) / 100,
    };
  }
  return result;
}

/** Restituisce le fasi WBS attive (non-root, max 3 livelli) per la selezione Bot */
export async function getWbsFasiAttive(cantiereId) {
  return prisma.wbsNode.findMany({
    where: {
      cantiere_id: Number(cantiereId),
      parent_id: { not: null },  // escludi la radice
    },
    orderBy: [{ parent_id: 'asc' }, { id: 'asc' }],
    select: { id: true, nome: true, parent_id: true },
  });
}
