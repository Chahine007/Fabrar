import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .optional()
  .nullable();

const positiveInt = z.coerce.number().int().positive("ID non valido.");

const optionalPositiveInt = z.preprocess(
  (value) => (value == null || value === "" ? null : value),
  positiveInt.nullable().optional()
);

const positiveDecimal = z.coerce.number().positive("La quantita deve essere maggiore di 0.");

export const createArticoloSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    codice_sku: z.string().trim().min(1, "codice_sku obbligatorio."),
    descrizione: z.string().trim().min(1, "descrizione obbligatoria."),
    unita_misura: z.string().trim().min(1, "unita_misura obbligatoria."),
    costo_medio: z.coerce.number().nonnegative("costo_medio non valido.").optional(),
    scorta_minima: z.coerce.number().int().nonnegative("scorta_minima non valida.").optional(),
    categoria: optionalText,
    fornitore_default_id: optionalPositiveInt,
  }),
});

export const createUbicazioneSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    codice: z.string().trim().min(1, "codice obbligatorio."),
    descrizione: optionalText,
  }),
});

export const getMovimentiCantiereSchema = z.object({
  params: z.object({
    cantiere_id: positiveInt,
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createMovimentoSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z
    .object({
      tipo_movimento: z.enum(["CARICO", "SCARICO_CANTIERE"]),
      articolo_id: positiveInt,
      quantita: positiveDecimal,
      ubicazione_da_id: optionalPositiveInt,
      ubicazione_a_id: optionalPositiveInt,
      cantiere_id: optionalPositiveInt,
      wbs_node_id: optionalPositiveInt,
      task_id: optionalPositiveInt,
      costo_acquisto: z.coerce.number().positive("costo_acquisto deve essere maggiore di 0.").optional(),
      documento_id: optionalPositiveInt,
      fornitore_id: optionalPositiveInt,
    })
    .superRefine((data, ctx) => {
      if (data.tipo_movimento === "CARICO") {
        if (!data.ubicazione_a_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ubicazione_a_id"],
            message: "ubicazione_a_id obbligatoria per un carico.",
          });
        }
        if (data.costo_acquisto === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["costo_acquisto"],
            message: "costo_acquisto obbligatorio per un carico.",
          });
        }
      }

      if (data.tipo_movimento === "SCARICO_CANTIERE") {
        if (!data.ubicazione_da_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ubicazione_da_id"],
            message: "ubicazione_da_id obbligatoria per uno scarico cantiere.",
          });
        }
        if (!data.cantiere_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cantiere_id"],
            message: "cantiere_id obbligatorio per uno scarico cantiere.",
          });
        }
      }
    }),
});
