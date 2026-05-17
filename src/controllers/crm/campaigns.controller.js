import { getDb } from "../../db/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const listCrmCampaigns = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { search, status, take, skip } = req.query;

  const q = String(search ?? "").trim();
  const where = {
    ...(status ? { status } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crmCampaign.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmCampaign.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const createCrmCampaign = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const campaign = await prisma.crmCampaign.create({ data: req.body });
  res.status(201).json(campaign);
});

export const updateCrmCampaign = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const campaignId = Number(req.params.campaignId);

  const existing = await prisma.crmCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Campagna non trovata." });

  const updated = await prisma.crmCampaign.update({ where: { id: campaignId }, data: req.body });
  res.json(updated);
});

export const deleteCrmCampaign = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const campaignId = Number(req.params.campaignId);

  const existing = await prisma.crmCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Campagna non trovata." });

  await prisma.crmCampaign.delete({ where: { id: campaignId } });
  res.json({ ok: true, campaignId });
});

export const listCrmCampaignMembers = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const campaignId = Number(req.params.campaignId);
  const { take, skip } = req.query;

  const campaign = await prisma.crmCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return res.status(404).json({ error: "Campagna non trovata." });

  const [items, total] = await Promise.all([
    prisma.crmCampaignMember.findMany({
      where: { campaign_id: campaignId },
      include: { contact: true },
      orderBy: [{ added_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmCampaignMember.count({ where: { campaign_id: campaignId } }),
  ]);

  res.json({ items, total, take, skip });
});

export const addCrmCampaignMember = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const campaignId = Number(req.params.campaignId);
  const { contact_id, status } = req.body;

  const campaign = await prisma.crmCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return res.status(404).json({ error: "Campagna non trovata." });

  const contact = await prisma.crmContact.findUnique({ where: { id: Number(contact_id) }, select: { id: true } });
  if (!contact) return res.status(404).json({ error: "Contatto non trovato." });

  const member = await prisma.crmCampaignMember.upsert({
    where: { campaign_id_contact_id: { campaign_id: campaignId, contact_id: Number(contact_id) } },
    create: { campaign_id: campaignId, contact_id: Number(contact_id), status: status ?? null },
    update: { status: status ?? undefined },
    include: { contact: true },
  });

  res.status(201).json(member);
});

export const removeCrmCampaignMember = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const campaignId = Number(req.params.campaignId);
  const contactId = Number(req.params.contactId);

  const existing = await prisma.crmCampaignMember.findUnique({
    where: { campaign_id_contact_id: { campaign_id: campaignId, contact_id: contactId } },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: "Membro non trovato." });

  await prisma.crmCampaignMember.delete({
    where: { campaign_id_contact_id: { campaign_id: campaignId, contact_id: contactId } },
  });
  res.json({ ok: true, campaignId, contactId });
});

