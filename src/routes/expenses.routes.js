import { Router } from "express";
import multer from "multer";
import { verifyTokenAndRole, verifyToken, DASHBOARD_ROLES } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import { uploadDocumentFile } from "../middleware/upload.js";
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
import {
    analyzeGenericInvoiceOcrController,
    analyzeSpesaOcrController,
    confirmGenericInvoiceOcrController,
    confirmSpesaOcrController,
    matchSpesaOcrController,
} from "../controllers/speseOcr.controller.js";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
const DATA_ENTRY_ROLES = ["WORKER", "PROJECT_MANAGER", "HR", "ADMIN"];
const OFFICE_EXPENSE_ROLES = ["HR", "ADMIN"];
const GENYA_IMPORT_ROLES = ["PROJECT_MANAGER", "HR", "ADMIN", "WAREHOUSEMAN"];

function uploadGenyaFile(req, res, next) {
    upload.single("file")(req, res, (err) => {
        if (!err) return next();
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File Genya troppo grande. Limite massimo: 5MB." });
        }
        return next(err);
    });
}

router.use("/api/pricebook", verifyTokenAndRole(DASHBOARD_ROLES));
router.use("/api/my-expenses", verifyToken);

router.get("/api/pricebook", getPricebook);
router.post("/api/admin/spese/manual", verifyTokenAndRole(OFFICE_EXPENSE_ROLES), validate(manualExpenseSchema), createManualExpense);
router.post("/api/admin/spese/bulk", verifyTokenAndRole(GENYA_IMPORT_ROLES), uploadGenyaFile, bulkImportExpenses);
router.post("/api/admin/spese/ocr/analyze", verifyTokenAndRole(GENYA_IMPORT_ROLES), uploadDocumentFile, analyzeGenericInvoiceOcrController);
router.post("/api/admin/spese/ocr/confirm", verifyTokenAndRole(GENYA_IMPORT_ROLES), confirmGenericInvoiceOcrController);
router.post("/api/admin/spese/:spesaId/ocr", verifyTokenAndRole(GENYA_IMPORT_ROLES), uploadDocumentFile, analyzeSpesaOcrController);
router.post("/api/admin/spese/:spesaId/ocr/confirm", verifyTokenAndRole(GENYA_IMPORT_ROLES), confirmSpesaOcrController);
router.post("/api/admin/spese/ocr/match", verifyTokenAndRole(GENYA_IMPORT_ROLES), matchSpesaOcrController);

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
