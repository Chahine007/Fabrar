import { getDb } from "../db/index.js";
import { getEffectiveUserCapabilities } from "../domain/auth/capabilitiesService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getMyCapabilities = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const capabilities = await getEffectiveUserCapabilities(prisma, req.user);

  if (!capabilities) {
    return res.status(401).json({ error: "Utente non attivo o non trovato." });
  }

  return res.json(capabilities);
});
