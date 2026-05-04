import express from "express";
import { getMe, generateTelegramCode } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Proteggiamo tutte le rotte utente col middleware che valida il JWT
router.use(verifyToken);

// GET /api/user/me -> Restituisce i dati utente
router.get("/me", getMe);

// POST /api/user/telegram-code -> Genera il codice di pairing
router.post("/telegram-code", generateTelegramCode);

export default router;
