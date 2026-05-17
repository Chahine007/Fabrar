import { getDb } from "../db/index.js";
import { getEffectiveUserCapabilities } from "../domain/auth/capabilitiesService.js";

export function requireCapabilities(...requiredCapabilities) {
  const required = requiredCapabilities.filter(Boolean);

  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Accesso negato: token non valido." });
      }

      if (required.length === 0) {
        return next();
      }

      const prisma = getDb();
      const effective = await getEffectiveUserCapabilities(prisma, req.user);
      if (!effective) {
        return res.status(401).json({ error: "Utente non attivo o non trovato." });
      }

      req.capabilities = effective.capabilities ?? [];
      const hasAll = required.every((capability) => req.capabilities.includes(capability));
      if (!hasAll) {
        return res.status(403).json({ error: "Accesso negato: capability insufficienti." });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

