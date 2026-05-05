import { Router } from "express";
import { authorizeRoles, verifyToken } from "../middleware/auth.js";
import { uploadDocumentFile } from "../middleware/upload.js";
import {
  deleteDocument,
  downloadDocument,
  getDocumentsByCantiere,
  uploadDocument,
} from "../controllers/documents.controller.js";

const router = Router();

const DOCUMENT_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN", "WORKER"];
const DOCUMENT_DELETE_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN"];

router.use(verifyToken);

router.post("/", authorizeRoles(...DOCUMENT_ROLES), uploadDocumentFile, uploadDocument);
router.get("/cantiere/:id", authorizeRoles(...DOCUMENT_ROLES), getDocumentsByCantiere);
router.get("/:id/download", authorizeRoles(...DOCUMENT_ROLES), downloadDocument);
router.delete("/:id", authorizeRoles(...DOCUMENT_DELETE_ROLES), deleteDocument);

export default router;
