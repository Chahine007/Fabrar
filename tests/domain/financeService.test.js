import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/db/index.js", () => ({
  getDb: vi.fn(),
}));

import {
  buildMultiProjectFinancialsMap,
  getMultiProjectFinancials,
} from "../../src/domain/finance/financeService.js";

describe("financeService multi-project aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merge i gruppi parziali e produce default a zero per i cantieri senza righe", () => {
    const result = buildMultiProjectFinancialsMap(
      [
        { id: 1, budget: 1000, valore_contratto: 1200 },
        { id: 2, budget: 500, valore_contratto: null },
      ],
      {
        laborRows: [{ cantiere_id: 1, costo_manodopera: 100 }],
        materialRows: [{ cantiere_id: 1, _sum: { valore_totale: 200 } }],
        expenseRows: [{ cantiere_id: 1, _sum: { importo: 50 } }],
        billedRows: [{ cantiere_id: 1, _sum: { importo_totale: 400 } }],
        collectedRows: [{ cantiere_id: 1, _sum: { importo_totale: 250 } }],
      }
    );

    expect(result[1]).toEqual({
      costoManodopera: 100,
      costoMateriali: 200,
      costoSpese: 50,
      costoTotale: 350,
      totaleContratto: 1200,
      ricavoPrevisto: 1200,
      totaleFatturato: 400,
      totaleIncassato: 250,
      ricaviFatturati: 400,
      ricaviReali: 250,
      daFatturare: 800,
      margine: 850,
      burnRate: 0.29,
      cpi: 3.43,
      marginePrevisto: 850,
      margineFatturato: 50,
      margineIncassato: -100,
    });
    expect(result[2]).toEqual({
      costoManodopera: 0,
      costoMateriali: 0,
      costoSpese: 0,
      costoTotale: 0,
      totaleContratto: 500,
      ricavoPrevisto: 500,
      totaleFatturato: 0,
      totaleIncassato: 0,
      ricaviFatturati: 0,
      ricaviReali: 0,
      daFatturare: 500,
      margine: 500,
      burnRate: 0,
      cpi: null,
      marginePrevisto: 500,
      margineFatturato: 0,
      margineIncassato: 0,
    });
  });

  it("normalizza gli id e usa un set costante di query aggregate senza rileggere i cantieri se gia forniti", async () => {
    const baseCantieri = [{ id: 1, nome: "Alfa", budget: 1000, valore_contratto: 1200 }];
    const prisma = {
      cantiere: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ cantiere_id: 1, costo_manodopera: 100 }]),
      movimentoMagazzino: {
        groupBy: vi.fn().mockResolvedValue([{ cantiere_id: 1, _sum: { valore_totale: 30 } }]),
      },
      spesa: {
        groupBy: vi.fn().mockResolvedValue([{ cantiere_id: 1, _sum: { importo: 20 } }]),
      },
      fattura: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ cantiere_id: 1, _sum: { importo_totale: 400 } }])
          .mockResolvedValueOnce([{ cantiere_id: 1, _sum: { importo_totale: 250 } }]),
      },
    };

    const result = await getMultiProjectFinancials(prisma, [1, "1", null, 0], baseCantieri);

    expect(prisma.cantiere.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.movimentoMagazzino.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.spesa.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.fattura.groupBy).toHaveBeenCalledTimes(2);
    expect(result[1]).toEqual(
      expect.objectContaining({
        costoTotale: 150,
        daFatturare: 800,
        margine: 1050,
        burnRate: 0.13,
        cpi: 8,
      })
    );
  });
});
