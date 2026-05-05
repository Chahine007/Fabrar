import { describe, expect, it, vi } from "vitest";
import { canAccessCantiere, getAccessibleCantiere } from "../../src/domain/shared/accessControl.js";

describe("accessControl", () => {
  it("consente accesso globale ai ruoli configurati senza query ownership", async () => {
    const prisma = {
      cantiere: {
        findFirst: vi.fn(),
      },
    };

    await expect(canAccessCantiere(prisma, { id: 1, role: "ADMIN" }, 10)).resolves.toBe(true);
    expect(prisma.cantiere.findFirst).not.toHaveBeenCalled();
  });

  it("limita i PROJECT_MANAGER ai cantieri assegnati", async () => {
    const prisma = {
      cantiere: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 10 })
          .mockResolvedValueOnce(null),
      },
    };

    await expect(canAccessCantiere(prisma, { id: 5, role: "PROJECT_MANAGER" }, 10)).resolves.toBe(true);
    await expect(canAccessCantiere(prisma, { id: 5, role: "PROJECT_MANAGER" }, 11)).resolves.toBe(false);

    expect(prisma.cantiere.findFirst).toHaveBeenCalledWith({
      where: {
        id: 10,
        OR: [{ pm_id: 5 }, { site_manager_id: 5 }],
      },
      select: { id: true },
    });
  });

  it("recupera il cantiere solo se accessibile", async () => {
    const prisma = {
      cantiere: {
        findFirst: vi.fn().mockResolvedValue({ id: 20, nome: "Alpha" }),
      },
    };

    await expect(getAccessibleCantiere(
      prisma,
      { id: 8, role: "PROJECT_MANAGER" },
      20,
      { select: { id: true, nome: true } }
    )).resolves.toEqual({ id: 20, nome: "Alpha" });
  });
});
