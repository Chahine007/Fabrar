import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getCantieriStatus: vi.fn(),
  formatDateOnly: vi.fn((value) => value),
  parseDateOnly: vi.fn((value) => value),
  getPendingSummary: vi.fn(),
  getMultiProjectFinancials: vi.fn(),
}));

vi.mock("../../src/db/index.js", () => ({
  getDb: mocks.getDb,
  getCantieriStatus: mocks.getCantieriStatus,
  formatDateOnly: mocks.formatDateOnly,
  parseDateOnly: mocks.parseDateOnly,
}));

vi.mock("../../src/controllers/hr.controller.js", () => ({
  getPendingSummary: mocks.getPendingSummary,
}));

vi.mock("../../src/domain/finance/financeService.js", () => ({
  getMultiProjectFinancials: mocks.getMultiProjectFinancials,
}));

import { getFinanceKPIs } from "../../src/controllers/dashboard.controller.js";

function createResponse() {
  return {
    json: vi.fn(),
  };
}

describe("dashboard controller finance KPIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa un solo batch finance helper per tutti i cantieri attivi e mantiene la shape di risposta", async () => {
    const cantieri = [
      { id: 1, nome: "Alfa", budget: 1000, valore_contratto: 1200 },
      { id: 2, nome: "Beta", budget: 800, valore_contratto: null },
    ];
    const prisma = {
      cantiere: {
        findMany: vi.fn().mockResolvedValue(cantieri),
      },
    };
    mocks.getDb.mockReturnValue(prisma);
    mocks.getMultiProjectFinancials.mockResolvedValue({
      1: {
        costoTotale: 300,
        costoManodopera: 100,
        costoMateriali: 120,
        costoSpese: 80,
        totaleContratto: 1200,
        totaleFatturato: 400,
        totaleIncassato: 250,
        daFatturare: 800,
        ricaviFatturati: 400,
        ricaviReali: 250,
        margineFatturato: 100,
        margineIncassato: -50,
      },
      2: {
        costoTotale: 200,
        costoManodopera: 80,
        costoMateriali: 70,
        costoSpese: 50,
        totaleContratto: 800,
        totaleFatturato: 0,
        totaleIncassato: 0,
        daFatturare: 800,
        ricaviFatturati: 0,
        ricaviReali: 0,
        margineFatturato: -200,
        margineIncassato: -200,
      },
    });
    const res = createResponse();
    const next = vi.fn();

    await getFinanceKPIs({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(prisma.cantiere.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.getMultiProjectFinancials).toHaveBeenCalledTimes(1);
    expect(mocks.getMultiProjectFinancials).toHaveBeenCalledWith(prisma, [1, 2], cantieri);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetTotale: 2000,
        costiTotali: 500,
        costoManodoperaTotale: 180,
        costoMaterialiTotale: 190,
        costoSpeseTotale: 130,
        totaleFatturato: 400,
        totaleIncassato: 250,
        daFatturare: 1600,
        margine: 1500,
        topCantieri: [
          expect.objectContaining({
            id: 1,
            valoreContratto: 1200,
            costo: 300,
            burnRate: 0.25,
            cpi: 4,
          }),
          expect.objectContaining({
            id: 2,
            valoreContratto: 800,
            costo: 200,
            burnRate: 0.25,
            cpi: 4,
          }),
        ],
      })
    );
  });
});
