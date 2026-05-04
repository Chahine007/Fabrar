import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, googleLoginOrRegister, generateInviteCode } from "../controllers/auth.controller.js";
import { verifyTokenAndRole } from "../middleware/auth.js";

const router = Router();

// Rate limiter condiviso per endpoint di autenticazione
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 15, // Max 15 richieste per IP
    message: { error: "Troppi tentativi di autenticazione. Riprova tra 15 minuti." },
});

// ── Login classico (username + password) ─────────────────────────────────────
router.post("/api/login", authLimiter, login);

// ── Sprint 12: Google OAuth Login / Register ─────────────────────────────────
router.post("/api/auth/google", authLimiter, googleLoginOrRegister);

// ── Sprint 12: Genera codice invito (solo ADMIN) ─────────────────────────────
router.post("/api/auth/invite/:employeeId", verifyTokenAndRole(["ADMIN"]), generateInviteCode);

export default router;