import jwt from "jsonwebtoken";

/** Ruoli ammessi per dashboard/API ufficio (Policy 4.1) */
export const DASHBOARD_ROLES = ["ADMIN", "HR"];

/**
 * Normalizza il payload JWT su req.user.
 * Supporta token nuovi (id, employee_id, role) e legacy (employeeId).
 */
function normalizeUserPayload(decoded) {
  if (!decoded || typeof decoded !== "object") return null;
  const employee_id = decoded.employee_id ?? decoded.employeeId ?? null;
  const id = decoded.id ?? decoded.userId ?? null;
  const role = decoded.role ?? null;
  return {
    id,
    employee_id,
    role,
    /** Alias retro-compatibile */
    employeeId: employee_id,
  };
}

export function verifyTokenAndRole(allowedRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Accesso negato: Token mancante o non valido." });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = normalizeUserPayload(decoded);

      if (!req.user || req.user.role == null) {
        return res.status(401).json({ error: "Accesso negato: Token non valido." });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Accesso negato: Ruolo non autorizzato." });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: "Accesso negato: Token scaduto o non valido." });
    }
  };
}

/** Backward-compat: middleware JWT without role restrictions */
export const verifyToken = verifyTokenAndRole();
