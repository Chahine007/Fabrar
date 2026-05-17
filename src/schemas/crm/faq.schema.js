import { z } from "zod";

const optionalTrimmedText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .optional()
  .nullable();

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const listCrmFaqSchema = z.object({
  query: z.object({
    category: optionalTrimmedString,
    is_active: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.boolean().optional()),
    take: z
      .preprocess((v) => (v == null || v === "" ? 100 : v), z.coerce.number().int().min(1).max(200)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createCrmFaqSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    question: z.string().trim().min(1, "Domanda obbligatoria."),
    answer: z.string().trim().min(1, "Risposta obbligatoria."),
    category: optionalTrimmedText,
    is_active: z.preprocess((v) => (v == null || v === "" ? true : v), z.coerce.boolean()),
    sort_order: z.preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
});

export const updateCrmFaqSchema = z.object({
  params: z.object({
    faqId: z.coerce.number().int().positive("ID FAQ non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      question: z.string().trim().min(1).optional(),
      answer: z.string().trim().min(1).optional(),
      category: optionalTrimmedText,
      is_active: z.coerce.boolean().optional(),
      sort_order: z.coerce.number().int().min(0).optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteCrmFaqSchema = z.object({
  params: z.object({
    faqId: z.coerce.number().int().positive("ID FAQ non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

