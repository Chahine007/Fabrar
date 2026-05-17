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

DO $$
BEGIN
  IF to_regclass('"Document"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "Document" ALTER COLUMN "cantiere_id" DROP NOT NULL';
  END IF;

  IF to_regclass('"Spesa"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "Spesa"
      ALTER COLUMN "cantiere_id" DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS "fornitore_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "cost_category" "CostCategory" NOT NULL DEFAULT ''OTHER'',
      ADD COLUMN IF NOT EXISTS "allocation_scope" "CostAllocationScope" NOT NULL DEFAULT ''PROJECT''';

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Spesa' AND column_name='logistica_status')
       AND (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Spesa' AND column_name='fonte')
         OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Spesa' AND column_name='input_method')) THEN
      EXECUTE 'UPDATE "Spesa"
        SET "cost_category" = ''UNKNOWN'',
            "allocation_scope" = ''REVIEW''
        WHERE ("fonte" = ''IMPORT_GENYA'' OR "input_method" = ''import_genya'')
          AND "logistica_status" IN (''PENDING_OCR'', ''OCR_REVIEW'', ''RECONCILIATION_REQUIRED'')';

      EXECUTE 'UPDATE "Spesa"
        SET "cost_category" = ''INVENTORY_MATERIAL'',
            "allocation_scope" = ''PROJECT''
        WHERE ("fonte" = ''IMPORT_GENYA'' OR "input_method" = ''import_genya'')
          AND "logistica_status" = ''LOADED_TO_WAREHOUSE''';
    END IF;

    EXECUTE 'UPDATE "Spesa"
      SET "allocation_scope" = ''OVERHEAD''
      WHERE "cantiere_id" IS NULL';

    IF to_regclass('"Fornitore"') IS NOT NULL THEN
      EXECUTE 'ALTER TABLE "Spesa"
        ADD CONSTRAINT IF NOT EXISTS "Spesa_fornitore_id_fkey"
        FOREIGN KEY ("fornitore_id") REFERENCES "Fornitore"("id")
        ON DELETE SET NULL ON UPDATE CASCADE';
    END IF;

    EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_fornitore_id_idx" ON "Spesa"("fornitore_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_cost_category_idx" ON "Spesa"("cost_category")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_allocation_scope_idx" ON "Spesa"("allocation_scope")';
  END IF;
END $$;
