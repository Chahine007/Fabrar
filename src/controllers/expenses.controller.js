import { insertSpesa, listPricebook, getDb } from "../db/index.js";
import { normalizeOptionalText, parseIdParam } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function parseImportedTimestamp(value) {
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
            stato_validazione: "PENDING",
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

    if (req.file) {
        const csvText = req.file.buffer.toString("utf-8");
        const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

        if (lines.length > 1) {
            const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
            spese_bulk = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(/[;,]/).map((v) => v.trim().replace(/^["']|["']$/g, ""));
                const row = {};
                headers.forEach((h, idx) => { row[h] = values[idx] || null; });
                if (row.importo && row.cantiere_id) spese_bulk.push(row);
            }
        }
    }

    if (!Array.isArray(spese_bulk) || spese_bulk.length === 0) {
        return res.status(400).json({ error: "Nessuna spesa fornita o CSV non valido." });
    }

    const uploaderEmployeeId = req.user?.employee_id;
    if (uploaderEmployeeId == null || uploaderEmployeeId === "") {
        return res.status(400).json({ error: "Utente senza employee_id collegato: impossibile registrare l'import." });
    }

    const prisma = getDb();
    const employeeId = Number(uploaderEmployeeId);

    await prisma.$transaction(async (tx) => {
        const rootWbsCache = new Map();
        for (const item of spese_bulk) {
            const importo = typeof item.importo === "number" ? item.importo : parseFloat(String(item.importo));
            if (!Number.isFinite(importo) || importo <= 0) throw new Error("Importi devono essere > 0.");

            const cantiereId = parseIdParam(item.cantiere_id);
            if (!cantiereId) throw new Error("Ogni spesa deve essere associata a un cantiere.");

            const cantiere = await tx.cantiere.findFirst({ where: { id: cantiereId, attivo: 1 }, select: { id: true } });
            if (!cantiere) throw new Error(`Cantiere non valido o inattivo: ${cantiereId}.`);

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
                    fonte: normalizeOptionalText(item.fonte) || "IMPORT",
                    fattura_rif: normalizeOptionalText(item.fattura_rif),
                    stato_validazione: "PENDING",
                },
            });
        }
    });
    res.json({ ok: true, salvate: spese_bulk.length });
});