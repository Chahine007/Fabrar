-- CRM MVP schema (generated via prisma migrate diff)

-- CreateEnum
CREATE TYPE "CrmInteractionType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK');

-- CreateEnum
CREATE TYPE "CrmDealStage" AS ENUM ('PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "CrmTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CrmTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CrmCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "CrmAccount" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "vat_number" TEXT,
    "tax_code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "country" TEXT DEFAULT 'IT',
    "industry" TEXT,
    "notes" TEXT,
    "tags" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "title" TEXT,
    "department" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "tags" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmInteraction" (
    "id" SERIAL NOT NULL,
    "type" "CrmInteractionType" NOT NULL DEFAULT 'NOTE',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT,
    "body" TEXT,
    "outcome" TEXT,
    "account_id" INTEGER,
    "contact_id" INTEGER,
    "deal_id" INTEGER,
    "ticket_id" INTEGER,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmDeal" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" "CrmDealStage" NOT NULL DEFAULT 'PROSPECT',
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "expected_close" TIMESTAMP(3),
    "owner_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTicket" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER,
    "contact_id" INTEGER,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CrmTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_user_id" INTEGER,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCampaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "channel" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCampaignMember" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "status" TEXT DEFAULT 'ADDED',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmFaq" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmIntegrationAccount" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "display_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmIntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEvent" (
    "id" SERIAL NOT NULL,
    "integration_account_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_event_id" TEXT,
    "payload" JSONB,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmAccount_name_idx" ON "CrmAccount"("name");

-- CreateIndex
CREATE INDEX "CrmAccount_vat_number_idx" ON "CrmAccount"("vat_number");

-- CreateIndex
CREATE INDEX "CrmAccount_tax_code_idx" ON "CrmAccount"("tax_code");

-- CreateIndex
CREATE INDEX "CrmAccount_email_idx" ON "CrmAccount"("email");

-- CreateIndex
CREATE INDEX "CrmAccount_is_active_updated_at_idx" ON "CrmAccount"("is_active", "updated_at");

-- CreateIndex
CREATE INDEX "CrmContact_account_id_idx" ON "CrmContact"("account_id");

-- CreateIndex
CREATE INDEX "CrmContact_email_idx" ON "CrmContact"("email");

-- CreateIndex
CREATE INDEX "CrmContact_phone_idx" ON "CrmContact"("phone");

-- CreateIndex
CREATE INDEX "CrmContact_last_name_idx" ON "CrmContact"("last_name");

-- CreateIndex
CREATE INDEX "CrmContact_updated_at_idx" ON "CrmContact"("updated_at");

-- CreateIndex
CREATE INDEX "CrmInteraction_account_id_occurred_at_idx" ON "CrmInteraction"("account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "CrmInteraction_contact_id_occurred_at_idx" ON "CrmInteraction"("contact_id", "occurred_at");

-- CreateIndex
CREATE INDEX "CrmInteraction_deal_id_occurred_at_idx" ON "CrmInteraction"("deal_id", "occurred_at");

-- CreateIndex
CREATE INDEX "CrmInteraction_ticket_id_occurred_at_idx" ON "CrmInteraction"("ticket_id", "occurred_at");

-- CreateIndex
CREATE INDEX "CrmInteraction_created_by_user_id_occurred_at_idx" ON "CrmInteraction"("created_by_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "CrmDeal_account_id_idx" ON "CrmDeal"("account_id");

-- CreateIndex
CREATE INDEX "CrmDeal_stage_updated_at_idx" ON "CrmDeal"("stage", "updated_at");

-- CreateIndex
CREATE INDEX "CrmDeal_owner_user_id_idx" ON "CrmDeal"("owner_user_id");

-- CreateIndex
CREATE INDEX "CrmTicket_account_id_status_idx" ON "CrmTicket"("account_id", "status");

-- CreateIndex
CREATE INDEX "CrmTicket_contact_id_idx" ON "CrmTicket"("contact_id");

-- CreateIndex
CREATE INDEX "CrmTicket_assignee_user_id_status_idx" ON "CrmTicket"("assignee_user_id", "status");

-- CreateIndex
CREATE INDEX "CrmTicket_status_updated_at_idx" ON "CrmTicket"("status", "updated_at");

-- CreateIndex
CREATE INDEX "CrmCampaign_name_idx" ON "CrmCampaign"("name");

-- CreateIndex
CREATE INDEX "CrmCampaign_status_updated_at_idx" ON "CrmCampaign"("status", "updated_at");

-- CreateIndex
CREATE INDEX "CrmCampaignMember_campaign_id_idx" ON "CrmCampaignMember"("campaign_id");

-- CreateIndex
CREATE INDEX "CrmCampaignMember_contact_id_idx" ON "CrmCampaignMember"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCampaignMember_campaign_id_contact_id_key" ON "CrmCampaignMember"("campaign_id", "contact_id");

-- CreateIndex
CREATE INDEX "CrmFaq_category_idx" ON "CrmFaq"("category");

-- CreateIndex
CREATE INDEX "CrmFaq_is_active_sort_order_idx" ON "CrmFaq"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "CrmIntegrationAccount_provider_status_idx" ON "CrmIntegrationAccount"("provider", "status");

-- CreateIndex
CREATE INDEX "CrmEvent_integration_account_id_created_at_idx" ON "CrmEvent"("integration_account_id", "created_at");

-- CreateIndex
CREATE INDEX "CrmEvent_event_type_created_at_idx" ON "CrmEvent"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "CrmEvent_processed_at_idx" ON "CrmEvent"("processed_at");

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "CrmDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "CrmTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCampaignMember" ADD CONSTRAINT "CrmCampaignMember_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCampaignMember" ADD CONSTRAINT "CrmCampaignMember_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEvent" ADD CONSTRAINT "CrmEvent_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "CrmIntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

