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

const STATUS = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const listCrmTicketsSchema = z.object({
  query: z.object({
    search: optionalTrimmedString,
    account_id: optionalPositiveInt,
    contact_id: optionalPositiveInt,
    assignee_user_id: optionalPositiveInt,
    status: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.enum(STATUS).optional()),
    priority: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.enum(PRIORITY).optional()),
    take: z
      .preprocess((v) => (v == null || v === "" ? 50 : v), z.coerce.number().int().min(1).max(100)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createCrmTicketSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    account_id: optionalPositiveInt,
    contact_id: optionalPositiveInt,
    subject: z.string().trim().min(1, "Oggetto ticket obbligatorio."),
    description: optionalTrimmedText,
    status: z.enum(STATUS).optional(),
    priority: z.enum(PRIORITY).optional(),
    assignee_user_id: optionalPositiveInt,
  }),
});

export const updateCrmTicketSchema = z.object({
  params: z.object({
    ticketId: z.coerce.number().int().positive("ID ticket non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      account_id: optionalPositiveInt,
      contact_id: optionalPositiveInt,
      subject: z.string().trim().min(1).optional(),
      description: optionalTrimmedText,
      status: z.enum(STATUS).optional(),
      priority: z.enum(PRIORITY).optional(),
      assignee_user_id: optionalPositiveInt,
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteCrmTicketSchema = z.object({
  params: z.object({
    ticketId: z.coerce.number().int().positive("ID ticket non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

