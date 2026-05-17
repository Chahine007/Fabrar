-- Sprint: OCR strutturato fatture acquisto
-- Espande fornitori e persiste fatture fornitori + righe estratte da OCR.

DO $$
BEGIN
  IF to_regclass('"Fornitore"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "Fornitore"
      ADD COLUMN IF NOT EXISTS "partita_iva_normalizzata" TEXT,
      ADD COLUMN IF NOT EXISTS "codice_fiscale" TEXT,
      ADD COLUMN IF NOT EXISTS "comune" TEXT,
      ADD COLUMN IF NOT EXISTS "provincia" TEXT,
      ADD COLUMN IF NOT EXISTS "cap" TEXT,
      ADD COLUMN IF NOT EXISTS "paese" TEXT DEFAULT ''IT'',
      ADD COLUMN IF NOT EXISTS "iban_default" TEXT';
  END IF;
END $$;

CREATE TABLE "FatturaAcquisto" (
  "id" SERIAL NOT NULL,
  "document_id" INTEGER,
  "spesa_id" INTEGER,
  "fornitore_id" INTEGER,
  "cantiere_id" INTEGER,
  "document_type" TEXT,
  "tipo_documento" TEXT,
  "numero_documento" TEXT,
  "data_documento" DATE,
  "codice_destinatario" TEXT,
  "cliente_partita_iva" TEXT,
  "cliente_ragione_sociale" TEXT,
  "cliente_codice_fiscale" TEXT,
  "cliente_indirizzo" TEXT,
  "cliente_comune" TEXT,
  "cliente_provincia" TEXT,
  "cliente_cap" TEXT,
  "totale_imponibile" DECIMAL(10,2),
  "totale_imposta" DECIMAL(10,2),
  "totale_documento" DECIMAL(10,2),
  "pagamento_modalita" TEXT,
  "pagamento_iban" TEXT,
  "pagamento_scadenza" DATE,
  "pagamento_importo" DECIMAL(10,2),
  "cost_category" "CostCategory" NOT NULL DEFAULT 'UNKNOWN',
  "allocation_scope" "CostAllocationScope" NOT NULL DEFAULT 'REVIEW',
  "logistica_required" BOOLEAN NOT NULL DEFAULT false,
  "ocr_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FatturaAcquisto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RigaFatturaAcquisto" (
  "id" SERIAL NOT NULL,
  "fattura_acquisto_id" INTEGER NOT NULL,
  "articolo_id" INTEGER,
  "movimento_id" INTEGER,
  "codice_articolo_originale" TEXT,
  "codice_sku_normalizzato" TEXT,
  "descrizione" TEXT,
  "quantita" DECIMAL(10,2),
  "unita_misura" TEXT,
  "prezzo_unitario" DECIMAL(10,2),
  "iva_percentuale" DECIMAL(5,2),
  "prezzo_totale" DECIMAL(10,2),
  "cost_category" "CostCategory" NOT NULL DEFAULT 'UNKNOWN',
  "allocation_scope" "CostAllocationScope" NOT NULL DEFAULT 'REVIEW',
  "is_stockable" BOOLEAN NOT NULL DEFAULT false,
  "reconciliation_status" TEXT NOT NULL DEFAULT 'OK',
  "raw_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RigaFatturaAcquisto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FatturaAcquisto_document_id_key" ON "FatturaAcquisto"("document_id");
CREATE UNIQUE INDEX "FatturaAcquisto_spesa_id_key" ON "FatturaAcquisto"("spesa_id");
CREATE INDEX "FatturaAcquisto_fornitore_id_numero_documento_data_documento_idx"
  ON "FatturaAcquisto"("fornitore_id", "numero_documento", "data_documento");
CREATE INDEX "FatturaAcquisto_spesa_id_idx" ON "FatturaAcquisto"("spesa_id");
CREATE INDEX "FatturaAcquisto_cantiere_id_idx" ON "FatturaAcquisto"("cantiere_id");
CREATE INDEX "FatturaAcquisto_cost_category_idx" ON "FatturaAcquisto"("cost_category");
CREATE INDEX "FatturaAcquisto_allocation_scope_idx" ON "FatturaAcquisto"("allocation_scope");

CREATE UNIQUE INDEX "RigaFatturaAcquisto_movimento_id_key" ON "RigaFatturaAcquisto"("movimento_id");
CREATE INDEX "RigaFatturaAcquisto_fattura_acquisto_id_idx" ON "RigaFatturaAcquisto"("fattura_acquisto_id");
CREATE INDEX "RigaFatturaAcquisto_articolo_id_idx" ON "RigaFatturaAcquisto"("articolo_id");
CREATE INDEX "RigaFatturaAcquisto_codice_sku_normalizzato_idx" ON "RigaFatturaAcquisto"("codice_sku_normalizzato");
CREATE INDEX "RigaFatturaAcquisto_cost_category_idx" ON "RigaFatturaAcquisto"("cost_category");

DO $$
BEGIN
  IF to_regclass('"Fornitore"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Fornitore_partita_iva_normalizzata_idx" ON "Fornitore"("partita_iva_normalizzata")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Fornitore_ragione_sociale_idx" ON "Fornitore"("ragione_sociale")';
  END IF;

  IF to_regclass('"FatturaAcquisto"') IS NOT NULL THEN
    IF to_regclass('"Document"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FatturaAcquisto_document_id_fkey') THEN
        EXECUTE 'ALTER TABLE "FatturaAcquisto"
          ADD CONSTRAINT "FatturaAcquisto_document_id_fkey"
          FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE';
      END IF;
    END IF;
    IF to_regclass('"Spesa"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FatturaAcquisto_spesa_id_fkey') THEN
        EXECUTE 'ALTER TABLE "FatturaAcquisto"
          ADD CONSTRAINT "FatturaAcquisto_spesa_id_fkey"
          FOREIGN KEY ("spesa_id") REFERENCES "Spesa"("id") ON DELETE SET NULL ON UPDATE CASCADE';
      END IF;
    END IF;
    IF to_regclass('"Fornitore"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FatturaAcquisto_fornitore_id_fkey') THEN
        EXECUTE 'ALTER TABLE "FatturaAcquisto"
          ADD CONSTRAINT "FatturaAcquisto_fornitore_id_fkey"
          FOREIGN KEY ("fornitore_id") REFERENCES "Fornitore"("id") ON DELETE SET NULL ON UPDATE CASCADE';
      END IF;
    END IF;
    IF to_regclass('"Cantiere"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FatturaAcquisto_cantiere_id_fkey') THEN
        EXECUTE 'ALTER TABLE "FatturaAcquisto"
          ADD CONSTRAINT "FatturaAcquisto_cantiere_id_fkey"
          FOREIGN KEY ("cantiere_id") REFERENCES "Cantiere"("id") ON DELETE SET NULL ON UPDATE CASCADE';
      END IF;
    END IF;
  END IF;

  IF to_regclass('"RigaFatturaAcquisto"') IS NOT NULL THEN
    IF to_regclass('"FatturaAcquisto"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RigaFatturaAcquisto_fattura_acquisto_id_fkey') THEN
        EXECUTE 'ALTER TABLE "RigaFatturaAcquisto"
          ADD CONSTRAINT "RigaFatturaAcquisto_fattura_acquisto_id_fkey"
          FOREIGN KEY ("fattura_acquisto_id") REFERENCES "FatturaAcquisto"("id") ON DELETE CASCADE ON UPDATE CASCADE';
      END IF;
    END IF;
    IF to_regclass('"Articolo"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RigaFatturaAcquisto_articolo_id_fkey') THEN
        EXECUTE 'ALTER TABLE "RigaFatturaAcquisto"
          ADD CONSTRAINT "RigaFatturaAcquisto_articolo_id_fkey"
          FOREIGN KEY ("articolo_id") REFERENCES "Articolo"("id") ON DELETE SET NULL ON UPDATE CASCADE';
      END IF;
    END IF;
    IF to_regclass('"MovimentoMagazzino"') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RigaFatturaAcquisto_movimento_id_fkey') THEN
        EXECUTE 'ALTER TABLE "RigaFatturaAcquisto"
          ADD CONSTRAINT "RigaFatturaAcquisto_movimento_id_fkey"
          FOREIGN KEY ("movimento_id") REFERENCES "MovimentoMagazzino"("id") ON DELETE SET NULL ON UPDATE CASCADE';
      END IF;
    END IF;
  END IF;
END $$;
