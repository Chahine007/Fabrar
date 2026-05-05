import { z } from "zod";

const positiveInt = z.coerce.number().int().positive("ID fornitore non valido.");
const nullableText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .optional()
  .nullable();

export const supplierIdSchema = z.object({
  params: z.object({ id: positiveInt }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createSupplierSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    ragione_sociale: z.string().trim().min(1, "La ragione sociale è obbligatoria."),
    partita_iva: nullableText,
    email: nullableText,
    telefono: nullableText,
    indirizzo: nullableText,
    note: nullableText,
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({ id: positiveInt }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      ragione_sociale: z.string().trim().min(1, "La ragione sociale non può essere vuota.").optional(),
      partita_iva: nullableText,
      email: nullableText,
      telefono: nullableText,
      indirizzo: nullableText,
      note: nullableText,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Nessun campo valido da aggiornare.",
    }),
});
