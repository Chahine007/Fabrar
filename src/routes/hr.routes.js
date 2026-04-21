import { Router } from "express";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
    getKpiSchema,
    getAuditSchema,
    auditBulkSchema,
    userCostSchema,
    updateReportEntrySchema,
    updateReportSchema,
    updateSpesaSchema
} from "../schemas/hr.schema.js";
import {
    getAlerts,
    getUserKpi,
    getAudit,
    bulkUpdateAudit,
    createUserCost,
    updateReportEntryCtrl,
    updateReportCtrl,
    updateSpesaCtrl,
    listReportsCtrl,
    getAuditLogsCtrl,
    getPendingSummaryCtrl,
} from "../controllers/hr.controller.js";

const router = Router();

// Protegge tutte le rotte HR
router.use("/api/hr", verifyTokenAndRole(DASHBOARD_ROLES));
router.use("/api/reports", verifyTokenAndRole(DASHBOARD_ROLES));
router.use("/api/logs", verifyTokenAndRole(DASHBOARD_ROLES));
router.use("/api/admin/pending-summary", verifyTokenAndRole(DASHBOARD_ROLES));

router.get("/api/hr/alerts", getAlerts);
router.get("/api/hr/users/:id/kpi", validate(getKpiSchema), getUserKpi);
router.get("/api/hr/audit", validate(getAuditSchema), getAudit);
router.put("/api/hr/audit/bulk", validate(auditBulkSchema), bulkUpdateAudit);
router.post("/api/hr/users/:id/cost", validate(userCostSchema), createUserCost);
router.patch("/api/hr/report-entries/:id", validate(updateReportEntrySchema), updateReportEntryCtrl);
router.patch("/api/hr/reports/:id", validate(updateReportSchema), updateReportCtrl);
router.patch("/api/hr/spese/:id", validate(updateSpesaSchema), updateSpesaCtrl);

// Nuove rotte ripristinate
router.get("/api/reports", listReportsCtrl);
router.get("/api/logs", getAuditLogsCtrl);
router.get("/api/admin/pending-summary", getPendingSummaryCtrl);

export default router;