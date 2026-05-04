import crypto from "crypto";
import { getDb } from "../db/index.js";
import logger from "../logger.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Restituisce i dati completi dell'utente loggato, incluso il record Employee collegato
export const getMe = asyncHandler(async (req, res) => {
  const userId = req.user.id; // Estratto dal JWT tramite verifyToken
  const prisma = getDb();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
      last_login_at: true,
      employee: {
        select: {
          id: true,
          nome: true,
          cognome: true,
          telegram_id: true,
          ruolo: true,
          telegram_pairing_code: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  res.json({ user });
});

// Genera una stringa randomica e la salva in telegram_pairing_code dell'Employee
export const generateTelegramCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const prisma = getDb();

  // Prima troviamo l'employee associato all'utente
  const emp = await prisma.employee.findUnique({
    where: { user_id: userId },
  });

  if (!emp) {
    return res.status(404).json({ error: "Nessun profilo dipendente collegato a questo account." });
  }

  // Genera un codice alfanumerico di 4 caratteri (es. A1B2) e prependiamo TG-
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
  const code = `TG-${randomPart}`;

  await prisma.employee.update({
    where: { id: emp.id },
    data: { telegram_pairing_code: code },
  });

  logger.info(
    { event: "telegram_code_generated", userId, employeeId: emp.id, code },
    "Codice Telegram generato"
  );

  res.json({ telegram_pairing_code: code });
});
