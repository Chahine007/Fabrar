import {
  CostAllocationScope,
  LedgerEntryStatus,
  LogisticaStatus,
  OutboxStatus,
  PaymentDueStatus,
} from "../../constants.js";
import { LEDGER_ENTRY_TYPES } from "../finance/ledgerService.js";
import { round2, toNumber } from "../../utils/helpers.js";

function sumRows(rows, field = "amount") {
  return round2(rows.reduce((total, row) => total + toNumber(row?._sum?.[field]), 0));
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function aggregateLedger(prisma, where = {}) {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["entry_type", "allocation_scope"],
    where: {
      status: LedgerEntryStatus.POSTED,
      ...where,
    },
    _sum: { amount: true },
  });

  const byType = Object.fromEntries(
    rows.map((row) => [
      `${row.entry_type}:${row.allocation_scope ?? "NONE"}`,
      round2(toNumber(row._sum?.amount)),
    ]),
  );

  return {
    rows,
    byType,
    projectCosts: sumRows(rows.filter((row) => (
      row.allocation_scope === CostAllocationScope.PROJECT &&
      [
        LEDGER_ENTRY_TYPES.LABOR_COST,
        LEDGER_ENTRY_TYPES.MATERIAL_COST,
        LEDGER_ENTRY_TYPES.EXPENSE_COST,
      ].includes(row.entry_type)
    ))),
    overheadCosts: sumRows(rows.filter((row) => (
      row.allocation_scope === CostAllocationScope.OVERHEAD &&
      [
        LEDGER_ENTRY_TYPES.EXPENSE_COST,
        LEDGER_ENTRY_TYPES.PURCHASE_INVOICE,
      ].includes(row.entry_type)
    ))),
    receipts: sumRows(rows.filter((row) => row.entry_type === LEDGER_ENTRY_TYPES.RECEIPT_IN)),
    purchaseInvoices: sumRows(rows.filter((row) => row.entry_type === LEDGER_ENTRY_TYPES.PURCHASE_INVOICE)),
    stockValue: sumRows(rows.filter((row) => row.entry_type === LEDGER_ENTRY_TYPES.STOCK_LOAD)),
  };
}

async function getOpenPayablesSummary(prisma) {
  const today = startOfToday();
  const in7Days = addDays(today, 7);
  const in30Days = addDays(today, 30);

  const [overdue, next7, next30, openTotal] = await Promise.all([
    prisma.scadenzaPagamento.aggregate({
      where: { status: PaymentDueStatus.OPEN, data_scadenza: { lt: today } },
      _count: { _all: true },
      _sum: { importo: true },
    }),
    prisma.scadenzaPagamento.aggregate({
      where: { status: PaymentDueStatus.OPEN, data_scadenza: { gte: today, lte: in7Days } },
      _count: { _all: true },
      _sum: { importo: true },
    }),
    prisma.scadenzaPagamento.aggregate({
      where: { status: PaymentDueStatus.OPEN, data_scadenza: { gte: today, lte: in30Days } },
      _count: { _all: true },
      _sum: { importo: true },
    }),
    prisma.scadenzaPagamento.aggregate({
      where: { status: PaymentDueStatus.OPEN },
      _count: { _all: true },
      _sum: { importo: true },
    }),
  ]);

  return {
    overdue: { count: overdue._count?._all ?? 0, amount: round2(toNumber(overdue._sum?.importo)) },
    next7Days: { count: next7._count?._all ?? 0, amount: round2(toNumber(next7._sum?.importo)) },
    next30Days: { count: next30._count?._all ?? 0, amount: round2(toNumber(next30._sum?.importo)) },
    openTotal: { count: openTotal._count?._all ?? 0, amount: round2(toNumber(openTotal._sum?.importo)) },
  };
}

async function getUnderstockArticles(prisma, limit = 20) {
  const articles = await prisma.articolo.findMany({
    where: { scorta_minima: { gt: 0 } },
    include: { giacenze: true },
    orderBy: { descrizione: "asc" },
    take: 1000,
  });

  return articles
    .map((article) => {
      const available = round2(article.giacenze.reduce((total, item) => total + toNumber(item.quantita_disponibile), 0));
      return {
        id: article.id,
        codice_sku: article.codice_sku,
        descrizione: article.descrizione,
        scorta_minima: article.scorta_minima,
        quantita_disponibile: available,
      };
    })
    .filter((article) => article.quantita_disponibile < Number(article.scorta_minima || 0))
    .slice(0, limit);
}

export async function getBiOverview(prisma) {
  const [
    ledger,
    payables,
    pendingOcr,
    materialRequestsPending,
    materialRequestsApproved,
    failedOutbox,
    understockArticles,
  ] = await Promise.all([
    aggregateLedger(prisma),
    getOpenPayablesSummary(prisma),
    prisma.spesa.count({
      where: {
        logistica_status: {
          in: [
            LogisticaStatus.PENDING_OCR,
            LogisticaStatus.OCR_REVIEW,
            LogisticaStatus.RECONCILIATION_REQUIRED,
          ],
        },
      },
    }),
    prisma.richiestaMateriale.count({ where: { status: "PENDING" } }),
    prisma.richiestaMateriale.count({ where: { status: "APPROVED" } }),
    prisma.outboxEvent.count({ where: { status: OutboxStatus.FAILED } }),
    getUnderstockArticles(prisma, 10),
  ]);

  const margin = round2(ledger.receipts - ledger.projectCosts);
  const marginPct = ledger.receipts > 0 ? round2((margin / ledger.receipts) * 100) : null;

  return {
    financials: {
      ricaviIncassati: ledger.receipts,
      costiProgetto: ledger.projectCosts,
      costiOverhead: ledger.overheadCosts,
      fatturePassive: ledger.purchaseInvoices,
      stockValue: ledger.stockValue,
      margine: margin,
      marginePercentuale: marginPct,
    },
    exceptions: {
      pendingOcr,
      materialRequestsPending,
      materialRequestsApproved,
      outboxFailed: failedOutbox,
      payables,
      understockArticles,
    },
  };
}

export async function getBiJobCosting(prisma, { cantiereId = null } = {}) {
  const normalizedCantiereId = Number(cantiereId);
  const where = {
    allocation_scope: CostAllocationScope.PROJECT,
    ...(Number.isInteger(normalizedCantiereId) && normalizedCantiereId > 0
      ? { cantiere_id: normalizedCantiereId }
      : {}),
    entry_type: {
      in: [
        LEDGER_ENTRY_TYPES.LABOR_COST,
        LEDGER_ENTRY_TYPES.MATERIAL_COST,
        LEDGER_ENTRY_TYPES.EXPENSE_COST,
        LEDGER_ENTRY_TYPES.RECEIPT_IN,
      ],
    },
  };

  const rows = await prisma.ledgerEntry.groupBy({
    by: ["cantiere_id", "task_id", "entry_type"],
    where: {
      status: LedgerEntryStatus.POSTED,
      ...where,
    },
    _sum: { amount: true },
  });

  const cantiereIds = [...new Set(rows.map((row) => row.cantiere_id).filter(Boolean))];
  const cantieri = cantiereIds.length
    ? await prisma.cantiere.findMany({
        where: { id: { in: cantiereIds } },
        select: { id: true, nome: true, valore_contratto: true },
      })
    : [];
  const cantieriById = new Map(cantieri.map((cantiere) => [cantiere.id, cantiere]));

  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.cantiere_id ?? "none"}:${row.task_id ?? "none"}`;
    const current = grouped.get(key) ?? {
      cantiere_id: row.cantiere_id,
      cantiere_nome: cantieriById.get(row.cantiere_id)?.nome ?? null,
      task_id: row.task_id,
      ricavi: 0,
      costoManodopera: 0,
      costoMateriali: 0,
      costoSpese: 0,
    };
    const amount = round2(toNumber(row._sum?.amount));
    if (row.entry_type === LEDGER_ENTRY_TYPES.RECEIPT_IN) current.ricavi = round2(current.ricavi + amount);
    if (row.entry_type === LEDGER_ENTRY_TYPES.LABOR_COST) current.costoManodopera = round2(current.costoManodopera + amount);
    if (row.entry_type === LEDGER_ENTRY_TYPES.MATERIAL_COST) current.costoMateriali = round2(current.costoMateriali + amount);
    if (row.entry_type === LEDGER_ENTRY_TYPES.EXPENSE_COST) current.costoSpese = round2(current.costoSpese + amount);
    grouped.set(key, current);
  }

  const items = [...grouped.values()].map((item) => {
    const costoTotale = round2(item.costoManodopera + item.costoMateriali + item.costoSpese);
    const margine = round2(item.ricavi - costoTotale);
    return {
      ...item,
      costoTotale,
      margine,
      marginePercentuale: item.ricavi > 0 ? round2((margine / item.ricavi) * 100) : null,
    };
  });

  return {
    items,
    summary: {
      ricavi: round2(items.reduce((total, item) => total + item.ricavi, 0)),
      costoManodopera: round2(items.reduce((total, item) => total + item.costoManodopera, 0)),
      costoMateriali: round2(items.reduce((total, item) => total + item.costoMateriali, 0)),
      costoSpese: round2(items.reduce((total, item) => total + item.costoSpese, 0)),
      costoTotale: round2(items.reduce((total, item) => total + item.costoTotale, 0)),
      margine: round2(items.reduce((total, item) => total + item.margine, 0)),
    },
  };
}

export async function getDataQuality(prisma) {
  const [
    users,
    suppliers,
    unclassifiedExpenses,
    pendingOcrExpenses,
    disconnectedDocuments,
    articlesWithoutStock,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { employee: { isNot: null } },
      include: { employee: { select: { id: true, nome: true, cognome: true, ruolo: true } } },
      take: 1000,
    }),
    prisma.fornitore.findMany({
      where: { partita_iva_normalizzata: { not: null } },
      select: { id: true, ragione_sociale: true, partita_iva: true, partita_iva_normalizzata: true },
      take: 2000,
    }),
    prisma.spesa.findMany({
      where: {
        OR: [
          { cost_category: "UNKNOWN" },
          { allocation_scope: "REVIEW" },
        ],
      },
      select: {
        id: true,
        importo: true,
        descrizione: true,
        fonte: true,
        cost_category: true,
        allocation_scope: true,
        logistica_status: true,
      },
      orderBy: { timestamp_utc: "desc" },
      take: 50,
    }),
    prisma.spesa.findMany({
      where: {
        logistica_status: {
          in: [
            LogisticaStatus.PENDING_OCR,
            LogisticaStatus.OCR_REVIEW,
            LogisticaStatus.RECONCILIATION_REQUIRED,
          ],
        },
      },
      select: { id: true, importo: true, descrizione: true, fonte: true, logistica_status: true, fattura_rif: true },
      orderBy: { timestamp_utc: "desc" },
      take: 50,
    }),
    prisma.document.findMany({
      where: {
        spese_collegate: { none: {} },
        movimenti_magazzino: { none: {} },
        fatture: { none: {} },
        fattura_acquisto: { is: null },
      },
      select: { id: true, name: true, tag: true, created_at: true, cantiere_id: true },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.articolo.findMany({
      where: { giacenze: { none: {} } },
      select: { id: true, codice_sku: true, descrizione: true, scorta_minima: true },
      orderBy: { descrizione: "asc" },
      take: 50,
    }),
  ]);

  const roleMismatches = users
    .map((user) => {
      const userRole = String(user.role ?? "").trim().toUpperCase();
      const employeeRole = String(user.employee?.ruolo ?? "").trim().toUpperCase();
      if (!userRole || !employeeRole || userRole === employeeRole) return null;
      return {
        user_id: user.id,
        username: user.username,
        user_role: user.role,
        employee_id: user.employee.id,
        employee_name: `${user.employee.nome ?? ""} ${user.employee.cognome ?? ""}`.trim(),
        employee_role: user.employee.ruolo,
      };
    })
    .filter(Boolean);

  const suppliersByVat = suppliers.reduce((map, supplier) => {
    const key = supplier.partita_iva_normalizzata;
    if (!key) return map;
    const list = map.get(key) ?? [];
    list.push(supplier);
    map.set(key, list);
    return map;
  }, new Map());

  const duplicateSuppliers = [...suppliersByVat.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([partita_iva_normalizzata, list]) => ({ partita_iva_normalizzata, suppliers: list }))
    .slice(0, 50);

  const understockArticles = await getUnderstockArticles(prisma, 50);

  return {
    summary: {
      roleMismatches: roleMismatches.length,
      duplicateSuppliers: duplicateSuppliers.length,
      unclassifiedExpenses: unclassifiedExpenses.length,
      pendingOcrExpenses: pendingOcrExpenses.length,
      disconnectedDocuments: disconnectedDocuments.length,
      articlesWithoutStock: articlesWithoutStock.length,
      understockArticles: understockArticles.length,
    },
    roleMismatches,
    duplicateSuppliers,
    unclassifiedExpenses,
    pendingOcrExpenses,
    disconnectedDocuments,
    articlesWithoutStock,
    understockArticles,
  };
}
