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
