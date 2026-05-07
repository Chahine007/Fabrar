import express from "express";
import logger from "../logger.js";
import authRoutes from "./auth.routes.js";
import meRoutes from "./me.routes.js";
import workflowRoutes from "./workflow.routes.js";
import cantieriRoutes from "./cantieri.routes.js";
import expensesRoutes from "./expenses.routes.js";
import hrRoutes from "./hr.routes.js";
import employeesRoutes from "./employees.routes.js"; // Se esiste
import dashboardRoutes from "./dashboard.routes.js";
import conversationsRoutes from "./conversations.routes.js";
import magazzinoRoutes from "./magazzino.routes.js";
import warehouseRoutes from "./warehouse.routes.js";
import suppliersRoutes from "./suppliers.routes.js";
import materialRequestsRoutes from "./materialRequests.routes.js";
import tasksRoutes from "./tasks.routes.js";
import timesheetsRoutes from "./timesheets.routes.js";
import userRoutes from "./user.routes.js";
import billingRoutes from "./billing.routes.js";
import documentsRoutes from "./documents.routes.js";
import accountingRoutes from "./accounting.routes.js";

const router = express.Router();

if (!process.env.JWT_SECRET) {
  logger.error("CRITICAL: JWT_SECRET non è definito nel file .env! Interruzione servizio per fail-fast.");
  process.exit(1);
}

// Router aggregator
router.use(authRoutes);
router.use(meRoutes);
router.use(workflowRoutes);
router.use(tasksRoutes);
router.use(timesheetsRoutes);
router.use(cantieriRoutes);
router.use(expensesRoutes);
router.use(hrRoutes);
router.use(employeesRoutes);
router.use(dashboardRoutes);
router.use(conversationsRoutes);
router.use("/api/magazzino", magazzinoRoutes);
router.use("/api/warehouse", warehouseRoutes);
router.use("/api/suppliers", suppliersRoutes);
router.use("/api/material-requests", materialRequestsRoutes);
router.use("/api/user", userRoutes);
router.use("/api/billing", billingRoutes);
router.use("/api/documents", documentsRoutes);
router.use("/api/accounting", accountingRoutes);

export default router;
