import { getDb, parseDateOnly, formatDateOnly } from "../db/index.js";
import { ValidationStatus } from "../constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  ensureCantiereActive,
  ensureTaskBelongsToCantiere,
  ensureWbsBelongsToCantiere,
  getRootWbsId,
} from "../domain/shared/linkValidators.js";

const WEB_SOURCE = "WEB";
const MUTABLE_STATUSES = new Set([ValidationStatus.PENDING, ValidationStatus.REJECTED]);

function getAuthenticatedEmployeeId(req) {
  const employeeId = Number(req.user?.employee_id);
  return Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null;
}

function isMutableStatus(status) {
  return MUTABLE_STATUSES.has(status);
}

function buildEntryInclude() {
  return {
    report: {
      select: {
        id: true,
        employee_id: true,
        report_date: true,
      },
    },
    cantiere: {
      select: {
        id: true,
        nome: true,
      },
    },
    wbs_node: {
      select: {
        id: true,
        nome: true,
        cantiere_id: true,
      },
    },
    task: {
      select: {
        id: true,
        title: true,
        status: true,
        cantiere_id: true,
      },
    },
  };
}

function mapTimeEntry(entry) {
  return {
    ...entry,
    report_date: formatDateOnly(entry.report?.report_date),
  };
}

async function recalculateReportHours(tx, reportId) {
  const aggregate = await tx.reportEntry.aggregate({
    where: { report_id: reportId },
    _sum: { ore_lavorate: true },
  });

  await tx.report.update({
    where: { id: reportId },
    data: {
      ore_lavorate: aggregate._sum.ore_lavorate ?? null,
      data_utc: new Date(),
    },
  });
}

async function validateEntryLinks(prisma, { cantiereId, taskId, wbsNodeId }) {
  if (!(await ensureCantiereActive(prisma, cantiereId))) {
    return "Cantiere non trovato o inattivo.";
  }

  if (!(await ensureTaskBelongsToCantiere(prisma, taskId, cantiereId))) {
    return "Task non trovato o non collegato al cantiere selezionato.";
  }

  if (!(await ensureWbsBelongsToCantiere(prisma, wbsNodeId, cantiereId))) {
    return "Nodo WBS non trovato o non collegato al cantiere selezionato.";
  }

  return null;
}

export const createMyTimeEntry = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const employeeId = getAuthenticatedEmployeeId(req);
  if (!employeeId) {
    return res.status(400).json({ error: "Utente senza employee_id collegato." });
  }

  const {
    report_date,
    cantiere_id,
    task_id = null,
    wbs_node_id = null,
    ore_lavorate,
    ingresso = null,
    pausa_inizio = null,
    pausa_fine = null,
    uscita = null,
    attivita_svolte = null,
    luogo_cantiere = null,
    problemi_riscontrati = null,
  } = req.body;

  const cantiereId = Number(cantiere_id);
  const linkError = await validateEntryLinks(prisma, { cantiereId, taskId, wbsNodeId: wbs_node_id });
  if (linkError) return res.status(400).json({ error: linkError });

  const reportDate = parseDateOnly(report_date);
  const wbsNodeId = wbs_node_id ?? (await getRootWbsId(prisma, cantiereId));

  const entry = await prisma.$transaction(async (tx) => {
    const report = await tx.report.upsert({
      where: {
        employee_id_report_date: {
          employee_id: employeeId,
          report_date: reportDate,
        },
      },
      update: {
        data_utc: new Date(),
        cantiere_id: cantiereId,
        fonte: WEB_SOURCE,
        input_method: "web",
      },
      create: {
        data_utc: new Date(),
        report_date: reportDate,
        employee_id: employeeId,
        cantiere_id: cantiereId,
        stato_validazione: ValidationStatus.PENDING,
        fonte: WEB_SOURCE,
        input_method: "web",
      },
    });

    const created = await tx.reportEntry.create({
      data: {
        report_id: report.id,
        cantiere_id: cantiereId,
        wbs_node_id: wbsNodeId,
        task_id: task_id ?? null,
        ore_lavorate,
        ingresso,
        pausa_inizio,
        pausa_fine,
        uscita,
        attivita_svolte,
        luogo_cantiere,
        problemi_riscontrati,
        stato_validazione: ValidationStatus.PENDING,
        fonte: WEB_SOURCE,
      },
      include: buildEntryInclude(),
    });

    await recalculateReportHours(tx, report.id);
    return created;
  });

  res.status(201).json(mapTimeEntry(entry));
});

export const updateMyTimeEntry = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const employeeId = getAuthenticatedEmployeeId(req);
  if (!employeeId) {
    return res.status(400).json({ error: "Utente senza employee_id collegato." });
  }

  const entryId = Number(req.params.entryId);
  const existing = await prisma.reportEntry.findUnique({
    where: { id: entryId },
    include: buildEntryInclude(),
  });

  if (!existing) return res.status(404).json({ error: "Riga ore non trovata." });
  if (existing.report?.employee_id !== employeeId) {
    return res.status(403).json({ error: "Accesso negato: questa riga ore non appartiene all'utente." });
  }
  if (!isMutableStatus(existing.stato_validazione)) {
    return res.status(403).json({ error: "Le ore approvate non possono essere modificate." });
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "cantiere_id") && req.body.cantiere_id == null) {
    return res.status(400).json({ error: "Il cantiere non puo essere rimosso da una riga ore." });
  }

  const targetCantiereId = Number(req.body.cantiere_id ?? existing.cantiere_id);
  const targetTaskId = req.body.task_id !== undefined ? req.body.task_id : existing.task_id;
  const targetWbsNodeId = req.body.wbs_node_id !== undefined ? req.body.wbs_node_id : existing.wbs_node_id;
  const linkError = await validateEntryLinks(prisma, {
    cantiereId: targetCantiereId,
    taskId: targetTaskId,
    wbsNodeId: targetWbsNodeId,
  });
  if (linkError) return res.status(400).json({ error: linkError });

  const updateData = {};
  const allowed = [
    "cantiere_id",
    "task_id",
    "wbs_node_id",
    "ore_lavorate",
    "ingresso",
    "pausa_inizio",
    "pausa_fine",
    "uscita",
    "attivita_svolte",
    "luogo_cantiere",
    "problemi_riscontrati",
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }

  if (updateData.cantiere_id !== undefined) updateData.cantiere_id = targetCantiereId;
  if (updateData.task_id === "") updateData.task_id = null;
  if (updateData.wbs_node_id === "") updateData.wbs_node_id = null;
  if (updateData.cantiere_id !== undefined && updateData.wbs_node_id === undefined) {
    updateData.wbs_node_id = await getRootWbsId(prisma, targetCantiereId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.reportEntry.update({
      where: { id: entryId },
      data: updateData,
      include: buildEntryInclude(),
    });

    await recalculateReportHours(tx, existing.report_id);
    return row;
  });

  res.json(mapTimeEntry(updated));
});

export const deleteMyTimeEntry = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const employeeId = getAuthenticatedEmployeeId(req);
  if (!employeeId) {
    return res.status(400).json({ error: "Utente senza employee_id collegato." });
  }

  const entryId = Number(req.params.entryId);
  const existing = await prisma.reportEntry.findUnique({
    where: { id: entryId },
    include: {
      report: {
        select: {
          id: true,
          employee_id: true,
        },
      },
    },
  });

  if (!existing) return res.status(404).json({ error: "Riga ore non trovata." });
  if (existing.report?.employee_id !== employeeId) {
    return res.status(403).json({ error: "Accesso negato: questa riga ore non appartiene all'utente." });
  }
  if (!isMutableStatus(existing.stato_validazione)) {
    return res.status(403).json({ error: "Le ore approvate non possono essere eliminate." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.reportEntry.delete({ where: { id: entryId } });
    await recalculateReportHours(tx, existing.report_id);
  });

  res.json({ ok: true, entryId });
});
