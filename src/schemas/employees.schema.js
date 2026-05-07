import { z } from "zod";

const employeeRoles = ["WORKER", "ADMIN", "PROJECT_MANAGER", "HR", "WAREHOUSEMAN"];

export const employeeIdSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID dipendente non valido."),
    }),
});

export const createEmployeeSchema = z.object({
    body: z.object({
        firstName: z.string().trim().min(1, "Il nome e' obbligatorio."),
        lastName: z.string().trim().min(1, "Il cognome e' obbligatorio."),
        role: z.enum(employeeRoles, { message: "Ruolo non valido." }),
        hourly_rate: z.coerce.number().min(0, "Il costo orario non puo' essere negativo.").optional(),
        email: z
            .union([z.string().trim().email("Email non valida."), z.literal("")])
            .optional()
            .transform((value) => (value === "" ? undefined : value)),
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

export const searchEmployeesSchema = z.object({
    query: z.object({
        q: z.string().trim().min(1, "Parametro di ricerca obbligatorio."),
    }),
});
