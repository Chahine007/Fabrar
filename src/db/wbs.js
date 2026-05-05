import { ValidationStatus } from '../constants.js';
import { getDb } from './client.js';
import { Prisma, decimalOrNull, decimalToNumber } from './shared.js';

export async function getWbsNodesByCantiere(cantiereId) {
  return getDb().wbsNode.findMany({
    where: { cantiere_id: Number(cantiereId) },
    orderBy: [{ parent_id: 'asc' }, { id: 'asc' }],
  });
}

export async function createWbsNode({ cantiere_id, nome, budget_preventivato = null, parent_id = null }) {
  return getDb().wbsNode.create({
    data: {
      cantiere_id: Number(cantiere_id),
      nome,
      budget_preventivato: decimalOrNull(budget_preventivato),
      parent_id: parent_id ? Number(parent_id) : null,
    },
  });
}

export async function updateWbsNode(id, fields) {
  const allowed = ['nome', 'budget_preventivato'];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.budget_preventivato !== undefined) data.budget_preventivato = decimalOrNull(data.budget_preventivato);
  if (Object.keys(data).length > 0) {
    await getDb().wbsNode.update({
      where: { id: Number(id) },
      data,
    });
  }
}

export async function deleteWbsNode(id) {
  const prisma = getDb();
  const nodeId = Number(id);
  const [entryCount, spesaCount, childCount] = await Promise.all([
    prisma.reportEntry.count({ where: { wbs_node_id: nodeId } }),
    prisma.spesa.count({ where: { wbs_node_id: nodeId } }),
    prisma.wbsNode.count({ where: { parent_id: nodeId } }),
  ]);

  if (entryCount > 0 || spesaCount > 0) {
    throw new Error(`Impossibile eliminare: il nodo ha ${entryCount} ore e ${spesaCount} spese collegate.`);
  }
  if (childCount > 0) {
    throw new Error(`Impossibile eliminare: il nodo ha ${childCount} sottofasi. Elimina prima le sottofasi.`);
  }

  await prisma.wbsNode.delete({ where: { id: nodeId } });
}

export async function getWbsBurnData(cantiereId) {
  const prisma = getDb();
  const id = Number(cantiereId);

  const [laborRows, spesaRows] = await Promise.all([
    prisma.$queryRaw(
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
          re.wbs_node_id,
          COALESCE(SUM(COALESCE(re.ore_lavorate, 0)), 0) AS ore_tot,
          COALESCE(SUM(COALESCE(re.ore_lavorate, 0) * COALESCE(lt.costo_orario, 0)), 0) AS costo_manodopera
        FROM "ReportEntry" re
        INNER JOIN "Report" r ON r.id = re.report_id
        LEFT JOIN latest_tariffe lt ON lt.employee_id = r.employee_id
        WHERE re.cantiere_id = ${id}
          AND re.stato_validazione = ${ValidationStatus.APPROVED}
          AND re.wbs_node_id IS NOT NULL
        GROUP BY re.wbs_node_id
      `
    ),
    prisma.spesa.groupBy({
      by: ['wbs_node_id'],
      where: {
        cantiere_id: id,
        wbs_node_id: { not: null },
        NOT: { stato_validazione: ValidationStatus.REJECTED },
      },
      _sum: { importo: true },
    }),
  ]);

  const burnMap = new Map();

  for (const row of laborRows) {
    const nodeId = Number(row.wbs_node_id);
    const current = burnMap.get(nodeId) ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0 };
    current.ore_tot += decimalToNumber(row.ore_tot) ?? 0;
    current.costo_manodopera += decimalToNumber(row.costo_manodopera) ?? 0;
    burnMap.set(nodeId, current);
  }

  for (const row of spesaRows) {
    const nodeId = Number(row.wbs_node_id);
    const importo = decimalToNumber(row._sum?.importo) ?? 0;
    const current = burnMap.get(nodeId) ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0 };
    current.costo_materiali += importo;
    burnMap.set(nodeId, current);
  }

  const result = {};
  for (const [nodeId, data] of burnMap.entries()) {
    result[nodeId] = {
      ore_tot: Math.round(data.ore_tot * 100) / 100,
      costo_manodopera: Math.round(data.costo_manodopera * 100) / 100,
      costo_materiali: Math.round(data.costo_materiali * 100) / 100,
      totale: Math.round((data.costo_manodopera + data.costo_materiali) * 100) / 100,
    };
  }

  return result;
}

export async function getWbsFasiAttive(cantiereId) {
  return getDb().wbsNode.findMany({
    where: {
      cantiere_id: Number(cantiereId),
      parent_id: { not: null },
    },
    orderBy: [{ parent_id: 'asc' }, { id: 'asc' }],
    select: { id: true, nome: true, parent_id: true },
  });
}
