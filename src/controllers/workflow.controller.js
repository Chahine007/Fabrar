import crypto from "crypto";
import { getDb } from "../db/index.js";
import { transitionEntity } from "../domain/workflow/workflowService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function getCorrelationId(req) {
  return (
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    crypto.randomUUID()
  );
}

export const transitionWorkflowEntity = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const result = await transitionEntity(prisma, {
    entityType: req.params.entityType,
    id: req.params.id,
    action: req.body?.action ?? req.body?.transition ?? req.body?.status,
    payload: req.body ?? {},
    user: req.user,
    correlationId: getCorrelationId(req),
  });

  return res.json(result);
});
