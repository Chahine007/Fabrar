import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import logger from "../logger.js";
import { findUserByUsername, updateUserLastLogin } from "../db/index.js";

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

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      logger.warn({ username, event: "login_failed_password_mismatch" }, "Login fallito: password errata");
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    await updateUserLastLogin(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        role: user.role,
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
