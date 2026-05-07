import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  flushPendingOutboxEvents,
  listOutboxEvents,
  retryOutboxEvent,
} from "../domain/events/outboxService.js";

export const getOutboxEvents = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const events = await listOutboxEvents(prisma, {
    status: req.query.status,
    eventType: req.query.event_type,
    aggregateType: req.query.aggregate_type,
    limit: req.query.limit,
  });

  res.json({ events });
});

export const retryOutbox = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const event = await retryOutboxEvent(prisma, req.params.id);

  res.json({
    message: "Evento rimesso in coda.",
    event,
  });
});

export const flushOutbox = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const results = await flushPendingOutboxEvents(prisma, { limit: req.body?.limit ?? req.query.limit });

  res.json({
    message: "Flush outbox completato.",
    results,
  });
});
