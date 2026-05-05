import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  createSupplier,
  deleteSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
} from "../controllers/suppliers.controller.js";
import {
  createSupplierSchema,
  supplierIdSchema,
  updateSupplierSchema,
} from "../schemas/suppliers.schema.js";

const router = Router();
const SUPPLIER_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN"];

router.use(verifyToken);
router.use(authorizeRoles(...SUPPLIER_ROLES));

router.get("/", getAllSuppliers);
router.post("/", validate(createSupplierSchema), createSupplier);
router.get("/:id", validate(supplierIdSchema), getSupplierById);
router.patch("/:id", validate(updateSupplierSchema), updateSupplier);
router.delete("/:id", validate(supplierIdSchema), deleteSupplier);

export default router;
