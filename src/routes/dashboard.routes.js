import { Router } from "express";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { getRadar } from "../controllers/dashboard.controller.js";

const router = Router();

router.use("/api/dashboard", verifyTokenAndRole(DASHBOARD_ROLES));

router.get("/api/dashboard/radar", getRadar);

export default router;