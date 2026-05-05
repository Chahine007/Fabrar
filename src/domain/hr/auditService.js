/**
 * auditService — regole di business per la validazione di ore e spese.
 *
 * Estratto da hr.controller.js (bulkUpdateAudit).
 * I controller diventano thin HTTP adapter; tutta la logica vive qui.
 */
import { ValidationStatus, AUDIT_TYPE } from '../../constants.js';
import { normalizeStatus } from '../../utils/helpers.js';
import { DomainError } from '../shared/DomainError.js';
import { domainBus, EVENTS } from '../events/domainBus.js';

// ─── Regola di business: Policy 4.2 ─────────────────────────────────────────

/**
 * Verifica che il dipendente abbia almeno una tariffa oraria registrata.
 * Obbligatoria per approvare una ReportEntry.
 */
async function enforceTariffaGuard(tx, employeeId) {
    const count = await tx.tariffa.count({ where: { employee_id: employeeId } });
    if (count === 0) {
        throw new DomainError(
            'Impossibile approvare: il dipendente non ha una tariffa oraria valida nel sistema (Policy 4.2).',
            'MISSING_TARIFFA'
        );
    }
}

// ─── Resoluzione item da ids+action ──────────────────────────────────────────

async function resolveItemsFromIds(tx, ids, action) {
    if (!ids?.length || !action) {
        throw new DomainError('Formato non valido: ids e action sono obbligatori.', 'INVALID_INPUT');
    }

    const [reportEntries, spese] = await Promise.all([
        tx.reportEntry.findMany({ where: { id: { in: ids } }, select: { id: true } }),
        tx.spesa.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    ]);

    const reportEntryIds = new Set(reportEntries.map((r) => r.id));
    const spesaIds = new Set(spese.map((s) => s.id));
    const defaultStatus =
        action === 'verify' ? ValidationStatus.APPROVED
        : action === 'reject' ? ValidationStatus.REJECTED
        : normalizeStatus(action);

    return ids.map((id) => {
        const inOre   = reportEntryIds.has(id);
        const inSpese = spesaIds.has(id);
        if (inOre && inSpese)  throw new DomainError(`ID ambiguo sia in ore che in spese: ${id}`, 'AMBIGUOUS_ID');
        if (!inOre && !inSpese) throw new DomainError(`Voce audit non trovata: ${id}`, 'NOT_FOUND');
        return { id, type: inOre ? AUDIT_TYPE.ORE : AUDIT_TYPE.SPESE, newStatus: defaultStatus };
    });
}

// ─── Pubblico ─────────────────────────────────────────────────────────────────

/**
 * Aggiorna in bulk lo stato di validazione di ore e/o spese.
 * Accetta sia il formato { items: [...] } che { ids: [...], action: '...' }.
 * Restituisce il numero di record aggiornati.
 */
export async function bulkUpdateItems(prisma, body) {
    const iso = new Date().toISOString();
    const events = [];

    const count = await prisma.$transaction(async (tx) => {
        let items = body?.items;

        if (!items) {
            items = await resolveItemsFromIds(tx, body?.ids ?? [], body?.action);
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new DomainError('Formato non valido: nessun elemento da aggiornare.', 'INVALID_INPUT');
        }

        for (const rawItem of items) {
            const { id } = rawItem;
            const newSt = normalizeStatus(rawItem.newStatus);

            if (rawItem.type === AUDIT_TYPE.ORE) {
                const entry = await tx.reportEntry.findUnique({
                    where: { id },
                    select: { report_id: true, cantiere_id: true, report: { select: { employee_id: true } } },
                });
                if (!entry) throw new DomainError(`Riga ore non trovata: ${id}`, 'NOT_FOUND');

                if (newSt === ValidationStatus.APPROVED) {
                    await enforceTariffaGuard(tx, entry.report?.employee_id);
                }

                await tx.reportEntry.update({
                    where: { id },
                    data: { stato_validazione: newSt, modified_by_admin_at: iso },
                });

                if (newSt === ValidationStatus.APPROVED) {
                    events.push({
                        type: EVENTS.REPORT_ENTRY_VERIFIED,
                        payload: {
                            entryId:    id,
                            cantiereId: entry.cantiere_id ?? null,
                        },
                    });
                }

                continue;
            }

            if (rawItem.type === AUDIT_TYPE.SPESE) {
                await tx.spesa.update({
                    where: { id },
                    data: { stato_validazione: newSt, modified_by_admin_at: iso },
                });
                continue;
            }

            throw new DomainError(`Tipo audit non supportato: ${rawItem.type}`, 'INVALID_TYPE');
        }

        return items.length;
    });

    for (const event of events) {
        domainBus.emit(event.type, event.payload);
    }

    return count;
}
