import { Router } from "express";
import { verifyTokenAndRole } from "../middleware/auth.js";
import {
  getPayables,
  getPurchaseInvoiceById,
  getVatRegister,
  updatePayable,
} from "../controllers/accounting.controller.js";

const router = Router();

router.use(verifyTokenAndRole(["ADMIN", "HR"]));

router.get("/payables", getPayables);
router.patch("/payables/:id", updatePayable);
router.get("/vat-register", getVatRegister);
router.get("/purchase-invoices/:id", getPurchaseInvoiceById);

export default router;
