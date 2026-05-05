import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import logger from "../logger.js";
import { getDb } from "../db/index.js";
import { findUserByUsername, updateUserLastLogin } from "../db/index.js";
import bcrypt from "bcrypt";
import { normalizeRole } from "../middleware/auth.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function normalizedAppRole(role, fallback = "WORKER") {
  return normalizeRole(role, fallback);
}

// ─── Legacy login (username + password) ──────────────────────────────────────

export async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Username e password obbligatori." });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      logger.warn({ username, event: "login_failed_user_not_found" }, "Login fallito: utente non trovato");
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    if (!user.is_active) {
      logger.warn({ username, event: "login_failed_user_inactive" }, "Login fallito: utente inattivo");
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    if (!user.password_hash) {
      // Utente Google-only, non ha password locale
      return res.status(401).json({ error: "Questo account utilizza Google Sign-In." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      logger.warn({ username, event: "login_failed_password_mismatch" }, "Login fallito: password errata");
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    await updateUserLastLogin(user.id);
    const normalizedRole = normalizedAppRole(user.role);

    // Recupera employee_id dal lato Employee
    const prisma = getDb();
    const emp = await prisma.employee.findFirst({ where: { user_id: user.id } });

    const token = jwt.sign(
      {
        id: user.id,
        employee_id: emp?.id ?? null,
        role: normalizedRole,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({ message: "Login effettuato", token });
  } catch (err) {
    logger.error({ err, event: "login_error" }, "login_error");
    return res.status(500).json({ error: "Errore durante il login." });
  }
}

// ─── Sprint 12: Genera codice invito (solo Admin) ────────────────────────────

export async function generateInviteCode(req, res) {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return res.status(400).json({ error: "ID dipendente non valido." });
    }

    const prisma = getDb();
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(404).json({ error: "Dipendente non trovato." });
    }

    // Genera codice alfanumerico 6 caratteri maiuscoli
    const code = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

    await prisma.employee.update({
      where: { id: employeeId },
      data: { invite_code: code },
    });

    logger.info(
      { event: "invite_code_generated", employeeId, code },
      "Codice invito generato"
    );

    return res.json({ invite_code: code, employee_id: employeeId });
  } catch (err) {
    logger.error({ err, event: "invite_code_error" }, "invite_code_error");
    return res.status(500).json({ error: "Errore nella generazione del codice invito." });
  }
}

// ─── Sprint 12: Google Login / Register con codice invito ────────────────────

export async function googleLoginOrRegister(req, res) {
  try {
    const { idToken, inviteCode } = req.body || {};

    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "idToken Google obbligatorio." });
    }

    // 1. Verifica il token Google
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      logger.warn({ event: "google_token_invalid", err: verifyErr.message }, "Token Google non valido");
      return res.status(401).json({ error: "Token Google non valido o scaduto." });
    }

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    if (!email) {
      return res.status(400).json({ error: "L'account Google non ha un'email associata." });
    }

    const prisma = getDb();

    // 2A. Flusso con codice invito → prima registrazione
    if (inviteCode && typeof inviteCode === "string") {
      const code = inviteCode.trim().toUpperCase();

      // Transazione atomica: crea User + aggiorna Employee
      const result = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { invite_code: code },
        });
        if (!employee) {
          throw Object.assign(new Error("Codice invito non valido o già utilizzato."), { statusCode: 400 });
        }

        // Controlla se l'employee ha già un user collegato
        if (employee.user_id) {
          throw Object.assign(new Error("Questo dipendente ha già un account web collegato."), { statusCode: 409 });
        }

        // Username derivato dall'email (prima della @)
        const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
        // Assicura unicità
        const existingUsername = await tx.user.findUnique({ where: { username: baseUsername } });
        const username = existingUsername ? `${baseUsername}_${Date.now().toString(36)}` : baseUsername;

        const role = normalizedAppRole(employee.ruolo);

        const newUser = await tx.user.create({
          data: {
            username,
            email,
            google_id: googleId,
            role,
            is_active: 1,
            last_login_at: new Date(),
          },
        });

        await tx.employee.update({
          where: { id: employee.id },
          data: {
            user_id: newUser.id,
            invite_code: null, // Brucia il codice
          },
        });

        return { user: newUser, employee };
      });

      const token = jwt.sign(
        {
          id: result.user.id,
          employee_id: result.employee.id,
          role: normalizedAppRole(result.user.role),
          username: result.user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );

      logger.info(
        { event: "google_register_success", userId: result.user.id, employeeId: result.employee.id },
        "Registrazione Google completata"
      );

      return res.json({
        message: "Registrazione completata",
        token,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: normalizedAppRole(result.user.role),
          employee_id: result.employee.id,
          nome: result.employee.nome,
          cognome: result.employee.cognome,
        },
      });
    }

    // 2B. Flusso senza codice invito → login esistente
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { google_id: googleId },
          { email },
        ],
      },
    });

    if (!user) {
      return res.status(403).json({
        error: "Utente non registrato. Contatta l'amministratore per ricevere un codice invito.",
        needsInviteCode: true,
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "Account disattivato. Contatta l'amministratore." });
    }

    const normalizedRole = normalizedAppRole(user.role);

    // Aggiorna google_id se mancante (utente creato con password e ora usa Google)
    if (!user.google_id || user.role !== normalizedRole) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(user.google_id ? {} : { google_id: googleId }),
          ...(user.role === normalizedRole ? {} : { role: normalizedRole }),
        },
      });
      user = {
        ...user,
        google_id: user.google_id ?? googleId,
        role: normalizedRole,
      };
    }

    await updateUserLastLogin(user.id);

    // Trova employee collegato
    const emp = await prisma.employee.findFirst({ where: { user_id: user.id } });

    const token = jwt.sign(
      {
        id: user.id,
        employee_id: emp?.id ?? null,
        role: normalizedRole,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    logger.info(
      { event: "google_login_success", userId: user.id },
      "Login Google completato"
    );

    return res.json({
      message: "Login effettuato",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: normalizedRole,
        employee_id: emp?.id ?? null,
        nome: emp?.nome ?? null,
        cognome: emp?.cognome ?? null,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error({ err, event: "google_auth_error" }, "google_auth_error");
    return res.status(500).json({ error: "Errore durante l'autenticazione Google." });
  }
}
