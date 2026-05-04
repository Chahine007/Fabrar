/**
 * Sprint 12: Pre-migration script.
 * Migra la relazione User.employee_id → Employee.user_id
 * PRIMA di applicare il nuovo schema con `prisma db push --accept-data-loss`.
 */
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.PRISMA_DB_URL || "postgresql://fabrar:fabrar_password@localhost:5432/fabrar_erp?schema=public",
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Aggiungi le nuove colonne se non esistono ancora
    await client.query(`
      ALTER TABLE "Employee"
        ADD COLUMN IF NOT EXISTS invite_code TEXT,
        ADD COLUMN IF NOT EXISTS user_id INTEGER;
    `);

    await client.query(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS google_id TEXT;
    `);

    // Rendi password_hash nullable
    await client.query(`
      ALTER TABLE "User"
        ALTER COLUMN password_hash DROP NOT NULL;
    `);

    // 2. Migra i dati: copia employee_id da User → Employee.user_id
    const { rows } = await client.query(`SELECT id, employee_id FROM "User" WHERE employee_id IS NOT NULL`);
    for (const row of rows) {
      console.log(`  Migrating User ${row.id} -> Employee ${row.employee_id} (setting user_id=${row.id})`);
      await client.query(
        `UPDATE "Employee" SET user_id = $1 WHERE id = $2 AND user_id IS NULL`,
        [row.id, row.employee_id]
      );
    }

    console.log(`\n✅ Pre-migration complete. Migrated ${rows.length} User→Employee links.`);
    console.log(`   Ora puoi eseguire: npx prisma db push --accept-data-loss`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
