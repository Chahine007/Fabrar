import { Router } from "express";
import { verifyTokenAndRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { conversationIdSchema, createConversationSchema, createMessageSchema } from "../schemas/conversations.schema.js";
import {
    listConversations,
    findOrCreateDirectConversation,
    getConversationMessages,
    createMessage
} from "../controllers/conversations.controller.js";

const router = Router();

router.use("/api/conversations", verifyTokenAndRole(["ADMIN", "HR", "PROJECT_MANAGER", "WORKER"]));

router.get("/api/conversations", listConversations);
router.post("/api/conversations", validate(createConversationSchema), findOrCreateDirectConversation);
router.get("/api/conversations/:id/messages", validate(conversationIdSchema), getConversationMessages);
router.post("/api/conversations/:id/messages", validate(createMessageSchema), createMessage);

export default router;
