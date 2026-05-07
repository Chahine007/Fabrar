import { AUDIT_TYPE, PaymentDueStatus, ValidationStatus } from "../../constants.js";
import { normalizeStatus } from "../../utils/helpers.js";
import { bulkUpdateItems } from "../hr/auditService.js";
import { postPaymentDuePaidLedger } from "../finance/ledgerService.js";
import { enqueueOutboxEvent } from "../events/outboxService.js";
import { EVENTS } from "../events/domainBus.js";
import { writeAuditLog } from "../audit/auditLogService.js";

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeEntityType(value) {
  return String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function actionToValidationStatus(action) {
  const normalized = String(action ?? "").trim().toLowerCase();
  if (["approve", "approved", "verify", "verified"].includes(normalized)) return ValidationStatus.APPROVED;
  if (["reject", "rejected"].includes(normalized)) return ValidationStatus.REJECTED;
  if (["reopen", "pending", "reset"].includes(normalized)) return ValidationStatus.PENDING;
  return normalizeStatus(action);
}

function paymentActionToStatus(action) {
  const normalized = String(action ?? "").trim().toLowerCase();
  if (["pay", "paid", "mark-paid"].includes(normalized)) return PaymentDueStatus.PAID;
  if (["cancel", "cancelled"].includes(normalized)) return PaymentDueStatus.CANCELLED;
  if (["reopen", "open"].includes(normalized)) return PaymentDueStatus.OPEN;
  return null;
}

async function recordWorkflowTransition(tx, user, {
  entityType,
  entityId,
  action,
  fromState = null,
  toState = null,
  payload = null,
  correlationId = null,
}) {
  return tx.workflowTransition.create({
    data: {
      entity_type: entityType,
      entity_id: String(entityId),
      action,
      from_state: fromState,
      to_state: toState,
      actor_user_id: parsePositiveInt(user?.id),
      actor_employee_id: parsePositiveInt(user?.employee_id),
      payload,
      correlation_id: correlationId ?? null,
    },
  });
}

async function transitionAuditItem(prisma, {
  entityType,
  id,
  action,
  payload,
  user,
  correlationId = null,
}) {
  const isReportEntry = entityType === "report-entry" || entityType === "reportentry" || entityType === "ore";
  const isSpesa = entityType === "spesa" || entityType === "expense" || entityType === "spese";
  if (!isReportEntry && !isSpesa) throw httpError("Tipo workflow audit non supportato.", 400);

  const itemId = parsePositiveInt(id);
  if (!itemId) throw httpError("ID workflow non valido.", 400);
  const newStatus = actionToValidationStatus(action);
  if (!newStatus) throw httpError("Azione workflow non valida.", 400);

  const previous = isReportEntry
    ? await prisma.reportEntry.findUnique({ where: { id: itemId }, select: { stato_validazione: true } })
    : await prisma.spesa.findUnique({ where: { id: itemId }, select: { stato_validazione: true } });
  if (!previous) throw httpError("Entità workflow non trovata.", 404);

  await bulkUpdateItems(prisma, {
    items: [{
      id: itemId,
      type: isReportEntry ? AUDIT_TYPE.ORE : AUDIT_TYPE.SPESE,
      newStatus,
    }],
  }, user);

  const transition = await prisma.workflowTransition.create({
    data: {
      entity_type: isReportEntry ? "ReportEntry" : "Spesa",
      entity_id: String(itemId),
      action,
      from_state: previous.stato_validazione,
      to_state: newStatus,
      actor_user_id: parsePositiveInt(user?.id),
      actor_employee_id: parsePositiveInt(user?.employee_id),
      payload: payload ?? null,
      correlation_id: correlationId,
    },
  });

  return {
    transition,
    entity: {
      type: transition.entity_type,
      id: itemId,
      stato_validazione: newStatus,
    },
  };
}

async function transitionPaymentDue(prisma, {
  id,
  action,
  payload,
  user,
  correlationId = null,
}) {
  const payableId = parsePositiveInt(id);
  if (!payableId) throw httpError("ID scadenza non valido.", 400);
  const nextStatus = paymentActionToStatus(action);
  if (!nextStatus) throw httpError("Azione pagamento non valida.", 400);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.scadenzaPagamento.findUnique({ where: { id: payableId } });
    if (!existing) throw httpError("Scadenza pagamento non trovata.", 404);

    const updateData = {
      status: nextStatus,
      note: payload?.note ?? existing.note,
    };
    if (nextStatus === PaymentDueStatus.PAID) {
      updateData.paid_at = payload?.paid_at ? new Date(payload.paid_at) : new Date();
      updateData.paid_amount = payload?.paid_amount ?? existing.importo;
    } else {
      updateData.paid_at = null;
      updateData.paid_amount = null;
    }

    const updated = await tx.scadenzaPagamento.update({ where: { id: payableId }, data: updateData });

    if (updated.status === PaymentDueStatus.PAID) {
      await postPaymentDuePaidLedger(tx, updated);
      await enqueueOutboxEvent(tx, {
        eventType: EVENTS.PAYMENT_DUE_PAID,
        aggregateType: "ScadenzaPagamento",
        aggregateId: updated.id,
        correlationId,
        payload: {
          paymentDueId: updated.id,
          fornitoreId: updated.fornitore_id,
          fatturaAcquistoId: updated.fattura_acquisto_id,
          amount: Number(updated.paid_amount ?? updated.importo),
        },
      });
    }

    await writeAuditLog(tx, user, {
      entityType: "ScadenzaPagamento",
      entityId: updated.id,
      action: updated.status === PaymentDueStatus.PAID ? "PAYMENT_DUE_PAID" : "PAYMENT_DUE_STATUS_CHANGED",
      previousState: { status: existing.status, paid_at: existing.paid_at, paid_amount: existing.paid_amount },
      nextState: { status: updated.status, paid_at: updated.paid_at, paid_amount: updated.paid_amount },
      note: payload?.note,
      correlationId,
    });

    const transition = await recordWorkflowTransition(tx, user, {
      entityType: "ScadenzaPagamento",
      entityId: updated.id,
      action,
      fromState: existing.status,
      toState: updated.status,
      payload,
      correlationId,
    });

    return { transition, entity: updated };
  });
}

export async function transitionEntity(prisma, {
  entityType,
  entityId,
  action,
  payload = null,
  user,
  correlationId = null,
}) {
  const normalizedEntityType = normalizeEntityType(entityType);
  if (!normalizedEntityType) throw httpError("Tipo entità workflow mancante.", 400);

  if (["report-entry", "reportentry", "ore", "spesa", "spese", "expense"].includes(normalizedEntityType)) {
    return transitionAuditItem(prisma, {
      entityType: normalizedEntityType,
      id: entityId,
      action,
      payload,
      user,
      correlationId,
    });
  }

  if (["payment-due", "payable", "scadenza-pagamento"].includes(normalizedEntityType)) {
    return transitionPaymentDue(prisma, {
      id: entityId,
      action,
      payload,
      user,
      correlationId,
    });
  }

  throw httpError(`Workflow non configurato per '${entityType}'.`, 404);
}
