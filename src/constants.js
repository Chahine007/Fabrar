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

export const LIMITS = Object.freeze({
    MAX_DAILY_HOURS_ALERT: Number(process.env.MAX_DAILY_HOURS_ALERT || 12),
    AUDIT_LOG_LIMIT: Number(process.env.AUDIT_LOG_LIMIT || 200),
    DEAD_STOCK_DAYS: Number(process.env.DEAD_STOCK_DAYS || 60),
});

export const DEFAULTS = Object.freeze({
    WBS_ROOT_NAME: process.env.WBS_ROOT_NAME || "Fase Radice",
    DEFAULT_EMPLOYEE_ROLE: process.env.DEFAULT_EMPLOYEE_ROLE || "Operaio",
});

export const SECURITY = Object.freeze({
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "12h",
});
