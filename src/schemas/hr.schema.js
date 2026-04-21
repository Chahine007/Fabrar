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
