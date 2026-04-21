import { Router } from "express";
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
    getCantiereMaterials,
    getCantiereSettings,
    updateCantiereSettings,
    getWbsTree,
    createWbsNode,
    updateWbsNode,
    deleteWbsNode,
} from "../controllers/cantieri.controller.js";


const router = Router();

// Applica il middleware di autenticazione solo alle rotte di questo modulo
router.use(["/api/cantieri", "/api/admin/cantieri"], verifyTokenAndRole(DASHBOARD_ROLES));

router.get(["/api/cantieri", "/api/admin/cantieri"], listCantieri);
router.post("/api/admin/cantieri", validate(createCantiereSchema), createCantiere);
router.patch("/api/admin/cantieri/:id", validate(updateCantiereSchema), updateCantiere);
router.patch("/api/admin/cantieri/:id/toggle", toggleCantiere);
router.get("/api/cantieri/:id/financial-timeline", getFinancialTimeline);
router.get("/api/cantieri/:id/details", getDetails);
router.get("/api/cantieri/:id/tasks", getTasks);
router.post("/api/cantieri/:id/tasks", validate(createTaskSchema), createTask);
router.get("/api/cantieri/:id/documents", getDocuments);
router.get("/api/cantieri/:id/materials", getCantiereMaterials);

// ─── Settings Routes ───────────────────────────────────────────────────
router.get("/api/cantieri/:id/settings", getCantiereSettings);
router.patch("/api/cantieri/:id/settings", validate(updateCantiereSettingsSchema), updateCantiereSettings);

// ─── WBS Routes ────────────────────────────────────────────────────────
router.use("/api/cantieri/:id/wbs", verifyTokenAndRole(DASHBOARD_ROLES));
router.get("/api/cantieri/:id/wbs", getWbsTree);
router.post("/api/cantieri/:id/wbs", createWbsNode);
router.patch("/api/cantieri/:id/wbs/:nodeId", updateWbsNode);
router.delete("/api/cantieri/:id/wbs/:nodeId", deleteWbsNode);

export default router;