import { beforeAll, describe, expect, it, vi } from "vitest";

let parseDateOnly;
let formatDateOnly;
let getCantieriStatus;

beforeAll(async () => {
  process.env.PRISMA_DB_URL ||= "postgresql://test:test@localhost:5432/test_db?schema=public";
  const db = await import("../src/db/index.js");
  parseDateOnly = db.parseDateOnly;
  formatDateOnly = db.formatDateOnly;
  getCantieriStatus = db.getCantieriStatus;
});

describe("db date helpers", () => {
  it("normalizza una data ISO date-only", () => {
    const parsed = parseDateOnly("2026-04-14");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe("2026-04-14T00:00:00.000Z");
  });

  it("normalizza una Date preservando il giorno", () => {
    const parsed = parseDateOnly(new Date("2026-04-14T18:45:00.000Z"));
    expect(formatDateOnly(parsed)).toBe("2026-04-14");
  });

  it("serializza BigInt senza perdita", () => {
    const json = JSON.stringify({ telegram_id: 9223372036854775807n });
    expect(json).toContain("\"9223372036854775807\"");
  });
});

describe("getCantieriStatus", () => {
  it("somma manodopera approvata e tutte le spese non rejected mantenendo lo shape corrente", async () => {
    const prismaClient = {
      cantiere: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, nome: "Alfa", budget: 1000 },
          { id: 2, nome: "Beta", budget: null },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        { cantiere_id: 1, costo_manodopera: 150.255 },
      ]),
      spesa: {
        groupBy: vi.fn().mockResolvedValue([
          { cantiere_id: 1, _sum: { importo: 49.749 } },
          { cantiere_id: 2, _sum: { importo: 10 } },
        ]),
      },
    };

    const result = await getCantieriStatus({ activeOnly: true }, prismaClient);

    expect(prismaClient.cantiere.findMany).toHaveBeenCalledWith({
      where: { attivo: 1 },
      select: { id: true, nome: true, budget: true },
      orderBy: { nome: "asc" },
    });
    expect(prismaClient.spesa.groupBy).toHaveBeenCalledWith({
      by: ["cantiere_id"],
      where: {
        cantiere_id: { in: [1, 2] },
        NOT: { stato_validazione: "REJECTED" },
      },
      _sum: { importo: true },
    });
    expect(result).toEqual([
      {
        id: 1,
        nome: "Alfa",
        budget: 1000,
        costo_manodopera: 150.26,
        costo_materiali: 49.75,
        costo_totale: 200.01,
      },
      {
        id: 2,
        nome: "Beta",
        budget: 0,
        costo_manodopera: 0,
        costo_materiali: 10,
        costo_totale: 10,
      },
    ]);
  });
});
