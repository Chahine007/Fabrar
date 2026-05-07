import { OutboxStatus } from "../../constants.js";
import { domainBus } from "./domainBus.js";

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizePayload(payload) {
  return payload && typeof payload === "object" ? payload : {};
}

export async function enqueueOutboxEvent(tx, {
  eventType,
  aggregateType = null,
  aggregateId = null,
  payload = {},
  correlationId = null,
}) {
  if (typeof tx?.outboxEvent?.create !== "function") {
    if (process.env.NODE_ENV === "test") return null;
    throw new Error("OutboxEvent Prisma delegate non disponibile.");
  }

  const normalizedEventType = normalizeText(eventType);
  if (!normalizedEventType) return null;

  return tx.outboxEvent.create({
    data: {
      event_type: normalizedEventType,
      aggregate_type: normalizeText(aggregateType) ?? "unknown",
      aggregate_id: aggregateId == null ? "unknown" : String(aggregateId),
      payload: normalizePayload(payload),
      correlation_id: normalizeText(correlationId),
    },
  });
}

export async function flushPendingOutboxEvents(prisma, { limit = 50 } = {}) {
  const rows = await prisma.outboxEvent.findMany({
    where: { status: OutboxStatus.PENDING },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(Number(limit) || 50, 500)),
  });

  const results = [];
  for (const row of rows) {
    try {
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 }, last_error: null },
      });

      domainBus.emit(row.event_type, {
        ...(row.payload ?? {}),
        outboxEventId: row.id,
        correlationId: row.correlation_id ?? row.payload?.correlationId ?? null,
      });

      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: OutboxStatus.PUBLISHED, published_at: new Date(), last_error: null },
      });
      results.push({ id: row.id, status: OutboxStatus.PUBLISHED });
    } catch (err) {
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          status: OutboxStatus.FAILED,
          last_error: err?.message ?? "Errore sconosciuto durante la pubblicazione outbox.",
        },
      });
      results.push({ id: row.id, status: OutboxStatus.FAILED, error: err?.message });
    }
  }

  return results;
}

export async function listOutboxEvents(prisma, {
  status = null,
  eventType = null,
  aggregateType = null,
  limit = 100,
} = {}) {
  const where = {};
  if (status) where.status = String(status).trim().toUpperCase();
  if (eventType) where.event_type = String(eventType).trim();
  if (aggregateType) where.aggregate_type = String(aggregateType).trim();

  return prisma.outboxEvent.findMany({
    where,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(Number(limit) || 100, 500)),
  });
}

export async function retryOutboxEvent(prisma, id) {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    const error = new Error("ID evento outbox non valido.");
    error.status = 400;
    throw error;
  }

  const event = await prisma.outboxEvent.findUnique({ where: { id: parsedId } });
  if (!event) {
    const error = new Error("Evento outbox non trovato.");
    error.status = 404;
    throw error;
  }

  return prisma.outboxEvent.update({
    where: { id: parsedId },
    data: {
      status: OutboxStatus.PENDING,
      last_error: null,
      published_at: null,
    },
  });
}

export function startOutboxWorker(prisma, {
  intervalMs = 5000,
  batchSize = 50,
  logger = console,
} = {}) {
  const normalizedInterval = Math.max(1000, Number(intervalMs) || 5000);
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await flushPendingOutboxEvents(prisma, { limit: batchSize });
    } catch (err) {
      logger?.error?.({ err, event: "outbox_worker_error" }, "outbox_worker_error");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, normalizedInterval);
  timer.unref?.();
  tick();

  return () => clearInterval(timer);
}
