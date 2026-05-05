import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import {
  createSupplier,
  deleteSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
} from "../controllers/suppliers.controller.js";

const router = Router();
const SUPPLIER_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN"];

router.use(verifyToken);
router.use(authorizeRoles(...SUPPLIER_ROLES));

router.get("/", getAllSuppliers);
router.post("/", createSupplier);
router.get("/:id", getSupplierById);
router.patch("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;
