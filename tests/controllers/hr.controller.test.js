import { describe, expect, it, vi } from "vitest";
import { ValidationStatus } from "../../src/constants.js";

vi.mock("../../src/db/index.js", () => ({
  getDb: vi.fn(),
  createTariffa: vi.fn(),
  updateReportEntry: vi.fn(),
  updateSpesa: vi.fn(),
  listReportsWithEntries: vi.fn(),
  getAuditLogs: vi.fn(),
  updateReportHeader: vi.fn(),
  formatDateOnly: vi.fn((value) => value),
  parseDateOnly: vi.fn((value) => value),
}));

import { getPendingSummary } from "../../src/controllers/hr.controller.js";

describe("hr controller pending summary", () => {
  it("usa due count Prisma e mantiene il payload { reports, spese }", async () => {
    const prisma = {
      reportEntry: {
        count: vi.fn().mockResolvedValue(4),
      },
      spesa: {
        count: vi.fn().mockResolvedValue(7),
      },
    };

    const result = await getPendingSummary(prisma);

    expect(prisma.reportEntry.count).toHaveBeenCalledWith({
      where: { stato_validazione: ValidationStatus.PENDING },
    });
    expect(prisma.spesa.count).toHaveBeenCalledWith({
      where: { stato_validazione: ValidationStatus.PENDING },
    });
    expect(result).toEqual({
      reports: 4,
      spese: 7,
    });
  });
});
