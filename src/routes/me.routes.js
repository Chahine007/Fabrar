import { Router } from "express";
import { getMyCapabilities } from "../controllers/me.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.get("/api/me/capabilities", verifyToken, getMyCapabilities);

export default router;
