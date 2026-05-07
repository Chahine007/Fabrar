import { Router } from "express";
import { transitionWorkflowEntity } from "../controllers/workflow.controller.js";
import { verifyTokenAndRole } from "../middleware/auth.js";

const router = Router();
const WORKFLOW_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN", "WORKER"];

router.post(
  "/api/workflows/:entityType/:id/transitions",
  verifyTokenAndRole(WORKFLOW_ROLES),
  transitionWorkflowEntity,
);

export default router;
