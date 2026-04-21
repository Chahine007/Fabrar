import { z } from "zod";

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