import { z } from "zod";

const positiveInt = z.coerce.number().int().positive("ID non valido.");
const optionalPositiveInt = z.preprocess(
  (value) => (value == null || value === "" ? null : value),
  positiveInt.nullable().optional()
);
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .optional()
  .nullable();

const requestLineSchema = z.object({
  articolo_id: positiveInt,
  quantita: z.coerce.number().int().positive("La quantità deve essere maggiore di 0."),
  note: optionalText,
});

export const listMaterialRequestsSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED"]).optional(),
    cantiere_id: positiveInt.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: positiveInt.optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }).passthrough(),
  body: z.object({}).passthrough(),
});

export const createMaterialRequestSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z
    .object({
      cantiere_id: positiveInt,
      task_id: optionalPositiveInt,
      note: optionalText,
      righe: z.array(requestLineSchema).optional(),
      lines: z.array(requestLineSchema).optional(),
      items: z.array(requestLineSchema).optional(),
    })
    .superRefine((data, ctx) => {
      const lines = data.righe ?? data.lines ?? data.items ?? [];
      if (!Array.isArray(lines) || lines.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["righe"],
          message: "La richiesta deve contenere almeno una riga materiale.",
        });
      }
    }),
});

export const updateMaterialRequestStatusSchema = z.object({
  params: z.object({ id: positiveInt }),
  query: z.object({}).passthrough(),
  body: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  }),
});

export const fulfillMaterialRequestSchema = z.object({
  params: z.object({ id: positiveInt }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});
