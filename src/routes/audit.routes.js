import express from "express";
import { getAuditLogs } from "../controllers/audit.controller.js";
import { verifyTokenAndRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/logs", verifyTokenAndRole(["ADMIN", "HR"]), getAuditLogs);

export default router;
