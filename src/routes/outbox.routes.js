import express from "express";
import { flushOutbox, getOutboxEvents, retryOutbox } from "../controllers/outbox.controller.js";
import { verifyTokenAndRole } from "../middleware/auth.js";

const router = express.Router();
const adminOnly = verifyTokenAndRole(["ADMIN"]);

router.get("/", adminOnly, getOutboxEvents);
router.post("/flush", adminOnly, flushOutbox);
router.post("/:id/retry", adminOnly, retryOutbox);

export default router;
