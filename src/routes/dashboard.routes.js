import { Router } from "express";
import { verifyToken, DASHBOARD_ROLES } from "../middleware/auth.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { getRadar, getFinanceKPIs, getWarehouseKPIs, getHrKPIs, getOpsKPIs } from "../controllers/dashboard.controller.js";

const router = Router();

router.use("/api/dashboard", verifyToken);

router.get("/api/dashboard/radar",          authorizeRoles(...DASHBOARD_ROLES), getRadar);
router.get("/api/dashboard/bi/finance",     authorizeRoles("ADMIN"), getFinanceKPIs);
router.get("/api/dashboard/bi/warehouse",   authorizeRoles("ADMIN"), getWarehouseKPIs);
router.get("/api/dashboard/bi/hr",          authorizeRoles("ADMIN", "HR"), getHrKPIs);
router.get("/api/dashboard/bi/operations",  authorizeRoles("ADMIN", "HR"), getOpsKPIs);

export default router;
