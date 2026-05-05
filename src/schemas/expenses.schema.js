import { z } from "zod";

const optionalText = z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .optional()
    .nullable();

const optionalPositiveInt = z.preprocess(
    (value) => (value == null || value === "" ? null : value),
    z.coerce.number().int().positive("ID non valido.").nullable().optional()
);

const optionalDate = z.preprocess(
    (value) => (value == null || value === "" ? undefined : value),
    z.coerce.date().optional()
);

export const manualExpenseSchema = z.object({
    body: z.object({
        cantiere_id: z.coerce.number().positive("cantiere_id obbligatorio."),
        importo: z.coerce.number().positive("Importo obbligatorio e > 0."),
        fornitore: z.string().optional().nullable(),
        descrizione: z.string().optional().nullable(),
        // Accetta un ID valido oppure stringa vuota/null per permettere l'annullamento
        pricebook_id: z.union([z.coerce.number().positive(), z.literal(""), z.null()]).optional(),
        quantita: z.union([z.coerce.number().positive(), z.literal(""), z.null()]).optional(),
        wbs_node_id: z.union([z.coerce.number().positive(), z.literal(""), z.null()]).optional(),
        fonte: z.string().optional().nullable(),
    }),
});

function normalizeExpenseBody(data) {
    return {
        ...data,
        documento_id: data.documento_id ?? data.document_id,
        timestamp_utc: data.timestamp_utc ?? data.date,
    };
}

export const createMyExpenseSchema = z.object({
    params: z.object({}).passthrough(),
    query: z.object({}).passthrough(),
    body: z
        .object({
            cantiere_id: z.coerce.number().int().positive("ID cantiere obbligatorio."),
            timestamp_utc: optionalDate,
            date: optionalDate,
            task_id: optionalPositiveInt,
            wbs_node_id: optionalPositiveInt,
            importo: z.coerce.number().positive("Importo obbligatorio e > 0."),
            fornitore: optionalText,
            descrizione: optionalText,
            documento_id: optionalPositiveInt,
            document_id: optionalPositiveInt,
        })
        .transform(normalizeExpenseBody),
});

export const updateMyExpenseSchema = z.object({
    params: z.object({
        expenseId: z.coerce.number().int().positive("ID spesa non valido."),
    }),
    query: z.object({}).passthrough(),
    body: z
        .object({
            cantiere_id: optionalPositiveInt,
            timestamp_utc: optionalDate,
            date: optionalDate,
            task_id: optionalPositiveInt,
            wbs_node_id: optionalPositiveInt,
            importo: z.coerce.number().positive("Importo obbligatorio e > 0.").optional(),
            fornitore: optionalText,
            descrizione: optionalText,
            documento_id: optionalPositiveInt,
            document_id: optionalPositiveInt,
        })
        .refine((data) => Object.values(data).some((value) => value !== undefined), {
            message: "Nessun campo da aggiornare.",
        })
        .transform(normalizeExpenseBody),
});

export const deleteMyExpenseSchema = z.object({
    params: z.object({
        expenseId: z.coerce.number().int().positive("ID spesa non valido."),
    }),
    query: z.object({}).passthrough(),
    body: z.object({}).passthrough(),
});
