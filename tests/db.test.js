import { describe, it, expect, beforeEach, vi } from "vitest";

// Strategia mocking: resettiamo i moduli e forziamo DB_PATH=:memory:
// per garantire isolamento totale e nessun accesso al DB di produzione.

async function loadDb() {
  vi.resetModules();
  process.env.DB_PATH = ":memory:";
  const db = await import("../src/db/index.js");
  await db.initDb();
  return db;
}

describe("db", () => {
  beforeEach(() => {
    process.env.DB_PATH = ":memory:";
  });

  it("crea un dipendente e lo recupera", async () => {
    const db = await loadDb();
    const emp = await db.createEmployee(123, 456);
    expect(emp.telegram_id).toBe(123);

    const found = await db.findEmployeeByTelegramId(123);
    expect(found).not.toBeNull();
    expect(found.chat_id).toBe(456);
  });

  it("aggiorna il dipendente in stato registrato", async () => {
    const db = await loadDb();
    const emp = await db.createEmployee(999, 111);
    await db.updateEmployee(emp.id, { stato_registrazione: "registrato", nome: "Mario" });

    const found = await db.findEmployeeByTelegramId(999);
    expect(found.stato_registrazione).toBe("registrato");
    expect(found.nome).toBe("Mario");
  });

  it("upsert report giornaliero crea e poi aggiorna", async () => {
    const db = await loadDb();
    const emp = await db.createEmployee(222, 333);
    const date = "2026-03-26";

    await db.upsertReport(emp.id, date, {
      ore_lavorate: 8,
      attivita_svolte: "Test A",
      luogo_cantiere: "Cantiere 1",
      problemi_riscontrati: "Nessuno",
      testo_originale: "ok",
    });

    const r1 = await db.findReportForDate(emp.id, date);
    expect(r1.ore_lavorate).toBe(8);

    await db.upsertReport(emp.id, date, {
      ore_lavorate: 7.5,
      attivita_svolte: "Test B",
      luogo_cantiere: "Cantiere 1",
      problemi_riscontrati: "Ritardo",
      testo_originale: "ok2",
    });

    const r2 = await db.findReportForDate(emp.id, date);
    expect(r2.ore_lavorate).toBe(7.5);
    expect(r2.attivita_svolte).toBe("Test B");
  });
});
