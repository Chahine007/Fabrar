import express from "express";
import {
  getMe,
  generateTelegramCode,
  getUserSettings,
  updateUserSettings,
  changePassword,
  getMaterialRequests,
  getSupportContact,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Proteggiamo tutte le rotte utente col middleware che valida il JWT
router.use(verifyToken);

// GET /api/user/me -> Restituisce i dati utente
router.get("/me", getMe);

// GET/PATCH /api/user/settings -> Preferenze e notifiche personali
router.get("/settings", getUserSettings);
router.patch("/settings", updateUserSettings);

// PATCH /api/user/password -> Cambio password per account locali
router.patch("/password", changePassword);

// GET /api/user/material-requests -> Movimenti/richieste materiali dell'utente
router.get("/material-requests", getMaterialRequests);

// GET /api/user/support-contact -> Contatto interno per supporto
router.get("/support-contact", getSupportContact);

// POST /api/user/telegram-code -> Genera il codice di pairing
router.post("/telegram-code", generateTelegramCode);

export default router;
