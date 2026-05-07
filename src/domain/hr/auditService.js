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
import { writeAuditLog } from '../audit/auditLogService.js';
import { enqueueOutboxEvent } from '../events/outboxService.js';
import { postReportEntryApprovedLedger, postSpesaApprovedLedger } from '../finance/ledgerService.js';

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
export async function bulkUpdateItems(prisma, body, user = null) {
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
                    select: {
                        id: true,
                        report_id: true,
                        cantiere_id: true,
                        wbs_node_id: true,
                        task_id: true,
                        ore_lavorate: true,
                        stato_validazione: true,
                        report: { select: { employee_id: true, report_date: true } },
                    },
                });
                if (!entry) throw new DomainError(`Riga ore non trovata: ${id}`, 'NOT_FOUND');

                if (newSt === ValidationStatus.APPROVED) {
                    await enforceTariffaGuard(tx, entry.report?.employee_id);
                }

                await tx.reportEntry.update({
                    where: { id },
                    data: { stato_validazione: newSt, modified_by_admin_at: iso },
                });

                await writeAuditLog(tx, user, {
                    entityType: 'ReportEntry',
                    entityId: id,
                    action: 'REPORT_ENTRY_STATUS_CHANGED',
                    previousState: { stato_validazione: entry.stato_validazione },
                    nextState: { stato_validazione: newSt },
                });

                if (newSt === ValidationStatus.APPROVED) {
                    await postReportEntryApprovedLedger(tx, {
                        ...entry,
                        stato_validazione: newSt,
                    });
                    await enqueueOutboxEvent(tx, {
                        eventType: EVENTS.REPORT_ENTRY_APPROVED,
                        aggregateType: 'ReportEntry',
                        aggregateId: id,
                        payload: {
                            entryId: id,
                            cantiereId: entry.cantiere_id ?? null,
                            taskId: entry.task_id ?? null,
                            employeeId: entry.report?.employee_id ?? null,
                        },
                    });
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
                const spesa = typeof tx.spesa.findUnique === 'function'
                    ? await tx.spesa.findUnique({
                        where: { id },
                        select: {
                            id: true,
                            timestamp_utc: true,
                            employee_id: true,
                            cantiere_id: true,
                            wbs_node_id: true,
                            task_id: true,
                            importo: true,
                            fornitore_id: true,
                            descrizione: true,
                            fonte: true,
                            input_method: true,
                            documento_id: true,
                            logistica_status: true,
                            cost_category: true,
                            allocation_scope: true,
                            stato_validazione: true,
                        },
                    })
                    : null;
                if (typeof tx.spesa.findUnique === 'function' && !spesa) {
                    throw new DomainError(`Spesa non trovata: ${id}`, 'NOT_FOUND');
                }

                await tx.spesa.update({
                    where: { id },
                    data: { stato_validazione: newSt, modified_by_admin_at: iso },
                });

                await writeAuditLog(tx, user, {
                    entityType: 'Spesa',
                    entityId: id,
                    action: 'SPESA_STATUS_CHANGED',
                    previousState: { stato_validazione: spesa?.stato_validazione ?? null },
                    nextState: { stato_validazione: newSt },
                });

                if (newSt === ValidationStatus.APPROVED) {
                    if (spesa) {
                        await postSpesaApprovedLedger(tx, {
                            ...spesa,
                            stato_validazione: newSt,
                        });
                        await enqueueOutboxEvent(tx, {
                            eventType: EVENTS.EXPENSE_APPROVED,
                            aggregateType: 'Spesa',
                            aggregateId: id,
                            payload: {
                                spesaId: id,
                                cantiereId: spesa.cantiere_id ?? null,
                                taskId: spesa.task_id ?? null,
                                allocationScope: spesa.allocation_scope ?? null,
                                costCategory: spesa.cost_category ?? null,
                            },
                        });
                    }
                    events.push({
                        type: EVENTS.SPESA_VERIFIED,
                        payload: {
                            spesaId: id,
                            cantiereId: spesa?.cantiere_id ?? null,
                        },
                    });
                }
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
