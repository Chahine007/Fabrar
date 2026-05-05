-- Additive remediation indexes.
-- Roll out manually on PostgreSQL outside a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReportEntry_task_id_idx" ON "ReportEntry"("task_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Spesa_task_id_idx" ON "Spesa"("task_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Spesa_pricebook_id_idx" ON "Spesa"("pricebook_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Spesa_documento_id_idx" ON "Spesa"("documento_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_cantiere_id_idx" ON "Task"("cantiere_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_assignee_id_idx" ON "Task"("assignee_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_cantiere_id_status_priority_idx" ON "Task"("cantiere_id", "status", "priority");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_cantiere_id_idx" ON "Document"("cantiere_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_tag_idx" ON "Document"("tag");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Fattura_documento_id_idx" ON "Fattura"("documento_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Rata_fattura_id_idx" ON "Rata"("fattura_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Conversation_cantiere_id_idx" ON "Conversation"("cantiere_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_conversation_id_created_at_idx" ON "Message"("conversation_id", "created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_sender_id_idx" ON "Message"("sender_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ConversationParticipant_employee_id_idx" ON "ConversationParticipant"("employee_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Articolo_fornitore_default_id_idx" ON "Articolo"("fornitore_default_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_wbs_node_id_idx" ON "MovimentoMagazzino"("wbs_node_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_task_id_idx" ON "MovimentoMagazzino"("task_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_ubicazione_da_id_idx" ON "MovimentoMagazzino"("ubicazione_da_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_ubicazione_a_id_idx" ON "MovimentoMagazzino"("ubicazione_a_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_esecutore_id_idx" ON "MovimentoMagazzino"("esecutore_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_documento_id_idx" ON "MovimentoMagazzino"("documento_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_fornitore_id_idx" ON "MovimentoMagazzino"("fornitore_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MovimentoMagazzino_articolo_id_data_movimento_idx" ON "MovimentoMagazzino"("articolo_id", "data_movimento");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "RichiestaMateriale_richiedente_id_idx" ON "RichiestaMateriale"("richiedente_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RichiestaMateriale_status_data_richiesta_idx" ON "RichiestaMateriale"("status", "data_richiesta");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "RigaRichiestaMateriale_richiesta_id_idx" ON "RigaRichiestaMateriale"("richiesta_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RigaRichiestaMateriale_articolo_id_idx" ON "RigaRichiestaMateriale"("articolo_id");
