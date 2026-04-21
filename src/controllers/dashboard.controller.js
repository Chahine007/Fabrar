import { getDb, getCantieriStatus, formatDateOnly, parseDateOnly } from "../db/index.js";
import { round2, toNumber, isPendingSpesa } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPendingSummary } from "./hr.controller.js";

export const getRadar = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    const lastMondayStr = formatDateOnly(new Date(monday.getTime() - 7 * 86400000));
    const lastSundayStr = formatDateOnly(new Date(monday.getTime() - 86400000));
    const sevenDaysAgoStr = formatDateOnly(new Date(today.getTime() - 7 * 86400000));

    const [cantieriRaw, pending, weekEntries, activeEntries] = await Promise.all([
        getCantieriStatus(),
        getPendingSummary(prisma),
        prisma.reportEntry.findMany({
            where: {
                NOT: { stato_validazione: { in: ["rejected", "REJECTED"] } },
                report: { is: { report_date: { gte: parseDateOnly(lastMondayStr) } } },
            },
            select: { ore_lavorate: true, report: { select: { report_date: true, employee_id: true } } },
        }),
        prisma.reportEntry.findMany({
            where: {
                NOT: { stato_validazione: { in: ["rejected", "REJECTED"] } },
                report: { is: { report_date: { gte: parseDateOnly(sevenDaysAgoStr) } } },
            },
            select: { report: { select: { employee_id: true } } },
        }),
    ]);

    const cantieri = cantieriRaw.map((c) => ({
        id: c.id, nome: c.nome, budget: c.budget, costo: round2(c.costo_totale),
        pct: c.budget > 0 ? c.costo_totale / c.budget : null,
        status: c.budget > 0 ? (c.costo_totale / c.budget < 0.75 ? "green" : c.costo_totale / c.budget <= 0.9 ? "amber" : "red") : "gray"
    }));

    let currentWeekHours = 0, lastWeekHours = 0;
    const mondayStr = formatDateOnly(monday);
    for (const entry of weekEntries) {
        const d = formatDateOnly(entry.report?.report_date);
        const h = toNumber(entry.ore_lavorate);
        if (d >= mondayStr) currentWeekHours += h;
        else if (d >= lastMondayStr && d <= lastSundayStr) lastWeekHours += h;
    }

    res.json({
        cantieri,
        pending: { reports: pending.reports, spese: pending.spese },
        oreSettimana: { corrente: round2(currentWeekHours), scorsa: round2(lastWeekHours) },
        operaiAttivi: new Set(activeEntries.map(e => e.report?.employee_id).filter(Boolean)).size,
    });
});