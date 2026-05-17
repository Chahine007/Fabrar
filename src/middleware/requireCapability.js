import { getDb } from "../db/index.js";
import { getCapabilitiesForRole, getEffectiveUserCapabilities } from "../domain/auth/capabilitiesService.js";

function isCrmProtectedCapability(capability) {
  return typeof capability === "string" && capability.startsWith("crm:");
}

function canBypassWithCrmAdmin(required, current) {
  return isCrmProtectedCapability(required) && current.includes("crm:admin");
}

/**
 * Enforces that the user has at least one of the provided capabilities.
 * Uses effective capabilities (DB-backed) when possible; falls back to role mapping.
 */
export function requireCapability(...requiredCapabilities) {
  const required = requiredCapabilities.filter((cap) => typeof cap === "string" && cap.trim().length > 0);

  return async (req, res, next) => {
    if (required.length === 0) return next();

    if (!req.user) {
      return res.status(401).json({ error: "Accesso negato: Token mancante o non valido." });
    }

    let capabilities = [];
    try {
      const prisma = getDb();
      const effective = await getEffectiveUserCapabilities(prisma, req.user);
      if (effective?.capabilities) {
        capabilities = effective.capabilities;
        req.user = effective.user;
        req.capabilities = capabilities;
      } else if (req.user?.role) {
        capabilities = getCapabilitiesForRole(req.user.role);
        req.capabilities = capabilities;
      }
    } catch (err) {
      return next(err);
    }

    const allowed = required.some((capability) =>
      capabilities.includes(capability) || canBypassWithCrmAdmin(capability, capabilities)
    );

    if (!allowed) {
      return res.status(403).json({ error: "Accesso negato: permessi insufficienti." });
    }

    return next();
  };
}

