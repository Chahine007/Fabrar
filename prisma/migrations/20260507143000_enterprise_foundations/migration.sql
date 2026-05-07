DO $$ BEGIN
  CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerEntryStatus" AS ENUM ('POSTED', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "correlation_id" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_correlation_id_idx" ON "AuditLog"("correlation_id");

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
  "id" SERIAL PRIMARY KEY,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_line_key" TEXT NOT NULL DEFAULT 'main',
  "event_type" TEXT NOT NULL,
  "entry_type" TEXT NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "description" TEXT,
  "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "LedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
  "cantiere_id" INTEGER,
  "task_id" INTEGER,
  "wbs_node_id" INTEGER,
  "employee_id" INTEGER,
  "fornitore_id" INTEGER,
  "document_id" INTEGER,
  "spesa_id" INTEGER,
  "report_entry_id" INTEGER,
  "movimento_id" INTEGER,
  "fattura_acquisto_id" INTEGER,
  "scadenza_pagamento_id" INTEGER,
  "fattura_id" INTEGER,
  "rata_id" INTEGER,
  "cost_category" "CostCategory",
  "allocation_scope" "CostAllocationScope",
  "vat_rate" DECIMAL(5, 2),
  "taxable_amount" DECIMAL(12, 2),
  "tax_amount" DECIMAL(12, 2),
  "metadata" JSONB,
  "correlation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerEntry_source_type_source_id_source_line_key_event_type_key"
  ON "LedgerEntry"("source_type", "source_id", "source_line_key", "event_type");
CREATE INDEX IF NOT EXISTS "LedgerEntry_event_type_entry_date_idx" ON "LedgerEntry"("event_type", "entry_date");
CREATE INDEX IF NOT EXISTS "LedgerEntry_entry_type_entry_date_idx" ON "LedgerEntry"("entry_type", "entry_date");
CREATE INDEX IF NOT EXISTS "LedgerEntry_cantiere_id_task_id_idx" ON "LedgerEntry"("cantiere_id", "task_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_wbs_node_id_idx" ON "LedgerEntry"("wbs_node_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_employee_id_idx" ON "LedgerEntry"("employee_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_fornitore_id_idx" ON "LedgerEntry"("fornitore_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_document_id_idx" ON "LedgerEntry"("document_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_spesa_id_idx" ON "LedgerEntry"("spesa_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_report_entry_id_idx" ON "LedgerEntry"("report_entry_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_movimento_id_idx" ON "LedgerEntry"("movimento_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_fattura_acquisto_id_idx" ON "LedgerEntry"("fattura_acquisto_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_scadenza_pagamento_id_idx" ON "LedgerEntry"("scadenza_pagamento_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_fattura_id_idx" ON "LedgerEntry"("fattura_id");
CREATE INDEX IF NOT EXISTS "LedgerEntry_cost_category_allocation_scope_idx" ON "LedgerEntry"("cost_category", "allocation_scope");
CREATE INDEX IF NOT EXISTS "LedgerEntry_correlation_id_idx" ON "LedgerEntry"("correlation_id");

CREATE TABLE IF NOT EXISTS "OutboxEvent" (
  "id" SERIAL PRIMARY KEY,
  "event_type" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "correlation_id" TEXT,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OutboxEvent_status_created_at_idx" ON "OutboxEvent"("status", "created_at");
CREATE INDEX IF NOT EXISTS "OutboxEvent_event_type_idx" ON "OutboxEvent"("event_type");
CREATE INDEX IF NOT EXISTS "OutboxEvent_aggregate_type_aggregate_id_idx" ON "OutboxEvent"("aggregate_type", "aggregate_id");
CREATE INDEX IF NOT EXISTS "OutboxEvent_correlation_id_idx" ON "OutboxEvent"("correlation_id");

CREATE TABLE IF NOT EXISTS "WorkflowTransition" (
  "id" SERIAL PRIMARY KEY,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_state" TEXT,
  "to_state" TEXT,
  "actor_user_id" INTEGER,
  "actor_employee_id" INTEGER,
  "payload" JSONB,
  "correlation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "WorkflowTransition_entity_type_entity_id_idx" ON "WorkflowTransition"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_action_idx" ON "WorkflowTransition"("action");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_actor_user_id_idx" ON "WorkflowTransition"("actor_user_id");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_actor_employee_id_idx" ON "WorkflowTransition"("actor_employee_id");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_correlation_id_idx" ON "WorkflowTransition"("correlation_id");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_created_at_idx" ON "WorkflowTransition"("created_at");
