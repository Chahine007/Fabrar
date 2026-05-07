import { insertSpesa, listPricebook, getDb } from "../db/index.js";
import { normalizeOptionalText, parseIdParam } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CostAllocationScope, CostCategory, LogisticaStatus, ValidationStatus } from "../constants.js";
import {
    ensureCantiereActive,
    ensureTaskBelongsToCantiere,
    ensureWbsBelongsToCantiere,
    getRootWbsId,
} from "../domain/shared/linkValidators.js";
import { canAccessCantiere } from "../domain/shared/accessControl.js";
import {
    GenyaImportFormatError,
    parseCantiereIdFromReferer,
    parseExpenseRowsFromUploadedFile,
    parseImportedMoney,
    parseImportedTimestamp,
} from "../services/genyaImportParser.js";

export {
    parseCantiereIdFromReferer,
    parseExpenseRowsFromCsv,
    parseExpenseRowsFromTable,
    parseExpenseRowsFromUploadedFile,
    parseExpenseRowsFromXlsx,
    parseImportedMoney,
    parseImportedTimestamp,
} from "../services/genyaImportParser.js";

const WEB_SOURCE = "WEB";
const MUTABLE_STATUSES = new Set([ValidationStatus.PENDING, ValidationStatus.REJECTED]);
const MATERIAL_IMPORT_KEYS = [
    "codice_sku",
    "sku",
    "codice_articolo",
    "cod_articolo",
    "descrizione_articolo",
    "descrizione_materiale",
    "quantita",
    "qta",
    "qty",
    "unita_misura",
    "costo_unitario",
    "prezzo_unitario",
    "importo_riga",
    "valore_riga",
    "prezzo_totale",
];

function getAuthenticatedEmployeeId(req) {
    const employeeId = Number(req.user?.employee_id);
    return Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null;
}

function isMutableStatus(status) {
    return MUTABLE_STATUSES.has(status);
}

function buildExpenseInclude() {
    return {
        cantiere: { select: { id: true, nome: true } },
        task: { select: { id: true, title: true, status: true, cantiere_id: true } },
        wbs_node: { select: { id: true, nome: true, cantiere_id: true } },
        documento: { select: { id: true, name: true, file_path: true, type: true, cantiere_id: true } },
    };
}

function hasMaterialImportFields(item) {
    return MATERIAL_IMPORT_KEYS.some((key) => item?.[key] != null && item[key] !== "");
}

async function ensureDocumentBelongsToCantiere(prisma, documentId, cantiereId) {
    if (documentId == null) return true;

    const document = await prisma.document.findUnique({
        where: { id: Number(documentId) },
        select: { id: true, cantiere_id: true },
    });

    return Boolean(document && document.cantiere_id === Number(cantiereId));
}

async function validateExpenseLinks(prisma, { cantiereId, taskId, wbsNodeId, documentId }) {
    if (!(await ensureCantiereActive(prisma, cantiereId))) {
        return "Cantiere non trovato o inattivo.";
    }

    if (!(await ensureTaskBelongsToCantiere(prisma, taskId, cantiereId))) {
        return "Task non trovato o non collegato al cantiere selezionato.";
    }

    if (!(await ensureWbsBelongsToCantiere(prisma, wbsNodeId, cantiereId))) {
        return "Nodo WBS non trovato o non collegato al cantiere selezionato.";
    }

    if (!(await ensureDocumentBelongsToCantiere(prisma, documentId, cantiereId))) {
        return "Documento non trovato o non collegato al cantiere selezionato.";
    }

    return null;
}

export const getPricebook = asyncHandler(async (req, res) => {
    const rows = await listPricebook();
    res.json(rows);
});

export const createManualExpense = asyncHandler(async (req, res) => {
    const uploaderId = req.user?.employee_id;
    if (uploaderId == null || uploaderId === "") {
        return res.status(400).json({ error: "Utente senza employee_id collegato." });
    }
    const { cantiere_id, importo, fornitore, descrizione, pricebook_id, quantita, fonte, wbs_node_id } = req.body;

    let extra = null;
    if ((pricebook_id != null && pricebook_id !== "") || (wbs_node_id != null && wbs_node_id !== "")) {
        extra = {
            pricebook_id: pricebook_id ? Number(pricebook_id) : undefined,
            quantita: quantita != null && quantita !== "" ? Number(quantita) : 1,
            wbs_node_id: wbs_node_id ? Number(wbs_node_id) : undefined,
            stato_validazione: ValidationStatus.PENDING,
        };
    }
    await insertSpesa(
        uploaderId,
        Number(cantiere_id),
        importo,
        fornitore || null,
        descrizione || null,
        fonte || "MANUAL_OFFICE",
        null,
        extra
    );
    res.json({ ok: true });
});

export const bulkImportExpenses = asyncHandler(async (req, res) => {
    let spese_bulk = req.body.spese_bulk;
    const explicitCantiereId = parseIdParam(req.body.cantiere_id ?? req.query.cantiere_id);
    const fallbackCantiereId = explicitCantiereId ?? parseCantiereIdFromReferer(req.get?.("referer") ?? req.headers?.referer);

    if (req.file) {
        try {
            spese_bulk = await parseExpenseRowsFromUploadedFile(req.file, fallbackCantiereId);
        } catch (err) {
            if (err instanceof GenyaImportFormatError) {
                return res.status(400).json({ error: err.message });
            }
            throw err;
        }
    }

    if (!Array.isArray(spese_bulk) || spese_bulk.length === 0) {
        return res.status(400).json({
            error: "Nessuna spesa fornita o CSV non valido.",
            details: "Verifica che il file contenga una colonna importo/totale e un cantiere, oppure avvia l'import dal dettaglio cantiere. Per il formato Full Genya servono importi riga valorizzati.",
        });
    }

    const uploaderEmployeeId = req.user?.employee_id;
    if (uploaderEmployeeId == null || uploaderEmployeeId === "") {
        return res.status(400).json({ error: "Utente senza employee_id collegato: impossibile registrare l'import." });
    }

    const prisma = getDb();
    const employeeId = Number(uploaderEmployeeId);
    const importStats = {
        speseCreate: 0,
        righeLogisticaPending: 0,
        righeSpese: 0,
        warnings: [],
    };

    await prisma.$transaction(async (tx) => {
        const rootWbsCache = new Map();
        for (const item of spese_bulk) {
            const importo = parseImportedMoney(item.importo);
            if (!Number.isFinite(importo) || importo <= 0) throw new Error("Importi devono essere > 0.");

            const hasMaterialFields = hasMaterialImportFields(item);
            const cantiereId = parseIdParam(item.cantiere_id);
            if (!cantiereId) throw new Error("Ogni spesa deve essere associata a un cantiere.");

            if (!(await canAccessCantiere(tx, req.user, cantiereId, {
                globalRoles: ["ADMIN", "HR"],
                ownerRoles: ["PROJECT_MANAGER"],
            }))) {
                throw new Error(`Accesso negato al cantiere ${cantiereId}.`);
            }

            const cantiere = await tx.cantiere.findFirst({ where: { id: cantiereId, attivo: 1 }, select: { id: true } });
            if (!cantiere) throw new Error(`Cantiere non valido o inattivo: ${cantiereId}.`);

            if (hasMaterialFields) {
                importStats.warnings.push("Import Genya trattato come coda logistica: nessun carico magazzino viene creato dal CSV.");
            }
            importStats.righeSpese += 1;
            importStats.righeLogisticaPending += 1;
            if (!rootWbsCache.has(cantiereId)) {
                const rootWbs = await tx.wbsNode.findFirst({ where: { cantiere_id: cantiereId, parent_id: null }, select: { id: true } });
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
                    fonte: "IMPORT_GENYA",
                    input_method: "import_genya",
                    fattura_rif: normalizeOptionalText(item.fattura_rif),
                    stato_validazione: ValidationStatus.PENDING,
                    logistica_status: LogisticaStatus.PENDING_OCR,
                    cost_category: CostCategory.UNKNOWN,
                    allocation_scope: CostAllocationScope.REVIEW,
                },
            });
            importStats.speseCreate += 1;
        }
    });
    res.json({
        ok: true,
        righeProcessate: spese_bulk.length,
        salvate: importStats.speseCreate,
        inserted: importStats.speseCreate,
        speseCreate: importStats.speseCreate,
        righeSpese: importStats.righeSpese,
        righeLogisticaPending: importStats.righeLogisticaPending,
        articoliCreati: 0,
        movimentiCaricoCreati: 0,
        righeDaRiconciliare: 0,
        righeDaRiconciliareDettaglio: [],
        warnings: [...new Set(importStats.warnings)],
    });
});

export const createMyExpense = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const employeeId = getAuthenticatedEmployeeId(req);
    if (!employeeId) {
        return res.status(400).json({ error: "Utente senza employee_id collegato." });
    }

    const {
        cantiere_id,
        task_id = null,
        wbs_node_id = null,
        timestamp_utc = null,
        importo,
        fornitore = null,
        descrizione = null,
        documento_id = null,
    } = req.body;

    const cantiereId = Number(cantiere_id);
    const linkError = await validateExpenseLinks(prisma, {
        cantiereId,
        taskId: task_id,
        wbsNodeId: wbs_node_id,
        documentId: documento_id,
    });
    if (linkError) return res.status(400).json({ error: linkError });

    const wbsNodeId = wbs_node_id ?? (await getRootWbsId(prisma, cantiereId));

    const expense = await prisma.spesa.create({
        data: {
            employee_id: employeeId,
            cantiere_id: cantiereId,
            timestamp_utc: timestamp_utc ?? new Date(),
            task_id: task_id ?? null,
            wbs_node_id: wbsNodeId,
            importo,
            fornitore,
            descrizione,
            documento_id: documento_id ?? null,
            stato_validazione: ValidationStatus.PENDING,
            fonte: WEB_SOURCE,
            input_method: "web",
        },
        include: buildExpenseInclude(),
    });

    res.status(201).json(expense);
});

export const updateMyExpense = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const employeeId = getAuthenticatedEmployeeId(req);
    if (!employeeId) {
        return res.status(400).json({ error: "Utente senza employee_id collegato." });
    }

    const expenseId = Number(req.params.expenseId);
    const existing = await prisma.spesa.findUnique({
        where: { id: expenseId },
        include: buildExpenseInclude(),
    });

    if (!existing) return res.status(404).json({ error: "Spesa non trovata." });
    if (existing.employee_id !== employeeId) {
        return res.status(403).json({ error: "Accesso negato: questa spesa non appartiene all'utente." });
    }
    if (!isMutableStatus(existing.stato_validazione)) {
        return res.status(403).json({ error: "Le spese approvate non possono essere modificate." });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "cantiere_id") && req.body.cantiere_id == null) {
        return res.status(400).json({ error: "Il cantiere non puo essere rimosso da una spesa." });
    }

    const targetCantiereId = Number(req.body.cantiere_id ?? existing.cantiere_id);
    const targetTaskId = req.body.task_id !== undefined ? req.body.task_id : existing.task_id;
    const targetWbsNodeId = req.body.wbs_node_id !== undefined ? req.body.wbs_node_id : existing.wbs_node_id;
    const targetDocumentId = req.body.documento_id !== undefined ? req.body.documento_id : existing.documento_id;

    const linkError = await validateExpenseLinks(prisma, {
        cantiereId: targetCantiereId,
        taskId: targetTaskId,
        wbsNodeId: targetWbsNodeId,
        documentId: targetDocumentId,
    });
    if (linkError) return res.status(400).json({ error: linkError });

    const updateData = {};
    const allowed = [
        "cantiere_id",
        "task_id",
        "wbs_node_id",
        "timestamp_utc",
        "importo",
        "fornitore",
        "descrizione",
        "documento_id",
    ];

    for (const key of allowed) {
        if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    if (updateData.cantiere_id !== undefined) updateData.cantiere_id = targetCantiereId;
    if (updateData.task_id === "") updateData.task_id = null;
    if (updateData.wbs_node_id === "") updateData.wbs_node_id = null;
    if (updateData.documento_id === "") updateData.documento_id = null;
    if (updateData.cantiere_id !== undefined && updateData.wbs_node_id === undefined) {
        updateData.wbs_node_id = await getRootWbsId(prisma, targetCantiereId);
    }

    const updated = await prisma.spesa.update({
        where: { id: expenseId },
        data: updateData,
        include: buildExpenseInclude(),
    });

    res.json(updated);
});

export const deleteMyExpense = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const employeeId = getAuthenticatedEmployeeId(req);
    if (!employeeId) {
        return res.status(400).json({ error: "Utente senza employee_id collegato." });
    }

    const expenseId = Number(req.params.expenseId);
    const existing = await prisma.spesa.findUnique({
        where: { id: expenseId },
        select: {
            id: true,
            employee_id: true,
            stato_validazione: true,
        },
    });

    if (!existing) return res.status(404).json({ error: "Spesa non trovata." });
    if (existing.employee_id !== employeeId) {
        return res.status(403).json({ error: "Accesso negato: questa spesa non appartiene all'utente." });
    }
    if (!isMutableStatus(existing.stato_validazione)) {
        return res.status(403).json({ error: "Le spese approvate non possono essere eliminate." });
    }

    await prisma.spesa.delete({ where: { id: expenseId } });
    res.json({ ok: true, expenseId });
});
