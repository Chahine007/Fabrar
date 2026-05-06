import { z } from "zod";

export const conversationIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("ID conversazione non valido."),
    }),
    query: z.object({
        limit: z.coerce.number().int().min(1).max(500).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        cursor: z.string().uuid().optional(),
    }).passthrough(),
    body: z.object({}).passthrough(),
});

export const createMessageSchema = z.object({
    params: z.object({
        id: z.string().uuid("ID conversazione non valido."),
    }),
    body: z.object({
        content: z.string().trim().min(1, "Il contenuto del messaggio è obbligatorio."),
        type: z.enum(["text"]).optional().default("text"),
    }),
});

export const createConversationSchema = z.object({
    body: z.object({
        targetEmployeeId: z.coerce.number().int().positive("ID dipendente non valido."),
    }),
});
