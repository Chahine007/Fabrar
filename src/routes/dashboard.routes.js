import { Router } from "express";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { getRadar, getFinanceKPIs, getWarehouseKPIs, getHrKPIs, getOpsKPIs } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/api/dashboard/radar",          verifyTokenAndRole(DASHBOARD_ROLES), getRadar);
router.get("/api/dashboard/bi/finance",     verifyTokenAndRole(["ADMIN"]), getFinanceKPIs);
router.get("/api/dashboard/bi/warehouse",   verifyTokenAndRole(["ADMIN"]), getWarehouseKPIs);
router.get("/api/dashboard/bi/hr",          verifyTokenAndRole(["ADMIN", "HR"]), getHrKPIs);
router.get("/api/dashboard/bi/operations",  verifyTokenAndRole(["ADMIN", "HR"]), getOpsKPIs);

export default router;
