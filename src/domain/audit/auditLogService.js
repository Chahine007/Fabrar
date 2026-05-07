import { normalizeOptionalText } from "../../utils/helpers.js";

function normalizeEntityId(value) {
  if (value == null) return null;
  return String(value);
}

function normalizeUserId(user, key) {
  const parsed = Number(user?.[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toJsonValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    if (typeof value.toNumber === "function") return value.toNumber();
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, toJsonValue(entryValue)])
    );
  }
  return String(value);
}

export async function writeAuditLog(prisma, user, {
  entityType,
  entityId,
  action,
  previousState = null,
  nextState = null,
  note = null,
  source = null,
  requestId = null,
  correlationId = null,
}) {
  const normalizedEntityId = normalizeEntityId(entityId);
  const normalizedEntityType = normalizeOptionalText(entityType);
  const normalizedAction = normalizeOptionalText(action);

  if (!normalizedEntityType || !normalizedEntityId || !normalizedAction) return null;
  if (typeof prisma?.auditLog?.create !== "function") {
    if (process.env.NODE_ENV === "test") return null;
    throw new Error("AuditLog Prisma delegate non disponibile.");
  }

  return prisma.auditLog.create({
    data: {
      actor_user_id: normalizeUserId(user, "id"),
      actor_employee_id: normalizeUserId(user, "employee_id"),
      entity_type: normalizedEntityType,
      entity_id: normalizedEntityId,
      action: normalizedAction,
      previous_state: toJsonValue(previousState),
      next_state: toJsonValue(nextState),
      note: normalizeOptionalText(note),
      source: normalizeOptionalText(source),
      request_id: normalizeOptionalText(requestId),
      correlation_id: normalizeOptionalText(correlationId),
    },
  });
}
