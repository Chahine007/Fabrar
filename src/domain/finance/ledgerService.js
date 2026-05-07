import { Prisma } from "@prisma/client";
import {
  CostAllocationScope,
  CostCategory,
  LedgerDirection,
  LedgerEntryStatus,
  LogisticaStatus,
  ValidationStatus,
} from "../../constants.js";
import { round2, toNumber } from "../../utils/helpers.js";

export const LEDGER_ENTRY_TYPES = Object.freeze({
  LABOR_COST: "cost.labor",
  MATERIAL_COST: "cost.material",
  EXPENSE_COST: "cost.expense",
  PURCHASE_INVOICE: "purchase.invoice",
  PURCHASE_VAT: "purchase.vat",
  PAYMENT_OUT: "payment.out",
  SALES_INVOICE: "sales.invoice",
  RECEIPT_IN: "receipt.in",
  STOCK_LOAD: "stock.load",
});

function normalizeText(value, fallback = null) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeId(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function decimal(value) {
  const parsed = toNumber(value);
  return new Prisma.Decimal(Number.isFinite(parsed) ? parsed : 0);
}

function positiveDecimalOrNull(value) {
  const amount = decimal(value);
  return amount.gt(0) ? amount : null;
}

function normalizedSourceId(value) {
  return String(value ?? "").trim();
}

function hasLedgerDelegate(tx) {
  return typeof tx?.ledgerEntry?.upsert === "function";
}

export async function postLedgerEntry(tx, entry = {}) {
  if (!hasLedgerDelegate(tx)) {
    if (process.env.NODE_ENV === "test") return null;
    throw new Error("LedgerEntry Prisma delegate non disponibile.");
  }

  const sourceType = normalizeText(entry.sourceType ?? entry.source_type);
  const sourceId = normalizedSourceId(entry.sourceId ?? entry.source_id);
  const eventType = normalizeText(entry.eventType ?? entry.event_type);
  const sourceLineKey = normalizeText(entry.sourceLineKey ?? entry.source_line_key, "main");
  const amount = positiveDecimalOrNull(entry.amount);

  if (!sourceType || !sourceId || !eventType || !amount) return null;

  const data = {
    source_type: sourceType,
    source_id: sourceId,
    source_line_key: sourceLineKey,
    event_type: eventType,
    entry_type: normalizeText(entry.entryType ?? entry.entry_type, LEDGER_ENTRY_TYPES.EXPENSE_COST),
    direction: entry.direction === LedgerDirection.CREDIT ? LedgerDirection.CREDIT : LedgerDirection.DEBIT,
    amount,
    currency: normalizeText(entry.currency, "EUR"),
    description: normalizeText(entry.description),
    entry_date: entry.entryDate ?? entry.entry_date ?? new Date(),
    cantiere_id: normalizeId(entry.cantiere_id),
    task_id: normalizeId(entry.task_id),
    wbs_node_id: normalizeId(entry.wbs_node_id),
    employee_id: normalizeId(entry.employee_id),
    fornitore_id: normalizeId(entry.fornitore_id),
    document_id: normalizeId(entry.document_id),
    spesa_id: normalizeId(entry.spesa_id),
    report_entry_id: normalizeId(entry.report_entry_id),
    movimento_id: normalizeId(entry.movimento_id),
    fattura_acquisto_id: normalizeId(entry.fattura_acquisto_id),
    scadenza_pagamento_id: normalizeId(entry.scadenza_pagamento_id),
    fattura_id: normalizeId(entry.fattura_id),
    cost_category: entry.cost_category ?? CostCategory.UNKNOWN,
    allocation_scope: entry.allocation_scope ?? CostAllocationScope.REVIEW,
    taxable_amount: entry.imponibile == null ? null : decimal(entry.imponibile),
    tax_amount: entry.imposta == null ? null : decimal(entry.imposta),
    vat_rate: entry.iva_percentuale == null ? null : decimal(entry.iva_percentuale),
    metadata: entry.metadata ?? null,
    status: entry.status ?? LedgerEntryStatus.POSTED,
  };

  return tx.ledgerEntry.upsert({
    where: {
      ledger_entry_source_unique: {
        source_type: sourceType,
        source_id: sourceId,
        event_type: eventType,
        source_line_key: sourceLineKey,
      },
    },
    update: data,
    create: data,
  });
}

async function getLatestHourlyRate(tx, employeeId) {
  const normalizedEmployeeId = normalizeId(employeeId);
  if (!normalizedEmployeeId) return null;
  if (typeof tx?.tariffa?.findFirst !== "function") return null;
  return tx.tariffa.findFirst({
    where: { employee_id: normalizedEmployeeId },
    orderBy: [{ valido_dal: "desc" }, { id: "desc" }],
    select: { costo_orario: true },
  });
}

export async function postReportEntryApprovedLedger(tx, entry) {
  if (!hasLedgerDelegate(tx)) return null;
  if (!entry || entry.stato_validazione !== ValidationStatus.APPROVED) return null;
  const employeeId = entry.report?.employee_id;
  const hours = toNumber(entry.ore_lavorate);
  const tariffa = await getLatestHourlyRate(tx, employeeId);
  const hourlyCost = toNumber(tariffa?.costo_orario);
  const amount = round2(hours * hourlyCost);
  if (amount <= 0) return null;

  return postLedgerEntry(tx, {
    sourceType: "ReportEntry",
    sourceId: entry.id,
    eventType: "report_entry.approved",
    entryType: LEDGER_ENTRY_TYPES.LABOR_COST,
    direction: LedgerDirection.DEBIT,
    amount,
    description: `Costo manodopera riga ore #${entry.id}`,
    entryDate: entry.report?.report_date ?? new Date(),
    cantiere_id: entry.cantiere_id,
    task_id: entry.task_id,
    wbs_node_id: entry.wbs_node_id,
    employee_id: employeeId,
    report_entry_id: entry.id,
    cost_category: CostCategory.SERVICE,
    allocation_scope: CostAllocationScope.PROJECT,
    metadata: { ore_lavorate: hours, costo_orario: hourlyCost },
  });
}

function shouldSkipExpenseCost(spesa) {
  if (!spesa) return true;
  if (spesa.stato_validazione !== ValidationStatus.APPROVED) return true;
  if (spesa.fonte === "MAGAZZINO") return true;
  return spesa.fonte === "IMPORT_GENYA" && spesa.logistica_status === LogisticaStatus.LOADED_TO_WAREHOUSE;
}

export async function postSpesaApprovedLedger(tx, spesa) {
  if (!hasLedgerDelegate(tx)) return null;
  if (shouldSkipExpenseCost(spesa)) return null;

  return postLedgerEntry(tx, {
    sourceType: "Spesa",
    sourceId: spesa.id,
    eventType: "expense.approved",
    entryType: LEDGER_ENTRY_TYPES.EXPENSE_COST,
    direction: LedgerDirection.DEBIT,
    amount: spesa.importo,
    description: spesa.descrizione ?? `Spesa #${spesa.id}`,
    entryDate: spesa.timestamp_utc ?? new Date(),
    cantiere_id: spesa.cantiere_id,
    task_id: spesa.task_id,
    wbs_node_id: spesa.wbs_node_id,
    employee_id: spesa.employee_id,
    fornitore_id: spesa.fornitore_id,
    document_id: spesa.documento_id,
    spesa_id: spesa.id,
    cost_category: spesa.cost_category ?? CostCategory.OTHER,
    allocation_scope: spesa.allocation_scope ?? (spesa.cantiere_id ? CostAllocationScope.PROJECT : CostAllocationScope.OVERHEAD),
    metadata: {
      fonte: spesa.fonte,
      input_method: spesa.input_method,
      logistica_status: spesa.logistica_status,
    },
  });
}

export async function postWarehouseMovementLedger(tx, movimento) {
  if (!hasLedgerDelegate(tx)) return null;
  if (!movimento) return null;
  const isDischarge = movimento.tipo_movimento === "SCARICO_CANTIERE";
  const isLoad = movimento.tipo_movimento === "CARICO";
  if (!isDischarge && !isLoad) return null;

  return postLedgerEntry(tx, {
    sourceType: "MovimentoMagazzino",
    sourceId: movimento.id,
    eventType: isDischarge ? "stock.issued" : "stock.loaded",
    entryType: isDischarge ? LEDGER_ENTRY_TYPES.MATERIAL_COST : LEDGER_ENTRY_TYPES.STOCK_LOAD,
    direction: LedgerDirection.DEBIT,
    amount: movimento.valore_totale,
    description: isDischarge ? `Scarico magazzino #${movimento.id}` : `Carico magazzino #${movimento.id}`,
    entryDate: movimento.data_movimento ?? new Date(),
    cantiere_id: movimento.cantiere_id,
    task_id: movimento.task_id,
    wbs_node_id: movimento.wbs_node_id,
    fornitore_id: movimento.fornitore_id,
    document_id: movimento.documento_id,
    movimento_id: movimento.id,
    cost_category: CostCategory.INVENTORY_MATERIAL,
    allocation_scope: isDischarge ? CostAllocationScope.PROJECT : CostAllocationScope.REVIEW,
    metadata: {
      tipo_movimento: movimento.tipo_movimento,
      articolo_id: movimento.articolo_id,
      quantita: toNumber(movimento.quantita),
      costo_unitario: toNumber(movimento.costo_unitario),
    },
  });
}

export async function postPurchaseInvoiceLedger(tx, fatturaAcquisto) {
  if (!hasLedgerDelegate(tx)) return [];
  if (!fatturaAcquisto?.id) return [];
  const entries = [];

  const invoiceAmount = positiveDecimalOrNull(fatturaAcquisto.totale_documento);
  if (invoiceAmount) {
    entries.push(await postLedgerEntry(tx, {
      sourceType: "FatturaAcquisto",
      sourceId: fatturaAcquisto.id,
      eventType: "purchase_invoice.confirmed",
      sourceLineKey: "document_total",
      entryType: LEDGER_ENTRY_TYPES.PURCHASE_INVOICE,
      direction: LedgerDirection.DEBIT,
      amount: invoiceAmount,
      description: `Fattura acquisto ${fatturaAcquisto.numero_documento ?? `#${fatturaAcquisto.id}`}`,
      entryDate: fatturaAcquisto.data_documento ?? new Date(),
      cantiere_id: fatturaAcquisto.cantiere_id,
      fornitore_id: fatturaAcquisto.fornitore_id,
      document_id: fatturaAcquisto.document_id,
      spesa_id: fatturaAcquisto.spesa_id,
      fattura_acquisto_id: fatturaAcquisto.id,
      cost_category: fatturaAcquisto.cost_category ?? CostCategory.UNKNOWN,
      allocation_scope: fatturaAcquisto.allocation_scope ?? CostAllocationScope.REVIEW,
      imponibile: fatturaAcquisto.totale_imponibile,
      imposta: fatturaAcquisto.totale_imposta,
    }));
  }

  const vatAmount = positiveDecimalOrNull(fatturaAcquisto.totale_imposta);
  if (vatAmount) {
    entries.push(await postLedgerEntry(tx, {
      sourceType: "FatturaAcquisto",
      sourceId: fatturaAcquisto.id,
      eventType: "purchase_invoice.vat_recorded",
      sourceLineKey: "vat",
      entryType: LEDGER_ENTRY_TYPES.PURCHASE_VAT,
      direction: LedgerDirection.DEBIT,
      amount: vatAmount,
      description: `IVA fattura acquisto ${fatturaAcquisto.numero_documento ?? `#${fatturaAcquisto.id}`}`,
      entryDate: fatturaAcquisto.data_documento ?? new Date(),
      cantiere_id: fatturaAcquisto.cantiere_id,
      fornitore_id: fatturaAcquisto.fornitore_id,
      document_id: fatturaAcquisto.document_id,
      spesa_id: fatturaAcquisto.spesa_id,
      fattura_acquisto_id: fatturaAcquisto.id,
      cost_category: fatturaAcquisto.cost_category ?? CostCategory.UNKNOWN,
      allocation_scope: fatturaAcquisto.allocation_scope ?? CostAllocationScope.REVIEW,
      imposta: fatturaAcquisto.totale_imposta,
    }));
  }

  return entries.filter(Boolean);
}

export async function postPaymentDuePaidLedger(tx, paymentDue) {
  if (!hasLedgerDelegate(tx)) return null;
  if (!paymentDue || paymentDue.status !== "PAID") return null;
  return postLedgerEntry(tx, {
    sourceType: "ScadenzaPagamento",
    sourceId: paymentDue.id,
    eventType: "payment_due.paid",
    entryType: LEDGER_ENTRY_TYPES.PAYMENT_OUT,
    direction: LedgerDirection.CREDIT,
    amount: paymentDue.paid_amount ?? paymentDue.importo,
    description: `Pagamento uscita scadenza #${paymentDue.id}`,
    entryDate: paymentDue.paid_at ?? new Date(),
    fornitore_id: paymentDue.fornitore_id,
    spesa_id: paymentDue.spesa_id,
    fattura_acquisto_id: paymentDue.fattura_acquisto_id,
    scadenza_pagamento_id: paymentDue.id,
    metadata: {
      modalita_pagamento: paymentDue.modalita_pagamento,
      iban: paymentDue.iban,
      source: paymentDue.source,
    },
  });
}

export async function postSalesInvoicePaidLedger(tx, invoice) {
  if (!hasLedgerDelegate(tx)) return null;
  if (!invoice || invoice.stato !== "PAID") return null;
  return postLedgerEntry(tx, {
    sourceType: "Fattura",
    sourceId: invoice.id,
    eventType: "invoice.paid",
    entryType: LEDGER_ENTRY_TYPES.RECEIPT_IN,
    direction: LedgerDirection.CREDIT,
    amount: invoice.paid_amount ?? invoice.importo_totale,
    description: `Incasso fattura attiva ${invoice.numero_fattura ?? `#${invoice.id}`}`,
    entryDate: invoice.paid_at ?? new Date(),
    cantiere_id: invoice.cantiere_id,
    fattura_id: invoice.id,
  });
}

export async function calculateLedgerTrueCost(prisma, cantiereId, taskId = null) {
  if (typeof prisma?.ledgerEntry?.groupBy !== "function") return null;
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["entry_type"],
    where: {
      cantiere_id: cantiereId,
      ...(taskId ? { task_id: taskId } : {}),
      status: LedgerEntryStatus.POSTED,
      allocation_scope: CostAllocationScope.PROJECT,
      entry_type: {
        in: [
          LEDGER_ENTRY_TYPES.LABOR_COST,
          LEDGER_ENTRY_TYPES.MATERIAL_COST,
          LEDGER_ENTRY_TYPES.EXPENSE_COST,
        ],
      },
    },
    _sum: { amount: true },
  });

  if (rows.length === 0) return null;
  const get = (entryType) => round2(toNumber(rows.find((row) => row.entry_type === entryType)?._sum?.amount));
  const costoManodopera = get(LEDGER_ENTRY_TYPES.LABOR_COST);
  const costoMateriali = get(LEDGER_ENTRY_TYPES.MATERIAL_COST);
  const costoSpese = get(LEDGER_ENTRY_TYPES.EXPENSE_COST);
  return {
    costoManodopera,
    costoMateriali,
    costoSpese,
    costoTotale: round2(costoManodopera + costoMateriali + costoSpese),
  };
}
