import { getDb } from "../../db/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const listCrmDeals = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { search, account_id, owner_user_id, stage, take, skip } = req.query;

  const q = String(search ?? "").trim();
  const where = {
    ...(account_id ? { account_id: Number(account_id) } : {}),
    ...(owner_user_id ? { owner_user_id: Number(owner_user_id) } : {}),
    ...(stage ? { stage } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crmDeal.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmDeal.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const createCrmDeal = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const deal = await prisma.crmDeal.create({ data: req.body });
  res.status(201).json(deal);
});

export const updateCrmDeal = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const dealId = Number(req.params.dealId);

  const existing = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Deal non trovato." });

  const updated = await prisma.crmDeal.update({ where: { id: dealId }, data: req.body });
  res.json(updated);
});

export const deleteCrmDeal = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const dealId = Number(req.params.dealId);

  const existing = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Deal non trovato." });

  await prisma.crmDeal.delete({ where: { id: dealId } });
  res.json({ ok: true, dealId });
});

