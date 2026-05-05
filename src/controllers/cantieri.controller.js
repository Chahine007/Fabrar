import fs from "fs";
import path from "path";
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
import { ValidationStatus } from "../constants.js";
import { syncCantiereBudget, computeFinancialTimeline, computeFinancialKpis } from "../domain/cantiere/cantiereService.js";
import { buildWbsTree, validateNodeDepth } from "../domain/cantiere/wbsService.js";

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
    const activeSpese = cantiere.spese.filter((spesa) => !isRejectedStatus(spesa.stato_validazione));

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

    const { months, costoReale, costoPerMese } = computeFinancialTimeline(dataset);

    res.json({
        nome:             dataset.cantiere.nome,
        budget:           toNumber(dataset.cantiere.budget),
        raggio_tolleranza: dataset.cantiere.raggio_tolleranza || 300,
        months, costoReale, costoPerMese,
    });
});

export const getDetails = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const dataset = await loadCantiereCostDataset(getDb(), cantiereId);
    if (!dataset) return res.status(404).json({ error: "Cantiere non trovato." });

    const { kpi, perDipendente } = computeFinancialKpis(dataset);
    const { report_entries: _e, spese: _s, ...cantiere } = dataset.cantiere;

    res.json({ cantiere: { ...cantiere, budget: kpi.budget }, kpi, perDipendente });
});

export const getCantiereMaterials = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const prisma = getDb();
    const speseMateriali = await prisma.spesa.findMany({
        where: {
            cantiere_id: cantiereId,
            pricebook_id: { not: null },
            stato_validazione: { not: ValidationStatus.REJECTED }
        },
        include: {
            pricebook: true,
            wbs_node: { select: { id: true, nome: true } }
        },
        orderBy: { timestamp_utc: 'desc' }
    });

    res.json(speseMateriali);
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

// Helper: converte bytes in stringa leggibile (es. "1.2 MB")
function formatFileSize(bytes) {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper: determina il tipo da estensione/mime
function detectDocType(mimetype, originalname) {
    if (!mimetype) return 'document';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype === 'application/pdf') return 'pdf';
    const ext = path.extname(originalname).toLowerCase();
    if (['.xls', '.xlsx'].includes(ext)) return 'excel';
    return 'document';
}

export const uploadDocument = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });
    if (!req.file)   return res.status(400).json({ error: "Nessun file caricato." });

    const { tag = 'generic', numero_fattura } = req.body;
    const type      = detectDocType(req.file.mimetype, req.file.originalname);
    // percorso relativo — la root è UPLOAD_DIR
    const file_path = path.join('cantieri', String(cantiereId), req.file.filename);

    const prisma = getDb();
    const doc = await prisma.document.create({
        data: {
            cantiere_id:    cantiereId,
            name:           req.file.originalname,
            file_path,
            type,
            size:           formatFileSize(req.file.size),
            uploader:       req.user?.username ?? 'admin',
            tag,
            numero_fattura: numero_fattura || null,
        },
    });
    res.status(201).json(doc);
});

export const downloadDocument = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    const docId      = parseIdParam(req.params.docId);
    if (!cantiereId || !docId) return res.status(400).json({ error: "Parametri non validi." });

    const prisma = getDb();
    const doc = await prisma.document.findFirst({
        where: { id: docId, cantiere_id: cantiereId },
    });
    if (!doc) return res.status(404).json({ error: "Documento non trovato." });
    if (!doc.file_path) return res.status(404).json({ error: "File non disponibile (caricato prima della migrazione)." });

    const uploadDir = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve('./uploads');
    const filePath = path.join(uploadDir, doc.file_path);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File fisico non trovato." });
    res.download(filePath, doc.name);
});

export const updateGps = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "lat e lng sono obbligatori." });

    await getDb().cantiere.update({
        where: { id: cantiereId },
        data:  { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
    res.json({ ok: true });
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

// syncCantiereBudget è ora gestito da src/domain/cantiere/cantiereService.js

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


    res.json(buildWbsTree(nodes, burnMap));
});

export const createWbsNode = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    if (!cantiereId) return res.status(400).json({ error: "ID cantiere non valido." });

    const { nome, budget_preventivato, parent_id } = req.body;
    const prisma = getDb();
    await validateNodeDepth(prisma, parent_id, cantiereId);

    const node = await dbCreateWbsNode({ cantiere_id: cantiereId, nome, budget_preventivato, parent_id });
    if (parent_id == null) await syncCantiereBudget(prisma, cantiereId);
    res.status(201).json(node);
});

export const updateWbsNode = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    const nodeId     = parseIdParam(req.params.nodeId);
    if (!cantiereId || !nodeId) return res.status(400).json({ error: "ID non valido." });

    const prisma = getDb();
    const node = await prisma.wbsNode.findFirst({ where: { id: nodeId, cantiere_id: cantiereId } });
    if (!node) return res.status(404).json({ error: "Nodo WBS non trovato." });

    await dbUpdateWbsNode(nodeId, req.body);
    if (node.parent_id == null) await syncCantiereBudget(prisma, cantiereId);
    res.json({ ok: true });
});

export const deleteWbsNode = asyncHandler(async (req, res) => {
    const cantiereId = parseIdParam(req.params.id);
    const nodeId     = parseIdParam(req.params.nodeId);
    if (!cantiereId || !nodeId) return res.status(400).json({ error: "ID non valido." });

    const prisma = getDb();
    const node = await prisma.wbsNode.findFirst({ where: { id: nodeId, cantiere_id: cantiereId } });
    if (!node) return res.status(404).json({ error: "Nodo WBS non trovato." });
    if (node.parent_id === null) return res.status(400).json({ error: "Il nodo radice non può essere eliminato." });

    try {
        await dbDeleteWbsNode(nodeId);
        res.json({ ok: true });
    } catch (err) {
        res.status(409).json({ error: err.message });
    }
});

// syncCantiereBudget è ora gestito da src/domain/cantiere/cantiereService.js
