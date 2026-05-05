import { getDb } from "../../db/index.js";
import { ValidationStatus } from "../../constants.js";
import { round2, toNumber } from "../../utils/helpers.js";

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
      where: {
        ...baseWhere,
        stato_validazione: ValidationStatus.APPROVED,
        OR: [{ fonte: null }, { fonte: { not: "MAGAZZINO" } }],
      },
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
