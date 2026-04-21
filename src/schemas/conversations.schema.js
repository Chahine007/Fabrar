import { z } from "zod";

export const conversationIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("ID conversazione non valido."),
    }),
});

export const createMessageSchema = z.object({
    params: z.object({
        id: z.string().uuid("ID conversazione non valido."),
    }),
    body: z.object({
        content: z.string().trim().min(1, "Il contenuto del messaggio è obbligatorio."),
        type: z.string().optional().default("text"),
    }),
});