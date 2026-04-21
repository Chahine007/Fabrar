import { formatDateOnly } from "../db/index.js";
import { STATUS, DB_STATUS } from "../constants.js";

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeStatus(value, fallback = "pending") {
    return String(value ?? fallback).trim().toLowerCase();
}

export function isRejectedStatus(value) {
    return normalizeStatus(value) === STATUS.REJECTED;
}

export function isVerifiedStatus(value) {
    return normalizeStatus(value) === STATUS.VERIFIED;
}

export function isPendingStatus(value, fallback = "pending") {
    return normalizeStatus(value, fallback) === STATUS.PENDING;
}

export function toNumber(value) {
    if (value == null || value === "") return 0;
    return Number(value);
}

export function toNullableNumber(value) {
    if (value == null || value === "") return null;
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
    return text === "" ? null : text;
}

export function isBlankText(value) {
    return normalizeOptionalText(value) == null;
}

export function formatEmployeeName(employee, employeeId) {
    const fullName = [employee?.nome, employee?.cognome].filter(Boolean).join(" ").trim();
    return fullName || `Dipendente ${employeeId}`;
}

export function getMonthKey(value) {
    const dateOnly = formatDateOnly(value);
    return dateOnly ? dateOnly.slice(0, 7) : null;
}

export function resolveEntryStatus(entry) {
    return normalizeStatus(entry?.stato_validazione, "pending");
}

export function resolveSpesaStatus(spesa) {
    return normalizeStatus(spesa?.stato_validazione ?? spesa?.status, "pending");
}

export function isPendingEntry(entry) {
    return isPendingStatus(resolveEntryStatus(entry));
}

export function isPendingSpesa(spesa) {
    return isPendingStatus(resolveSpesaStatus(spesa));
}

export function isManualInput(...values) {
    return !values.some((value) => ["timer", "gps", "app"].includes(normalizeStatus(value, "")));
}

export function getEntryHourlyCost(entry) {
    return toNumber(entry?.report?.employee?.tariffe?.[0]?.costo_orario);
}

export function getEntryCost(entry) {
    return round2(toNumber(entry?.ore_lavorate) * getEntryHourlyCost(entry));
}

export function mapAuditStatusToDb(s) {
    const x = String(s || "").toLowerCase();
    if (x === STATUS.VERIFIED) return DB_STATUS.VERIFIED;
    if (x === STATUS.REJECTED) return DB_STATUS.REJECTED;
    if (x === STATUS.PENDING) return DB_STATUS.PENDING;
    return String(s || "").toUpperCase();
}