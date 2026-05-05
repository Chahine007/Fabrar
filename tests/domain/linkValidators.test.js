import { describe, expect, it, vi } from "vitest";
import {
  ensureCantiereActive,
  ensureTaskBelongsToCantiere,
  ensureWbsBelongsToCantiere,
  getRootWbsId,
} from "../../src/domain/shared/linkValidators.js";

describe("linkValidators", () => {
  it("verifica se il cantiere e attivo", async () => {
    const prisma = {
      cantiere: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 5 })
          .mockResolvedValueOnce(null),
      },
    };

    await expect(ensureCantiereActive(prisma, 5)).resolves.toBe(true);
    await expect(ensureCantiereActive(prisma, 7)).resolves.toBe(false);
  });

  it("rifiuta task collegati a un altro cantiere", async () => {
    const prisma = {
      task: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 10, cantiere_id: 3 })
          .mockResolvedValueOnce({ id: 11, cantiere_id: 8 })
          .mockResolvedValueOnce(null),
      },
    };

    await expect(ensureTaskBelongsToCantiere(prisma, 10, 3)).resolves.toBe(true);
    await expect(ensureTaskBelongsToCantiere(prisma, 11, 3)).resolves.toBe(false);
    await expect(ensureTaskBelongsToCantiere(prisma, 12, 3)).resolves.toBe(false);
  });

  it("rifiuta WBS collegati a un altro cantiere", async () => {
    const prisma = {
      wbsNode: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 20, cantiere_id: 4 })
          .mockResolvedValueOnce({ id: 21, cantiere_id: 9 })
          .mockResolvedValueOnce(null),
      },
    };

    await expect(ensureWbsBelongsToCantiere(prisma, 20, 4)).resolves.toBe(true);
    await expect(ensureWbsBelongsToCantiere(prisma, 21, 4)).resolves.toBe(false);
    await expect(ensureWbsBelongsToCantiere(prisma, 22, 4)).resolves.toBe(false);
  });

  it("restituisce la root WBS o null se manca", async () => {
    const prisma = {
      wbsNode: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 30 })
          .mockResolvedValueOnce(null),
      },
    };

    await expect(getRootWbsId(prisma, 6)).resolves.toBe(30);
    await expect(getRootWbsId(prisma, 7)).resolves.toBeNull();
  });
});
