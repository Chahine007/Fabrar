/**
 * botSessionService — sessioni Telegram durature su DB.
 *
 * Sostituisce la Map in-process di expenseHandler.js con record
 * nella tabella BotSession (aggiunta in Fase 1).
 * Resistente ai riavvii e compatibile con scaling orizzontale.
 */
import { getDb } from '../../db/index.js';

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minuti

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Crea una sessione pending_expense su DB.
 * @returns {string} sessionId (UUID)
 */
export async function createPendingExpense(employeeId, payload) {
    const prisma     = getDb();
    const expires_at = new Date(Date.now() + SESSION_TTL_MS);
    const session    = await prisma.botSession.create({
        data: {
            employee_id:  employeeId,
            type:         'pending_expense',
            payload_json: JSON.stringify(payload),
            expires_at,
        },
    });
    return session.id;
}

/**
 * Recupera una sessione pending_expense dal DB.
 * Restituisce null se non trovata o scaduta.
 * @returns {{ sessionId, employeeId, importo, fornitore, descrizione } | null}
 */
export async function getPendingExpense(sessionId) {
    const prisma   = getDb();
    const session  = await prisma.botSession.findUnique({ where: { id: sessionId } });
    if (!session || session.expires_at < new Date()) return null;
    return { sessionId: session.id, employeeId: session.employee_id, ...JSON.parse(session.payload_json) };
}

/**
 * Elimina una sessione dopo la conferma (o timeout esplicito).
 */
export async function deletePendingExpense(sessionId) {
    const prisma = getDb();
    await prisma.botSession.delete({ where: { id: sessionId } }).catch(() => {});
}

/**
 * Elimina tutte le sessioni scadute.
 * Da chiamare da un cron job (es. scheduleDraftsCleanup).
 */
export async function cleanExpiredSessions() {
    const prisma = getDb();
    const result = await prisma.botSession.deleteMany({
        where: { expires_at: { lt: new Date() } },
    });
    return result.count;
}
