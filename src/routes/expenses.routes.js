import { Router } from "express";
import multer from "multer";
import { verifyTokenAndRole, verifyToken, DASHBOARD_ROLES } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
    createMyExpenseSchema,
    deleteMyExpenseSchema,
    manualExpenseSchema,
    updateMyExpenseSchema,
} from "../schemas/expenses.schema.js";
import {
    createMyExpense,
    getPricebook,
    createManualExpense,
    bulkImportExpenses,
    deleteMyExpense,
    updateMyExpense,
} from "../controllers/expenses.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const DATA_ENTRY_ROLES = ["WORKER", "PROJECT_MANAGER", "HR", "ADMIN"];
const OFFICE_EXPENSE_ROLES = ["HR", "ADMIN"];
const GENYA_IMPORT_ROLES = ["PROJECT_MANAGER", "HR", "ADMIN"];

router.use("/api/pricebook", verifyTokenAndRole(DASHBOARD_ROLES));
router.use("/api/my-expenses", verifyToken);

router.get("/api/pricebook", getPricebook);
router.post("/api/admin/spese/manual", verifyTokenAndRole(OFFICE_EXPENSE_ROLES), validate(manualExpenseSchema), createManualExpense);
router.post("/api/admin/spese/bulk", verifyTokenAndRole(GENYA_IMPORT_ROLES), upload.single("file"), bulkImportExpenses);

router.post(
    "/api/my-expenses",
    authorizeRoles(...DATA_ENTRY_ROLES),
    validate(createMyExpenseSchema),
    createMyExpense
);

router.patch(
    "/api/my-expenses/:expenseId",
    authorizeRoles(...DATA_ENTRY_ROLES),
    validate(updateMyExpenseSchema),
    updateMyExpense
);

router.delete(
    "/api/my-expenses/:expenseId",
    authorizeRoles(...DATA_ENTRY_ROLES),
    validate(deleteMyExpenseSchema),
    deleteMyExpense
);

export default router;
