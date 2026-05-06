import { getDb } from './src/db/client.js';

const prisma = getDb();

async function main() {
  console.log("⏳ Inizio allineamento del database...");

  // 1. Inserimento Ubicazione DEFAULT
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Ubicazione" ("codice", "descrizione")
    VALUES ('DEFAULT', 'Magazzino principale')
    ON CONFLICT ("codice") DO NOTHING;
  `);
  console.log("✅ Ubicazione 'DEFAULT' verificata/creata con successo.");

  // 2. Backfill delle vecchie spese Genya
  const righeAggiornate = await prisma.$executeRawUnsafe(`
    UPDATE "Spesa"
    SET logistica_status = 'PENDING_OCR'
    WHERE fonte = 'IMPORT_GENYA'
      AND logistica_status = 'NOT_REQUIRED';
  `);
  console.log(`✅ Spese Genya storiche aggiornate a PENDING_OCR. (Righe modificate: ${righeAggiornate})`);

  console.log("🎉 Database pronto per il nuovo flusso logistico!");
}

main()
  .catch((e) => {
    console.error("❌ Errore durante l'esecuzione:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Note: the client in src/db/client.js might have its own cleanup logic
    // but calling $disconnect directly is safe.
    await prisma.$disconnect();
  });
