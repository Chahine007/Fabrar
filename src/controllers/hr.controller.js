import pkg from "@prisma/client";
import {
    getDb,
    createTariffa,
    updateReportEntry as dbUpdateReportEntry,
    updateSpesa as dbUpdateSpesa,
    listReportsWithEntries as dbListReportsWithEntries,
    getAuditLogs as dbGetAuditLogs,
    updateReportHeader,
    updateSpesa,
    updateReportEntry,
    formatDateOnly,
    parseDateOnly,
} from "../db/index.js";
import {
    isPendingSpesa,
    isManualInput,
    isBlankText,
    normalizeOptionalText,
    round2,
    toNumber,
    normalizeStatus,
    resolveEntryStatus,
    resolveSpesaStatus,
    formatEmployeeName,
    parseIdParam,
} from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AUDIT_TYPE, LIMITS, ValidationStatus } from "../constants.js";
import { bulkUpdateItems } from "../domain/hr/auditService.js";
import { domainBus, EVENTS } from "../domain/events/domainBus.js";
import { parsePagination } from "../utils/pagination.js";

const { Prisma } = pkg;
const MAX_DAILY_HOURS_ALERT = LIMITS.MAX_DAILY_HOURS_ALERT;

export async function getPendingSummary(prisma) {
    const [reports, spese] = await Promise.all([
        prisma.reportEntry.count({
            where: {
                stato_validazione: ValidationStatus.PENDING,
            },
        }),
        prisma.spesa.count({
            where: {
                stato_validazione: ValidationStatus.PENDING,
            },
        }),
    ]);

    return {
        reports,
        spese,
    };
}

function mapAuditOreRow(entry) {
    return {
        id: entry.id,
        type: AUDIT_TYPE.ORE,
        // Lowercase per uniformità col frontend (AuditStatus type)
        status: resolveEntryStatus(entry).toLowerCase(),
        input_method: normalizeOptionalText(entry.fonte) || normalizeOptionalText(entry.report?.input_method) || "manual",
        date: formatDateOnly(entry.report?.report_date),
        value: toNumber(entry.ore_lavorate),
        employee_id: entry.report?.employee_id,
        nome: entry.report?.employee?.nome || null,
        cognome: entry.report?.employee?.cognome || null,
        note: entry.attivita_svolte || null,
        // Priorità: cantiere diretto sull'entry → cantiere del report header → null
        cantiere_nome: entry.cantiere?.nome || entry.report?.cantiere?.nome || entry.luogo_cantiere || null,
        cantiere_id:   entry.cantiere_id || entry.report?.cantiere_id || null,
        task_id: entry.task_id ?? null,
        task_title: entry.task?.title ?? null,
        luogo_cantiere: entry.luogo_cantiere || null,
        report_id: entry.report_id,
    };
}

function resolveSpesaInputMethod(spesa) {
    const fonte = normalizeOptionalText(spesa.fonte);
    const inputMethod = normalizeOptionalText(spesa.input_method);
    const normalizedFonte = String(fonte ?? "").toLowerCase();

    if (normalizedFonte.includes("genya") || normalizedFonte.includes("genia") || normalizedFonte.includes("import")) {
        return fonte;
    }

    return inputMethod || fonte || "manual";
}

function mapAuditSpesaRow(spesa) {
    return {
        id: spesa.id,
        type: AUDIT_TYPE.SPESE,
        // Lowercase per uniformità col frontend (AuditStatus type)
        status: resolveSpesaStatus(spesa).toLowerCase(),
        input_method: resolveSpesaInputMethod(spesa),
        date: spesa.timestamp_utc,
        value: toNumber(spesa.importo),
        employee_id: spesa.employee_id,
        nome: spesa.employee?.nome || null,
        cognome: spesa.employee?.cognome || null,
        fornitore: spesa.fornitore || null,
        note: spesa.descrizione || null,
        cantiere_nome: spesa.cantiere?.nome || null,
        cantiere_id:   spesa.cantiere_id || null,
        task_id: spesa.task_id ?? null,
        task_title: spesa.task?.title ?? null,
        documento_id: spesa.documento_id ?? null,
        documento_nome: spesa.documento?.name ?? null,
        logistica_status: spesa.logistica_status ?? null,
        ocr_payload: spesa.ocr_payload ?? null,
        ocr_reviewed_at: spesa.ocr_reviewed_at ?? null,
        movimenti_magazzino_count: spesa.documento?._count?.movimenti_magazzino ?? 0,
    };
}

export const getAlerts = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const pending = await getPendingSummary(prisma);

    const lastThirtyDays = new Date();
    lastThirtyDays.setDate(lastThirtyDays.getDate() - 30);

    const since = parseDateOnly(formatDateOnly(lastThirtyDays));
    const [dailyHourRows, recentReports] = await Promise.all([
        prisma.$queryRaw(
            Prisma.sql`
                SELECT
                    r.employee_id,
                    r.report_date,
                    e.nome,
                    e.cognome,
                    COALESCE(SUM(COALESCE(re.ore_lavorate, 0)), 0) AS total_hours
                FROM "ReportEntry" re
                INNER JOIN "Report" r ON r.id = re.report_id
                LEFT JOIN "Employee" e ON e.id = r.employee_id
                WHERE r.report_date >= ${since}
                  AND re.stato_validazione <> ${ValidationStatus.REJECTED}
                GROUP BY r.employee_id, r.report_date, e.nome, e.cognome
                HAVING COALESCE(SUM(COALESCE(re.ore_lavorate, 0)), 0) > ${MAX_DAILY_HOURS_ALERT}
                ORDER BY total_hours DESC
            `
        ),
        prisma.report.findMany({
            where: { report_date: { gte: since } },
            include: { employee: { select: { nome: true, cognome: true } } },
            orderBy: [{ report_date: "desc" }, { id: "desc" }],
        }),
    ]);

    const anomalies = dailyHourRows
        .map((row) => {
            const name = formatEmployeeName({ nome: row.nome, cognome: row.cognome }, row.employee_id);
            return `Il dipendente ${name} ha registrato ${round2(toNumber(row.total_hours))}h il ${formatDateOnly(row.report_date)}.`;
        });

    const warnings = [];
    for (const report of recentReports) {
        const name = formatEmployeeName(report.employee, report.employee_id);
        const reportDate = formatDateOnly(report.report_date);
        const note = normalizeOptionalText(report.attivita_svolte) || normalizeOptionalText(report.testo_originale);

        if (toNumber(report.ore_lavorate) > MAX_DAILY_HOURS_ALERT) {
            warnings.push({ type: "ORE ELEVATE", name, text: `${round2(report.ore_lavorate)}h il ${reportDate}` });
            continue;
        }

        if (isManualInput(report.input_method, report.fonte) && isBlankText(note)) {
            warnings.push({ type: "NO NOTA", name, text: `Manuale senza nota il ${reportDate}` });
        }
    }

    res.json({
        pending: { reports: pending.reports, spese: pending.spese, total: pending.reports + pending.spese },
        anomalies,
        warnings,
    });
});

// ─── Employees with KPIs ──────────────────────────────────────────────────────

/**
 * Restituisce la lista di tutti gli Employee con:
 *   - tariffa corrente (costo_orario)
 *   - ore_mese: totale ore approvate nell'ultimo mese
 *   - costo_mese: ore_mese * costo_orario
 */
export const getEmployeesWithKPIs = asyncHandler(async (req, res) => {
    const prisma = getDb();

    const now          = new Date();
    const monthStart   = parseDateOnly(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    const nextMonth    = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    // Carica tutti gli employee con tariffa corrente e report del mese
    const employees = await prisma.employee.findMany({
        orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
        include: {
            tariffe: {
                orderBy: { valido_dal: 'desc' },
                take: 1,
            },
            reports: {
                where: { report_date: { gte: monthStart, lt: nextMonth } },
                include: {
                    entries: {
                        where: {
                            stato_validazione: { in: [ValidationStatus.APPROVED] },
                        },
                        select: { ore_lavorate: true },
                    },
                },
            },
        },
    });

    const result = employees.map((emp) => {
        const tariffa     = emp.tariffe[0] ?? null;
        const costoOrario = toNumber(tariffa?.costo_orario);

        const oreMese = round2(
            emp.reports.flatMap((r) => r.entries)
                       .reduce((sum, e) => sum + toNumber(e.ore_lavorate), 0)
        );

        return {
            id:          emp.id,
            nome:        emp.nome,
            cognome:     emp.cognome,
            ruolo:       emp.ruolo,
            telegram_id: emp.telegram_id,
            telefono:         emp.telefono ?? emp.telefono_personale ?? null,
            email_personale:  emp.email_personale ?? null,
            dipartimento:     emp.dipartimento ?? null,
            data_assunzione:  emp.data_assunzione ?? null,
            costo_orario: costoOrario,
            ore_mese:     oreMese,
            costo_mese:   round2(oreMese * costoOrario),
        };
    });

    res.json(result);
});

// ─── Employee Detail ──────────────────────────────────────────────────────────

/**
 * GET /api/hr/employees/:id
 * Restituisce l'intero record del dipendente con tariffa corrente e KPI globali.
 */
export const getEmployeeDetail = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const prisma = getDb();

    const emp = await prisma.employee.findUnique({
        where: { id },
        include: {
            tariffe: { orderBy: { valido_dal: 'desc' }, take: 1 },
            reports: {
                include: {
                    entries: {
                        where: { stato_validazione: ValidationStatus.APPROVED },
                        select: { ore_lavorate: true },
                    },
                },
            },
        },
    });

    if (!emp) return res.status(404).json({ error: 'Dipendente non trovato.' });

    const tariffa      = emp.tariffe[0] ?? null;
    const costoOrario  = toNumber(tariffa?.costo_orario);
    const oreTotali    = round2(emp.reports.flatMap(r => r.entries).reduce((s, e) => s + toNumber(e.ore_lavorate), 0));
    const costoTotale  = round2(oreTotali * costoOrario);

    // Rimuovi campi interni / relazioni pesanti prima di serializzare
    const { reports, tariffe, pending_json, pending_text, pending_date, pending_report_date, ...employeeData } = emp;

    res.json({
        ...employeeData,
        telegram_id: employeeData.telegram_id?.toString() ?? null,
        chat_id:     employeeData.chat_id?.toString() ?? null,
        costo_orario: costoOrario,
        valido_dal:   tariffa?.valido_dal ?? null,
        ore_totali:   oreTotali,
        costo_totale: costoTotale,
    });
});

// ─── Generate CV (JSON) ───────────────────────────────────────────────────────

/**
 * GET /api/hr/employees/:id/cv
 * Restituisce un JSON strutturato con i dati dell'employee formattati per un CV.
 */
export const generateEmployeeCV = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const prisma = getDb();

    const emp = await prisma.employee.findUnique({
        where: { id },
        include: {
            tariffe: { orderBy: { valido_dal: 'desc' }, take: 1 },
            reports: {
                include: {
                    entries: {
                        where: { stato_validazione: ValidationStatus.APPROVED },
                        include: { cantiere: { select: { nome: true } } },
                    },
                },
            },
        },
    });

    if (!emp) return res.status(404).json({ error: 'Dipendente non trovato.' });

    // Cantieri unici su cui ha lavorato
    const cantieriLavorati = [...new Set(
        emp.reports.flatMap(r => r.entries)
            .filter(e => e.cantiere?.nome)
            .map(e => e.cantiere.nome)
    )];

    const oreTotali = round2(
        emp.reports.flatMap(r => r.entries)
                   .reduce((s, e) => s + toNumber(e.ore_lavorate), 0)
    );

    // Competenze: prova JSON, fallback su skills stringa
    let competenze = [];
    if (emp.competenze) {
        try { competenze = Array.isArray(emp.competenze) ? emp.competenze : JSON.parse(emp.competenze); } catch { competenze = []; }
    } else if (emp.skills) {
        competenze = emp.skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    res.json({
        generato_il: new Date().toISOString(),
        anagrafica: {
            nome:              emp.nome,
            cognome:           emp.cognome,
            codice_fiscale:    emp.codice_fiscale ?? null,
            data_nascita:      emp.data_nascita ?? null,
            indirizzo:         [emp.indirizzo, emp.cap, emp.citta].filter(Boolean).join(', ') || null,
            telefono:          emp.telefono ?? emp.telefono_personale ?? null,
            email:             emp.email_personale ?? null,
        },
        professionale: {
            ruolo:             emp.ruolo ?? 'Operaio',
            dipartimento:      emp.dipartimento ?? null,
            data_assunzione:   emp.data_assunzione ?? null,
            tariffa_oraria:    toNumber(emp.tariffe[0]?.costo_orario),
        },
        competenze,
        esperienza: {
            ore_totali_lavorate: oreTotali,
            cantieri_lavorati:   cantieriLavorati,
        },
    });
});

// ─── Update Employee (anagrafica) ─────────────────────────────────────────────

/**
 * PATCH /api/hr/employees/:id
 * Aggiorna i campi anagrafici di un dipendente.
 */
export const updateEmployeeCtrl = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const prisma = getDb();

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Dipendente non trovato.' });

    // Whitelist campi modificabili
    const allowed = [
        'nome', 'cognome', 'ruolo', 'telefono', 'skills', 'note_admin',
        'codice_fiscale', 'indirizzo', 'citta', 'cap',
        'telefono_personale', 'email_personale', 'dipartimento',
    ];
    const dateFields = ['data_nascita', 'data_assunzione'];

    const data = {};
    for (const k of allowed) {
        if (req.body[k] !== undefined) {
            data[k] = req.body[k] === '' ? null : req.body[k];
        }
    }
    for (const k of dateFields) {
        if (req.body[k] !== undefined) {
            data[k] = req.body[k] ? parseDateOnly(req.body[k]) : null;
        }
    }
    // Competenze: accetta array o stringa CSV
    if (req.body.competenze !== undefined) {
        const val = req.body.competenze;
        if (Array.isArray(val)) {
            data.competenze = val;
        } else if (typeof val === 'string') {
            data.competenze = val.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            data.competenze = null;
        }
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nessun campo valido fornito.' });
    }

    await prisma.employee.update({ where: { id }, data });

    res.json({ ok: true, updated: Object.keys(data) });
});

export const getUserKpi = asyncHandler(async (req, res) => {
    const employeeId = req.params.id; // Validato da Zod

    const prisma = getDb();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = parseDateOnly(`${month}-01`);
    const nextMonthStart = new Date(`${month}-01T00:00:00.000Z`);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

    const [entries, pendingSpese, tariffa] = await Promise.all([
        prisma.reportEntry.findMany({
            where: { NOT: { stato_validazione: ValidationStatus.REJECTED }, report: { is: { employee_id: Number(employeeId), report_date: { gte: monthStart, lt: nextMonthStart } } } },
            select: { ore_lavorate: true, fonte: true },
        }),
        prisma.spesa.count({
            where: { employee_id: Number(employeeId), stato_validazione: ValidationStatus.PENDING },
        }),
        prisma.tariffa.findFirst({
            where: { employee_id: Number(employeeId) },
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

    const inputStats = Array.from(inputStatsMap.values()).map((row) => ({ ...row, hours: round2(row.hours) }));

    res.json({
        month,
        totalHours,
        inputStats,
        pendingSpese,
        costo_orario: toNumber(tariffa?.costo_orario),
    });
});

export const getAudit = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const { type, status, employee_id, cantiere_id, from, to } = req.query; // Validati da Zod
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });
    const pageWindow = limit + offset;

    const isPrivilegedRole = req.user?.role === "ADMIN" || req.user?.role === "HR";
    const scopedEmployeeId = !isPrivilegedRole ? parseIdParam(req.user?.employee_id) : null;
    if (!isPrivilegedRole && scopedEmployeeId == null) {
        return res.status(403).json({ error: "Accesso negato: privilegi insufficienti" });
    }
    const employeeId  = scopedEmployeeId ?? (employee_id ? Number(employee_id) : null);
    const cantiereId  = cantiere_id  ? Number(cantiere_id)  : null;
    const statusValue = status ? normalizeStatus(status) : null;
    const fromDate = from ? parseDateOnly(from) : null;
    const toDate = to ? parseDateOnly(to) : null;
    let allData = [];

    if (!type || type === AUDIT_TYPE.ORE) {
        const oreRows = await prisma.reportEntry.findMany({
            where: {
                ...(employeeId ? { report: { is: { employee_id: employeeId } } } : {}),
                ...(cantiereId ? {
                    OR: [
                        { cantiere_id: cantiereId },
                        { report: { is: { cantiere_id: cantiereId } } },
                    ],
                } : {}),
                ...(statusValue ? { stato_validazione: statusValue } : {}),
                ...((fromDate || toDate) ? {
                    report: {
                        is: {
                            ...(employeeId ? { employee_id: employeeId } : {}),
                            report_date: {
                                ...(fromDate ? { gte: fromDate } : {}),
                                ...(toDate ? { lte: toDate } : {}),
                            },
                        },
                    },
                } : {}),
            },
            include: {
                report: { include: { employee: { select: { nome: true, cognome: true } }, cantiere: { select: { nome: true } } } },
                cantiere: { select: { nome: true } },
                task: { select: { id: true, title: true } },
            },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            take: pageWindow,
        });

        allData = allData.concat(oreRows.map(mapAuditOreRow));
    }

    if (!type || type === AUDIT_TYPE.SPESE) {
        const speseRows = await prisma.spesa.findMany({
            where: {
                ...(employeeId  ? { employee_id: employeeId }  : {}),
                ...(cantiereId  ? { cantiere_id: cantiereId }  : {}),
                ...(statusValue ? { stato_validazione: statusValue } : {}),
                ...((fromDate || toDate) ? {
                    timestamp_utc: {
                        ...(fromDate ? { gte: fromDate } : {}),
                        ...(toDate ? { lte: toDate } : {}),
                    },
                } : {}),
            },
            include: {
                employee: { select: { nome: true, cognome: true } },
                cantiere: { select: { nome: true } },
                task: { select: { id: true, title: true } },
                documento: {
                    select: {
                        id: true,
                        name: true,
                        _count: { select: { movimenti_magazzino: true } },
                    },
                },
            },
            orderBy: [{ timestamp_utc: "desc" }, { id: "desc" }],
            take: pageWindow,
        });

        allData = allData.concat(speseRows.map(mapAuditSpesaRow));
    }

    allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(allData.slice(offset, offset + limit));
});

export const bulkUpdateAudit = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const count  = await bulkUpdateItems(prisma, req.body);
    res.json({ success: true, count });
});

export const createUserCost = asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.id);
    const { costo_orario, valido_dal } = req.body;

    await createTariffa({ employee_id: employeeId, costo_orario, valido_dal });
    res.json({ success: true });
});

export const updateReportEntryCtrl = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = { ...req.body, modified_by_admin_at: new Date().toISOString() };
    if (data.cantiere_id === "") data.cantiere_id = null;
    await dbUpdateReportEntry(id, data);
    res.json({ success: true });
});

/**
 * updateReportEntryAdminCtrl — Modifica admin di una timbratura (ore + cantiere + wbs).
 * Se la entry era VERIFIED, emette REPORT_ENTRY_VERIFIED per ricalcolare i costi.
 */
export const updateReportEntryAdminCtrl = asyncHandler(async (req, res) => {
    const id     = Number(req.params.id);
    const prisma = getDb();

    // Leggi lo stato attuale prima di modificare
    const entry = await prisma.reportEntry.findUnique({
        where:  { id },
        select: { stato_validazione: true, cantiere_id: true },
    });
    if (!entry) return res.status(404).json({ error: 'Timbratura non trovata.' });

    const wasVerified = entry.stato_validazione === ValidationStatus.APPROVED;

    // Campi permessi al solo admin
    const allowed = ['ore_lavorate', 'cantiere_id', 'wbs_node_id', 'attivita_svolte'];
    const updateData = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    if (updateData.cantiere_id === '' || updateData.cantiere_id === null)
        updateData.cantiere_id = null;
    if (updateData.wbs_node_id === '' || updateData.wbs_node_id === null)
        updateData.wbs_node_id = null;
    updateData.modified_by_admin_at = new Date().toISOString();

    await prisma.reportEntry.update({ where: { id }, data: updateData });

    // Se la entry era già approvata, ricalcola i costi del cantiere
    if (wasVerified) {
        const targetCantiereId = updateData.cantiere_id ?? entry.cantiere_id;
        if (targetCantiereId) {
            domainBus.emit(EVENTS.REPORT_ENTRY_VERIFIED, {
                entryId:    id,
                cantiereId: targetCantiereId,
            });
        }
    }

    res.json({ success: true });
});

export const updateReportCtrl = asyncHandler(async (req, res) => {
    const reportId = Number(req.params.id);
    const data = { ...req.body, modified_by_admin_at: new Date().toISOString() };
    if (data.status !== undefined) {
        data.stato_validazione = normalizeStatus(data.status);
        delete data.status; // status column removed from schema
    }
    if (data.cantiere_id === '') data.cantiere_id = null;
    await updateReportHeader(reportId, data);
    res.json({ success: true });
});

export const updateSpesaCtrl = asyncHandler(async (req, res) => {
    const spesaId = Number(req.params.id);
    const data = { ...req.body, modified_by_admin_at: new Date().toISOString() };
    if (data.status !== undefined) {
        data.stato_validazione = normalizeStatus(data.status);
        delete data.status; // status column removed from schema
    }
    await dbUpdateSpesa(spesaId, data);
    res.json({ success: true });
});

export const listReportsCtrl = asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const isPrivilegedRole = req.user?.role === "ADMIN" || req.user?.role === "HR";
    const employeeId = !isPrivilegedRole ? parseIdParam(req.user?.employee_id) : null;
    if (!isPrivilegedRole && employeeId == null) {
        return res.status(403).json({ error: "Accesso negato: privilegi insufficienti" });
    }
    const rows = await dbListReportsWithEntries({ start, end, employeeId });
    res.json(rows);
});

export const getAuditLogsCtrl = asyncHandler(async (req, res) => {
    const rows = await dbGetAuditLogs();
    res.json(rows);
});

export const getPendingSummaryCtrl = asyncHandler(async (req, res) => {
    const pending = await getPendingSummary(getDb());
    res.json(pending);
});
