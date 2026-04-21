import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login } from "../controllers/auth.controller.js";

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 10, // Max 10 richieste per IP
    message: { error: "Troppi tentativi di login. Riprova tra 15 minuti." },
});

router.post("/api/login", loginLimiter, login);

export default router;