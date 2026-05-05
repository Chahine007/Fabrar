import { z } from "zod";

const optionalText = z.string().trim().transform((v) => (v === "" ? null : v)).optional().nullable();

export const createCantiereSchema = z.object({
    body: z.object({
        nome: z.string({ required_error: "Nome cantiere obbligatorio." }).min(3, { message: "Il nome deve essere di almeno 3 caratteri." }),
        indirizzo: optionalText,
        lat: z.coerce.number().optional().nullable(),
        lng: z.coerce.number().optional().nullable(),
        budget: z.coerce.number().positive("Il budget deve essere un numero positivo.").optional().nullable(),
        valore_contratto: z.coerce.number().positive("Il valore contratto deve essere un numero positivo.").optional().nullable(),
        budget_spese: z.coerce.number().nonnegative("Il budget spese non puo essere negativo.").optional().nullable(),
    }),
});

export const updateCantiereSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID cantiere non valido."),
    }),
    body: z.object({
        nome: z.string().trim().min(1, "Nome cantiere obbligatorio.").optional(),
        indirizzo: optionalText,
        lat: z.coerce.number().optional().nullable(),
        lng: z.coerce.number().optional().nullable(),
        budget: z.coerce.number().positive().optional().nullable(),
        valore_contratto: z.coerce.number().positive().optional().nullable(),
        budget_spese: z.coerce.number().nonnegative().optional().nullable(),
        raggio_tolleranza: z.coerce.number().nonnegative("raggio_tolleranza non valido.").optional().nullable(),
        attivo: z.coerce.number().optional(),
    }).refine((data) => Object.keys(data).length > 0, {
        message: "Nessun campo da aggiornare.",
    }),
});

export const toggleCantiereSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID cantiere non valido."),
    }),
    query: z.object({}).passthrough(),
    body: z.object({}).passthrough(),
});

export const updateGpsSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID cantiere non valido."),
    }),
    query: z.object({}).passthrough(),
    body: z.object({
        lat: z.coerce.number().min(-90, "Latitudine non valida.").max(90, "Latitudine non valida."),
        lng: z.coerce.number().min(-180, "Longitudine non valida.").max(180, "Longitudine non valida."),
    }),
});

export const updateCantiereSettingsSchema = z.object({
    params: z.object({
        id: z.coerce.number().positive("ID cantiere non valido."),
    }),
    body: z.object({
        nome: z.string().min(1).optional(),
        indirizzo: optionalText,
        lat: z.coerce.number().optional().nullable(),
        lng: z.coerce.number().optional().nullable(),
        raggio_tolleranza: z.coerce.number().min(50, "Il raggio minimo è 50m.").max(2000, "Il raggio massimo è 2000m.").optional().nullable(),
        bot_checkin_gps: z.boolean().optional(),
        bot_anomaly_action: z.enum(['LOG', 'BLOCK']).optional(),
        bot_wbs_prompt_thr: z.coerce.number().min(1).optional(),
        budget_contingency: z.coerce.number().nonnegative().optional().nullable(),
        valore_contratto: z.coerce.number().positive().optional().nullable(),
        budget_spese: z.coerce.number().nonnegative().optional().nullable(),
        kpi_warning_thr: z.coerce.number().min(0).max(100).optional(),
        kpi_critical_thr: z.coerce.number().min(0).max(100).optional(),
        client_name: optionalText,
        client_ref_email: z.string().email("Email non valida.").optional().or(z.literal('')).transform(e => e === '' ? null : e).nullable(),
        pm_id: z.coerce.number().positive().optional().nullable(),
        site_manager_id: z.coerce.number().positive().optional().nullable(),
    }).refine((data) => Object.keys(data).length > 0, {
        message: "Nessuna impostazione fornita.",
    }),
});
