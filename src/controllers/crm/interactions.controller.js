import { getDb } from "../../db/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const listCrmInteractions = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { account_id, contact_id, deal_id, ticket_id, take, skip } = req.query;

  const where = {
    ...(account_id ? { account_id: Number(account_id) } : {}),
    ...(contact_id ? { contact_id: Number(contact_id) } : {}),
    ...(deal_id ? { deal_id: Number(deal_id) } : {}),
    ...(ticket_id ? { ticket_id: Number(ticket_id) } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crmInteraction.findMany({
      where,
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmInteraction.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const createCrmInteraction = asyncHandler(async (req, res) => {
  const prisma = getDb();

  const createdByUserId = req.user?.id != null ? Number(req.user.id) : null;
  const interaction = await prisma.crmInteraction.create({
    data: {
      ...req.body,
      created_by_user_id: Number.isInteger(createdByUserId) ? createdByUserId : null,
    },
  });

  res.status(201).json(interaction);
});

