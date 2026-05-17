-- Sprint 2 performance indexes.
-- Note: Prisma applies migrations inside a transaction (including shadow DB checks),
-- so we cannot use CREATE INDEX CONCURRENTLY here.
-- We also guard indexes for tables that may not exist yet in earlier environments.

DO $$
BEGIN
  IF to_regclass('"WbsNode"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "WbsNode_cantiere_id_idx" ON "WbsNode"("cantiere_id")';
  END IF;

  IF to_regclass('"Report"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Report_employee_id_idx" ON "Report"("employee_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Report_cantiere_id_idx" ON "Report"("cantiere_id")';
  END IF;

  IF to_regclass('"ReportEntry"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ReportEntry_report_id_idx" ON "ReportEntry"("report_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ReportEntry_cantiere_id_idx" ON "ReportEntry"("cantiere_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ReportEntry_wbs_node_id_idx" ON "ReportEntry"("wbs_node_id")';
  END IF;

  IF to_regclass('"Spesa"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_employee_id_idx" ON "Spesa"("employee_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_cantiere_id_idx" ON "Spesa"("cantiere_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Spesa_wbs_node_id_idx" ON "Spesa"("wbs_node_id")';
  END IF;

  IF to_regclass('"Tariffa"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Tariffa_employee_id_idx" ON "Tariffa"("employee_id")';
  END IF;

  IF to_regclass('"Giacenza"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Giacenza_articolo_id_idx" ON "Giacenza"("articolo_id")';
  END IF;

  IF to_regclass('"MovimentoMagazzino"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_articolo_id_idx" ON "MovimentoMagazzino"("articolo_id")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "MovimentoMagazzino_cantiere_id_idx" ON "MovimentoMagazzino"("cantiere_id")';
  END IF;
END $$;
