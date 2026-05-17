import { z } from "zod";

const optionalTrimmedText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .optional()
  .nullable();

const optionalPositiveInt = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce.number().int().positive("ID non valido.").optional()
);

export const listCrmInteractionsSchema = z.object({
  query: z.object({
    account_id: optionalPositiveInt,
    contact_id: optionalPositiveInt,
    deal_id: optionalPositiveInt,
    ticket_id: optionalPositiveInt,
    take: z
      .preprocess((v) => (v == null || v === "" ? 50 : v), z.coerce.number().int().min(1).max(200)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createCrmInteractionSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "TASK"]).optional(),
    occurred_at: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
    subject: optionalTrimmedText,
    body: optionalTrimmedText,
    outcome: optionalTrimmedText,
    account_id: optionalPositiveInt,
    contact_id: optionalPositiveInt,
    deal_id: optionalPositiveInt,
    ticket_id: optionalPositiveInt,
  }),
});

