/**
 * ValidationStatus — unica fonte di verità per lo stato di validazione.
 * Sostituisce il doppio standard STATUS (lowercase) / DB_STATUS (uppercase).
 * Tutti i record nel DB usano questi valori uppercase.
 */
export const ValidationStatus = Object.freeze({
    PENDING:  'PENDING',
    APPROVED: 'APPROVED',
    // Alias applicativo legacy: vecchio codice e vecchi payload parlano ancora di VERIFIED.
    VERIFIED: 'APPROVED',
    REJECTED: 'REJECTED',
});

export const AUDIT_TYPE = Object.freeze({
    ORE:       'ore',
    SPESE:     'spese',
    AMBIGUOUS: 'ambiguous',
});
