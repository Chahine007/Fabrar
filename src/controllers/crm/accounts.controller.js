import { getDb } from "../../db/index.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

function buildAccountWhere({ search, is_active }) {
  const where = {};
  if (typeof is_active === "boolean") where.is_active = is_active;

  const q = String(search ?? "").trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { vat_number: { contains: q, mode: "insensitive" } },
      { tax_code: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export const listCrmAccounts = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { search, is_active, take, skip } = req.query;

  const where = buildAccountWhere({ search, is_active });
  const [items, total] = await Promise.all([
    prisma.crmAccount.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmAccount.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const getCrmAccount = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const accountId = Number(req.params.accountId);

  const account = await prisma.crmAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) return res.status(404).json({ error: "Account non trovato." });
  res.json(account);
});

export const createCrmAccount = asyncHandler(async (req, res) => {
  const prisma = getDb();

  const account = await prisma.crmAccount.create({
    data: req.body,
  });

  res.status(201).json(account);
});

export const updateCrmAccount = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const accountId = Number(req.params.accountId);

  const existing = await prisma.crmAccount.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: "Account non trovato." });

  const updated = await prisma.crmAccount.update({
    where: { id: accountId },
    data: req.body,
  });

  res.json(updated);
});

export const deleteCrmAccount = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const accountId = Number(req.params.accountId);

  const existing = await prisma.crmAccount.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: "Account non trovato." });

  await prisma.crmAccount.delete({ where: { id: accountId } });
  res.json({ ok: true, accountId });
});

export const listContactsByAccount = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const accountId = Number(req.params.accountId);
  const { search, take, skip } = req.query;

  const account = await prisma.crmAccount.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) return res.status(404).json({ error: "Account non trovato." });

  const q = String(search ?? "").trim();
  const where = {
    account_id: accountId,
    ...(q
      ? {
          OR: [
            { full_name: { contains: q, mode: "insensitive" } },
            { first_name: { contains: q, mode: "insensitive" } },
            { last_name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { mobile: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crmContact.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.crmContact.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

export const createContactForAccount = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const accountId = Number(req.params.accountId);

  const account = await prisma.crmAccount.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) return res.status(404).json({ error: "Account non trovato." });

  const contact = await prisma.crmContact.create({
    data: {
      ...req.body,
      account_id: accountId,
    },
  });

  res.status(201).json(contact);
});

export const updateCrmContact = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const contactId = Number(req.params.contactId);

  const existing = await prisma.crmContact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: "Contatto non trovato." });

  const updated = await prisma.crmContact.update({
    where: { id: contactId },
    data: req.body,
  });

  res.json(updated);
});

export const deleteCrmContact = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const contactId = Number(req.params.contactId);

  const existing = await prisma.crmContact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: "Contatto non trovato." });

  await prisma.crmContact.delete({ where: { id: contactId } });
  res.json({ ok: true, contactId });
});

