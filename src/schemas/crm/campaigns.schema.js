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

const STATUS = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"];

export const listCrmCampaignsSchema = z.object({
  query: z.object({
    search: optionalTrimmedString,
    status: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.enum(STATUS).optional()),
    take: z
      .preprocess((v) => (v == null || v === "" ? 50 : v), z.coerce.number().int().min(1).max(100)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createCrmCampaignSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    name: z.string().trim().min(1, "Nome campagna obbligatorio."),
    description: optionalTrimmedText,
    status: z.enum(STATUS).optional(),
    start_date: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
    end_date: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
    channel: optionalTrimmedText,
  }),
});

export const updateCrmCampaignSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive("ID campagna non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      description: optionalTrimmedText,
      status: z.enum(STATUS).optional(),
      start_date: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
      end_date: z.preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.date().optional()),
      channel: optionalTrimmedText,
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteCrmCampaignSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive("ID campagna non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const listCrmCampaignMembersSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive("ID campagna non valido."),
  }),
  query: z.object({
    take: z
      .preprocess((v) => (v == null || v === "" ? 100 : v), z.coerce.number().int().min(1).max(200)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  body: z.object({}).passthrough(),
});

export const addCrmCampaignMemberSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive("ID campagna non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({
    contact_id: z.coerce.number().int().positive("ID contatto non valido."),
    status: optionalTrimmedText,
  }),
});

export const removeCrmCampaignMemberSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive("ID campagna non valido."),
    contactId: z.coerce.number().int().positive("ID contatto non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

