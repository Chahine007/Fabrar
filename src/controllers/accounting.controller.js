import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { round2, toNumber } from "../utils/helpers.js";
import { CostAllocationScope, CostCategory, PaymentDueStatus } from "../constants.js";
import { writeAuditLog } from "../domain/audit/auditLogService.js";
import { postPaymentDuePaidLedger } from "../domain/finance/ledgerService.js";
import { enqueueOutboxEvent } from "../domain/events/outboxService.js";
import { domainBus, EVENTS } from "../domain/events/domainBus.js";

const PAYMENT_STATUS_VALUES = new Set(Object.values(PaymentDueStatus));
const COST_CATEGORY_VALUES = new Set(Object.values(CostCategory));
const ALLOCATION_SCOPE_VALUES = new Set(Object.values(CostAllocationScope));

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeEnum(value, allowedValues) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return allowedValues.has(normalized) ? normalized : null;
}

function lineTax(row) {
  const taxable = toNumber(row.imponibile_riga ?? row.prezzo_totale);
  const explicitTax = row.imposta_riga == null ? null : toNumber(row.imposta_riga);
  const vatRate = row.iva_percentuale == null ? null : toNumber(row.iva_percentuale);
  const tax = explicitTax ?? (vatRate == null ? 0 : round2((taxable * vatRate) / 100));
  return {
    taxable: round2(taxable),
    tax: round2(tax),
    gross: round2(taxable + tax),
    vatRate,
  };
}

function effectivePayableStatus(payable, today = startOfToday()) {
  if (payable.status !== PaymentDueStatus.OPEN) return payable.status;
  const dueDate = parseDate(payable.data_scadenza);
  if (!dueDate) return PaymentDueStatus.OPEN;
  if (dueDate < today) return "OVERDUE";
  if (dueDate <= addDays(today, 7)) return "DUE_SOON";
  return PaymentDueStatus.OPEN;
}

function mapPayable(row) {
  return {
    id: row.id,
    data_scadenza: row.data_scadenza,
    importo: round2(toNumber(row.importo)),
    modalita_pagamento: row.modalita_pagamento,
    iban: row.iban,
    status: row.status,
    status_effettivo: effectivePayableStatus(row),
    source: row.source,
    paid_at: row.paid_at,
    paid_amount: row.paid_amount == null ? null : round2(toNumber(row.paid_amount)),
    note: row.note,
    fornitore: row.fornitore,
    spesa: row.spesa,
    fattura_acquisto: row.fattura_acquisto
      ? {
          ...row.fattura_acquisto,
          totale_imponibile: row.fattura_acquisto.totale_imponibile == null ? null : round2(toNumber(row.fattura_acquisto.totale_imponibile)),
          totale_imposta: row.fattura_acquisto.totale_imposta == null ? null : round2(toNumber(row.fattura_acquisto.totale_imposta)),
          totale_documento: row.fattura_acquisto.totale_documento == null ? null : round2(toNumber(row.fattura_acquisto.totale_documento)),
        }
      : null,
  };
}

function payableInclude() {
  return {
    fornitore: {
      select: {
        id: true,
        ragione_sociale: true,
        partita_iva: true,
        partita_iva_normalizzata: true,
        iban_default: true,
      },
    },
    spesa: {
      select: {
        id: true,
        importo: true,
        fonte: true,
        input_method: true,
        cost_category: true,
        allocation_scope: true,
      },
    },
    fattura_acquisto: {
      include: {
        documento: { select: { id: true, name: true, file_path: true, tag: true } },
        cantiere: { select: { id: true, nome: true } },
      },
    },
  };
}

function buildPayableWhere(query) {
  const and = [];
  const today = startOfToday();
  const status = String(query.status ?? "").trim().toUpperCase();
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  const supplierId = parsePositiveInt(query.supplier_id ?? query.fornitore_id);
  const costCategory = normalizeEnum(query.cost_category, COST_CATEGORY_VALUES);
  const allocationScope = normalizeEnum(query.allocation_scope, ALLOCATION_SCOPE_VALUES);

  if (from || to) {
    and.push({
      data_scadenza: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }
  if (supplierId) and.push({ fornitore_id: supplierId });
  if (PAYMENT_STATUS_VALUES.has(status)) and.push({ status });
  if (status === "OVERDUE") {
    and.push({ status: PaymentDueStatus.OPEN, data_scadenza: { lt: today } });
  }
  if (status === "DUE_7" || status === "DUE_SOON") {
    and.push({ status: PaymentDueStatus.OPEN, data_scadenza: { gte: today, lte: addDays(today, 7) } });
  }
  if (status === "DUE_30") {
    and.push({ status: PaymentDueStatus.OPEN, data_scadenza: { gte: today, lte: addDays(today, 30) } });
  }
  if (costCategory || allocationScope) {
    and.push({
      fattura_acquisto: {
        is: {
          ...(costCategory ? { cost_category: costCategory } : {}),
          ...(allocationScope ? { allocation_scope: allocationScope } : {}),
        },
      },
    });
  }

  return and.length ? { AND: and } : {};
}

function buildPayableSummary(rows) {
  const today = startOfToday();
  const due7 = addDays(today, 7);
  const due30 = addDays(today, 30);
  return rows.reduce((acc, row) => {
    const amount = toNumber(row.importo);
    const dueDate = parseDate(row.data_scadenza);
    if (row.status === PaymentDueStatus.PAID) {
      acc.paid += amount;
      return acc;
    }
    if (row.status !== PaymentDueStatus.OPEN) return acc;
    acc.open += amount;
    if (dueDate && dueDate < today) acc.overdue += amount;
    if (dueDate && dueDate >= today && dueDate <= due7) acc.due7 += amount;
    if (dueDate && dueDate >= today && dueDate <= due30) acc.due30 += amount;
    return acc;
  }, { open: 0, overdue: 0, due7: 0, due30: 0, paid: 0 });
}

export const getPayables = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const rows = await prisma.scadenzaPagamento.findMany({
    where: buildPayableWhere(req.query),
    include: payableInclude(),
    orderBy: [{ data_scadenza: "asc" }, { id: "asc" }],
    take: 500,
  });
  const summary = buildPayableSummary(rows);
  res.json({
    summary: {
      totale_aperto: round2(summary.open),
      totale_scaduto: round2(summary.overdue),
      totale_in_scadenza_7: round2(summary.due7),
      totale_in_scadenza_30: round2(summary.due30),
      totale_pagato: round2(summary.paid),
    },
    items: rows.map(mapPayable),
  });
});

export const updatePayable = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const id = parsePositiveInt(req.params.id);
  if (!id) throw httpError("ID scadenza non valido.", 400);

  const existing = await prisma.scadenzaPagamento.findUnique({ where: { id } });
  if (!existing) throw httpError("Scadenza pagamento non trovata.", 404);

  const data = {};
  if (req.body.data_scadenza !== undefined) {
    const date = parseDate(req.body.data_scadenza);
    if (!date) throw httpError("Data scadenza non valida.", 400);
    data.data_scadenza = date;
  }
  if (req.body.importo !== undefined) {
    const amount = Number(req.body.importo);
    if (!Number.isFinite(amount) || amount <= 0) throw httpError("Importo non valido.", 400);
    data.importo = amount;
  }
  if (req.body.modalita_pagamento !== undefined) data.modalita_pagamento = req.body.modalita_pagamento || null;
  if (req.body.iban !== undefined) data.iban = req.body.iban ? String(req.body.iban).replace(/\s+/g, "").toUpperCase() : null;
  if (req.body.note !== undefined) data.note = req.body.note || null;

  if (req.body.status !== undefined) {
    const status = normalizeEnum(req.body.status, PAYMENT_STATUS_VALUES);
    if (!status) throw httpError("Stato pagamento non valido.", 400);
    data.status = status;
    if (status === PaymentDueStatus.PAID) {
      data.paid_at = parseDate(req.body.paid_at) ?? new Date();
      data.paid_amount = req.body.paid_amount == null ? existing.importo : Number(req.body.paid_amount);
    }
    if (status === PaymentDueStatus.OPEN || status === PaymentDueStatus.CANCELLED) {
      data.paid_at = null;
      data.paid_amount = null;
    }
  }

  const events = [];
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.scadenzaPagamento.update({
      where: { id },
      data,
      include: payableInclude(),
    });

    if (row.status === PaymentDueStatus.PAID) {
      await postPaymentDuePaidLedger(tx, row);
      await enqueueOutboxEvent(tx, {
        eventType: EVENTS.PAYMENT_DUE_PAID,
        aggregateType: "ScadenzaPagamento",
        aggregateId: row.id,
        payload: {
          paymentDueId: row.id,
          fornitoreId: row.fornitore_id,
          fatturaAcquistoId: row.fattura_acquisto_id,
          amount: toNumber(row.paid_amount ?? row.importo),
        },
      });
      events.push({
        type: EVENTS.PAYMENT_DUE_PAID,
        payload: {
          paymentDueId: row.id,
          fornitoreId: row.fornitore_id,
          fatturaAcquistoId: row.fattura_acquisto_id,
        },
      });
    }

    await writeAuditLog(tx, req.user, {
      entityType: "ScadenzaPagamento",
      entityId: id,
      action: row.status === PaymentDueStatus.PAID ? "PAYMENT_DUE_PAID" : "PAYABLE_UPDATED",
      previousState: existing,
      nextState: data,
    });
    return row;
  });

  for (const event of events) {
    domainBus.emit(event.type, event.payload);
  }

  res.json(mapPayable(updated));
});

export const getVatRegister = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const supplierId = parsePositiveInt(req.query.supplier_id ?? req.query.fornitore_id);
  const vatRateFilter = req.query.iva_percentuale == null || req.query.iva_percentuale === ""
    ? null
    : Number(req.query.iva_percentuale);
  const costCategory = normalizeEnum(req.query.cost_category, COST_CATEGORY_VALUES);
  const allocationScope = normalizeEnum(req.query.allocation_scope, ALLOCATION_SCOPE_VALUES);

  const rows = await prisma.rigaFatturaAcquisto.findMany({
    where: {
      ...(Number.isFinite(vatRateFilter) ? { iva_percentuale: vatRateFilter } : {}),
      fattura_acquisto: {
        is: {
          ...(from || to ? {
            data_documento: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          } : {}),
          ...(supplierId ? { fornitore_id: supplierId } : {}),
          ...(costCategory ? { cost_category: costCategory } : {}),
          ...(allocationScope ? { allocation_scope: allocationScope } : {}),
        },
      },
    },
    include: {
      fattura_acquisto: {
        include: {
          fornitore: { select: { id: true, ragione_sociale: true, partita_iva: true } },
          cantiere: { select: { id: true, nome: true } },
          documento: { select: { id: true, name: true } },
          spesa: { select: { id: true, fonte: true, input_method: true } },
        },
      },
    },
    orderBy: [
      { fattura_acquisto: { data_documento: "desc" } },
      { fattura_acquisto_id: "desc" },
      { id: "asc" },
    ],
    take: 1000,
  });

  const summaryByRate = new Map();
  const invoiceIds = new Set();
  const items = rows.map((row) => {
    const tax = lineTax(row);
    const rateKey = tax.vatRate == null ? "N/D" : tax.vatRate.toFixed(2);
    const current = summaryByRate.get(rateKey) ?? { iva_percentuale: tax.vatRate, imponibile: 0, imposta: 0, totale: 0, righe: 0 };
    current.imponibile += tax.taxable;
    current.imposta += tax.tax;
    current.totale += tax.gross;
    current.righe += 1;
    summaryByRate.set(rateKey, current);
    invoiceIds.add(row.fattura_acquisto_id);

    return {
      id: row.id,
      fattura_acquisto_id: row.fattura_acquisto_id,
      numero_documento: row.fattura_acquisto?.numero_documento ?? null,
      data_documento: row.fattura_acquisto?.data_documento ?? null,
      fornitore: row.fattura_acquisto?.fornitore ?? null,
      cantiere: row.fattura_acquisto?.cantiere ?? null,
      descrizione: row.descrizione,
      codice_sku_normalizzato: row.codice_sku_normalizzato,
      imponibile: tax.taxable,
      iva_percentuale: tax.vatRate,
      imposta: tax.tax,
      totale: tax.gross,
      cost_category: row.cost_category,
      allocation_scope: row.allocation_scope,
      is_stockable: row.is_stockable,
    };
  });

  const totals = items.reduce((acc, item) => ({
    imponibile: acc.imponibile + item.imponibile,
    imposta: acc.imposta + item.imposta,
    totale: acc.totale + item.totale,
  }), { imponibile: 0, imposta: 0, totale: 0 });

  res.json({
    summary: {
      imponibile: round2(totals.imponibile),
      imposta: round2(totals.imposta),
      totale: round2(totals.totale),
      fatture_count: invoiceIds.size,
      righe_count: items.length,
      by_iva: [...summaryByRate.values()].map((row) => ({
        iva_percentuale: row.iva_percentuale,
        imponibile: round2(row.imponibile),
        imposta: round2(row.imposta),
        totale: round2(row.totale),
        righe: row.righe,
      })),
    },
    items,
  });
});

export const getPurchaseInvoiceById = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const id = parsePositiveInt(req.params.id);
  if (!id) throw httpError("ID fattura acquisto non valido.", 400);

  const invoice = await prisma.fatturaAcquisto.findUnique({
    where: { id },
    include: {
      fornitore: true,
      documento: true,
      spesa: true,
      cantiere: { select: { id: true, nome: true } },
      scadenze: { orderBy: [{ data_scadenza: "asc" }, { id: "asc" }] },
      righe: {
        orderBy: { id: "asc" },
        include: {
          articolo: { select: { id: true, codice_sku: true, descrizione: true } },
          movimento: { select: { id: true, tipo_movimento: true, quantita: true, valore_totale: true } },
        },
      },
    },
  });
  if (!invoice) throw httpError("Fattura acquisto non trovata.", 404);
  res.json(invoice);
});
