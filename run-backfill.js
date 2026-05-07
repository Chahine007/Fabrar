import { getDb } from './src/db/client.js';
// Assicurati che il percorso del service sia corretto in base alla tua struttura
import { runBackfill } from './src/services/ledgerBackfillService.js'; 

async function main() {
  console.log("⏳ Inizio simulazione (Dry Run) del Backfill...");
  const dryRunResult = await runBackfill({ dryRun: true });
  console.log("📊 Risultato Dry Run:", dryRunResult);

  console.log("\n🚀 Avvio esecuzione REALE del Backfill...");
  const actualResult = await runBackfill({ dryRun: false });
  console.log("✅ Backfill completato con successo:", actualResult);
}

main()
  .catch(console.error)
  .finally(async () => {
    const prisma = getDb();
    await prisma.$disconnect();
  });
