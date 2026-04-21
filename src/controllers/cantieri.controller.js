import {
    getAllCantieri as dbGetAllCantieri,
    createCantiere as dbCreateCantiere,
    toggleCantiere as dbToggleCantiere,
    updateCantiere as dbUpdateCantiere,
    getDb,
    formatDateOnly,
    getWbsNodesByCantiere,
    createWbsNode as dbCreateWbsNode,
    updateWbsNode as dbUpdateWbsNode,
    deleteWbsNode as dbDeleteWbsNode,
    getWbsBurnData,
} from "../db/index.js";

import {
    parseIdParam,
    toNullableNumber,
    normalizeOptionalText,
    round2,
    getMonthKey,
    getEntryCost,
    isVerifiedStatus,
    isRejectedStatus,
    toNumber,
} from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
                                    tariffe: { orderBy: { valido_dal: "desc" }, take: 1 },
                                },
                            },
                        },
                    },
                    cantiere: { select: { nome: true } },
                },
                orderBy: { id: "asc" },
            },
            spese: {
                include: { cantiere: { select: { nome: true } } },
                orderBy: { timestamp_utc: "asc" },
            },
        },
    });

    if (!cantiere) return null;

    const verifiedEntries = cantiere.report_entries.filter((entry) => isVerifiedStatus(entry.stato_validazione));
    const activeSpese = cantiere.spese.filter((spesa) => !isRejectedStatus(spesa.stato_validazione ?? spesa.status));

    return { cantiere, verifiedEntries, activeSpese };
}

export const listCantieri = asyncHandler(async (req, res) => {
    const rows = await dbGetAllCantieri();
    res.json(rows);
});

export const createCantiere = asyncHandler(async (req, res) => {
    // La validazione e la coercizione dei tipi sono già state eseguite dal middleware Zod.
    const { nome, indirizzo, lat, lng, budget } = req.body;

    await dbCreateCantiere({
        nome,
        indirizzo,
        lat,
        lng,
        budget,
    });
    res.status(201).json({ ok: true });
});

export const toggleCantiere = asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: "ID cantiere non valido." });

    await dbToggleCantiere(id);
    res.json({ ok: true });
});

export const updateCantiere = asyncHandler(async (req, res) => {
    const cantiereId = req.params.id; // Già estratto e validato come intero positivo da Zod

    await dbUpdateCantiere(cantiereId, req.body);
    res.json({ success: true });
});

export const getFinancialTimeline = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const dataset = await loadCantiereCostDataset(getDb(), cantiereId);
    if (!dataset) return res.status(404).json({ error: "Cantiere non trovato." });

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
    const costoPerMese = months.map((month) => round2(byMonth[month] || 0));
    const costoReale = costoPerMese.map((value) => (cumulative = round2(cumulative + value)));

    res.json({
        nome: dataset.cantiere.nome,
        budget: toNumber(dataset.cantiere.budget),
        raggio_tolleranza: dataset.cantiere.raggio_tolleranza || 300,
        months,
        costoReale,
        costoPerMese,
    });
});

export const getDetails = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const dataset = await loadCantiereCostDataset(getDb(), cantiereId);
    if (!dataset) return res.status(404).json({ error: "Cantiere non trovato." });

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
        .map((row) => ({ ...row, ore_tot: round2(row.ore_tot), costo_calcolato: round2(row.costo_calcolato) }))
        .sort((a, b) => b.ore_tot - a.ore_tot);

    const mesiAttiviSet = new Set(dataset.verifiedEntries.map((e) => getMonthKey(e.report?.report_date)).filter(Boolean));
    const nMesi = Math.max(mesiAttiviSet.size, 1);
    const burnRate = round2(costoTotale / nMesi);

    const { report_entries: _entries, spese: _spese, ...cantiere } = dataset.cantiere;

    res.json({
        cantiere: { ...cantiere, budget },
        kpi: { budget, costoTotale, costoManodopera, costoMateriali, margine, burnRate, nMesi },
        perDipendente,
    });
});

export const getCantiereMaterials = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const prisma = getDb();
    const speseMateriali = await prisma.spesa.findMany({
        where: {
            cantiere_id: cantiereId,
            pricebook_id: { not: null },
            status: { not: 'rejected' },
            stato_validazione: { not: 'REJECTED' }
        },
        include: {
            pricebook: true,
            wbs_node: { select: { id: true, nome: true } }
        },
        orderBy: { timestamp_utc: 'desc' }
    });

    res.json(speseMateriali);
});

export const getTasks = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const prisma = getDb();
    const tasks = await prisma.task.findMany({
        where: { cantiere_id: cantiereId },
        orderBy: { id: 'desc' }
    });
    res.json(tasks);
});

export const createTask = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const prisma = getDb();
    const newTask = await prisma.task.create({
        data: {
            cantiere_id: cantiereId,
            title: req.body.title,
            assignee: 'Non Assegnato',
            status: 'Da Fare',
            priority: 'Media',
            due: '-',
        }
    });

    res.status(201).json(newTask);
});

export const getDocuments = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });
    
    const tag = req.query.tag; // Optional filter

    const prisma = getDb();
    const whereClause = { cantiere_id: cantiereId };
    if (tag) whereClause.tag = tag;

    const docs = await prisma.document.findMany({
        where: whereClause,
        orderBy: { id: 'desc' }
    });
    res.json(docs);
});

// ─── Settings handlers ────────────────────────────────────────────────────────

export const getCantiereSettings = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const prisma = getDb();
    const cantiere = await prisma.cantiere.findUnique({
        where: { id: cantiereId },
        select: {
            nome: true, indirizzo: true,
            lat: true, lng: true, raggio_tolleranza: true,
            bot_checkin_gps: true, bot_anomaly_action: true, bot_wbs_prompt_thr: true,
            budget_contingency: true, kpi_warning_thr: true, kpi_critical_thr: true,
            client_name: true, client_ref_email: true, pm_id: true, site_manager_id: true,
            budget: true,
        }
    });
    if (!cantiere) return res.status(404).json({ error: "Cantiere non trovato." });

    // Users with access to the dashboard for PM assignment
    const pms = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'EXTERNAL_PM', 'HR'] }, is_active: 1 },
        select: { id: true, username: true, employee: { select: { nome: true, cognome: true } } }
    });

    res.json({ settings: cantiere, pms });
});

export const updateCantiereSettings = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const prisma = getDb();
    const cantiere = await prisma.cantiere.update({
        where: { id: cantiereId },
        data: req.body
    });

    res.json(cantiere);
});

// ─── WBS handlers ────────────────────────────────────────────────────────────

/**
 * Costruisce l'albero WBS con burn rate per ogni nodo.
 * Max 3 livelli (root → fase → sottofase) come da configurazione.
 */
export const getWbsTree = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const [nodes, burnMap] = await Promise.all([
        getWbsNodesByCantiere(cantiereId),
        getWbsBurnData(cantiereId),
    ]);

    // Normalizza i nodi e inietta il burn
    const nodeMap = new Map();
    for (const n of nodes) {
        const budget = n.budget_preventivato != null ? Number(n.budget_preventivato) : null;
        const burn = burnMap[n.id] ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0, totale: 0 };
        const avanzamento_pct = budget && budget > 0
            ? Math.min(100, Math.round((burn.totale / budget) * 1000) / 10)
            : null;
        nodeMap.set(n.id, {
            id: n.id,
            nome: n.nome,
            budget_preventivato: budget,
            parent_id: n.parent_id,
            is_variant: n.is_variant,
            burn,
            avanzamento_pct,
            children: [],
        });
    }

    // Costruisce l'albero (max 3 livelli)
    // Costruisce l'albero (max 3 livelli) e identifica le radici
    const roots = [];
    for (const node of nodeMap.values()) {
        if (node.parent_id === null) {
            roots.push(node);
        } else {
            const parent = nodeMap.get(node.parent_id);
            if (parent) parent.children.push(node);
            else roots.push(node); // nodo orfano: trattalo come root
        }
    }

    // Rollup dal basso verso l'alto (post-order traversal implicito via ricorsione)
    function calculateRollup(node) {
        let rolledUpBurn = { ...node.burn };
        for (const child of node.children) {
            const childBurn = calculateRollup(child);
            rolledUpBurn.ore_tot += childBurn.ore_tot;
            rolledUpBurn.costo_manodopera += childBurn.costo_manodopera;
            rolledUpBurn.costo_materiali += childBurn.costo_materiali;
            rolledUpBurn.totale += childBurn.totale;
        }
        node.burn = {
            ore_tot: Math.round(rolledUpBurn.ore_tot * 100) / 100,
            costo_manodopera: Math.round(rolledUpBurn.costo_manodopera * 100) / 100,
            costo_materiali: Math.round(rolledUpBurn.costo_materiali * 100) / 100,
            totale: Math.round(rolledUpBurn.totale * 100) / 100,
        };
        
        if (node.budget_preventivato && node.budget_preventivato > 0) {
            node.avanzamento_pct = Math.min(100, Math.round((node.burn.totale / node.budget_preventivato) * 1000) / 10);
        }
        
        return node.burn;
    }

    for (const root of roots) {
        calculateRollup(root);
    }


    res.json(roots);
});

export const createWbsNode = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    // Controlla che il parent_id, se fornito, appartenga a questo cantiere
    const { nome, budget_preventivato, parent_id } = req.body;
    if (parent_id != null) {
        const prisma = getDb();
        const parent = await prisma.wbsNode.findFirst({
            where: { id: Number(parent_id), cantiere_id: cantiereId }
        });
        if (!parent) return res.status(400).json({ error: "Nodo genitore non valido per questo cantiere." });

        // Limita la profondita' a 3 livelli (root ha parent_id=null = depth 0)
        if (parent.parent_id !== null) {
            const grandParent = await prisma.wbsNode.findUnique({ where: { id: parent.parent_id } });
            if (grandParent?.parent_id !== null) {
                return res.status(400).json({ error: "Profondita' massima WBS raggiunta (max 3 livelli)." });
            }
        }
    }

    const node = await dbCreateWbsNode({ cantiere_id: cantiereId, nome, budget_preventivato, parent_id });
    if (parent_id == null) {
        await syncCantiereBudget(cantiereId);
    }
    res.status(201).json(node);
});

export const updateWbsNode = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    const nodeId     = parseIdParam(req.params.nodeId);
    if (!cantiereId || !nodeId) return res.status(400).json({ error: "ID non valido." });

    // Verifica che il nodo appartenga al cantiere
    const prisma = getDb();
    const node = await prisma.wbsNode.findFirst({ where: { id: nodeId, cantiere_id: cantiereId } });
    if (!node) return res.status(404).json({ error: "Nodo WBS non trovato." });

    await dbUpdateWbsNode(nodeId, req.body);
    if (node.parent_id == null) {
        await syncCantiereBudget(cantiereId);
    }
    res.json({ ok: true });
});

export const deleteWbsNode = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    const nodeId     = parseIdParam(req.params.nodeId);
    if (!cantiereId || !nodeId) return res.status(400).json({ error: "ID non valido." });

    // Verifica ownership e che non sia la radice
    const prisma = getDb();
    const node = await prisma.wbsNode.findFirst({ where: { id: nodeId, cantiere_id: cantiereId } });
    if (!node) return res.status(404).json({ error: "Nodo WBS non trovato." });
    if (node.parent_id === null) return res.status(400).json({ error: "Il nodo radice non può essere eliminato." });

    try {
        await dbDeleteWbsNode(nodeId);
        if (node.parent_id == null) {
            await syncCantiereBudget(cantiereId);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(409).json({ error: err.message });
    }
});

/**
 * Ricalcola il budget del cantiere sommando i budget dei nodi radice (parent_id = null)
 */
async function syncCantiereBudget(cantiereId) {
    const prisma = getDb();
    const rootNodes = await prisma.wbsNode.findMany({
        where: { cantiere_id: cantiereId, parent_id: null }
    });
    
    let total = 0;
    for (const n of rootNodes) {
        if (n.budget_preventivato) {
            total += Number(n.budget_preventivato);
        }
    }
    
    await prisma.cantiere.update({
        where: { id: cantiereId },
        data: { budget: total > 0 ? total : null }
    });
}