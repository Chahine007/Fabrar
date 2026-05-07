-- Remediation operativa: incassi, prenotazioni stock e audit trail.

ALTER TABLE "Fattura"
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "paid_amount" DECIMAL(10,2),
  ADD COLUMN "payment_note" TEXT;

CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

CREATE TABLE "StockReservation" (
  "id" SERIAL NOT NULL,
  "richiesta_id" INTEGER NOT NULL,
  "riga_richiesta_id" INTEGER NOT NULL,
  "giacenza_id" INTEGER NOT NULL,
  "articolo_id" INTEGER NOT NULL,
  "quantita" DECIMAL(10,2) NOT NULL,
  "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),

  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" SERIAL NOT NULL,
  "actor_user_id" INTEGER,
  "actor_employee_id" INTEGER,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previous_state" JSONB,
  "next_state" JSONB,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockReservation_richiesta_id_status_idx" ON "StockReservation"("richiesta_id", "status");
CREATE INDEX "StockReservation_riga_richiesta_id_idx" ON "StockReservation"("riga_richiesta_id");
CREATE INDEX "StockReservation_giacenza_id_idx" ON "StockReservation"("giacenza_id");
CREATE INDEX "StockReservation_articolo_id_idx" ON "StockReservation"("articolo_id");

CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");
CREATE INDEX "AuditLog_actor_user_id_idx" ON "AuditLog"("actor_user_id");
CREATE INDEX "AuditLog_actor_employee_id_idx" ON "AuditLog"("actor_employee_id");
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_cantiere_id_fkey"
  FOREIGN KEY ("cantiere_id") REFERENCES "Cantiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_richiesta_id_fkey"
  FOREIGN KEY ("richiesta_id") REFERENCES "RichiestaMateriale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_riga_richiesta_id_fkey"
  FOREIGN KEY ("riga_richiesta_id") REFERENCES "RigaRichiestaMateriale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_giacenza_id_fkey"
  FOREIGN KEY ("giacenza_id") REFERENCES "Giacenza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_articolo_id_fkey"
  FOREIGN KEY ("articolo_id") REFERENCES "Articolo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
