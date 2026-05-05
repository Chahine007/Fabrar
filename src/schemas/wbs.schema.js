import { z } from "zod";

const optionalPositiveDecimal = z.coerce
  .number()
  .positive("Il budget deve essere un numero positivo.")
  .optional()
  .nullable();

export const createWbsNodeSchema = z.object({
  params: z.object({
    id: z.coerce.number().positive("ID cantiere non valido."),
  }),
  body: z.object({
    nome: z
      .string({ required_error: "Il nome della fase è obbligatorio." })
      .trim()
      .min(2, "Il nome deve essere di almeno 2 caratteri."),
    budget_preventivato: optionalPositiveDecimal,
    parent_id: z.coerce.number().positive().optional().nullable(),
  }),
});

export const updateWbsNodeSchema = z.object({
  params: z.object({
    id: z.coerce.number().positive("ID cantiere non valido."),
    nodeId: z.coerce.number().positive("ID nodo non valido."),
  }),
  body: z
    .object({
      nome: z.string().trim().min(2).optional(),
      budget_preventivato: optionalPositiveDecimal,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteWbsNodeSchema = z.object({
  params: z.object({
    id: z.coerce.number().positive("ID cantiere non valido."),
    nodeId: z.coerce.number().positive("ID nodo non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});
