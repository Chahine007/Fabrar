import { Router } from "express";
import { verifyTokenAndRole } from "../middleware/auth.js";
import {
  createInstallment,
  createInvoice,
  getProjectBilling,
  updateInstallment,
} from "../controllers/billing.controller.js";
import { validate } from "../middleware/validation.js";
import {
  createInstallmentSchema,
  createInvoiceSchema,
  updateInstallmentSchema,
} from "../schemas/billing.schema.js";

const router = Router();

router.use(verifyTokenAndRole(["ADMIN", "PROJECT_MANAGER"]));

router.get("/projects/:cantiereId", getProjectBilling);
router.post("/projects/:cantiereId/installments", validate(createInstallmentSchema), createInstallment);
router.patch("/installments/:installmentId", validate(updateInstallmentSchema), updateInstallment);
router.post("/projects/:cantiereId/invoices", validate(createInvoiceSchema), createInvoice);

export default router;
