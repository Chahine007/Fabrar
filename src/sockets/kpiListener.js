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
        log.info({ cantiereId, event: EVENTS.WAREHOUSE_DISCHARGED }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'warehouse_discharged' });
    });

    domainBus.on(EVENTS.REPORT_ENTRY_VERIFIED, ({ entryId, cantiereId }) => {
        log.info({ entryId, cantiereId, event: EVENTS.REPORT_ENTRY_VERIFIED }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'report_verified' });
    });

    domainBus.on(EVENTS.SPESA_VERIFIED, ({ spesaId, cantiereId }) => {
        log.info({ spesaId, cantiereId, event: EVENTS.SPESA_VERIFIED }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'spesa_verified' });
    });

    domainBus.on(EVENTS.INVOICE_PAID, ({ invoiceId, cantiereId, status }) => {
        log.info({ invoiceId, cantiereId, status, event: 'invoice.paid' }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'invoice_paid' });
    });

    domainBus.on(EVENTS.MATERIAL_REQUEST_STATUS_CHANGED, ({ requestId, cantiereId, status }) => {
        log.info({ requestId, cantiereId, status, event: 'material_request.status_changed' }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'material_request_status_changed' });
    });

    domainBus.on(EVENTS.DOCUMENT_LINKED, ({ documentId, cantiereId }) => {
        log.info({ documentId, cantiereId, event: 'document.linked' }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'document_linked' });
    });

    domainBus.on(EVENTS.STOCK_LOADED, ({ movimentoId, documentId }) => {
        log.info({ movimentoId, documentId, event: EVENTS.STOCK_LOADED }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { reason: 'stock_loaded' });
    });

    domainBus.on(EVENTS.PAYMENT_DUE_PAID, ({ paymentDueId, fatturaAcquistoId }) => {
        log.info({ paymentDueId, fatturaAcquistoId, event: EVENTS.PAYMENT_DUE_PAID }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { reason: 'payment_due_paid' });
    });

    domainBus.on(EVENTS.PURCHASE_INVOICE_CONFIRMED, ({ fatturaAcquistoId, cantiereId }) => {
        log.info({ fatturaAcquistoId, cantiereId, event: EVENTS.PURCHASE_INVOICE_CONFIRMED }, 'kpi:refresh emitted');
        io.emit('kpi:refresh', { cantiereId, reason: 'purchase_invoice_confirmed' });
    });

    domainBus.on(EVENTS.CANTIERE_BUDGET_CHANGED, ({ cantiereId }) => {
        io.emit('kpi:refresh', { cantiereId, reason: 'budget_changed' });
    });
}
