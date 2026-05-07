import { getDb } from '../db/client.js';
import { backfillLedger } from '../domain/finance/ledgerBackfillService.js';

/**
 * Service wrapper for ledger backfill.
 * Uses the default database client.
 * 
 * @param {Object} options - Backfill options.
 * @param {boolean} [options.dryRun=true] - If true, only simulates the backfill.
 * @param {number} [options.limit=500] - Limit the number of records per batch.
 * @returns {Promise<Object>} The result of the backfill operation.
 */
export async function runBackfill(options = {}) {
  const prisma = getDb();
  return backfillLedger(prisma, options);
}
