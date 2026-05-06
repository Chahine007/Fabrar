CREATE TYPE "CostCategory" AS ENUM (
  'INVENTORY_MATERIAL',
  'CONSUMABLE_SUPPLY',
  'SERVICE',
  'LEASING_RENTAL',
  'UTILITY',
  'INSURANCE',
  'TAX_FEE',
  'PROFESSIONAL_SERVICE',
  'TRAVEL_VEHICLE',
  'OTHER',
  'UNKNOWN'
);

CREATE TYPE "CostAllocationScope" AS ENUM (
  'PROJECT',
  'OVERHEAD',
  'REVIEW'
);

ALTER TABLE "Document"
  ALTER COLUMN "cantiere_id" DROP NOT NULL;

ALTER TABLE "Spesa"
  ALTER COLUMN "cantiere_id" DROP NOT NULL,
  ADD COLUMN "fornitore_id" INTEGER,
  ADD COLUMN "cost_category" "CostCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "allocation_scope" "CostAllocationScope" NOT NULL DEFAULT 'PROJECT';

UPDATE "Spesa"
SET "cost_category" = 'UNKNOWN',
    "allocation_scope" = 'REVIEW'
WHERE ("fonte" = 'IMPORT_GENYA' OR "input_method" = 'import_genya')
  AND "logistica_status" IN ('PENDING_OCR', 'OCR_REVIEW', 'RECONCILIATION_REQUIRED');

UPDATE "Spesa"
SET "cost_category" = 'INVENTORY_MATERIAL',
    "allocation_scope" = 'PROJECT'
WHERE ("fonte" = 'IMPORT_GENYA' OR "input_method" = 'import_genya')
  AND "logistica_status" = 'LOADED_TO_WAREHOUSE';

UPDATE "Spesa"
SET "allocation_scope" = 'OVERHEAD'
WHERE "cantiere_id" IS NULL;

ALTER TABLE "Spesa"
  ADD CONSTRAINT "Spesa_fornitore_id_fkey"
  FOREIGN KEY ("fornitore_id") REFERENCES "Fornitore"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Spesa_fornitore_id_idx" ON "Spesa"("fornitore_id");
CREATE INDEX "Spesa_cost_category_idx" ON "Spesa"("cost_category");
CREATE INDEX "Spesa_allocation_scope_idx" ON "Spesa"("allocation_scope");
