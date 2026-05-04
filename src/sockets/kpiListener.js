/**
 * kpiListener — bridge tra il DomainEventBus e Socket.io.
 *
 * Ascolta gli eventi di dominio e propaga aggiornamenti real-time
 * ai client del dashboard. Il modulo magazzino e HR non sanno nulla
 * di Socket.io — emettono solo eventi di dominio.
 */
import { domainBus, EVENTS } from '../domain/events/domainBus.js';
import logger from '../logger.js';

const log = logger.child({ module: 'kpiListener' });

export function registerKpiListeners(io) {
    domainBus.on(EVENTS.WAREHOUSE_DISCHARGED, ({ cantiereId }) => {
        log.info({ cantiereId, event: 'warehouse.discharged' }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'warehouse_discharged' });
    });

    domainBus.on(EVENTS.REPORT_ENTRY_VERIFIED, ({ entryId, cantiereId }) => {
        log.info({ entryId, cantiereId, event: 'report_entry.verified' }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'report_verified' });
    });

    domainBus.on(EVENTS.CANTIERE_BUDGET_CHANGED, ({ cantiereId }) => {
        io.emit('kpi:refresh', { cantiereId, reason: 'budget_changed' });
    });
}
