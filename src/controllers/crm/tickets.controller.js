import { getDb } from "../../db/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const listCrmTickets = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { search, account_id, contact_id, assignee_user_id, status, priority, take, skip } = req.query;

  const q = String(search ?? "").trim();
  const where = {
    ...(account_id ? { account_id: Number(account_id) } : {}),
    ...(contact_id ? { contact_id: Number(contact_id) } : {}),
    ...(assignee_user_id ? { assignee_user_id: Number(assignee_user_id) } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crmTicket.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmTicket.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const createCrmTicket = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const createdByUserId = req.user?.id != null ? Number(req.user.id) : null;

  const ticket = await prisma.crmTicket.create({
    data: {
      ...req.body,
      created_by_user_id: Number.isInteger(createdByUserId) ? createdByUserId : null,
    },
  });

  res.status(201).json(ticket);
});

export const updateCrmTicket = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const ticketId = Number(req.params.ticketId);

  const existing = await prisma.crmTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Ticket non trovato." });

  const updated = await prisma.crmTicket.update({ where: { id: ticketId }, data: req.body });
  res.json(updated);
});

export const deleteCrmTicket = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const ticketId = Number(req.params.ticketId);

  const existing = await prisma.crmTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Ticket non trovato." });

  await prisma.crmTicket.delete({ where: { id: ticketId } });
  res.json({ ok: true, ticketId });
});

