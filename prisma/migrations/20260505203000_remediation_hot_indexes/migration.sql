-- Additive remediation indexes.
-- Note: Prisma applies migrations inside a transaction (including shadow DB checks),
-- so we cannot use CREATE INDEX CONCURRENTLY here.
-- We also guard indexes for columns/tables that might not exist in older environments.

DO $$
BEGIN
  IF to_regclass('"ReportEntry"') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ReportEntry' AND column_name='task_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ReportEntry_task_id_idx" ON "ReportEntry"("task_id")';
  END IF;

  IF to_regclass('"Spesa"') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Spesa' AND column_name='task_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_task_id_idx" ON "Spesa"("task_id")';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Spesa' AND column_name='pricebook_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_pricebook_id_idx" ON "Spesa"("pricebook_id")';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Spesa' AND column_name='documento_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_documento_id_idx" ON "Spesa"("documento_id")';
    END IF;
  END IF;

  IF to_regclass('"Task"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Task_cantiere_id_idx" ON "Task"("cantiere_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Task_assignee_id_idx" ON "Task"("assignee_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Task_cantiere_id_status_priority_idx" ON "Task"("cantiere_id", "status", "priority")';
  END IF;

  IF to_regclass('"Document"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Document_cantiere_id_idx" ON "Document"("cantiere_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Document_tag_idx" ON "Document"("tag")';
  END IF;

  IF to_regclass('"Fattura"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Fattura_documento_id_idx" ON "Fattura"("documento_id")';
  END IF;
  IF to_regclass('"Rata"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Rata_fattura_id_idx" ON "Rata"("fattura_id")';
  END IF;

  IF to_regclass('"Conversation"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Conversation_cantiere_id_idx" ON "Conversation"("cantiere_id")';
  END IF;
  IF to_regclass('"Message"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Message_conversation_id_created_at_idx" ON "Message"("conversation_id", "created_at")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Message_sender_id_idx" ON "Message"("sender_id")';
  END IF;
  IF to_regclass('"ConversationParticipant"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ConversationParticipant_employee_id_idx" ON "ConversationParticipant"("employee_id")';
  END IF;

  IF to_regclass('"Articolo"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Articolo_fornitore_default_id_idx" ON "Articolo"("fornitore_default_id")';
  END IF;

  IF to_regclass('"MovimentoMagazzino"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_wbs_node_id_idx" ON "MovimentoMagazzino"("wbs_node_id")';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='MovimentoMagazzino' AND column_name='task_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_task_id_idx" ON "MovimentoMagazzino"("task_id")';
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_ubicazione_da_id_idx" ON "MovimentoMagazzino"("ubicazione_da_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_ubicazione_a_id_idx" ON "MovimentoMagazzino"("ubicazione_a_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_esecutore_id_idx" ON "MovimentoMagazzino"("esecutore_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_documento_id_idx" ON "MovimentoMagazzino"("documento_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_fornitore_id_idx" ON "MovimentoMagazzino"("fornitore_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_articolo_id_data_movimento_idx" ON "MovimentoMagazzino"("articolo_id", "data_movimento")';
  END IF;

  IF to_regclass('"RichiestaMateriale"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "RichiestaMateriale_richiedente_id_idx" ON "RichiestaMateriale"("richiedente_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "RichiestaMateriale_status_data_richiesta_idx" ON "RichiestaMateriale"("status", "data_richiesta")';
  END IF;

  IF to_regclass('"RigaRichiestaMateriale"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "RigaRichiestaMateriale_richiesta_id_idx" ON "RigaRichiestaMateriale"("richiesta_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "RigaRichiestaMateriale_articolo_id_idx" ON "RigaRichiestaMateriale"("articolo_id")';
  END IF;
END $$;
