/**
 * cantiereService — regole di business finanziarie per il Cantiere.
 *
 * Estratto da cantieri.controller.js (getDetails, getFinancialTimeline,
 * syncCantiereBudget). Funzioni pure testabili senza Express.
 */
import { round2, toNumber, getMonthKey, getEntryCost } from '../../utils/helpers.js';
import { formatDateOnly } from '../../db/index.js';

// ─── Budget Sync ──────────────────────────────────────────────────────────────

/**
 * Regola di business: il budget del cantiere è la somma dei budget
 * dei nodi WBS radice (parent_id = null).
 * Chiamata dopo ogni creazione/modifica/eliminazione di un nodo radice.
 */
export async function syncCantiereBudget(prisma, cantiereId) {
    const rootNodes = await prisma.wbsNode.findMany({
        where: { cantiere_id: cantiereId, parent_id: null },
    });

    let total = 0;
    for (const n of rootNodes) {
        if (n.budget_preventivato) total += Number(n.budget_preventivato);
    }

    await prisma.cantiere.update({
        where: { id: cantiereId },
        data: { budget: total > 0 ? total : null },
    });
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

/**
 * Calcola la curva S (costi cumulativi per mese) per un cantiere.
 * @param {object} dataset - { verifiedEntries, activeSpese, cantiere }
 */
export function computeFinancialTimeline(dataset) {
    const byMonth = {};

    for (const entry of dataset.verifiedEntries) {
        const month = getMonthKey(entry.report?.report_date);
        if (month) byMonth[month] = round2((byMonth[month] || 0) + getEntryCost(entry));
    }
    for (const spesa of dataset.activeSpese) {
        const month = getMonthKey(spesa.timestamp_utc);
        if (month) byMonth[month] = round2((byMonth[month] || 0) + toNumber(spesa.importo));
    }

    const months = Object.keys(byMonth).sort();
    let cumulative = 0;
    const costoPerMese = months.map((m) => round2(byMonth[m] || 0));
    const costoReale   = costoPerMese.map((v) => (cumulative = round2(cumulative + v)));

    return { months, costoReale, costoPerMese };
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

/**
 * Calcola i KPI finanziari e la ripartizione dei costi per dipendente.
 * @param {object} dataset - { verifiedEntries, activeSpese, cantiere }
 * @returns {{ kpi, perDipendente }}
 */
export function computeFinancialKpis(dataset) {
    const { cantiere, verifiedEntries, activeSpese } = dataset;

    const costoManodopera = round2(verifiedEntries.reduce((s, e) => s + getEntryCost(e), 0));
    const costoMateriali  = round2(activeSpese.reduce((s, sp) => s + toNumber(sp.importo), 0));
    const costoTotale     = round2(costoManodopera + costoMateriali);
    const budget          = toNumber(cantiere.budget);
    const margine         = round2(budget - costoTotale);

    // Raggruppamento per dipendente
    const perDipendenteMap = new Map();
    for (const entry of verifiedEntries) {
        const employeeId = entry.report?.employee_id;
        if (!employeeId) continue;

        const current = perDipendenteMap.get(employeeId) ?? {
            nome:           entry.report?.employee?.nome   ?? null,
            cognome:        entry.report?.employee?.cognome ?? null,
            ore_tot:        0,
            costo_calcolato: 0,
            ultimo_accesso: null,
        };

        current.ore_tot         += toNumber(entry.ore_lavorate);
        current.costo_calcolato += getEntryCost(entry);

        const reportDate = formatDateOnly(entry.report?.report_date);
        if (reportDate && (!current.ultimo_accesso || reportDate > current.ultimo_accesso)) {
            current.ultimo_accesso = reportDate;
        }
        perDipendenteMap.set(employeeId, current);
    }

    const perDipendente = Array.from(perDipendenteMap.values())
        .map((r) => ({ ...r, ore_tot: round2(r.ore_tot), costo_calcolato: round2(r.costo_calcolato) }))
        .sort((a, b) => b.ore_tot - a.ore_tot);

    const mesiAttiviSet = new Set(
        verifiedEntries.map((e) => getMonthKey(e.report?.report_date)).filter(Boolean)
    );
    const nMesi    = Math.max(mesiAttiviSet.size, 1);
    const burnRate = round2(costoTotale / nMesi);

    return {
        kpi: { budget, costoTotale, costoManodopera, costoMateriali, margine, burnRate, nMesi },
        perDipendente,
    };
}
