import { Router } from "express";
import multer from "multer";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { manualExpenseSchema } from "../schemas/expenses.schema.js";
import {
    getPricebook,
    createManualExpense,
    bulkImportExpenses,
} from "../controllers/expenses.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(["/api/pricebook", "/api/admin/spese"], verifyTokenAndRole(DASHBOARD_ROLES));

router.get("/api/pricebook", getPricebook);
router.post("/api/admin/spese/manual", validate(manualExpenseSchema), createManualExpense);
router.post("/api/admin/spese/bulk", upload.single("file"), bulkImportExpenses);

export default router;