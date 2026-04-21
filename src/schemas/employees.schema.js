import { z } from "zod";

export const employeeIdSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID dipendente non valido."),
    }),
});

export const updateEmployeeSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID dipendente non valido."),
    }),
    body: z
        .object({
            nome: z.string().optional().nullable(),
            cognome: z.string().optional().nullable(),
            ruolo: z.string().optional().nullable(),
            telefono: z.string().optional().nullable(),
            skills: z.string().optional().nullable(),
            note_admin: z.string().optional().nullable(),
            documenti: z.string().optional().nullable(),
            attivo: z.coerce.number().int().min(0).max(1).optional(),
        })
        .partial()
        .refine((data) => Object.keys(data).length > 0, {
            message: "Nessun campo da aggiornare.",
        }),
});

export const parseCvSchema = z.object({
    body: z.object({
        text: z.string().min(20, "Testo CV troppo corto o mancante (minimo 20 caratteri)."),
    }),
});