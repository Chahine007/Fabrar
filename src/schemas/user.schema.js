import { z } from "zod";

export const updateUserSettingsSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    notifications: z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      telegram: z.boolean().optional(),
      dailySummary: z.boolean().optional(),
      criticalAlerts: z.boolean().optional(),
    }).optional(),
    preferences: z.object({
      theme: z.enum(["light", "dark"]).optional(),
      language: z.enum(["it", "en", "es", "fr"]).optional(),
      timezone: z.string().trim().min(1).optional(),
      dateFormat: z.enum(["DD/MM/YYYY", "YYYY-MM-DD"]).optional(),
    }).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "Nessuna impostazione fornita.",
  }),
});

export const changePasswordSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    currentPassword: z.string().min(1, "Password corrente obbligatoria."),
    newPassword: z.string().min(8, "La nuova password deve contenere almeno 8 caratteri."),
  }),
});
