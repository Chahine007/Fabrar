import { formatDateOnly } from "../db/index.js";
import { ValidationStatus } from "../constants.js";

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Status helpers ───────────────────────────────────────────────────────────
// Ora che esiste una sola colonna (stato_validazione, uppercase), non serve più
// la normalizzazione tra le due colonne. Queste funzioni sono semplici guard.

/**
 * Normalizza un valore di status grezzo in uppercase canonical.
 * Usato per input da API (query-string, body) che potrebbero arrivare in lowercase.
 */
export function normalizeStatus(value, fallback = ValidationStatus.PENDING) {
    const upper = String(value ?? '').trim().toUpperCase();
    return Object.values(ValidationStatus).includes(upper) ? upper : fallback;
}

export function isRejectedStatus(value) {
    return String(value ?? '').toUpperCase() === ValidationStatus.REJECTED;
}

export function isVerifiedStatus(value) {
    return String(value ?? '').toUpperCase() === ValidationStatus.VERIFIED;
}

export function isPendingStatus(value) {
    const upper = String(value ?? '').toUpperCase();
    // Tratta stringa vuota e null come PENDING (stato di default)
    return upper === ValidationStatus.PENDING || upper === '';
}

/**
 * Restituisce lo stato canonico di una ReportEntry.
 * Unica colonna: stato_validazione.
 */
export function resolveEntryStatus(entry) {
    return normalizeStatus(entry?.stato_validazione);
}

/**
 * Restituisce lo stato canonico di una Spesa.
 * Unica colonna: stato_validazione.
 */
export function resolveSpesaStatus(spesa) {
    return normalizeStatus(spesa?.stato_validazione);
}

export function isPendingEntry(entry) {
    return isPendingStatus(resolveEntryStatus(entry));
}

export function isPendingSpesa(spesa) {
    return isPendingStatus(resolveSpesaStatus(spesa));
}

// ─── Number / text utilities ──────────────────────────────────────────────────

export function toNumber(value) {
    if (value == null || value === '') return 0;
    return Number(value);
}

export function toNullableNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function round2(value) {
    return Number(Number(value || 0).toFixed(2));
}

export function parseIdParam(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeOptionalText(value) {
    if (value == null) return null;
    const text = String(value).trim();
    return text === '' ? null : text;
}

export function isBlankText(value) {
    return normalizeOptionalText(value) == null;
}

export function formatEmployeeName(employee, employeeId) {
    const fullName = [employee?.nome, employee?.cognome].filter(Boolean).join(' ').trim();
    return fullName || `Dipendente ${employeeId}`;
}

export function getMonthKey(value) {
    const dateOnly = formatDateOnly(value);
    return dateOnly ? dateOnly.slice(0, 7) : null;
}

export function isManualInput(...values) {
    return !values.some((value) => ['timer', 'gps', 'app'].includes(String(value ?? '').toLowerCase()));
}

export function getEntryHourlyCost(entry) {
    return toNumber(entry?.report?.employee?.tariffe?.[0]?.costo_orario);
}

export function getEntryCost(entry) {
    return round2(toNumber(entry?.ore_lavorate) * getEntryHourlyCost(entry));
}