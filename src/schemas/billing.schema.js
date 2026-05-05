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
const optionalDate = z.preprocess(
  (value) => (value == null || value === "" ? null : value),
  z.coerce.date().nullable().optional()
);

const installmentStatus = z.enum(["PENDING"]);
const invoiceStatus = z.enum(["DRAFT", "ISSUED"]);

export const createInstallmentSchema = z.object({
  params: z.object({ cantiereId: positiveInt }),
  query: z.object({}).passthrough(),
  body: z.object({
    nome: z.string().trim().min(1, "Il nome della rata è obbligatorio."),
    wbs_node_id: optionalPositiveInt,
    percentuale: z.coerce.number().min(0).max(100).optional().nullable(),
    importo_previsto: z.coerce.number().min(0, "importo_previsto non valido."),
    data_scadenza_prevista: optionalDate,
    stato: installmentStatus.optional(),
  }),
});

export const updateInstallmentSchema = z.object({
  params: z.object({ installmentId: positiveInt }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      nome: z.string().trim().min(1).optional(),
      wbs_node_id: optionalPositiveInt,
      percentuale: z.coerce.number().min(0).max(100).optional().nullable(),
      importo_previsto: z.coerce.number().min(0).optional(),
      data_scadenza_prevista: optionalDate,
      stato: installmentStatus.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Nessun campo valido da aggiornare.",
    }),
});

export const createInvoiceSchema = z.object({
  params: z.object({ cantiereId: positiveInt }),
  query: z.object({}).passthrough(),
  body: z.object({
    numero_fattura: optionalText,
    data_emissione: optionalDate,
    importo_totale: z.coerce.number().min(0).optional(),
    stato: invoiceStatus.optional(),
    documento_id: optionalPositiveInt,
    note: optionalText,
    installment_ids: z.array(positiveInt).optional(),
  }),
});
