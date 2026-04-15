-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT,
    "chat_id" BIGINT,
    "nome" TEXT,
    "cognome" TEXT,
    "attivo" INTEGER NOT NULL DEFAULT 1,
    "stato_registrazione" TEXT DEFAULT 'in_attesa_nome',
    "gdpr_accettato" INTEGER NOT NULL DEFAULT 0,
    "pending_json" TEXT,
    "pending_text" TEXT,
    "pending_date" TEXT,
    "pending_report_date" TEXT,
    "ruolo" TEXT,
    "telefono" TEXT,
    "skills" TEXT,
    "note_admin" TEXT,
    "documenti" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cantiere" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "indirizzo" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "budget" DECIMAL(10,2),
    "attivo" INTEGER NOT NULL DEFAULT 1,
    "raggio_tolleranza" INTEGER NOT NULL DEFAULT 200,

    CONSTRAINT "Cantiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsNode" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER,
    "cantiere_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "budget_preventivato" DECIMAL(10,2) DEFAULT 0,
    "is_variant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WbsNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "data_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_date" DATE NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "cantiere_id" INTEGER,
    "ore_lavorate" DOUBLE PRECISION,
    "ingresso" TEXT,
    "pausa_inizio" TEXT,
    "pausa_fine" TEXT,
    "uscita" TEXT,
    "attivita_svolte" TEXT,
    "luogo_cantiere" TEXT,
    "problemi_riscontrati" TEXT,
    "testo_originale" TEXT,
    "stato_validazione" TEXT NOT NULL DEFAULT 'PENDING',
    "fonte" TEXT,
    "status" TEXT DEFAULT 'verified',
    "input_method" TEXT DEFAULT 'timer',
    "admin_note" TEXT,
    "modified_by_admin_at" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportEntry" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "cantiere_id" INTEGER,
    "wbs_node_id" INTEGER,
    "ore_lavorate" DOUBLE PRECISION,
    "ingresso" TEXT,
    "pausa_inizio" TEXT,
    "pausa_fine" TEXT,
    "uscita" TEXT,
    "attivita_svolte" TEXT,
    "luogo_cantiere" TEXT,
    "problemi_riscontrati" TEXT,
    "testo_originale" TEXT,
    "stato_validazione" TEXT NOT NULL DEFAULT 'PENDING',
    "fonte" TEXT,
    "admin_note" TEXT,
    "modified_by_admin_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spesa" (
    "id" SERIAL NOT NULL,
    "timestamp_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employee_id" INTEGER NOT NULL,
    "cantiere_id" INTEGER NOT NULL,
    "wbs_node_id" INTEGER,
    "importo" DECIMAL(10,2) NOT NULL,
    "fornitore" TEXT,
    "descrizione" TEXT,
    "pricebook_id" INTEGER,
    "quantita" DECIMAL(10,2),
    "stato_validazione" TEXT NOT NULL DEFAULT 'PENDING',
    "fonte" TEXT DEFAULT 'TELEGRAM',
    "status" TEXT DEFAULT 'verified',
    "input_method" TEXT DEFAULT 'telegram_ocr',
    "fattura_rif" TEXT,
    "admin_note" TEXT,
    "modified_by_admin_at" TIMESTAMP(3),

    CONSTRAINT "Spesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariffa" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER,
    "costo_orario" DECIMAL(10,2) NOT NULL,
    "valido_dal" DATE NOT NULL,

    CONSTRAINT "Tariffa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricebook" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "unita" TEXT,
    "costo_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Pricebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" SERIAL NOT NULL,
    "timestamp_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employee_id" INTEGER NOT NULL,
    "message_type" TEXT,
    "raw_text" TEXT,
    "extracted_json" TEXT,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_telegram_id_key" ON "Employee"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_employee_id_idx" ON "User"("employee_id");

-- CreateIndex
CREATE INDEX "User_role_is_active_idx" ON "User"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Report_employee_id_report_date_key" ON "Report"("employee_id", "report_date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_cantiere_id_fkey" FOREIGN KEY ("cantiere_id") REFERENCES "Cantiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_cantiere_id_fkey" FOREIGN KEY ("cantiere_id") REFERENCES "Cantiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEntry" ADD CONSTRAINT "ReportEntry_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEntry" ADD CONSTRAINT "ReportEntry_cantiere_id_fkey" FOREIGN KEY ("cantiere_id") REFERENCES "Cantiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEntry" ADD CONSTRAINT "ReportEntry_wbs_node_id_fkey" FOREIGN KEY ("wbs_node_id") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spesa" ADD CONSTRAINT "Spesa_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spesa" ADD CONSTRAINT "Spesa_cantiere_id_fkey" FOREIGN KEY ("cantiere_id") REFERENCES "Cantiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spesa" ADD CONSTRAINT "Spesa_pricebook_id_fkey" FOREIGN KEY ("pricebook_id") REFERENCES "Pricebook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spesa" ADD CONSTRAINT "Spesa_wbs_node_id_fkey" FOREIGN KEY ("wbs_node_id") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariffa" ADD CONSTRAINT "Tariffa_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
