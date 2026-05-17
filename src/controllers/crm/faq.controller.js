import { getDb } from "../../db/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const listCrmFaq = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { category, is_active, take, skip } = req.query;

  const where = {
    ...(category ? { category } : {}),
    ...(typeof is_active === "boolean" ? { is_active } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crmFaq.findMany({
      where,
      orderBy: [{ sort_order: "asc" }, { updated_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmFaq.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const createCrmFaq = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const faq = await prisma.crmFaq.create({ data: req.body });
  res.status(201).json(faq);
});

export const updateCrmFaq = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const faqId = Number(req.params.faqId);

  const existing = await prisma.crmFaq.findUnique({ where: { id: faqId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "FAQ non trovata." });

  const updated = await prisma.crmFaq.update({ where: { id: faqId }, data: req.body });
  res.json(updated);
});

export const deleteCrmFaq = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const faqId = Number(req.params.faqId);

  const existing = await prisma.crmFaq.findUnique({ where: { id: faqId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "FAQ non trovata." });

  await prisma.crmFaq.delete({ where: { id: faqId } });
  res.json({ ok: true, faqId });
});

