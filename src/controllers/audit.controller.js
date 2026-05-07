import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function parsePositiveInt(value, fallback = 100, max = 500) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const getAuditLogs = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const where = {};

  if (req.query.entity_type) where.entity_type = String(req.query.entity_type);
  if (req.query.entity_id) where.entity_id = String(req.query.entity_id);
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.correlation_id) where.correlation_id = String(req.query.correlation_id);

  const actorUserId = Number(req.query.actor_user_id);
  if (Number.isInteger(actorUserId) && actorUserId > 0) where.actor_user_id = actorUserId;

  const actorEmployeeId = Number(req.query.actor_employee_id);
  if (Number.isInteger(actorEmployeeId) && actorEmployeeId > 0) where.actor_employee_id = actorEmployeeId;

  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from || to) {
    where.created_at = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: parsePositiveInt(req.query.limit),
  });

  res.json({ logs });
});
