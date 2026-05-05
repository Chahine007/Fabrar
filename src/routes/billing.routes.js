import { Router } from "express";
import { verifyTokenAndRole } from "../middleware/auth.js";
import {
  createInstallment,
  createInvoice,
  getProjectBilling,
  updateInstallment,
} from "../controllers/billing.controller.js";

const router = Router();

router.use(verifyTokenAndRole(["ADMIN", "PROJECT_MANAGER"]));

router.get("/projects/:cantiereId", getProjectBilling);
router.post("/projects/:cantiereId/installments", createInstallment);
router.patch("/installments/:installmentId", updateInstallment);
router.post("/projects/:cantiereId/invoices", createInvoice);

export default router;
