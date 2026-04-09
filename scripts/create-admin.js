#!/usr/bin/env node
/**
 * Crea un utente dashboard ADMIN collegato a un dipendente (employees).
 *
 * Uso interattivo:
 *   npm run seed:admin
 *
 * Uso non interattivo (es. CI / Docker):
 *   SEED_TELEGRAM_ID=123456 SEED_USERNAME=admin SEED_PASSWORD=secret npm run seed:admin
 *
 * Variabili d'ambiente:
 *   SEED_TELEGRAM_ID  — Telegram ID numerico del dipendente (obbligatorio)
 *   SEED_USERNAME     — Username login dashboard (obbligatorio)
 *   SEED_PASSWORD     — Password in chiaro (obbligatorio; solo in env per ambienti controllati)
 *   DB_PATH           — Opzionale; stesso significato del server (default ./data/app.db)
 */

import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcrypt";
import {
  initDb,
  findEmployeeByTelegramId,
  createEmployee,
  findUserByUsername,
  findUserByEmployeeId,
  createUser,
} from "../src/db/index.js";

const BCRYPT_ROUNDS = 12;

function parseTelegramId(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function main() {
  await initDb();

  const fromEnv =
    process.env.SEED_TELEGRAM_ID && process.env.SEED_USERNAME && process.env.SEED_PASSWORD;

  let telegramRaw;
  let username;
  let password;

  if (fromEnv) {
    telegramRaw = process.env.SEED_TELEGRAM_ID;
    username = process.env.SEED_USERNAME.trim();
    password = process.env.SEED_PASSWORD;
  } else {
    const rl = readline.createInterface({ input, output });
    try {
      telegramRaw = await rl.question("Telegram ID del dipendente (numerico): ");
      username = (await rl.question("Username dashboard: ")).trim();
      password = await rl.question("Password (in chiaro): ");
    } finally {
      rl.close();
    }
  }

  const telegramId = parseTelegramId(telegramRaw);
  if (telegramId == null) {
    console.error("Errore: SEED_TELEGRAM_ID / Telegram ID non valido (intero positivo richiesto).");
    process.exit(1);
  }

  if (!username) {
    console.error("Errore: username mancante.");
    process.exit(1);
  }

  if (!password || String(password).length < 8) {
    console.error("Errore: password assente o troppo corta (minimo 8 caratteri).");
    process.exit(1);
  }

  const existingUser = await findUserByUsername(username);
  if (existingUser) {
    console.error(`Errore: esiste già un utente con username "${username}".`);
    process.exit(1);
  }

  let employee = await findEmployeeByTelegramId(telegramId);
  if (!employee) {
    employee = await createEmployee(telegramId, null);
    console.log(`Creato dipendente id=${employee.id} (telegram_id=${telegramId}).`);
  } else {
    console.log(`Dipendente trovato: id=${employee.id} (telegram_id=${telegramId}).`);
  }

  const userSameEmployee = await findUserByEmployeeId(employee.id);
  if (userSameEmployee) {
    console.error(
      `Errore: il dipendente ${employee.id} ha già un utente dashboard (id=${userSameEmployee.id}, username=${userSameEmployee.username}).`
    );
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

  const user = await createUser({
    employee_id: employee.id,
    username,
    password_hash,
    role: "ADMIN",
    is_active: 1,
  });

  console.log(`Utente ADMIN creato: id=${user.id}, username=${user.username}, employee_id=${user.employee_id}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
