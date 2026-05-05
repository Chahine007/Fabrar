-- Sprint 2 performance indexes.
-- Roll out this script manually with prisma db execute or psql outside a transaction,
-- then reconcile Prisma migration history with the team's hotfix workflow.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WbsNode_cantiere_id_idx"
ON "WbsNode"("cantiere_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Report_employee_id_idx"
ON "Report"("employee_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Report_cantiere_id_idx"
ON "Report"("cantiere_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReportEntry_report_id_idx"
ON "ReportEntry"("report_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReportEntry_cantiere_id_idx"
ON "ReportEntry"("cantiere_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReportEntry_wbs_node_id_idx"
ON "ReportEntry"("wbs_node_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Spesa_employee_id_idx"
ON "Spesa"("employee_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Spesa_cantiere_id_idx"
ON "Spesa"("cantiere_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Spesa_wbs_node_id_idx"
ON "Spesa"("wbs_node_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tariffa_employee_id_idx"
ON "Tariffa"("employee_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Giacenza_articolo_id_idx"
ON "Giacenza"("articolo_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_articolo_id_idx"
ON "MovimentoMagazzino"("articolo_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_cantiere_id_idx"
ON "MovimentoMagazzino"("cantiere_id");
