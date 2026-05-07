import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { authorizeRoles, verifyToken, verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
    createCantiereSchema,
    toggleCantiereSchema,
    updateCantiereSchema,
    updateCantiereSettingsSchema,
    updateGpsSchema,
} from "../schemas/cantiere.schema.js";
import { createWbsNodeSchema, deleteWbsNodeSchema, updateWbsNodeSchema } from "../schemas/wbs.schema.js";
import {
    listCantieri,
    createCantiere,
    toggleCantiere,
    updateCantiere,
    getFinancialTimeline,
    getDetails,
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

router.use(["/api/cantieri", "/api/admin/cantieri"], verifyToken);

// ─── Cantieri base routes ──────────────────────────────────────────────────────

router.get(["/api/cantieri", "/api/admin/cantieri"], listCantieri);
router.post("/api/admin/cantieri", authorizeRoles(...DASHBOARD_ROLES), validate(createCantiereSchema), createCantiere);
router.patch("/api/admin/cantieri/:id", authorizeRoles(...DASHBOARD_ROLES), validate(updateCantiereSchema), updateCantiere);
router.patch("/api/admin/cantieri/:id/toggle", authorizeRoles(...DASHBOARD_ROLES), validate(toggleCantiereSchema), toggleCantiere);
router.get("/api/cantieri/:id/financial-timeline", getFinancialTimeline);
router.get("/api/cantieri/:id/details", getDetails);
router.patch("/api/cantieri/:id/gps", validate(updateGpsSchema), updateGps);

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

router.use("/api/cantieri/:id/wbs", verifyTokenAndRole(["ADMIN", "HR", "PROJECT_MANAGER"]));
router.get("/api/cantieri/:id/wbs", getWbsTree);
router.post("/api/cantieri/:id/wbs", validate(createWbsNodeSchema), createWbsNode);
router.patch("/api/cantieri/:id/wbs/:nodeId", validate(updateWbsNodeSchema), updateWbsNode);
router.delete("/api/cantieri/:id/wbs/:nodeId", validate(deleteWbsNodeSchema), deleteWbsNode);

export default router;
