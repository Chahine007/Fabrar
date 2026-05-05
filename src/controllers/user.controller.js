import crypto from "crypto";
import bcrypt from "bcrypt";
import { getDb } from "../db/index.js";
import logger from "../logger.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DEFAULT_USER_SETTINGS = {
  notifications: {
    email: true,
    push: true,
    telegram: false,
    dailySummary: true,
    criticalAlerts: true,
  },
  preferences: {
    theme: "light",
    language: "it",
    timezone: "Europe/Rome",
    dateFormat: "DD/MM/YYYY",
  },
};

function generateTelegramPairingToken() {
  return `TG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
}

function hashTelegramPairingToken(code) {
  return crypto.createHash("sha256").update(String(code).trim().toUpperCase()).digest("hex");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeUserSettings(settings = {}) {
  const source = isPlainObject(settings) ? settings : {};
  return {
    notifications: {
      ...DEFAULT_USER_SETTINGS.notifications,
      ...(isPlainObject(source.notifications) ? source.notifications : {}),
    },
    preferences: {
      ...DEFAULT_USER_SETTINGS.preferences,
      ...(isPlainObject(source.preferences) ? source.preferences : {}),
    },
  };
}

function sanitizeSettingsPatch(body = {}) {
  const patch = {};

  if (isPlainObject(body.notifications)) {
    patch.notifications = {};
    for (const key of Object.keys(DEFAULT_USER_SETTINGS.notifications)) {
      if (typeof body.notifications[key] === "boolean") {
        patch.notifications[key] = body.notifications[key];
      }
    }
  }

  if (isPlainObject(body.preferences)) {
    patch.preferences = {};
    const { theme, language, timezone, dateFormat } = body.preferences;
    if (["light", "dark"].includes(theme)) patch.preferences.theme = theme;
    if (["it", "en", "es", "fr"].includes(language)) patch.preferences.language = language;
    if (typeof timezone === "string" && timezone.trim()) patch.preferences.timezone = timezone.trim();
    if (["DD/MM/YYYY", "YYYY-MM-DD"].includes(dateFormat)) patch.preferences.dateFormat = dateFormat;
  }

  return patch;
}

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
      password_hash: true,
      google_id: true,
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

  const { password_hash, google_id, ...safeUser } = user;
  res.json({
    user: {
      ...safeUser,
      has_password: Boolean(password_hash),
      google_connected: Boolean(google_id),
    },
  });
});

export const getUserSettings = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { settings: true },
  });

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  res.json({ settings: mergeUserSettings(user.settings) });
});

export const updateUserSettings = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { settings: true },
  });

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  const current = mergeUserSettings(user.settings);
  const patch = sanitizeSettingsPatch(req.body);
  const next = mergeUserSettings({
    notifications: {
      ...current.notifications,
      ...(patch.notifications ?? {}),
    },
    preferences: {
      ...current.preferences,
      ...(patch.preferences ?? {}),
    },
  });

  await prisma.user.update({
    where: { id: req.user.id },
    data: { settings: next },
  });

  res.json({ settings: next });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Password corrente e nuova password sono obbligatorie." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "La nuova password deve contenere almeno 8 caratteri." });
  }

  const prisma = getDb();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, password_hash: true },
  });

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato." });
  }

  if (!user.password_hash) {
    return res.status(409).json({ error: "Questo account usa Google Sign-In e non ha una password locale." });
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    return res.status(400).json({ error: "La password corrente non è corretta." });
  }

  const nextHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: nextHash },
  });

  logger.info({ event: "password_changed", userId: user.id }, "Password utente aggiornata");

  res.json({ message: "Password aggiornata correttamente." });
});

export const getMaterialMovements = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const movimenti = await prisma.movimentoMagazzino.findMany({
      where: { esecutore_id: req.user.id },
      include: {
        articolo: { select: { codice_sku: true, descrizione: true, unita_misura: true } },
        ubicazione_da: { select: { codice: true, descrizione: true } },
        ubicazione_a: { select: { codice: true, descrizione: true } },
        cantiere: { select: { id: true, nome: true } },
        wbs_node: { select: { id: true, nome: true } },
        documento: { select: { id: true, name: true, tag: true, numero_fattura: true } },
        fornitore: { select: { id: true, ragione_sociale: true, partita_iva: true } },
      },
    orderBy: { data_movimento: "desc" },
    take: 50,
  });

  res.json(movimenti);
});

export const getSupportContact = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const configuredId = Number(process.env.SUPPORT_EMPLOYEE_ID);

  let employee = Number.isInteger(configuredId) && configuredId > 0
    ? await prisma.employee.findFirst({
        where: { id: configuredId, attivo: 1 },
        select: { id: true, nome: true, cognome: true, ruolo: true, user: { select: { role: true, is_active: true } } },
      })
    : null;

  if (!employee || employee.user?.is_active !== 1) {
    const admin = await prisma.user.findFirst({
      where: {
        role: "ADMIN",
        is_active: 1,
        employee: { isNot: null },
      },
      select: {
        employee: {
          select: { id: true, nome: true, cognome: true, ruolo: true },
        },
      },
      orderBy: { id: "asc" },
    });

    employee = admin?.employee ?? null;
  }

  if (!employee) {
    return res.status(404).json({ error: "Contatto supporto non configurato." });
  }

  res.json({
    employee: {
      id: employee.id,
      firstName: employee.nome,
      lastName: employee.cognome,
      role: employee.ruolo ?? employee.user?.role ?? "ADMIN",
    },
  });
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

  const code = generateTelegramPairingToken();

  await prisma.employee.update({
    where: { id: emp.id },
    data: { telegram_pairing_code: hashTelegramPairingToken(code) },
  });

  logger.info(
    { event: "telegram_code_generated", userId, employeeId: emp.id },
    "Codice Telegram generato"
  );

  res.json({ telegram_pairing_code: code });
});
