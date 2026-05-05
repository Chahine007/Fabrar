import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida. Usa YYYY-MM-DD.");

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

const timeField = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato orario non valido. Usa HH:mm.")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

function normalizeTimeBody(data) {
  return {
    ...data,
    report_date: data.report_date ?? data.date,
    attivita_svolte: data.attivita_svolte ?? data.descrizione,
  };
}

export const createMyTimeEntrySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z
    .object({
      report_date: dateOnly.optional(),
      date: dateOnly.optional(),
      cantiere_id: z.coerce.number().int().positive("ID cantiere obbligatorio."),
      task_id: optionalPositiveInt,
      wbs_node_id: optionalPositiveInt,
      ore_lavorate: z.coerce.number().positive("Le ore devono essere maggiori di 0.").max(24),
      ingresso: timeField,
      pausa_inizio: timeField,
      pausa_fine: timeField,
      uscita: timeField,
      descrizione: optionalText,
      attivita_svolte: optionalText,
      luogo_cantiere: optionalText,
      problemi_riscontrati: optionalText,
    })
    .refine((data) => data.report_date || data.date, {
      message: "La data del report e obbligatoria.",
      path: ["report_date"],
    })
    .transform(normalizeTimeBody),
});

export const updateMyTimeEntrySchema = z.object({
  params: z.object({
    entryId: z.coerce.number().int().positive("ID riga ore non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      cantiere_id: optionalPositiveInt,
      task_id: optionalPositiveInt,
      wbs_node_id: optionalPositiveInt,
      ore_lavorate: z.coerce.number().positive("Le ore devono essere maggiori di 0.").max(24).optional(),
      ingresso: timeField,
      pausa_inizio: timeField,
      pausa_fine: timeField,
      uscita: timeField,
      descrizione: optionalText,
      attivita_svolte: optionalText,
      luogo_cantiere: optionalText,
      problemi_riscontrati: optionalText,
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    })
    .transform(normalizeTimeBody),
});

export const deleteMyTimeEntrySchema = z.object({
  params: z.object({
    entryId: z.coerce.number().int().positive("ID riga ore non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});
