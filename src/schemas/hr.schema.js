import { z } from "zod";

export const getKpiSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive(),
    }),
});

export const getAuditSchema = z.object({
    query: z.object({
        type: z.enum(["ore", "spese"]).optional().nullable(),
        status: z.string().optional().nullable(),
        employee_id: z.coerce.number().optional().nullable(),
        cantiere_id: z.coerce.number().optional().nullable(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
        offset: z.coerce.number().int().min(0).optional(),
    }).partial(),
});

const booleanQuery = z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") return true;
        if (normalized === "false" || normalized === "0") return false;
    }
    return value;
}, z.boolean().optional());

export const getAuditLogsSchema = z.object({
    query: z.object({
        employee_id: z.coerce.number().positive().optional().nullable(),
        message_type: z.string().max(50).optional().nullable(),
        has_extracted_json: booleanQuery,
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        search: z.string().max(300).optional().nullable(),
    }).partial(),
});

export const auditBulkSchema = z.object({
    body: z.object({
        items: z.array(z.object({
            id: z.coerce.number(),
            type: z.enum(["ore", "spese"]),
            newStatus: z.string(),
        })).optional(),
        ids: z.array(z.coerce.number()).optional(),
        action: z.string().optional(),
    }).refine(data => data.items || (data.ids && data.action), {
        message: "Fornire 'items' oppure 'ids' e 'action'.",
    }),
});

export const userCostSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive(),
    }),
    body: z.object({
        costo_orario: z.number().positive(),
        valido_dal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
});

export const updateReportEntrySchema = z.object({
    params: z.object({
        id: z.coerce.number(),
    }),
    body: z.object({
        stato_validazione: z.string().optional(),
        ore_lavorate: z.number().optional(),
        attivita_svolte: z.string().optional().nullable(),
    }).partial(),
});

export const updateReportSchema = z.object({
    params: z.object({
        id: z.coerce.number(),
    }),
    body: z.object({
        note: z.string().optional().nullable(),
        report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).partial(),
});

export const updateSpesaSchema = z.object({
    params: z.object({
        id: z.coerce.number(),
    }),
    body: z.object({
        stato_validazione: z.string().optional(),
        importo: z.number().optional(),
        descrizione: z.string().optional().nullable(),
    }).partial(),
});

/**
 * Schema per la modifica admin di una timbratura.
 * Permette di cambiare: ore lavorate, cantiere assegnato, nodo WBS, note.
 */
export const updateReportEntryAdminSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive(),
    }),
    body: z.object({
        ore_lavorate:    z.coerce.number().min(0).max(24).optional(),
        cantiere_id:     z.coerce.number().positive().optional().nullable()
                          .or(z.literal('').transform(() => null)),
        wbs_node_id:     z.coerce.number().positive().optional().nullable()
                          .or(z.literal('').transform(() => null)),
        attivita_svolte: z.string().max(500).optional().nullable(),
    }).refine(data => Object.keys(data).length > 0, {
        message: 'Nessun campo da aggiornare.',
    }),
});
