import { beforeAll, describe, expect, it } from "vitest";

let parseDateOnly;
let formatDateOnly;

beforeAll(async () => {
  process.env.PRISMA_DB_URL ||= "postgresql://test:test@localhost:5432/test_db?schema=public";
  const db = await import("../src/db/index.js");
  parseDateOnly = db.parseDateOnly;
  formatDateOnly = db.formatDateOnly;
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
