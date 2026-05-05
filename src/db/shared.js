import pkg from '@prisma/client';
import { formatDateOnly } from './date.js';

const { Prisma, Decimal } = pkg;

BigInt.prototype.toJSON = function () {
  return this.toString();
};

Decimal.prototype.toJSON = function () {
  return Number(this.toString());
};

export { Prisma };

export function decimalOrNull(value) {
  if (value == null || value === "") return null;
  return new Prisma.Decimal(value);
}

export function decimalToNumber(value) {
  if (value == null || value === "") return null;
  return Number(value);
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeUserRole(role, fallback = null) {
  if (typeof role !== "string") return fallback;
  const normalized = role.trim().toUpperCase();
  return normalized || fallback;
}

export function normalizeReportRecord(report) {
  return {
    ...report,
    report_date: formatDateOnly(report.report_date),
  };
}
