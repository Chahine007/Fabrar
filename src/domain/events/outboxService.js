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
    where: { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } },
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
