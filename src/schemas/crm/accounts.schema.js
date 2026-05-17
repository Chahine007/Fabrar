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

export const listCrmAccountsSchema = z.object({
  query: z.object({
    search: optionalTrimmedString,
    is_active: z
      .preprocess((v) => (v == null || v === "" ? undefined : v), z.coerce.boolean().optional()),
    take: z
      .preprocess((v) => (v == null || v === "" ? 50 : v), z.coerce.number().int().min(1).max(100)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  params: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const getCrmAccountSchema = z.object({
  params: z.object({
    accountId: z.coerce.number().int().positive("ID account non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const createCrmAccountSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    name: z.string().trim().min(1, "Nome account obbligatorio."),
    vat_number: optionalTrimmedText,
    tax_code: optionalTrimmedText,
    email: optionalTrimmedText,
    phone: optionalTrimmedText,
    website: optionalTrimmedText,
    address: optionalTrimmedText,
    city: optionalTrimmedText,
    postal_code: optionalTrimmedText,
    country: optionalTrimmedText,
    industry: optionalTrimmedText,
    notes: optionalTrimmedText,
    tags: optionalTrimmedText,
    is_active: z.preprocess((v) => (v == null || v === "" ? true : v), z.coerce.boolean()),
  }),
});

export const updateCrmAccountSchema = z.object({
  params: z.object({
    accountId: z.coerce.number().int().positive("ID account non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      name: z.string().trim().min(1, "Nome account non valido.").optional(),
      vat_number: optionalTrimmedText,
      tax_code: optionalTrimmedText,
      email: optionalTrimmedText,
      phone: optionalTrimmedText,
      website: optionalTrimmedText,
      address: optionalTrimmedText,
      city: optionalTrimmedText,
      postal_code: optionalTrimmedText,
      country: optionalTrimmedText,
      industry: optionalTrimmedText,
      notes: optionalTrimmedText,
      tags: optionalTrimmedText,
      is_active: z.coerce.boolean().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteCrmAccountSchema = z.object({
  params: z.object({
    accountId: z.coerce.number().int().positive("ID account non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

export const listCrmContactsByAccountSchema = z.object({
  params: z.object({
    accountId: z.coerce.number().int().positive("ID account non valido."),
  }),
  query: z.object({
    search: optionalTrimmedString,
    take: z
      .preprocess((v) => (v == null || v === "" ? 50 : v), z.coerce.number().int().min(1).max(100)),
    skip: z
      .preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number().int().min(0)),
  }),
  body: z.object({}).passthrough(),
});

export const createCrmContactForAccountSchema = z.object({
  params: z.object({
    accountId: z.coerce.number().int().positive("ID account non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({
    first_name: optionalTrimmedText,
    last_name: optionalTrimmedText,
    full_name: optionalTrimmedText,
    email: optionalTrimmedText,
    phone: optionalTrimmedText,
    mobile: optionalTrimmedText,
    title: optionalTrimmedText,
    department: optionalTrimmedText,
    is_primary: z.preprocess((v) => (v == null || v === "" ? false : v), z.coerce.boolean()),
    notes: optionalTrimmedText,
    tags: optionalTrimmedText,
  }),
});

export const updateCrmContactSchema = z.object({
  params: z.object({
    contactId: z.coerce.number().int().positive("ID contatto non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z
    .object({
      account_id: optionalPositiveInt,
      first_name: optionalTrimmedText,
      last_name: optionalTrimmedText,
      full_name: optionalTrimmedText,
      email: optionalTrimmedText,
      phone: optionalTrimmedText,
      mobile: optionalTrimmedText,
      title: optionalTrimmedText,
      department: optionalTrimmedText,
      is_primary: z.coerce.boolean().optional(),
      notes: optionalTrimmedText,
      tags: optionalTrimmedText,
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "Nessun campo da aggiornare.",
    }),
});

export const deleteCrmContactSchema = z.object({
  params: z.object({
    contactId: z.coerce.number().int().positive("ID contatto non valido."),
  }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough(),
});

