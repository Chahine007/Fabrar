import { Router } from "express";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { conversationIdSchema, createMessageSchema } from "../schemas/conversations.schema.js";
import {
    listConversations,
    getConversationMessages,
    createMessage
} from "../controllers/conversations.controller.js";

const router = Router();

router.use("/api/conversations", verifyTokenAndRole(DASHBOARD_ROLES));

router.get("/api/conversations", listConversations);
router.get("/api/conversations/:id/messages", validate(conversationIdSchema), getConversationMessages);
router.post("/api/conversations/:id/messages", validate(createMessageSchema), createMessage);

export default router;