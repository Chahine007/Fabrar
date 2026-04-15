import express from "express";
import bcrypt from "bcrypt";
import logger from "../logger.js";
import {
  listEmployees,
  listReportsWithEntries,
  getAuditLogs,
  getCantieriStatus,
  getAllCantieri,
  createCantiere,
  toggleCantiere,
  getDb,
  findUserByUsername,
  updateUserLastLogin,
  getReportEntryById,
  getReportById,
  updateReportEntry,
  employeeHasTariffa,
  listPricebook,
  insertSpesa,
  createTariffa,
  updateEmployee,
  updateReportHeader,
  updateSpesa,
  updateCantiere,
  formatDateOnly,
  parseDateOnly,
} from "../db/index.js";
import jwt from "jsonwebtoken";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { extractCVData } from "../services/openai.js";

const router = express.Router();
const MAX_DAILY_HOURS_ALERT = 12;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value) {
  if (typeof value !== "string") return null;
  return DATE_ONLY_RE.test(value) ? value : null;
}

function normalizeStatus(value, fallback = "pending") {
  return String(value ?? fallback).trim().toLowerCase();
}

function isRejectedStatus(value) {
  return normalizeStatus(value) === "rejected";
}

function isVerifiedStatus(value) {
  return normalizeStatus(value) === "verified";
}

function isPendingStatus(value, fallback = "pending") {
  return normalizeStatus(value, fallback) === "pending";
}

function toNumber(value) {
  if (value == null || value === "") return 0;
  return Number(value);
}

function toNullableNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function parseIdParam(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionalText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function isBlankText(value) {
  return normalizeOptionalText(value) == null;
}

function formatEmployeeName(employee, employeeId) {
  const fullName = [employee?.nome, employee?.cognome].filter(Boolean).join(" ").trim();
  return fullName || `Dipendente ${employeeId}`;
}

function getMonthKey(value) {
  const dateOnly = formatDateOnly(value);
  return dateOnly ? dateOnly.slice(0, 7) : null;
}

function parseImportedTimestamp(value) {
  if (!value) return new Date();

  if (typeof value === "string" && value.includes("/")) {
    const [day, month, year] = value.split("/");
    if (day && month && year) {
      return new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Timestamp non valido: ${value}`);
  }

  return parsed;
}

function resolveEntryStatus(entry) {
  return normalizeStatus(entry?.stato_validazione, "pending");
}

function resolveSpesaStatus(spesa) {
  return normalizeStatus(spesa?.stato_validazione ?? spesa?.status, "pending");
}

function isRejectedEntry(entry) {
  return isRejectedStatus(resolveEntryStatus(entry));
}

function isRejectedSpesa(spesa) {
  return isRejectedStatus(resolveSpesaStatus(spesa));
}

function isPendingEntry(entry) {
  return isPendingStatus(resolveEntryStatus(entry));
}

function isPendingSpesa(spesa) {
  return isPendingStatus(resolveSpesaStatus(spesa));
}

function isManualInput(...values) {
  return !values.some((value) => ["timer", "gps", "app"].includes(normalizeStatus(value, "")));
}

function getEntryHourlyCost(entry) {
  return toNumber(entry?.report?.employee?.tariffe?.[0]?.costo_orario);
}

function getEntryCost(entry) {
  return round2(toNumber(entry?.ore_lavorate) * getEntryHourlyCost(entry));
}

async function getPendingSummary(prisma) {
  const [reports, spese] = await Promise.all([
    prisma.reportEntry.count({
      where: {
        OR: [
          { stato_validazione: "" },
          { stato_validazione: { equals: "pending", mode: "insensitive" } },
        ],
      },
    }),
    prisma.spesa.findMany({
      select: {
        stato_validazione: true,
        status: true,
      },
    }),
  ]);

  return {
    reports,
    spese: spese.filter(isPendingSpesa).length,
  };
}

function mapAuditOreRow(entry) {
  return {
    id: entry.id,
    type: "ore",
    status: resolveEntryStatus(entry),
    input_method: normalizeOptionalText(entry.fonte) || normalizeOptionalText(entry.report?.input_method) || "manual",
    date: formatDateOnly(entry.report?.report_date),
    value: toNumber(entry.ore_lavorate),
    employee_id: entry.report?.employee_id,
    nome: entry.report?.employee?.nome || null,
    cognome: entry.report?.employee?.cognome || null,
    note: entry.attivita_svolte || null,
    cantiere_nome: entry.cantiere?.nome || entry.report?.cantiere?.nome || null,
    report_id: entry.report_id,
  };
}

function mapAuditSpesaRow(spesa) {
  return {
    id: spesa.id,
    type: "spese",
    status: resolveSpesaStatus(spesa),
    input_method: normalizeOptionalText(spesa.input_method) || normalizeOptionalText(spesa.fonte) || "manual",
    date: spesa.timestamp_utc,
    value: toNumber(spesa.importo),
    employee_id: spesa.employee_id,
    nome: spesa.employee?.nome || null,
    cognome: spesa.employee?.cognome || null,
    note: spesa.descrizione || null,
    cantiere_nome: spesa.cantiere?.nome || null,
  };
}

async function loadCantiereCostDataset(prisma, cantiereId) {
  const cantiere = await prisma.cantiere.findUnique({
    where: { id: Number(cantiereId) },
    include: {
      report_entries: {
        include: {
          report: {
            include: {
              employee: {
                include: {
                  tariffe: { orderBy: { valido_dal: "desc" }, take: 1 }
                }
              }
            }
          },
          cantiere: { select: { nome: true } },
        },
        orderBy: { id: "asc" }
      },
      spese: {
        include: { cantiere: { select: { nome: true } } },
        orderBy: { timestamp_utc: "asc" }
      }
    }
  });

  if (!cantiere) return null;

  const verifiedEntries = cantiere.report_entries.filter((entry) => isVerifiedStatus(entry.stato_validazione));
  const activeSpese = cantiere.spese.filter((spesa) => !isRejectedStatus(spesa.stato_validazione ?? spesa.status));

  return { cantiere, verifiedEntries, activeSpese };
}

router.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Username e password obbligatori." });
    }

    const user = await findUserByUsername(username);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    await updateUserLastLogin(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({ message: "Login effettuato", token });
  } catch (err) {
    logger.error({ err, event: "login_error" }, "login_error");
    return res.status(500).json({ error: "Errore durante il login." });
  }
});

router.get("/api/employees", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const rows = await listEmployees();
  res.json(rows);
});

router.get("/api/reports", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const normalizeDate = (value) => {
    if (typeof value !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  };
  const start = normalizeDate(req.query.start);
  const end = normalizeDate(req.query.end);

  const rows = await listReportsWithEntries({ start, end });
  res.json(rows);
});

// â”€â”€â”€ GET /api/pricebook â€” listino materiali (Policy 4.3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/api/pricebook", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const rows = await listPricebook();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Errore listino." });
  }
});

// â”€â”€â”€ POST /api/admin/spese/manual â€” spesa da ufficio (con pricebook opzionale) â”€
router.post("/api/admin/spese/manual", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const uploaderId = req.user?.employee_id;
    if (uploaderId == null || uploaderId === "") {
      return res.status(400).json({ error: "Utente senza employee_id collegato." });
    }
    const { cantiere_id, importo, fornitore, descrizione, pricebook_id, quantita, fonte } = req.body || {};
    const importoNum = typeof importo === "number" ? importo : parseFloat(String(importo), 10);
    if (!Number.isFinite(importoNum) || importoNum <= 0) {
      return res.status(400).json({ error: "Importo obbligatorio e > 0." });
    }
    if (!cantiere_id) {
      return res.status(400).json({ error: "cantiere_id obbligatorio." });
    }
    let extra = null;
    if (pricebook_id != null && pricebook_id !== "") {
      extra = {
        pricebook_id: Number(pricebook_id),
        quantita: quantita != null && quantita !== "" ? Number(quantita) : 1,
        stato_validazione: "PENDING",
      };
    }
    await insertSpesa(
      uploaderId,
      Number(cantiere_id),
      importoNum,
      fornitore || null,
      descrizione || null,
      fonte || "MANUAL_OFFICE",
      null,
      extra
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Errore inserimento spesa." });
  }
});

// â”€â”€â”€ PATCH /api/admin/entries/:id/approve | reject â€” righe report (Policy 4.2) â”€
router.patch("/api/admin/entries/:id/approve", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const entry = await getReportEntryById(id);
    if (!entry) return res.status(404).json({ error: "Riga non trovata." });
    const report = await getReportById(entry.report_id);
    if (!report) return res.status(404).json({ error: "Report non trovato." });
    if (!(await employeeHasTariffa(report.employee_id))) {
      return res.status(400).json({
        error: "Impossibile approvare: il dipendente non ha una tariffa oraria valida nel sistema (Policy 4.2).",
      });
    }
    await updateReportEntry(id, {
      stato_validazione: "VERIFIED",
      modified_by_admin_at: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore approvazione." });
  }
});

router.patch("/api/admin/entries/:id/reject", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const entry = await getReportEntryById(id);
    if (!entry) return res.status(404).json({ error: "Riga non trovata." });
    await updateReportEntry(id, {
      stato_validazione: "REJECTED",
      modified_by_admin_at: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore rifiuto." });
  }
});

router.get("/api/logs", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const rows = await getAuditLogs();
  res.json(rows);
});

// --- ROTTE CANTIERI (Alias per compatibilitÃ  frontend/cache) ---
router.get(["/api/cantieri", "/api/admin/cantieri"], verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const rows = await getAllCantieri();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Errore dal database" });
  }
});


router.post("/api/admin/cantieri", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { nome, indirizzo, lat, lng, budget } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome cantiere obbligatorio." });
    
    await createCantiere({
      nome, 
      indirizzo, 
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      budget: budget ? parseFloat(budget) : null
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la creazione del cantiere." });
  }
});

router.patch("/api/admin/cantieri/:id/toggle", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    await toggleCantiere(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il cambio stato del cantiere." });
  }
});
router.post("/api/admin/spese/bulk", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const { spese_bulk } = req.body;

  if (!Array.isArray(spese_bulk) || spese_bulk.length === 0) {
    return res.status(400).json({ error: "Nessuna spesa fornita." });
  }

  const uploaderEmployeeId = req.user?.employee_id;
  if (uploaderEmployeeId == null || uploaderEmployeeId === "") {
    return res.status(400).json({
      error: "Utente senza employee_id collegato: impossibile registrare l'import. Verificare il record users -> employees.",
    });
  }

  try {
    const prisma = getDb();
    const employeeId = Number(uploaderEmployeeId);

    await prisma.$transaction(async (tx) => {
      const rootWbsCache = new Map();

      for (const item of spese_bulk) {
        const importo = typeof item.importo === "number" ? item.importo : parseFloat(String(item.importo));
        if (!Number.isFinite(importo) || importo <= 0) {
          throw new Error("Tutti gli importi devono essere maggiori di zero.");
        }

        const cantiereId = parseIdParam(item.cantiere_id);
        if (!cantiereId) {
          throw new Error("Ogni spesa deve essere associata a un cantiere.");
        }

        const cantiere = await tx.cantiere.findFirst({
          where: { id: cantiereId, attivo: 1 },
          select: { id: true },
        });
        if (!cantiere) {
          throw new Error(`Cantiere non valido o inattivo: ${cantiereId}.`);
        }

        if (!rootWbsCache.has(cantiereId)) {
          const rootWbs = await tx.wbsNode.findFirst({
            where: { cantiere_id: cantiereId, parent_id: null },
            select: { id: true },
          });
          rootWbsCache.set(cantiereId, rootWbs?.id ?? null);
        }

        await tx.spesa.create({
          data: {
            timestamp_utc: parseImportedTimestamp(item.timestamp_utc),
            employee_id: employeeId,
            cantiere_id: cantiereId,
            wbs_node_id: rootWbsCache.get(cantiereId),
            importo,
            fornitore: normalizeOptionalText(item.fornitore),
            descrizione: normalizeOptionalText(item.descrizione),
            fonte: normalizeOptionalText(item.fonte) || "IMPORT",
            fattura_rif: normalizeOptionalText(item.fattura_rif),
            stato_validazione: "PENDING",
          },
        });
      }
    });

    res.json({ ok: true, salvate: spese_bulk.length });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore durante l'inserimento massivo" });
  }
});

router.get("/api/admin/employees/:id/timeline", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const employeeId = parseIdParam(req.params.id);
    if (!employeeId) {
      return res.status(400).json({ error: "ID dipendente non valido." });
    }

    const prisma = getDb();
    const [reports, logs, spese] = await Promise.all([
      prisma.report.findMany({
        where: { employee_id: employeeId },
        orderBy: { data_utc: "desc" },
      }),
      prisma.messageLog.findMany({
        where: { employee_id: employeeId },
        orderBy: { timestamp_utc: "desc" },
      }),
      prisma.spesa.findMany({
        where: {
          employee_id: employeeId,
          fonte: { equals: "TELEGRAM", mode: "insensitive" },
        },
        orderBy: { timestamp_utc: "desc" },
      }),
    ]);

    const timeline = [];

    reports.forEach((report) => {
      timeline.push({
        type: "REPORT",
        timestamp: report.data_utc || report.report_date,
        data: {
          ore: toNumber(report.ore_lavorate),
          cantiere_id: report.cantiere_id,
          note: report.attivita_svolte || report.testo_originale,
          report_date: formatDateOnly(report.report_date),
        },
      });
    });

    logs.forEach((log) => {
      timeline.push({
        type: "LOG",
        timestamp: log.timestamp_utc,
        data: {
          messaggio: log.raw_text,
          has_audio: log.message_type === "voice" || log.message_type === "audio",
        },
      });
    });

    spese.forEach((spesa) => {
      timeline.push({
        type: "EXPENSE",
        timestamp: spesa.timestamp_utc,
        data: {
          importo: toNumber(spesa.importo),
          cantiere_id: spesa.cantiere_id,
        },
      });
    });

    timeline.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });

    res.json(timeline.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: "Errore durante il fetch della timeline." });
  }
});

router.get("/api/hr/alerts", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const prisma = getDb();
    const pending = await getPendingSummary(prisma);

    const lastThirtyDays = new Date();
    lastThirtyDays.setDate(lastThirtyDays.getDate() - 30);

    const [entries, recentReports] = await Promise.all([
      prisma.reportEntry.findMany({
        where: {
          NOT: { stato_validazione: { in: ["rejected", "REJECTED"] } },
        },
        select: {
          ore_lavorate: true,
          report: {
            select: {
              employee_id: true,
              report_date: true,
              employee: { select: { nome: true, cognome: true } },
            },
          },
        },
      }),
      prisma.report.findMany({
        where: { report_date: { gte: parseDateOnly(formatDateOnly(lastThirtyDays)) } },
        include: { employee: { select: { nome: true, cognome: true } } },
        orderBy: [{ report_date: "desc" }, { id: "desc" }],
      }),
    ]);

    const groupedHours = new Map();
    for (const entry of entries) {
      const reportDate = formatDateOnly(entry.report?.report_date);
      if (!reportDate) continue;

      const key = `${entry.report?.employee_id}:${reportDate}`;
      const current = groupedHours.get(key) || {
        employee: entry.report?.employee,
        employee_id: entry.report?.employee_id,
        report_date: reportDate,
        total_hours: 0,
      };
      current.total_hours += toNumber(entry.ore_lavorate);
      groupedHours.set(key, current);
    }

    const anomalies = Array.from(groupedHours.values())
      .filter((row) => row.total_hours > MAX_DAILY_HOURS_ALERT)
      .sort((a, b) => b.total_hours - a.total_hours)
      .map((row) => {
        const name = formatEmployeeName(row.employee, row.employee_id);
        return `Il dipendente ${name} ha registrato ${round2(row.total_hours)}h il ${row.report_date}.`;
      });

    const warnings = [];
    for (const report of recentReports) {
      const name = formatEmployeeName(report.employee, report.employee_id);
      const reportDate = formatDateOnly(report.report_date);
      const note = normalizeOptionalText(report.attivita_svolte) || normalizeOptionalText(report.testo_originale);

      if (toNumber(report.ore_lavorate) > MAX_DAILY_HOURS_ALERT) {
        warnings.push({
          type: "ORE ELEVATE",
          name,
          text: `${round2(report.ore_lavorate)}h il ${reportDate}`,
        });
        continue;
      }

      if (isManualInput(report.input_method, report.fonte) && isBlankText(note)) {
        warnings.push({
          type: "NO NOTA",
          name,
          text: `Manuale senza nota il ${reportDate}`,
        });
      }
    }

    res.json({
      pending: {
        reports: pending.reports,
        spese: pending.spese,
        total: pending.reports + pending.spese,
      },
      anomalies,
      warnings,
    });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il recupero degli alerts." });
  }
});

router.get("/api/hr/users/:id/kpi", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const employeeId = parseIdParam(req.params.id);
    if (!employeeId) {
      return res.status(400).json({ error: "ID dipendente non valido." });
    }

    const prisma = getDb();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = parseDateOnly(`${month}-01`);
    const nextMonthStart = new Date(`${month}-01T00:00:00.000Z`);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

    const [entries, employeeSpese, tariffa] = await Promise.all([
      prisma.reportEntry.findMany({
        where: {
          NOT: { stato_validazione: { in: ["rejected", "REJECTED"] } },
          report: {
            is: {
              employee_id: employeeId,
              report_date: {
                gte: monthStart,
                lt: nextMonthStart,
              },
            },
          },
        },
        select: { ore_lavorate: true, fonte: true },
      }),
      prisma.spesa.findMany({
        where: { employee_id: employeeId },
        select: { stato_validazione: true, status: true },
      }),
      prisma.tariffa.findFirst({
        where: { employee_id: employeeId },
        orderBy: [{ valido_dal: "desc" }, { id: "desc" }],
      }),
    ]);

    const totalHours = round2(entries.reduce((sum, entry) => sum + toNumber(entry.ore_lavorate), 0));
    const inputStatsMap = new Map();
    for (const entry of entries) {
      const inputMethod = isManualInput(entry.fonte) ? "manual" : "timer";
      const current = inputStatsMap.get(inputMethod) || { input_method: inputMethod, count: 0, hours: 0 };
      current.count += 1;
      current.hours += toNumber(entry.ore_lavorate);
      inputStatsMap.set(inputMethod, current);
    }

    const inputStats = Array.from(inputStatsMap.values()).map((row) => ({
      ...row,
      hours: round2(row.hours),
    }));

    res.json({
      month,
      totalHours,
      inputStats,
      pendingSpese: employeeSpese.filter(isPendingSpesa).length,
      costo_orario: toNumber(tariffa?.costo_orario),
    });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il recupero dei KPI utente." });
  }
});

router.get("/api/hr/audit", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const prisma = getDb();
    const type = normalizeOptionalText(req.query.type);
    const status = normalizeOptionalText(req.query.status);
    const employeeId = req.query.employee_id != null && req.query.employee_id !== ""
      ? parseIdParam(req.query.employee_id)
      : null;

    if (req.query.employee_id != null && req.query.employee_id !== "" && !employeeId) {
      return res.status(400).json({ error: "employee_id non valido." });
    }

    const statusValue = status ? normalizeStatus(status) : null;
    let allData = [];

    if (!type || type === "ore") {
      const oreRows = await prisma.reportEntry.findMany({
        where: {
          ...(employeeId
            ? {
                report: {
                  is: { employee_id: employeeId },
                }, 
              }
            : {}),
          ...(statusValue
            ? statusValue === "pending"
              ? {}
              : { stato_validazione: { equals: statusValue, mode: "insensitive" } }
            : {}),
        },
        include: {
          report: {
            include: {
              employee: { select: { nome: true, cognome: true } },
              cantiere: { select: { nome: true } },
            },
          },
          cantiere: { select: { nome: true } },
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      });

      allData = allData.concat(
        oreRows
          .map(mapAuditOreRow)
          .filter((row) => (statusValue === "pending" ? row.status === "pending" : true))
      );
    }

    if (!type || type === "spese") {
      const speseRows = await prisma.spesa.findMany({
        where: {
          ...(employeeId ? { employee_id: employeeId } : {}),
          ...(statusValue
            ? statusValue === "pending"
              ? {}
              : {
                  OR: [
                    { stato_validazione: { equals: statusValue, mode: "insensitive" } },
                    { status: { equals: statusValue, mode: "insensitive" } },
                  ],
                }
            : {}),
        },
        include: {
          employee: { select: { nome: true, cognome: true } },
          cantiere: { select: { nome: true } },
        },
        orderBy: [{ timestamp_utc: "desc" }, { id: "desc" }],
      });

      allData = allData.concat(
        speseRows
          .map(mapAuditSpesaRow)
          .filter((row) => (statusValue === "pending" ? row.status === "pending" : true))
      );
    }

    allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(allData);
  } catch (err) {
    res.status(500).json({ error: "Errore durante il recupero audit." });
  }
});

function mapAuditStatusToDb(s) {
  const x = String(s || "").toLowerCase();
  if (x === "verified") return "VERIFIED";
  if (x === "rejected") return "REJECTED";
  if (x === "pending") return "PENDING";
  return String(s || "").toUpperCase();
}

router.put("/api/hr/audit/bulk", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const prisma = getDb();
  const iso = new Date().toISOString();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let items = Array.isArray(req.body?.items) ? req.body.items : null;

      if (!items) {
        const ids = Array.isArray(req.body?.ids)
          ? req.body.ids.map((value) => parseIdParam(value)).filter(Boolean)
          : null;
        const action = normalizeOptionalText(req.body?.action);

        if (!ids || ids.length === 0 || !action) {
          throw new Error("Formato non valido.");
        }

        const reportEntries = await tx.reportEntry.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });
        const spese = await tx.spesa.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });

        const reportEntryIds = new Set(reportEntries.map((row) => row.id));
        const spesaIds = new Set(spese.map((row) => row.id));
        const defaultStatus = action === "verify" ? "verified" : action === "reject" ? "rejected" : action;

        items = ids.map((id) => {
          const inReportEntries = reportEntryIds.has(id);
          const inSpese = spesaIds.has(id);

          if (inReportEntries && inSpese) {
            throw new Error(`ID ambiguo presente sia nelle ore sia nelle spese: ${id}`);
          }
          if (!inReportEntries && !inSpese) {
            throw new Error(`Voce audit non trovata: ${id}`);
          }

          return {
            id,
            type: inReportEntries ? "ore" : "spese",
            newStatus: defaultStatus,
          };
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Formato non valido.");
      }

      for (const rawItem of items) {
        const id = parseIdParam(rawItem.id);
        if (!id) {
          throw new Error("Elemento bulk non valido.");
        }

        const newSt = mapAuditStatusToDb(rawItem.newStatus);
        if (rawItem.type === "ore") {
          const entry = await tx.reportEntry.findUnique({
            where: { id },
            select: {
              report_id: true,
              report: { select: { employee_id: true } },
            },
          });

          if (!entry) {
            throw new Error(`Riga ore non trovata: ${id}`);
          }

          if (newSt === "VERIFIED") {
            const tariffaCount = await tx.tariffa.count({
              where: { employee_id: entry.report?.employee_id },
            });
            if (tariffaCount === 0) {
              throw new Error(
                "Impossibile approvare: il dipendente non ha una tariffa oraria valida nel sistema (Policy 4.2)."
              );
            }
          }

          await tx.reportEntry.update({
            where: { id },
            data: { stato_validazione: newSt, modified_by_admin_at: iso },
          });
          continue;
        }

        if (rawItem.type === "spese") {
          await tx.spesa.update({
            where: { id },
            data: {
              stato_validazione: newSt,
              status: newSt.toLowerCase(),
              modified_by_admin_at: iso,
            },
          });
          continue;
        }

        throw new Error(`Tipo audit non supportato: ${rawItem.type}`);
      }

      return items.length;
    });

    res.json({ success: true, count: result });
  } catch (err) {
    const statusCode = err.message === "Formato non valido." ? 400 : 500;
    res.status(statusCode).json({ error: err.message || "Errore durante il bulk update." });
  }
});

router.post("/api/hr/users/:id/cost", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const employeeId = parseIdParam(req.params.id);
    if (!employeeId) {
      return res.status(400).json({ error: "ID dipendente non valido." });
    }

    const costoOrario = toNullableNumber(req.body?.costo_orario);
    const validoDal = normalizeDate(req.body?.valido_dal);

    if (!Number.isFinite(costoOrario) || costoOrario <= 0 || !validoDal) {
      return res.status(400).json({ error: "costo_orario e valido_dal sono obbligatori." });
    }

    await createTariffa({
      employee_id: employeeId,
      costo_orario: costoOrario,
      valido_dal: validoDal,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore inserimento nuova tariffa." });
  }
});

router.patch("/api/admin/employees/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const employeeId = parseIdParam(req.params.id);
    if (!employeeId) {
      return res.status(400).json({ error: "ID dipendente non valido." });
    }

    const fields = {};
    const textFields = ["nome", "cognome", "ruolo", "telefono", "skills", "note_admin", "documenti"];
    for (const key of textFields) {
      if (req.body[key] !== undefined) {
        fields[key] = normalizeOptionalText(req.body[key]);
      }
    }

    if (req.body.attivo !== undefined) {
      const attivo = Number(req.body.attivo);
      if (!Number.isFinite(attivo)) {
        return res.status(400).json({ error: "Valore attivo non valido." });
      }
      fields.attivo = attivo;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }

    await updateEmployee(employeeId, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento dipendente." });
  }
});

router.patch("/api/hr/reports/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const reportId = parseIdParam(req.params.id);
    if (!reportId) {
      return res.status(400).json({ error: "ID report non valido." });
    }

    const fields = {};

    if (req.body.ore_lavorate !== undefined) {
      const oreLavorate = toNullableNumber(req.body.ore_lavorate);
      if (oreLavorate == null || oreLavorate < 0) {
        return res.status(400).json({ error: "ore_lavorate non valido." });
      }
      fields.ore_lavorate = oreLavorate;
    }

    if (req.body.report_date !== undefined) {
      const reportDate = normalizeDate(req.body.report_date);
      if (!reportDate) {
        return res.status(400).json({ error: "report_date non valido." });
      }
      fields.report_date = reportDate;
    }

    if (req.body.cantiere_id !== undefined) {
      if (req.body.cantiere_id === "" || req.body.cantiere_id === null) {
        fields.cantiere_id = null;
      } else {
        const cantiereId = parseIdParam(req.body.cantiere_id);
        if (!cantiereId) {
          return res.status(400).json({ error: "cantiere_id non valido." });
        }
        fields.cantiere_id = cantiereId;
      }
    }

    if (req.body.attivita_svolte !== undefined) fields.attivita_svolte = normalizeOptionalText(req.body.attivita_svolte);
    if (req.body.luogo_cantiere !== undefined) fields.luogo_cantiere = normalizeOptionalText(req.body.luogo_cantiere);
    if (req.body.admin_note !== undefined) fields.admin_note = normalizeOptionalText(req.body.admin_note);

    if (req.body.status !== undefined) {
      const statusValue = normalizeOptionalText(req.body.status);
      fields.status = statusValue ? normalizeStatus(statusValue, statusValue) : null;
      fields.stato_validazione = statusValue ? mapAuditStatusToDb(statusValue) : null;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }

    fields.modified_by_admin_at = new Date().toISOString();
    await updateReportHeader(reportId, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento report." });
  }
});

router.patch("/api/hr/spese/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const spesaId = parseIdParam(req.params.id);
    if (!spesaId) {
      return res.status(400).json({ error: "ID spesa non valido." });
    }

    const fields = {};

    if (req.body.importo !== undefined) {
      const importo = toNullableNumber(req.body.importo);
      if (!Number.isFinite(importo) || importo <= 0) {
        return res.status(400).json({ error: "Importo non valido." });
      }
      fields.importo = importo;
    }

    if (req.body.cantiere_id !== undefined) {
      const cantiereId = parseIdParam(req.body.cantiere_id);
      if (!cantiereId) {
        return res.status(400).json({ error: "cantiere_id non valido." });
      }
      fields.cantiere_id = cantiereId;
    }

    if (req.body.fornitore !== undefined) fields.fornitore = normalizeOptionalText(req.body.fornitore);
    if (req.body.descrizione !== undefined) fields.descrizione = normalizeOptionalText(req.body.descrizione);
    if (req.body.admin_note !== undefined) fields.admin_note = normalizeOptionalText(req.body.admin_note);

    if (req.body.status !== undefined) {
      const statusValue = normalizeOptionalText(req.body.status);
      fields.status = statusValue ? normalizeStatus(statusValue, statusValue) : null;
      fields.stato_validazione = statusValue ? mapAuditStatusToDb(statusValue) : null;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }

    fields.modified_by_admin_at = new Date().toISOString();
    await updateSpesa(spesaId, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento spesa." });
  }
});

router.patch("/api/admin/cantieri/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) {
      return res.status(400).json({ error: "ID cantiere non valido." });
    }

    const fields = {};

    if (req.body.nome !== undefined) {
      const nome = normalizeOptionalText(req.body.nome);
      if (!nome) {
        return res.status(400).json({ error: "Nome cantiere obbligatorio." });
      }
      fields.nome = nome;
    }

    if (req.body.indirizzo !== undefined) fields.indirizzo = normalizeOptionalText(req.body.indirizzo);
    if (req.body.lat !== undefined) fields.lat = toNullableNumber(req.body.lat);
    if (req.body.lng !== undefined) fields.lng = toNullableNumber(req.body.lng);
    if (req.body.budget !== undefined) fields.budget = toNullableNumber(req.body.budget);

    if (req.body.raggio_tolleranza !== undefined) {
      const raggio = toNullableNumber(req.body.raggio_tolleranza);
      if (!Number.isFinite(raggio) || raggio < 0) {
        return res.status(400).json({ error: "raggio_tolleranza non valido." });
      }
      fields.raggio_tolleranza = raggio;
    }

    if (req.body.attivo !== undefined) {
      const attivo = Number(req.body.attivo);
      if (!Number.isFinite(attivo)) {
        return res.status(400).json({ error: "Valore attivo non valido." });
      }
      fields.attivo = attivo;
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }

    await updateCantiere(cantiereId, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento cantiere." });
  }
});

router.get("/api/cantieri/:id/financial-timeline", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) {
      return res.status(400).json({ error: "ID cantiere non valido." });
    }

    const dataset = await loadCantiereCostDataset(getDb(), cantiereId);
    if (!dataset) {
      return res.status(404).json({ error: "Cantiere non trovato." });
    }

    const byMonth = {};

    for (const entry of dataset.verifiedEntries) {
      const month = getMonthKey(entry.report?.report_date);
      if (!month) continue;
      byMonth[month] = round2((byMonth[month] || 0) + getEntryCost(entry));
    }

    for (const spesa of dataset.activeSpese) {
      const month = getMonthKey(spesa.timestamp_utc);
      if (!month) continue;
      byMonth[month] = round2((byMonth[month] || 0) + toNumber(spesa.importo));
    }

    const months = Object.keys(byMonth).sort();
    let cumulative = 0;
    const costoPerMese = months.map((month) => round2(byMonth[month] || 0));
    const costoReale = costoPerMese.map((value) => {
      cumulative = round2(cumulative + value);
      return cumulative;
    });

    res.json({
      nome: dataset.cantiere.nome,
      budget: toNumber(dataset.cantiere.budget),
      raggio_tolleranza: dataset.cantiere.raggio_tolleranza || 300,
      months,
      costoReale,
      costoPerMese,
    });
  } catch (err) {
    res.status(500).json({ error: "Errore financial timeline: " + err.message });
  }
});

router.get("/api/cantieri/:id/details", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) {
      return res.status(400).json({ error: "ID cantiere non valido." });
    }

    const dataset = await loadCantiereCostDataset(getDb(), cantiereId);
    if (!dataset) {
      return res.status(404).json({ error: "Cantiere non trovato." });
    }

    const costoManodopera = round2(dataset.verifiedEntries.reduce((sum, entry) => sum + getEntryCost(entry), 0));
    const costoMateriali = round2(dataset.activeSpese.reduce((sum, spesa) => sum + toNumber(spesa.importo), 0));
    const costoTotale = round2(costoManodopera + costoMateriali);
    const budget = toNumber(dataset.cantiere.budget);
    const margine = round2(budget - costoTotale);

    const perDipendenteMap = new Map();
    for (const entry of dataset.verifiedEntries) {
      const employeeId = entry.report?.employee_id;
      if (!employeeId) continue;

      const current = perDipendenteMap.get(employeeId) || {
        nome: entry.report?.employee?.nome || null,
        cognome: entry.report?.employee?.cognome || null,
        ore_tot: 0,
        costo_calcolato: 0,
        ultimo_accesso: null,
      };

      current.ore_tot += toNumber(entry.ore_lavorate);
      current.costo_calcolato += getEntryCost(entry);

      const reportDate = formatDateOnly(entry.report?.report_date);
      if (reportDate && (!current.ultimo_accesso || reportDate > current.ultimo_accesso)) {
        current.ultimo_accesso = reportDate;
      }

      perDipendenteMap.set(employeeId, current);
    }

    const perDipendente = Array.from(perDipendenteMap.values())
      .map((row) => ({
        ...row,
        ore_tot: round2(row.ore_tot),
        costo_calcolato: round2(row.costo_calcolato),
      }))
      .sort((a, b) => b.ore_tot - a.ore_tot);

    const mesiAttiviSet = new Set(
      dataset.verifiedEntries
        .map((entry) => getMonthKey(entry.report?.report_date))
        .filter(Boolean)
    );
    const nMesi = Math.max(mesiAttiviSet.size, 1);
    const burnRate = round2(costoTotale / nMesi);

    const { report_entries: _entries, spese: _spese, ...cantiere } = dataset.cantiere;

    res.json({
      cantiere: {
        ...cantiere,
        budget,
      },
      kpi: {
        budget,
        costoTotale,
        costoManodopera,
        costoMateriali,
        margine,
        burnRate,
        nMesi,
      },
      perDipendente,
    });
  } catch (err) {
    res.status(500).json({ error: "Errore details cantiere: " + err.message });
  }
});

router.post("/api/admin/employees/parse-cv", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const body = req.body || {};
    const text = body.text;
    logger.info({ event: "parse_cv_request", contentType: req.headers["content-type"], bodyKeys: Object.keys(body), textLen: text?.length || 0 }, "parse_cv_request");
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return res.status(400).json({ 
        error: "Testo CV troppo corto o mancante (minimo 20 caratteri).",
        debug: { bodyKeys: Object.keys(body), textType: typeof text, textLen: text?.length || 0, contentType: req.headers["content-type"] }
      });
    }
    const result = await extractCVData(text.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Errore AI nell'analisi del CV: " + (err.message || "sconosciuto") });
  }
});

// â”€â”€â”€ GET /api/dashboard/radar â€” KPI aggregati per Radar Aziendale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/api/dashboard/radar", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const prisma = getDb();
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);

    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);

    const lastSunday = new Date(monday);
    lastSunday.setDate(monday.getDate() - 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const mondayStr = formatDateOnly(monday);
    const lastMondayStr = formatDateOnly(lastMonday);
    const lastSundayStr = formatDateOnly(lastSunday);
    const sevenDaysAgoStr = formatDateOnly(sevenDaysAgo);

    const [cantieriRaw, pending, weekEntries, activeEntries] = await Promise.all([
      getCantieriStatus(),
      getPendingSummary(prisma),
      prisma.reportEntry.findMany({
        where: {
          NOT: { stato_validazione: { in: ["rejected", "REJECTED"] } },
          report: {
            is: {
              report_date: { gte: parseDateOnly(lastMondayStr) },
            },
          },
        },
        select: {
          ore_lavorate: true,
          report: { select: { report_date: true, employee_id: true } },
        },
      }),
      prisma.reportEntry.findMany({
        where: {
          NOT: { stato_validazione: { in: ["rejected", "REJECTED"] } },
          report: {
            is: {
              report_date: { gte: parseDateOnly(sevenDaysAgoStr) },
            },
          },
        },
        select: {
          report: { select: { employee_id: true } },
        },
      }),
    ]);

    const cantieri = cantieriRaw.map((cantiere) => {
      const pct = cantiere.budget > 0 ? cantiere.costo_totale / cantiere.budget : null;
      let status = "gray";
      if (pct !== null) {
        if (pct < 0.75) status = "green";
        else if (pct <= 0.9) status = "amber";
        else status = "red";
      }
      return {
        id: cantiere.id,
        nome: cantiere.nome,
        budget: cantiere.budget,
        costo: round2(cantiere.costo_totale),
        pct,
        status,
      };
    });

    let currentWeekHours = 0;
    let lastWeekHours = 0;
    for (const entry of weekEntries) {
      const reportDate = formatDateOnly(entry.report?.report_date);
      if (!reportDate) continue;

      const hours = toNumber(entry.ore_lavorate);
      if (reportDate >= mondayStr) {
        currentWeekHours += hours;
      } else if (reportDate >= lastMondayStr && reportDate <= lastSundayStr) {
        lastWeekHours += hours;
      }
    }

    const activeWorkers = new Set(
      activeEntries
        .map((entry) => entry.report?.employee_id)
        .filter(Boolean)
    );

    res.json({
      cantieri,
      pending: { reports: pending.reports, spese: pending.spese },
      oreSettimana: {
        corrente: round2(currentWeekHours),
        scorsa: round2(lastWeekHours),
      },
      operaiAttivi: activeWorkers.size,
    });
  } catch (err) {
    res.status(500).json({ error: "Errore radar: " + err.message });
  }
});

router.get("/api/cantieri/status", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const rows = await getCantieriStatus({ activeOnly: false });
    const map = {};
    rows.forEach((row) => {
      map[row.id] = { costo_totale: round2(row.costo_totale) };
    });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Errore calcolo status cantieri: " + err.message });
  }
});

router.patch("/api/hr/report-entries/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { ore_lavorate, attivita_svolte, admin_note, cantiere_id } = req.body || {};
    const fields = {};
    if (ore_lavorate !== undefined && ore_lavorate !== null) fields.ore_lavorate = parseFloat(ore_lavorate);
    if (attivita_svolte !== undefined) fields.attivita_svolte = attivita_svolte;
    if (admin_note !== undefined) fields.admin_note = admin_note;
    if (cantiere_id !== undefined) {
      fields.cantiere_id = cantiere_id === "" || cantiere_id === null ? null : Number(cantiere_id);
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }
    fields.modified_by_admin_at = new Date().toISOString();
    await updateReportEntry(id, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore modifica riga report." });
  }
});

// â”€â”€â”€ GET /api/admin/pending-summary â€” Conteggio approvazioni pendenti â”€â”€â”€â”€â”€â”€â”€â”€
router.get("/api/admin/pending-summary", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const pending = await getPendingSummary(getDb());
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: "Errore pending summary: " + err.message });
  }
});

export default router;







