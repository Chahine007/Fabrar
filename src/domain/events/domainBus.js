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
    REPORT_ENTRY_VERIFIED:   'report_entry.verified',
    WAREHOUSE_DISCHARGED:    'warehouse.discharged',
    SPESA_CREATED:           'spesa.created',
    CANTIERE_BUDGET_CHANGED: 'cantiere.budget_changed',
});
