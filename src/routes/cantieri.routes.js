import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { createCantiereSchema, updateCantiereSchema, updateCantiereSettingsSchema, createTaskSchema } from "../schemas/cantiere.schema.js";
import {
    listCantieri,
    createCantiere,
    toggleCantiere,
    updateCantiere,
    getFinancialTimeline,
    getDetails,
    getTasks,
    createTask,
    getDocuments,
    uploadDocument,
    downloadDocument,
    updateGps,
    getCantiereMaterials,
    getCantiereSettings,
    updateCantiereSettings,
    getWbsTree,
    createWbsNode,
    updateWbsNode,
    deleteWbsNode,
    listAllTasks,
    updateTask,
} from "../controllers/cantieri.controller.js";

const router = Router();

// ─── Multer configuration ─────────────────────────────────────────────────────

const ALLOWED_MIMETYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.resolve('./uploads');
        const dir = path.join(uploadDir, 'cantieri', req.params.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo di file non supportato: ${file.mimetype}`));
        }
    },
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

router.use(["/api/cantieri", "/api/admin/cantieri"], verifyTokenAndRole(DASHBOARD_ROLES));

// ─── Cantieri base routes ──────────────────────────────────────────────────────

router.get(["/api/cantieri", "/api/admin/cantieri"], listCantieri);
router.post("/api/admin/cantieri", validate(createCantiereSchema), createCantiere);
router.patch("/api/admin/cantieri/:id", validate(updateCantiereSchema), updateCantiere);
router.patch("/api/admin/cantieri/:id/toggle", toggleCantiere);
router.get("/api/cantieri/:id/financial-timeline", getFinancialTimeline);
router.get("/api/cantieri/:id/details", getDetails);
router.patch("/api/cantieri/:id/gps", updateGps);

// ─── Tasks routes ─────────────────────────────────────────────────────────────

router.get("/api/cantieri/:id/tasks", getTasks);
router.post("/api/cantieri/:id/tasks", validate(createTaskSchema), createTask);

// Cross-project: tutti i task di tutti i cantieri
router.get("/api/tasks", listAllTasks);
router.patch("/api/tasks/:taskId", updateTask);

// ─── Documents routes ─────────────────────────────────────────────────────────

router.get("/api/cantieri/:id/documents", getDocuments);
router.post("/api/cantieri/:id/documents/upload", upload.single('file'), uploadDocument);
router.get("/api/cantieri/:id/documents/:docId/download", downloadDocument);

// ─── Materials routes ─────────────────────────────────────────────────────────

router.get("/api/cantieri/:id/materials", getCantiereMaterials);

// ─── Settings routes ──────────────────────────────────────────────────────────

router.get("/api/cantieri/:id/settings", getCantiereSettings);
router.patch("/api/cantieri/:id/settings", validate(updateCantiereSettingsSchema), updateCantiereSettings);

// ─── WBS routes ───────────────────────────────────────────────────────────────

router.use("/api/cantieri/:id/wbs", verifyTokenAndRole(DASHBOARD_ROLES));
router.get("/api/cantieri/:id/wbs", getWbsTree);
router.post("/api/cantieri/:id/wbs", createWbsNode);
router.patch("/api/cantieri/:id/wbs/:nodeId", updateWbsNode);
router.delete("/api/cantieri/:id/wbs/:nodeId", deleteWbsNode);

export default router;