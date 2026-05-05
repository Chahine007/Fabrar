const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  if (typeof value === "string" && DATE_ONLY_RE.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data non valida: ${value}`);
  }

  return new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function formatDateOnly(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && DATE_ONLY_RE.test(value)) return value;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
