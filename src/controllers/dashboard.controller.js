import { getDb, getCantieriStatus, formatDateOnly, parseDateOnly } from "../db/index.js";
import { round2, toNumber } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPendingSummary } from "./hr.controller.js";
import { ValidationStatus } from "../constants.js";
import { calculateTrueCost } from "../domain/finance/financeService.js";

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
                NOT: { stato_validazione: ValidationStatus.REJECTED },
                report: { is: { report_date: { gte: parseDateOnly(lastMondayStr) } } },
            },
            select: { ore_lavorate: true, report: { select: { report_date: true, employee_id: true } } },
        }),
        prisma.reportEntry.findMany({
            where: {
                NOT: { stato_validazione: ValidationStatus.REJECTED },
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

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS INTELLIGENCE — Sprint 11
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/dashboard/bi/finance
 * Margine Globale, Top 3 cantieri burn-rate, CPI medio.
 */
export const getFinanceKPIs = asyncHandler(async (req, res) => {
    const prisma = getDb();

    const cantieri = await prisma.cantiere.findMany({
        where: { attivo: 1 },
        select: { id: true, nome: true, budget: true, valore_contratto: true },
    });

    const cantieriAnalysis = await Promise.all(
        cantieri.map(async (c) => {
            const ricavoPrevisto = toNumber(c.valore_contratto);
            const costi = await calculateTrueCost(c.id);
            const burnRate = ricavoPrevisto > 0 ? round2(costi.costoTotale / ricavoPrevisto) : 0;
            const cpi = costi.costoTotale > 0 ? round2(ricavoPrevisto / costi.costoTotale) : null;

            return {
                id: c.id,
                nome: c.nome,
                budget: round2(ricavoPrevisto),
                valoreContratto: round2(ricavoPrevisto),
                costo: costi.costoTotale,
                costoManodopera: costi.costoManodopera,
                costoMateriali: costi.costoMateriali,
                costoSpese: costi.costoSpese,
                burnRate,
                cpi,
            };
        })
    );

    const budgetTotale = round2(cantieriAnalysis.reduce((s, c) => s + c.valoreContratto, 0));
    const costiTotali = round2(cantieriAnalysis.reduce((s, c) => s + c.costo, 0));
    const margine = round2(budgetTotale - costiTotali);

    const top3BurnRate = cantieriAnalysis
        .filter((c) => c.valoreContratto > 0)
        .sort((a, b) => b.burnRate - a.burnRate)
        .slice(0, 3);
    const avgCPI = cantieriAnalysis.filter(c => c.cpi !== null).length > 0
        ? round2(cantieriAnalysis.filter(c => c.cpi !== null).reduce((s, c) => s + c.cpi, 0) / cantieriAnalysis.filter(c => c.cpi !== null).length)
        : null;

    res.json({
        budgetTotale: round2(budgetTotale),
        valoreContrattoTotale: round2(budgetTotale),
        speseTotali:  costiTotali,
        costiTotali,
        costoManodoperaTotale: round2(cantieriAnalysis.reduce((s, c) => s + c.costoManodopera, 0)),
        costoMaterialiTotale: round2(cantieriAnalysis.reduce((s, c) => s + c.costoMateriali, 0)),
        costoSpeseTotale: round2(cantieriAnalysis.reduce((s, c) => s + c.costoSpese, 0)),
        margine,
        marginePct:   budgetTotale > 0 ? round2((margine / budgetTotale) * 100) : null,
        cpiMedio:     avgCPI,
        top3BurnRate,
    });
});

/**
 * GET /api/dashboard/bi/warehouse
 * Capitale immobilizzato, dead stock (articoli senza movimenti recenti).
 */
export const getWarehouseKPIs = asyncHandler(async (req, res) => {
    const prisma = getDb();

    const [giacenze, movimenti] = await Promise.all([
        prisma.giacenza.findMany({
            include: { articolo: { select: { descrizione: true, costo_medio: true, codice_sku: true } } },
        }),
        prisma.movimentoMagazzino.findMany({
            orderBy: { data_movimento: 'desc' },
            select: { articolo_id: true, data_movimento: true },
        }),
    ]);

    // Capitale immobilizzato = Σ (quantità * costo_medio)
    let capitaleImmobilizzato = 0;
    let totalArticoli = 0;
    for (const g of giacenze) {
        const qty   = toNumber(g.quantita_disponibile) + toNumber(g.quantita_riservata);
        const costo = toNumber(g.articolo.costo_medio);
        capitaleImmobilizzato += qty * costo;
        if (qty > 0) totalArticoli++;
    }

    // Ultimo movimento per articolo
    const lastMove = {};
    for (const m of movimenti) {
        if (!lastMove[m.articolo_id]) lastMove[m.articolo_id] = m.data_movimento;
    }

    // Dead stock: articoli con giacenza > 0 ma ultimo movimento > 60 giorni fa (o mai)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
    const deadStock = giacenze
        .filter(g => (toNumber(g.quantita_disponibile) + toNumber(g.quantita_riservata)) > 0)
        .map(g => ({
            articolo_id:   g.articolo_id,
            codice_sku:    g.articolo.codice_sku,
            descrizione:   g.articolo.descrizione,
            quantita:      round2(toNumber(g.quantita_disponibile)),
            valore:        round2(toNumber(g.quantita_disponibile) * toNumber(g.articolo.costo_medio)),
            ultimo_movimento: lastMove[g.articolo_id] ?? null,
        }))
        .filter(g => !g.ultimo_movimento || new Date(g.ultimo_movimento) < sixtyDaysAgo)
        .sort((a, b) => b.valore - a.valore)
        .slice(0, 5);

    res.json({
        capitaleImmobilizzato: round2(capitaleImmobilizzato),
        totalArticoli,
        totalMovimenti: movimenti.length,
        deadStock,
    });
});

/**
 * GET /api/dashboard/bi/hr
 * Costo orario medio, % ore fatturabili (con WBS), ore e costo HR mese.
 */
export const getHrKPIs = asyncHandler(async (req, res) => {
    const prisma = getDb();

    const now        = new Date();
    const monthStart = parseDateOnly(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    const nextMonth  = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const [tariffe, entriesMese] = await Promise.all([
        // Tariffe attive (ultima per ogni dipendente)
        prisma.tariffa.findMany({ orderBy: { valido_dal: 'desc' } }),
        // Entry del mese corrente (non rifiutate)
        prisma.reportEntry.findMany({
            where: {
                NOT: { stato_validazione: ValidationStatus.REJECTED },
                report: { report_date: { gte: monthStart, lt: nextMonth } },
            },
            select: { ore_lavorate: true, wbs_node_id: true },
        }),
    ]);

    // Costo orario medio (solo ultima tariffa per dipendente)
    const seen = new Set();
    const tariffeUniche = tariffe.filter(t => {
        if (!t.employee_id || seen.has(t.employee_id)) return false;
        seen.add(t.employee_id);
        return true;
    });
    const costoOrarioMedio = tariffeUniche.length > 0
        ? round2(tariffeUniche.reduce((s, t) => s + toNumber(t.costo_orario), 0) / tariffeUniche.length)
        : 0;

    // Ore mese
    const oreTotaliMese = round2(entriesMese.reduce((s, e) => s + toNumber(e.ore_lavorate), 0));
    const oreConWbs     = round2(entriesMese.filter(e => e.wbs_node_id != null).reduce((s, e) => s + toNumber(e.ore_lavorate), 0));
    const pctFatturabili = oreTotaliMese > 0 ? round2((oreConWbs / oreTotaliMese) * 100) : 0;
    const costoHrMese    = round2(oreTotaliMese * costoOrarioMedio);

    res.json({
        costoOrarioMedio,
        oreTotaliMese,
        oreConWbs,
        pctFatturabili,
        costoHrMese,
        dipendentiConTariffa: tariffeUniche.length,
    });
});

/**
 * GET /api/dashboard/bi/operations
 * Time-to-approval medio, tasso rifiuto.
 */
export const getOpsKPIs = asyncHandler(async (req, res) => {
    const prisma = getDb();

    const [verifiedWithTime, totalVerifiedCount, rejected, total] = await Promise.all([
        // Solo le verified CON timestamp admin → per calcolo time-to-approval
        prisma.reportEntry.findMany({
            where: {
                stato_validazione: ValidationStatus.VERIFIED,
                modified_by_admin_at: { not: null },
            },
            select: { created_at: true, modified_by_admin_at: true },
        }),
        // TUTTE le verified → per conteggio corretto pending
        prisma.reportEntry.count({ where: { stato_validazione: ValidationStatus.VERIFIED } }),
        prisma.reportEntry.count({ where: { stato_validazione: ValidationStatus.REJECTED } }),
        prisma.reportEntry.count(),
    ]);

    // Time-to-approval medio in ore
    let totalHours = 0;
    let countValid = 0;
    for (const v of verifiedWithTime) {
        if (v.created_at && v.modified_by_admin_at) {
            const diff = new Date(v.modified_by_admin_at).getTime() - new Date(v.created_at).getTime();
            if (diff > 0) {
                totalHours += diff / (1000 * 60 * 60);
                countValid++;
            }
        }
    }
    const avgApprovalHours = countValid > 0 ? round2(totalHours / countValid) : null;

    // Tasso rifiuto
    const tassoRifiuto = total > 0 ? round2((rejected / total) * 100) : 0;

    res.json({
        avgApprovalHours,
        totalVerified:    totalVerifiedCount,
        totalRejected:    rejected,
        totalEntries:     total,
        tassoRifiuto,
        totalPending:     total - totalVerifiedCount - rejected,
    });
});
