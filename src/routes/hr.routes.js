import { Router } from "express";
import { verifyToken, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { authorizeRoles } from "../middleware/auth.js";
import {
    getKpiSchema,
    getAuditSchema,
    auditBulkSchema,
    userCostSchema,
    updateReportEntrySchema,
    updateReportEntryAdminSchema,
    updateReportSchema,
    updateSpesaSchema
} from "../schemas/hr.schema.js";
import {
    getAlerts,
    getUserKpi,
    getEmployeesWithKPIs,
    getEmployeeDetail,
    generateEmployeeCV,
    updateEmployeeCtrl,
    getAudit,
    bulkUpdateAudit,
    createUserCost,
    updateReportEntryCtrl,
    updateReportEntryAdminCtrl,
    updateReportCtrl,
    updateSpesaCtrl,
    listReportsCtrl,
    getAuditLogsCtrl,
    getPendingSummaryCtrl,
} from "../controllers/hr.controller.js";

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
router.use("/api/hr",                    verifyToken);
router.use("/api/employees",             verifyToken);
router.use("/api/reports",               verifyToken);
router.use("/api/logs",                  verifyToken);
router.use("/api/admin/pending-summary", verifyToken);

// ─── Employees (anagrafica + KPI mensili) ─────────────────────────────────────
router.get("/api/employees",             authorizeRoles(...DASHBOARD_ROLES), getEmployeesWithKPIs);
router.get("/api/hr/employees/:id",      authorizeRoles(...DASHBOARD_ROLES), getEmployeeDetail);
router.get("/api/hr/employees/:id/cv",   authorizeRoles(...DASHBOARD_ROLES), generateEmployeeCV);
router.patch("/api/hr/employees/:id",    authorizeRoles("ADMIN", "HR"), updateEmployeeCtrl);

// ─── HR Alerts & KPI ─────────────────────────────────────────────────────────
router.get("/api/hr/alerts",             authorizeRoles(...DASHBOARD_ROLES), getAlerts);
router.get("/api/hr/users/:id/kpi",      authorizeRoles(...DASHBOARD_ROLES), validate(getKpiSchema), getUserKpi);

// ─── Audit (Tabulati) ─────────────────────────────────────────────────────────
router.get("/api/hr/audit",              authorizeRoles("ADMIN", "HR", "PROJECT_MANAGER", "WORKER"), validate(getAuditSchema), getAudit);
router.put("/api/hr/audit/bulk",         authorizeRoles(...DASHBOARD_ROLES), validate(auditBulkSchema), bulkUpdateAudit);

// ─── Report Entry (modifica timbratura) ──────────────────────────────────────
// Vecchio endpoint (validazione stato): mantenuto per retro-compatibilità
router.patch("/api/hr/report-entries/:id", authorizeRoles(...DASHBOARD_ROLES), validate(updateReportEntrySchema), updateReportEntryCtrl);
// Nuovo endpoint admin: modifica ore / cantiere / wbs + ricalcolo costi
router.patch("/api/hr/report-entries/:id/admin", authorizeRoles(...DASHBOARD_ROLES), validate(updateReportEntryAdminSchema), updateReportEntryAdminCtrl);

// ─── Report headers & Spese ──────────────────────────────────────────────────
router.patch("/api/hr/reports/:id",      authorizeRoles(...DASHBOARD_ROLES), validate(updateReportSchema),  updateReportCtrl);
router.patch("/api/hr/spese/:id",        authorizeRoles(...DASHBOARD_ROLES), validate(updateSpesaSchema),   updateSpesaCtrl);

// ─── User costs (tariffe) ────────────────────────────────────────────────────
router.post("/api/hr/users/:id/cost",    authorizeRoles("ADMIN", "HR"), validate(userCostSchema), createUserCost);

// ─── Reports & Logs ──────────────────────────────────────────────────────────
router.get("/api/reports",               listReportsCtrl);
router.get("/api/logs",                  authorizeRoles(...DASHBOARD_ROLES), getAuditLogsCtrl);
router.get("/api/admin/pending-summary", authorizeRoles(...DASHBOARD_ROLES), getPendingSummaryCtrl);

export default router;
