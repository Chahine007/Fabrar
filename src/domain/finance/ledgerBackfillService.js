import {
  postPaymentDuePaidLedger,
  postPurchaseInvoiceLedger,
  postReportEntryApprovedLedger,
  postSalesInvoicePaidLedger,
  postSpesaApprovedLedger,
  postWarehouseMovementLedger,
} from "./ledgerService.js";
import { PaymentDueStatus, ValidationStatus } from "../../constants.js";

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.max(1, Math.min(Math.floor(parsed), 5000));
}

async function countSources(prisma) {
  const [
    reportEntriesApproved,
    speseApproved,
    warehouseMovements,
    purchaseInvoices,
    paidPayables,
    paidSalesInvoices,
    ledgerEntries,
  ] = await Promise.all([
    prisma.reportEntry.count({ where: { stato_validazione: ValidationStatus.APPROVED } }),
    prisma.spesa.count({ where: { stato_validazione: ValidationStatus.APPROVED } }),
    prisma.movimentoMagazzino.count({ where: { tipo_movimento: { in: ["CARICO", "SCARICO_CANTIERE"] } } }),
    prisma.fatturaAcquisto.count(),
    prisma.scadenzaPagamento.count({ where: { status: PaymentDueStatus.PAID } }),
    prisma.fattura.count({ where: { stato: "PAID" } }),
    prisma.ledgerEntry.count(),
  ]);

  return {
    reportEntriesApproved,
    speseApproved,
    warehouseMovements,
    purchaseInvoices,
    paidPayables,
    paidSalesInvoices,
    ledgerEntries,
  };
}

async function backfillBatch(prisma, {
  model,
  where,
  include,
  orderBy = { id: "asc" },
  limit,
  post,
}) {
  const query = {
    where,
    orderBy,
    take: limit,
  };

  if (include && Object.keys(include).length > 0) {
    query.include = include;
  }

  const rows = await prisma[model].findMany(query);

  let posted = 0;
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const result = await post(tx, row);
      if (Array.isArray(result)) posted += result.filter(Boolean).length;
      else if (result) posted += 1;
    });
  }

  return { scanned: rows.length, posted };
}

export async function backfillLedger(prisma, { dryRun = true, limit = 500 } = {}) {
  const normalizedLimit = clampLimit(limit);
  const sourceCounts = await countSources(prisma);

  if (dryRun) {
    return {
      dryRun: true,
      sourceCounts,
      planned: {
        reportEntriesApproved: Math.min(sourceCounts.reportEntriesApproved, normalizedLimit),
        speseApproved: Math.min(sourceCounts.speseApproved, normalizedLimit),
        warehouseMovements: Math.min(sourceCounts.warehouseMovements, normalizedLimit),
        purchaseInvoices: Math.min(sourceCounts.purchaseInvoices, normalizedLimit),
        paidPayables: Math.min(sourceCounts.paidPayables, normalizedLimit),
        paidSalesInvoices: Math.min(sourceCounts.paidSalesInvoices, normalizedLimit),
      },
    };
  }

  const reportEntries = await backfillBatch(prisma, {
    model: "reportEntry",
    where: { stato_validazione: ValidationStatus.APPROVED },
    include: { report: { select: { employee_id: true, report_date: true } } },
    limit: normalizedLimit,
    post: postReportEntryApprovedLedger,
  });

  const spese = await backfillBatch(prisma, {
    model: "spesa",
    where: { stato_validazione: ValidationStatus.APPROVED },
    include: {},
    limit: normalizedLimit,
    post: postSpesaApprovedLedger,
  });

  const movimenti = await backfillBatch(prisma, {
    model: "movimentoMagazzino",
    where: { tipo_movimento: { in: ["CARICO", "SCARICO_CANTIERE"] } },
    include: {},
    limit: normalizedLimit,
    post: postWarehouseMovementLedger,
  });

  const fattureAcquisto = await backfillBatch(prisma, {
    model: "fatturaAcquisto",
    where: {},
    include: {},
    limit: normalizedLimit,
    post: postPurchaseInvoiceLedger,
  });

  const scadenzePagate = await backfillBatch(prisma, {
    model: "scadenzaPagamento",
    where: { status: PaymentDueStatus.PAID },
    include: {},
    limit: normalizedLimit,
    post: postPaymentDuePaidLedger,
  });

  const fattureAttivePagate = await backfillBatch(prisma, {
    model: "fattura",
    where: { stato: "PAID" },
    include: {},
    limit: normalizedLimit,
    post: postSalesInvoicePaidLedger,
  });

  const afterCounts = await countSources(prisma);

  return {
    dryRun: false,
    limit: normalizedLimit,
    before: sourceCounts,
    after: afterCounts,
    results: {
      reportEntries,
      spese,
      movimenti,
      fattureAcquisto,
      scadenzePagate,
      fattureAttivePagate,
    },
  };
}
