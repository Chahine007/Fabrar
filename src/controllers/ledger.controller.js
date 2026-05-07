import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { backfillLedger } from "../domain/finance/ledgerBackfillService.js";

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["false", "0", "no"].includes(normalized)) return false;
  if (["true", "1", "yes"].includes(normalized)) return true;
  return fallback;
}

export const runLedgerBackfill = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const dryRun = parseBoolean(req.query.dryRun ?? req.body?.dryRun, true);
  const limit = req.query.limit ?? req.body?.limit;

  const result = await backfillLedger(prisma, { dryRun, limit });

  res.json({
    message: dryRun
      ? "Dry-run backfill ledger completato. Nessuna scrittura eseguita."
      : "Backfill ledger completato.",
    ...result,
  });
});
