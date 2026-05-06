import pkg from "@prisma/client";
import { getDb } from "../../db/index.js";
import { LogisticaStatus, ValidationStatus } from "../../constants.js";
import { round2, toNumber } from "../../utils/helpers.js";

const { Prisma } = pkg;

function parseOptionalId(value) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildCostWhere(cantiereId, taskId) {
  return {
    cantiere_id: cantiereId,
    ...(taskId ? { task_id: taskId } : {}),
  };
}

function getEntryHourlyCost(entry) {
  return toNumber(entry?.report?.employee?.tariffe?.[0]?.costo_orario);
}

function buildMoneyMap(rows, getAmount) {
  const map = new Map();

  for (const row of rows ?? []) {
    const cantiereId = parseOptionalId(row?.cantiere_id);
    if (!cantiereId) continue;
    map.set(cantiereId, round2(toNumber(getAmount(row))));
  }

  return map;
}

function buildKeyedMoneyMap(rows, keyName, getAmount) {
  const map = new Map();

  for (const row of rows ?? []) {
    const key = parseOptionalId(row?.[keyName]);
    if (!key) continue;
    map.set(key, round2(toNumber(getAmount(row))));
  }

  return map;
}

function buildContractTotal(cantiere) {
  return round2(toNumber(cantiere?.valore_contratto ?? cantiere?.budget));
}

function buildApprovedExpenseCostWhere(baseWhere = {}) {
  return {
    ...baseWhere,
    stato_validazione: ValidationStatus.APPROVED,
    OR: [{ fonte: null }, { fonte: { not: "MAGAZZINO" } }],
    NOT: {
      AND: [
        { fonte: "IMPORT_GENYA" },
        { logistica_status: LogisticaStatus.LOADED_TO_WAREHOUSE },
      ],
    },
  };
}

export function buildMultiProjectFinancialsMap(
  cantieri,
  {
    laborRows = [],
    materialRows = [],
    expenseRows = [],
    billedRows = [],
    collectedRows = [],
  } = {}
) {
  const laborMap = buildMoneyMap(laborRows, (row) => row.costo_manodopera);
  const materialMap = buildMoneyMap(materialRows, (row) => row._sum?.valore_totale);
  const expenseMap = buildMoneyMap(expenseRows, (row) => row._sum?.importo);
  const billedMap = buildMoneyMap(billedRows, (row) => row._sum?.importo_totale);
  const collectedMap = buildMoneyMap(collectedRows, (row) => row._sum?.importo_totale);

  return Object.fromEntries(
    (cantieri ?? []).map((cantiere) => {
      const totaleContratto = buildContractTotal(cantiere);
      const costoManodopera = laborMap.get(cantiere.id) ?? 0;
      const costoMateriali = materialMap.get(cantiere.id) ?? 0;
      const costoSpese = expenseMap.get(cantiere.id) ?? 0;
      const costoTotale = round2(costoManodopera + costoMateriali + costoSpese);
      const totaleFatturato = billedMap.get(cantiere.id) ?? 0;
      const totaleIncassato = collectedMap.get(cantiere.id) ?? 0;
      const ricavoPrevisto = totaleContratto;
      const margine = round2(ricavoPrevisto - costoTotale);
      const burnRate = ricavoPrevisto > 0 ? round2(costoTotale / ricavoPrevisto) : 0;
      const cpi = costoTotale > 0 ? round2(ricavoPrevisto / costoTotale) : null;

      return [
        cantiere.id,
        {
          costoManodopera,
          costoMateriali,
          costoSpese,
          costoTotale,
          totaleContratto,
          ricavoPrevisto,
          totaleFatturato,
          totaleIncassato,
          ricaviFatturati: totaleFatturato,
          ricaviReali: totaleIncassato,
          daFatturare: round2(totaleContratto - totaleFatturato),
          margine,
          burnRate,
          cpi,
          marginePrevisto: round2(totaleContratto - costoTotale),
          margineFatturato: round2(totaleFatturato - costoTotale),
          margineIncassato: round2(totaleIncassato - costoTotale),
        },
      ];
    })
  );
}

async function getMultiProjectLaborCosts(prismaClient, cantiereIds) {
  if (cantiereIds.length === 0) return [];

  return prismaClient.$queryRaw(
    Prisma.sql`
      WITH latest_tariffe AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT
            employee_id,
            costo_orario,
            ROW_NUMBER() OVER (
              PARTITION BY employee_id
              ORDER BY valido_dal DESC, id DESC
            ) AS rn
          FROM "Tariffa"
          WHERE employee_id IS NOT NULL
        ) ranked_tariffe
        WHERE rn = 1
      )
      SELECT
        re.cantiere_id,
        COALESCE(SUM(COALESCE(re.ore_lavorate, 0) * COALESCE(lt.costo_orario, 0)), 0) AS costo_manodopera
      FROM "ReportEntry" re
      INNER JOIN "Report" r ON r.id = re.report_id
      LEFT JOIN latest_tariffe lt ON lt.employee_id = r.employee_id
      WHERE re.cantiere_id IN (${Prisma.join(cantiereIds)})
        AND re.stato_validazione = ${ValidationStatus.APPROVED}
      GROUP BY re.cantiere_id
    `
  );
}

export async function getMultiProjectFinancials(prismaClient, cantiereIds, baseCantieri = null) {
  const normalizedIds = [...new Set((cantiereIds ?? []).map(parseOptionalId).filter(Boolean))];
  if (normalizedIds.length === 0) return {};

  const cantieri = baseCantieri ?? await prismaClient.cantiere.findMany({
    where: { id: { in: normalizedIds } },
    select: {
      id: true,
      nome: true,
      budget: true,
      valore_contratto: true,
    },
  });

  const [laborRows, materialRows, expenseRows, billedRows, collectedRows] = await Promise.all([
    getMultiProjectLaborCosts(prismaClient, normalizedIds),
    prismaClient.movimentoMagazzino.groupBy({
      by: ["cantiere_id"],
      where: {
        cantiere_id: { in: normalizedIds },
        tipo_movimento: "SCARICO_CANTIERE",
      },
      _sum: { valore_totale: true },
    }),
    prismaClient.spesa.groupBy({
      by: ["cantiere_id"],
      where: buildApprovedExpenseCostWhere({
        cantiere_id: { in: normalizedIds },
      }),
      _sum: { importo: true },
    }),
    prismaClient.fattura.groupBy({
      by: ["cantiere_id"],
      where: {
        cantiere_id: { in: normalizedIds },
        stato: { in: ["ISSUED", "PAID"] },
      },
      _sum: { importo_totale: true },
    }),
    prismaClient.fattura.groupBy({
      by: ["cantiere_id"],
      where: {
        cantiere_id: { in: normalizedIds },
        stato: "PAID",
      },
      _sum: { importo_totale: true },
    }),
  ]);

  return buildMultiProjectFinancialsMap(cantieri, {
    laborRows,
    materialRows,
    expenseRows,
    billedRows,
    collectedRows,
  });
}

async function getProjectBillingSummary(prisma, cantiereId) {
  const [cantiere, billedAgg, collectedAgg] = await Promise.all([
    prisma.cantiere.findUnique({
      where: { id: cantiereId },
      select: {
        id: true,
        budget: true,
        valore_contratto: true,
      },
    }),
    prisma.fattura.aggregate({
      where: {
        cantiere_id: cantiereId,
        stato: { in: ["ISSUED", "PAID"] },
      },
      _sum: { importo_totale: true },
    }),
    prisma.fattura.aggregate({
      where: {
        cantiere_id: cantiereId,
        stato: "PAID",
      },
      _sum: { importo_totale: true },
    }),
  ]);

  const totaleContratto = round2(toNumber(cantiere?.valore_contratto ?? cantiere?.budget));
  const totaleFatturato = round2(toNumber(billedAgg._sum.importo_totale));
  const totaleIncassato = round2(toNumber(collectedAgg._sum.importo_totale));

  return {
    totaleContratto,
    totaleFatturato,
    totaleIncassato,
    ricaviFatturati: totaleFatturato,
    ricaviReali: totaleIncassato,
    daFatturare: round2(totaleContratto - totaleFatturato),
  };
}

/**
 * Calcola il costo reale operativo di un cantiere o di un singolo task.
 *
 * Nota: le spese generate dal magazzino hanno fonte MAGAZZINO e vengono escluse
 * dai costi extra per evitare doppio conteggio con MovimentoMagazzino.
 */
export async function calculateTrueCost(cantiere_id, task_id = null) {
  const prisma = getDb();
  const cantiereId = parseOptionalId(cantiere_id);
  const taskId = parseOptionalId(task_id);

  if (!cantiereId) {
    throw new Error("cantiere_id non valido per il calcolo costi.");
  }

  const baseWhere = buildCostWhere(cantiereId, taskId);

  const [entries, materialAgg, expenseAgg] = await Promise.all([
    prisma.reportEntry.findMany({
      where: {
        ...baseWhere,
        stato_validazione: ValidationStatus.APPROVED,
      },
      select: {
        ore_lavorate: true,
        report: {
          select: {
            employee: {
              select: {
                tariffe: {
                  orderBy: { valido_dal: "desc" },
                  take: 1,
                  select: { costo_orario: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.movimentoMagazzino.aggregate({
      where: {
        ...baseWhere,
        tipo_movimento: "SCARICO_CANTIERE",
      },
      _sum: { valore_totale: true },
    }),
    prisma.spesa.aggregate({
      where: buildApprovedExpenseCostWhere({
        ...baseWhere,
      }),
      _sum: { importo: true },
    }),
  ]);

  const costoManodopera = round2(
    entries.reduce((sum, entry) => sum + toNumber(entry.ore_lavorate) * getEntryHourlyCost(entry), 0)
  );
  const costoMateriali = round2(toNumber(materialAgg._sum.valore_totale));
  const costoSpese = round2(toNumber(expenseAgg._sum.importo));
  const costoTotale = round2(costoManodopera + costoMateriali + costoSpese);

  return {
    costoManodopera,
    costoMateriali,
    costoSpese,
    costoTotale,
  };
}

async function getTaskLaborCosts(prismaClient, cantiereId, taskIds) {
  if (taskIds.length === 0) return [];

  return prismaClient.$queryRaw(
    Prisma.sql`
      WITH latest_tariffe AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT
            employee_id,
            costo_orario,
            ROW_NUMBER() OVER (
              PARTITION BY employee_id
              ORDER BY valido_dal DESC, id DESC
            ) AS rn
          FROM "Tariffa"
          WHERE employee_id IS NOT NULL
        ) ranked_tariffe
        WHERE rn = 1
      )
      SELECT
        re.task_id,
        COALESCE(SUM(COALESCE(re.ore_lavorate, 0) * COALESCE(lt.costo_orario, 0)), 0) AS costo_manodopera
      FROM "ReportEntry" re
      INNER JOIN "Report" r ON r.id = re.report_id
      LEFT JOIN latest_tariffe lt ON lt.employee_id = r.employee_id
      WHERE re.cantiere_id = ${cantiereId}
        AND re.task_id IN (${Prisma.join(taskIds)})
        AND re.stato_validazione = ${ValidationStatus.APPROVED}
      GROUP BY re.task_id
    `
  );
}

export async function getTaskCostsMap(cantiere_id, taskIds, prismaClient = getDb()) {
  const cantiereId = parseOptionalId(cantiere_id);
  const normalizedTaskIds = [...new Set((taskIds ?? []).map(parseOptionalId).filter(Boolean))];
  if (!cantiereId || normalizedTaskIds.length === 0) return new Map();

  const [laborRows, materialRows, expenseRows] = await Promise.all([
    getTaskLaborCosts(prismaClient, cantiereId, normalizedTaskIds),
    prismaClient.movimentoMagazzino.groupBy({
      by: ["task_id"],
      where: {
        cantiere_id: cantiereId,
        task_id: { in: normalizedTaskIds },
        tipo_movimento: "SCARICO_CANTIERE",
      },
      _sum: { valore_totale: true },
    }),
    prismaClient.spesa.groupBy({
      by: ["task_id"],
      where: buildApprovedExpenseCostWhere({
        cantiere_id: cantiereId,
        task_id: { in: normalizedTaskIds },
      }),
      _sum: { importo: true },
    }),
  ]);

  const laborMap = buildKeyedMoneyMap(laborRows, "task_id", (row) => row.costo_manodopera);
  const materialMap = buildKeyedMoneyMap(materialRows, "task_id", (row) => row._sum?.valore_totale);
  const expenseMap = buildKeyedMoneyMap(expenseRows, "task_id", (row) => row._sum?.importo);

  return new Map(normalizedTaskIds.map((taskId) => {
    const costoManodopera = laborMap.get(taskId) ?? 0;
    const costoMateriali = materialMap.get(taskId) ?? 0;
    const costoSpese = expenseMap.get(taskId) ?? 0;
    const costoTotale = round2(costoManodopera + costoMateriali + costoSpese);

    return [taskId, {
      costoManodopera,
      costoMateriali,
      costoSpese,
      costoTotale,
    }];
  }));
}

export async function getProjectFinancials(cantiere_id) {
  const prisma = getDb();
  const cantiereId = parseOptionalId(cantiere_id);

  if (!cantiereId) {
    throw new Error("cantiere_id non valido per il calcolo finanziario.");
  }

  const [costs, billing] = await Promise.all([
    calculateTrueCost(cantiereId),
    getProjectBillingSummary(prisma, cantiereId),
  ]);

  return {
    ...costs,
    ...billing,
    marginePrevisto: round2(billing.totaleContratto - costs.costoTotale),
    margineFatturato: round2(billing.totaleFatturato - costs.costoTotale),
    margineIncassato: round2(billing.totaleIncassato - costs.costoTotale),
  };
}
