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
    mapAuditStatusToDb,
    normalizeStatus,
    resolveEntryStatus,
    resolveSpesaStatus,
    formatEmployeeName,
} from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AUDIT_TYPE, DB_STATUS, STATUS } from "../constants.js";

const MAX_DAILY_HOURS_ALERT = 12;

export async function getPendingSummary(prisma) {
    const [reports, spese] = await Promise.all([
        prisma.reportEntry.count({
            where: {
                OR: [
                    { stato_validazione: "" },
                    { stato_validazione: { equals: STATUS.PENDING, mode: "insensitive" } },
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
        type: AUDIT_TYPE.ORE,
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
        type: AUDIT_TYPE.SPESE,
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

export const getAlerts = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const pending = await getPendingSummary(prisma);

    const lastThirtyDays = new Date();
    lastThirtyDays.setDate(lastThirtyDays.getDate() - 30);

    const [entries, recentReports] = await Promise.all([
        prisma.reportEntry.findMany({
            where: {
                NOT: { stato_validazione: { in: [STATUS.REJECTED, DB_STATUS.REJECTED] } },
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

export const getUserKpi = asyncHandler(async (req, res) => {
    const employeeId = req.params.id; // Validato da Zod

    const prisma = getDb();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = parseDateOnly(`${month}-01`);
    const nextMonthStart = new Date(`${month}-01T00:00:00.000Z`);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

    const [entries, employeeSpese, tariffa] = await Promise.all([
        prisma.reportEntry.findMany({
            where: { NOT: { stato_validazione: { in: [STATUS.REJECTED, DB_STATUS.REJECTED] } }, report: { is: { employee_id: Number(employeeId), report_date: { gte: monthStart, lt: nextMonthStart } } } },
            select: { ore_lavorate: true, fonte: true },
        }),
        prisma.spesa.findMany({
            where: { employee_id: Number(employeeId) },
            select: { stato_validazione: true, status: true },
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
        pendingSpese: employeeSpese.filter(isPendingSpesa).length,
        costo_orario: toNumber(tariffa?.costo_orario),
    });
});

export const getAudit = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const { type, status, employee_id } = req.query; // Validati da Zod

    const employeeId = employee_id ? Number(employee_id) : null;
    const statusValue = status ? normalizeStatus(status) : null;
    let allData = [];

    if (!type || type === AUDIT_TYPE.ORE) {
        const oreRows = await prisma.reportEntry.findMany({
            where: {
                ...(employeeId ? { report: { is: { employee_id: employeeId } } } : {}),
                ...(statusValue ? (statusValue === STATUS.PENDING ? {} : { stato_validazione: { equals: statusValue, mode: "insensitive" } }) : {}),
            },
            include: {
                report: { include: { employee: { select: { nome: true, cognome: true } }, cantiere: { select: { nome: true } } } },
                cantiere: { select: { nome: true } },
            },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
        });

        allData = allData.concat(oreRows.map(mapAuditOreRow).filter((row) => (statusValue === STATUS.PENDING ? row.status === STATUS.PENDING : true)));
    }

    if (!type || type === AUDIT_TYPE.SPESE) {
        const speseRows = await prisma.spesa.findMany({
            where: {
                ...(employeeId ? { employee_id: employeeId } : {}),
                ...(statusValue ? (statusValue === STATUS.PENDING ? {} : { OR: [{ stato_validazione: { equals: statusValue, mode: "insensitive" } }, { status: { equals: statusValue, mode: "insensitive" } }] }) : {}),
            },
            include: { employee: { select: { nome: true, cognome: true } }, cantiere: { select: { nome: true } } },
            orderBy: [{ timestamp_utc: "desc" }, { id: "desc" }],
        });

        allData = allData.concat(speseRows.map(mapAuditSpesaRow).filter((row) => (statusValue === STATUS.PENDING ? row.status === STATUS.PENDING : true)));
    }

    allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(allData);
});

export const bulkUpdateAudit = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const iso = new Date().toISOString();

    const result = await prisma.$transaction(async (tx) => {
        let items = req.body?.items;

        if (!items) {
            const ids = req.body?.ids || [];
            const action = req.body?.action;
            if (!ids || ids.length === 0 || !action) throw new Error("Formato non valido.");

            const reportEntries = await tx.reportEntry.findMany({ where: { id: { in: ids } }, select: { id: true } });
            const spese = await tx.spesa.findMany({ where: { id: { in: ids } }, select: { id: true } });

            const reportEntryIds = new Set(reportEntries.map((row) => row.id));
            const spesaIds = new Set(spese.map((row) => row.id));
            const defaultStatus = action === "verify" ? STATUS.VERIFIED : action === "reject" ? STATUS.REJECTED : action;

            items = ids.map((id) => {
                const inReportEntries = reportEntryIds.has(id);
                const inSpese = spesaIds.has(id);
                if (inReportEntries && inSpese) throw new Error(`ID ambiguo presente sia in ore che in spese: ${id}`);
                if (!inReportEntries && !inSpese) throw new Error(`Voce audit non trovata: ${id}`);

                return { id, type: inReportEntries ? AUDIT_TYPE.ORE : AUDIT_TYPE.SPESE, newStatus: defaultStatus };
            });
        }

        if (!Array.isArray(items) || items.length === 0) throw new Error("Formato non valido.");

        for (const rawItem of items) {
            const id = rawItem.id;
            const newSt = mapAuditStatusToDb(rawItem.newStatus);

            if (rawItem.type === AUDIT_TYPE.ORE) {
                const entry = await tx.reportEntry.findUnique({ where: { id }, select: { report_id: true, report: { select: { employee_id: true } } } });
                if (!entry) throw new Error(`Riga ore non trovata: ${id}`);

                if (newSt === DB_STATUS.VERIFIED) {
                    const tariffaCount = await tx.tariffa.count({ where: { employee_id: entry.report?.employee_id } });
                    if (tariffaCount === 0) throw new Error("Impossibile approvare: il dipendente non ha una tariffa oraria valida nel sistema (Policy 4.2).");
                }

                await tx.reportEntry.update({ where: { id }, data: { stato_validazione: newSt, modified_by_admin_at: iso } });
                continue;
            }

            if (rawItem.type === AUDIT_TYPE.SPESE) {
                await tx.spesa.update({ where: { id }, data: { stato_validazione: newSt, status: newSt.toLowerCase(), modified_by_admin_at: iso } });
                continue;
            }
            throw new Error(`Tipo audit non supportato: ${rawItem.type}`);
        }
        return items.length;
    });
    res.json({ success: true, count: result });
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

export const updateReportCtrl = asyncHandler(async (req, res) => {
    const reportId = Number(req.params.id);
    const data = { ...req.body, modified_by_admin_at: new Date().toISOString() };
    if (data.status !== undefined) {
        data.stato_validazione = mapAuditStatusToDb(data.status);
    }
    if (data.cantiere_id === "") data.cantiere_id = null;
    await updateReportHeader(reportId, data);
    res.json({ success: true });
});

export const updateSpesaCtrl = asyncHandler(async (req, res) => {
    const spesaId = Number(req.params.id);
    const data = { ...req.body, modified_by_admin_at: new Date().toISOString() };
    if (data.status !== undefined) {
        data.stato_validazione = mapAuditStatusToDb(data.status);
    }
    await dbUpdateSpesa(spesaId, data);
    res.json({ success: true });
});

export const listReportsCtrl = asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const rows = await dbListReportsWithEntries({ start, end });
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