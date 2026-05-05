import jwt from "jsonwebtoken";
import { getJwtVerifyOptions } from "../constants.js";

/** Ruoli ammessi per dashboard/API ufficio (Policy 4.1) */
export const DASHBOARD_ROLES = ["ADMIN", "HR"];

export function normalizeRole(role, fallback = null) {
  if (typeof role !== "string") return fallback;
  const normalized = role.trim().toUpperCase();
  return normalized || fallback;
}

/**
 * Normalizza il payload JWT su req.user.
 * Supporta token nuovi (id, employee_id, role) e legacy (employeeId).
 */
export function normalizeUserPayload(decoded) {
  if (!decoded || typeof decoded !== "object") return null;
  const employee_id = decoded.employee_id ?? decoded.employeeId ?? null;
  const id = decoded.id ?? decoded.userId ?? null;
  const role = normalizeRole(decoded.role, null);
  return {
    id,
    employee_id,
    role,
    /** Alias retro-compatibile */
    employeeId: employee_id,
  };
}

export function authorizeRoles(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles
    .map((role) => normalizeRole(role, null))
    .filter(Boolean);

  return (req, res, next) => {
    const normalizedUserRole = normalizeRole(req.user?.role, null);

    if (!normalizedUserRole) {
      return res.status(403).json({
        error: "Accesso negato: privilegi insufficienti",
      });
    }

    req.user = { ...req.user, role: normalizedUserRole };

    if (
      normalizedAllowedRoles.length > 0 &&
      !normalizedAllowedRoles.includes(normalizedUserRole)
    ) {
      return res.status(403).json({
        error: "Accesso negato: privilegi insufficienti",
      });
    }

    next();
  };
}

export function verifyTokenAndRole(allowedRoles = []) {
  const roleGuard = authorizeRoles(...allowedRoles);

  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Accesso negato: Token mancante o non valido." });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, getJwtVerifyOptions());
      req.user = normalizeUserPayload(decoded);

      if (!req.user || req.user.role == null) {
        return res.status(401).json({ error: "Accesso negato: Token non valido." });
      }

      return roleGuard(req, res, next);
    } catch (err) {
      return res.status(401).json({ error: "Accesso negato: Token scaduto o non valido." });
    }
  };
}

/** Backward-compat: middleware JWT without role restrictions */
export const verifyToken = verifyTokenAndRole();
