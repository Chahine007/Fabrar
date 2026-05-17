import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { requireCapability } from "../middleware/requireCapability.js";
import { validate } from "../middleware/validation.js";

import {
  createCrmAccountSchema,
  deleteCrmAccountSchema,
  getCrmAccountSchema,
  listCrmAccountsSchema,
  createCrmContactForAccountSchema,
  deleteCrmContactSchema,
  listCrmContactsByAccountSchema,
  updateCrmAccountSchema,
  updateCrmContactSchema,
} from "../schemas/crm/accounts.schema.js";
import { createCrmInteractionSchema, listCrmInteractionsSchema } from "../schemas/crm/interactions.schema.js";
import { createCrmDealSchema, deleteCrmDealSchema, listCrmDealsSchema, updateCrmDealSchema } from "../schemas/crm/deals.schema.js";
import {
  createCrmTicketSchema,
  deleteCrmTicketSchema,
  listCrmTicketsSchema,
  updateCrmTicketSchema,
} from "../schemas/crm/tickets.schema.js";
import {
  addCrmCampaignMemberSchema,
  createCrmCampaignSchema,
  deleteCrmCampaignSchema,
  listCrmCampaignMembersSchema,
  listCrmCampaignsSchema,
  removeCrmCampaignMemberSchema,
  updateCrmCampaignSchema,
} from "../schemas/crm/campaigns.schema.js";
import {
  createCrmFaqSchema,
  deleteCrmFaqSchema,
  listCrmFaqSchema,
  updateCrmFaqSchema,
} from "../schemas/crm/faq.schema.js";

import {
  createCrmAccount,
  createContactForAccount,
  deleteCrmAccount,
  deleteCrmContact,
  getCrmAccount,
  listContactsByAccount,
  listCrmAccounts,
  updateCrmAccount,
  updateCrmContact,
} from "../controllers/crm/accounts.controller.js";
import { createCrmInteraction, listCrmInteractions } from "../controllers/crm/interactions.controller.js";
import { createCrmDeal, deleteCrmDeal, listCrmDeals, updateCrmDeal } from "../controllers/crm/deals.controller.js";
import { createCrmTicket, deleteCrmTicket, listCrmTickets, updateCrmTicket } from "../controllers/crm/tickets.controller.js";
import {
  addCrmCampaignMember,
  createCrmCampaign,
  deleteCrmCampaign,
  listCrmCampaignMembers,
  listCrmCampaigns,
  removeCrmCampaignMember,
  updateCrmCampaign,
} from "../controllers/crm/campaigns.controller.js";
import { createCrmFaq, deleteCrmFaq, listCrmFaq, updateCrmFaq } from "../controllers/crm/faq.controller.js";

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
router.use("/api/crm", verifyToken);

// ─── Accounts ────────────────────────────────────────────────────────────────
router.get(
  "/api/crm/accounts",
  requireCapability("crm:accounts:read"),
  validate(listCrmAccountsSchema),
  listCrmAccounts
);
router.get(
  "/api/crm/accounts/:accountId",
  requireCapability("crm:accounts:read"),
  validate(getCrmAccountSchema),
  getCrmAccount
);
router.post(
  "/api/crm/accounts",
  requireCapability("crm:accounts:write"),
  validate(createCrmAccountSchema),
  createCrmAccount
);
router.patch(
  "/api/crm/accounts/:accountId",
  requireCapability("crm:accounts:write"),
  validate(updateCrmAccountSchema),
  updateCrmAccount
);
router.delete(
  "/api/crm/accounts/:accountId",
  requireCapability("crm:accounts:write"),
  validate(deleteCrmAccountSchema),
  deleteCrmAccount
);

// ─── Contacts ────────────────────────────────────────────────────────────────
router.get(
  "/api/crm/accounts/:accountId/contacts",
  requireCapability("crm:contacts:read"),
  validate(listCrmContactsByAccountSchema),
  listContactsByAccount
);
router.post(
  "/api/crm/accounts/:accountId/contacts",
  requireCapability("crm:contacts:write"),
  validate(createCrmContactForAccountSchema),
  createContactForAccount
);
router.patch(
  "/api/crm/contacts/:contactId",
  requireCapability("crm:contacts:write"),
  validate(updateCrmContactSchema),
  updateCrmContact
);
router.delete(
  "/api/crm/contacts/:contactId",
  requireCapability("crm:contacts:write"),
  validate(deleteCrmContactSchema),
  deleteCrmContact
);

// ─── Interactions ────────────────────────────────────────────────────────────
router.get(
  "/api/crm/interactions",
  requireCapability("crm:accounts:read"),
  validate(listCrmInteractionsSchema),
  listCrmInteractions
);
router.post(
  "/api/crm/interactions",
  requireCapability("crm:accounts:write"),
  validate(createCrmInteractionSchema),
  createCrmInteraction
);

// ─── Deals ───────────────────────────────────────────────────────────────────
router.get(
  "/api/crm/deals",
  requireCapability("crm:deals:read"),
  validate(listCrmDealsSchema),
  listCrmDeals
);
router.post(
  "/api/crm/deals",
  requireCapability("crm:deals:write"),
  validate(createCrmDealSchema),
  createCrmDeal
);
router.patch(
  "/api/crm/deals/:dealId",
  requireCapability("crm:deals:write"),
  validate(updateCrmDealSchema),
  updateCrmDeal
);
router.delete(
  "/api/crm/deals/:dealId",
  requireCapability("crm:deals:write"),
  validate(deleteCrmDealSchema),
  deleteCrmDeal
);

// ─── Tickets ─────────────────────────────────────────────────────────────────
router.get(
  "/api/crm/tickets",
  requireCapability("crm:tickets:read"),
  validate(listCrmTicketsSchema),
  listCrmTickets
);
router.post(
  "/api/crm/tickets",
  requireCapability("crm:tickets:write"),
  validate(createCrmTicketSchema),
  createCrmTicket
);
router.patch(
  "/api/crm/tickets/:ticketId",
  requireCapability("crm:tickets:write"),
  validate(updateCrmTicketSchema),
  updateCrmTicket
);
router.delete(
  "/api/crm/tickets/:ticketId",
  requireCapability("crm:tickets:write"),
  validate(deleteCrmTicketSchema),
  deleteCrmTicket
);

// ─── Campaigns ───────────────────────────────────────────────────────────────
router.get(
  "/api/crm/campaigns",
  requireCapability("crm:campaigns:read"),
  validate(listCrmCampaignsSchema),
  listCrmCampaigns
);
router.post(
  "/api/crm/campaigns",
  requireCapability("crm:campaigns:write"),
  validate(createCrmCampaignSchema),
  createCrmCampaign
);
router.patch(
  "/api/crm/campaigns/:campaignId",
  requireCapability("crm:campaigns:write"),
  validate(updateCrmCampaignSchema),
  updateCrmCampaign
);
router.delete(
  "/api/crm/campaigns/:campaignId",
  requireCapability("crm:campaigns:write"),
  validate(deleteCrmCampaignSchema),
  deleteCrmCampaign
);

router.get(
  "/api/crm/campaigns/:campaignId/members",
  requireCapability("crm:campaigns:read"),
  validate(listCrmCampaignMembersSchema),
  listCrmCampaignMembers
);
router.post(
  "/api/crm/campaigns/:campaignId/members",
  requireCapability("crm:campaigns:write"),
  validate(addCrmCampaignMemberSchema),
  addCrmCampaignMember
);
router.delete(
  "/api/crm/campaigns/:campaignId/members/:contactId",
  requireCapability("crm:campaigns:write"),
  validate(removeCrmCampaignMemberSchema),
  removeCrmCampaignMember
);

// ─── FAQ ─────────────────────────────────────────────────────────────────────
router.get(
  "/api/crm/faq",
  requireCapability("crm:accounts:read"),
  validate(listCrmFaqSchema),
  listCrmFaq
);
router.post(
  "/api/crm/faq",
  requireCapability("crm:accounts:write"),
  validate(createCrmFaqSchema),
  createCrmFaq
);
router.patch(
  "/api/crm/faq/:faqId",
  requireCapability("crm:accounts:write"),
  validate(updateCrmFaqSchema),
  updateCrmFaq
);
router.delete(
  "/api/crm/faq/:faqId",
  requireCapability("crm:accounts:write"),
  validate(deleteCrmFaqSchema),
  deleteCrmFaq
);

export default router;

