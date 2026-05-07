/**
 * domainBus — bus di eventi di dominio basato su Node.js EventEmitter.
 *
 * Disaccoppia i moduli: il mittente dell'evento non conosce i consumatori.
 * Percorso di migrazione futuro: sostituire EventEmitter con Redis Pub/Sub
 * o BullMQ senza modificare il codice del dominio — solo il transport layer.
 *
 * REGOLA: emettere eventi SOLO dopo il commit della transazione.
 * Mai emettere dall'interno di un prisma.$transaction().
 */
import { EventEmitter } from 'events';

export const domainBus = new EventEmitter();
domainBus.setMaxListeners(20);

export const EVENTS = Object.freeze({
    REPORT_ENTRY_VERIFIED:   'report_entry.approved',
    REPORT_ENTRY_APPROVED:   'report_entry.approved',
    WAREHOUSE_DISCHARGED:    'stock.issued',
    STOCK_ISSUED:            'stock.issued',
    STOCK_LOADED:            'stock.loaded',
    SPESA_CREATED:           'spesa.created',
    CANTIERE_BUDGET_CHANGED: 'cantiere.budget_changed',
    SPESA_VERIFIED:          'expense.approved',
    EXPENSE_APPROVED:        'expense.approved',
    INVOICE_PAID:            'invoice.paid',
    PAYMENT_DUE_PAID:        'payment_due.paid',
    PURCHASE_INVOICE_CONFIRMED: 'purchase_invoice.confirmed',
    MATERIAL_REQUEST_STATUS_CHANGED: 'material_request.status_changed',
    MATERIAL_REQUEST_FULFILLED: 'material_request.fulfilled',
    DOCUMENT_LINKED:         'document.linked',
    TASK_UPDATED:            'task.updated',
    MESSAGE_SENT:            'message.sent',
});
