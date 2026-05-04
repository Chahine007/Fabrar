import { getDb, initDb } from './src/db/index.js';

async function main() {
  const prisma = await initDb();
  const emps = await prisma.employee.count();
  const users = await prisma.user.count();
  const cantieri = await prisma.cantiere.count();
  console.log(`Dati nel DB - Dipendenti: ${emps}, Utenti: ${users}, Cantieri: ${cantieri}`);
  await prisma.$disconnect();
}
main().catch(console.error);
