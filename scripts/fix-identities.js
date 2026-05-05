#!/usr/bin/env node
import "dotenv/config";
import { initDb, getDb } from "../src/db/index.js";

function assertFound(record, label) {
  if (!record) {
    throw new Error(`${label} non trovato.`);
  }
  return record;
}

async function main() {
  await initDb();
  const prisma = getDb();

  const summary = await prisma.$transaction(async (tx) => {
    const changes = {
      adminDeleted: false,
      chahine: null,
      souhaiel: null,
    };

    // Pre-carico account target richiesti dalla migrazione
    const chahineUser = assertFound(
      await tx.user.findUnique({
        where: { username: "chahinechtioui06@gmail.com" },
        select: { id: true, username: true },
      }),
      "Utente chahinechtioui06@gmail.com"
    );

    const souhaielUser = assertFound(
      await tx.user.findUnique({
        where: { username: "info@fabdar.com" },
        select: { id: true, username: true },
      }),
      "Utente info@fabdar.com"
    );

    assertFound(
      await tx.employee.findUnique({ where: { id: 1 }, select: { id: true } }),
      "Employee id=1"
    );
    assertFound(
      await tx.employee.findUnique({ where: { id: 2 }, select: { id: true } }),
      "Employee id=2"
    );

    // 1) Elimina account legacy "admin" scollegandolo prima da qualunque Employee
    const adminUser = await tx.user.findUnique({
      where: { username: "admin" },
      select: { id: true, username: true },
    });

    if (adminUser) {
      // Re-assignment tecnico per rispettare FK ON DELETE RESTRICT
      await tx.movimentoMagazzino.updateMany({
        where: { esecutore_id: adminUser.id },
        data: { esecutore_id: chahineUser.id },
      });
      await tx.cantiere.updateMany({
        where: { pm_id: adminUser.id },
        data: { pm_id: chahineUser.id },
      });
      await tx.cantiere.updateMany({
        where: { site_manager_id: adminUser.id },
        data: { site_manager_id: chahineUser.id },
      });
      await tx.employee.updateMany({
        where: { user_id: adminUser.id },
        data: { user_id: null },
      });
      await tx.user.delete({ where: { id: adminUser.id } });
      changes.adminDeleted = true;
    }

    // 2) Chahine -> account personale admin, collegato a employee 1
    await tx.employee.updateMany({
      where: { user_id: chahineUser.id, id: { not: 1 } },
      data: { user_id: null },
    });

    await tx.employee.update({
      where: { id: 1 },
      data: {
        user_id: chahineUser.id,
        ruolo: "ADMIN",
      },
    });

    await tx.user.update({
      where: { id: chahineUser.id },
      data: { role: "ADMIN", is_active: 1 },
    });

    changes.chahine = { userId: chahineUser.id, employeeId: 1 };

    // 3) Souhaiel -> account personale admin, collegato a employee 2
    await tx.employee.updateMany({
      where: { user_id: souhaielUser.id, id: { not: 2 } },
      data: { user_id: null },
    });

    await tx.employee.update({
      where: { id: 2 },
      data: {
        user_id: souhaielUser.id,
        ruolo: "ADMIN",
      },
    });

    await tx.user.update({
      where: { id: souhaielUser.id },
      data: { role: "ADMIN", is_active: 1 },
    });

    changes.souhaiel = { userId: souhaielUser.id, employeeId: 2 };

    return changes;
  });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      is_active: true,
      employee: { select: { id: true, nome: true, cognome: true, ruolo: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log("Identity migration completed.");
  console.log(JSON.stringify({ summary, users }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Identity migration failed:", err.message);
    process.exit(1);
  });
