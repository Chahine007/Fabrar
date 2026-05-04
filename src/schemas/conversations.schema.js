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

export const createConversationSchema = z.object({
    body: z.object({
        targetEmployeeId: z.coerce.number().int().positive("ID dipendente non valido."),
    }),
});
