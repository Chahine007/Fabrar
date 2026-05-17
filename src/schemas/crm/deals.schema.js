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

const optionalPositiveInt = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce.number().int().positive("ID non valido.").optional()
);

const optionalMoney = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce.number().nonnegative("Importo non valido.").optional()
);

const STAGES = ["PROSPECT", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export const listCrmDealsSchema = z.object({
  query: z.object({
    search: optionalTrimmedString,
    account_id: optionalPositiveInt,
    owner_user_id: optionalPositiveInt,
    stage: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.enum(STAGES).optional()),
    take: z
      .preprocess((v) => (v == null || v === "" ? 50 : v), z.coerce.number().int().min(1).max(100)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createCrmDealSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    account_id: optionalPositiveInt,
    title: z.string().trim().min(1, "Titolo deal obbligatorio."),
    description: optionalTrimmedText,
    stage: z.enum(STAGES).optional(),
    amount: optionalMoney,
    currency: optionalTrimmedText,
    expected_close: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
    owner_user_id: optionalPositiveInt,
  }),
});

export const updateCrmDealSchema = z.object({
  params: z.object({
    dealId: z.coerce.number().int().positive("ID deal non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      account_id: optionalPositiveInt,
      title: z.string().trim().min(1).optional(),
      description: optionalTrimmedText,
      stage: z.enum(STAGES).optional(),
      amount: optionalMoney,
      currency: optionalTrimmedText,
      expected_close: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
      owner_user_id: optionalPositiveInt,
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteCrmDealSchema = z.object({
  params: z.object({
    dealId: z.coerce.number().int().positive("ID deal non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

