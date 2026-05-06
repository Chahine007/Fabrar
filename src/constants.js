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

export const LogisticaStatus = Object.freeze({
    NOT_REQUIRED: 'NOT_REQUIRED',
    PENDING_OCR: 'PENDING_OCR',
    OCR_REVIEW: 'OCR_REVIEW',
    LOADED_TO_WAREHOUSE: 'LOADED_TO_WAREHOUSE',
    RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
});

export const CostCategory = Object.freeze({
    INVENTORY_MATERIAL: 'INVENTORY_MATERIAL',
    CONSUMABLE_SUPPLY: 'CONSUMABLE_SUPPLY',
    SERVICE: 'SERVICE',
    LEASING_RENTAL: 'LEASING_RENTAL',
    UTILITY: 'UTILITY',
    INSURANCE: 'INSURANCE',
    TAX_FEE: 'TAX_FEE',
    PROFESSIONAL_SERVICE: 'PROFESSIONAL_SERVICE',
    TRAVEL_VEHICLE: 'TRAVEL_VEHICLE',
    OTHER: 'OTHER',
    UNKNOWN: 'UNKNOWN',
});

export const CostAllocationScope = Object.freeze({
    PROJECT: 'PROJECT',
    OVERHEAD: 'OVERHEAD',
    REVIEW: 'REVIEW',
});

export const PaymentDueStatus = Object.freeze({
    OPEN: 'OPEN',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
});

export const PaymentDueSource = Object.freeze({
    OCR: 'OCR',
    GENYA: 'GENYA',
    MANUAL: 'MANUAL',
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
    JWT_ALGORITHM: process.env.JWT_ALGORITHM || "HS256",
    JWT_ISSUER: process.env.JWT_ISSUER || null,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || null,
    INVITE_CODE_TTL_MS: Number(process.env.INVITE_CODE_TTL_MS || 24 * 60 * 60 * 1000),
    TELEGRAM_PAIRING_TTL_MS: Number(process.env.TELEGRAM_PAIRING_TTL_MS || 30 * 60 * 1000),
});

export function getJwtSignOptions() {
    return {
        expiresIn: SECURITY.JWT_EXPIRES_IN,
        algorithm: SECURITY.JWT_ALGORITHM,
        ...(SECURITY.JWT_ISSUER ? { issuer: SECURITY.JWT_ISSUER } : {}),
        ...(SECURITY.JWT_AUDIENCE ? { audience: SECURITY.JWT_AUDIENCE } : {}),
    };
}

export function getJwtVerifyOptions() {
    return {
        algorithms: [SECURITY.JWT_ALGORITHM],
        ...(SECURITY.JWT_ISSUER ? { issuer: SECURITY.JWT_ISSUER } : {}),
        ...(SECURITY.JWT_AUDIENCE ? { audience: SECURITY.JWT_AUDIENCE } : {}),
    };
}
