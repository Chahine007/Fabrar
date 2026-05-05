import { ValidationStatus } from '../constants.js';
import { getDb } from './client.js';
import { decimalOrNull, decimalToNumber } from './shared.js';

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

  const [entries, spese] = await Promise.all([
    prisma.reportEntry.findMany({
      where: {
        cantiere_id: id,
        stato_validazione: { in: [ValidationStatus.APPROVED] },
        wbs_node_id: { not: null },
      },
      include: {
        report: {
          include: {
            employee: {
              include: { tariffe: { orderBy: { valido_dal: 'desc' }, take: 1 } },
            },
          },
        },
      },
    }),
    prisma.spesa.findMany({
      where: {
        cantiere_id: id,
        wbs_node_id: { not: null },
        NOT: { stato_validazione: ValidationStatus.REJECTED },
      },
    }),
  ]);

  const burnMap = new Map();

  for (const entry of entries) {
    const nodeId = entry.wbs_node_id;
    const ore = entry.ore_lavorate ?? 0;
    const tariffa = decimalToNumber(entry.report?.employee?.tariffe?.[0]?.costo_orario) ?? 0;
    const costo = ore * tariffa;
    const current = burnMap.get(nodeId) ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0 };
    current.ore_tot += ore;
    current.costo_manodopera += costo;
    burnMap.set(nodeId, current);
  }

  for (const spesa of spese) {
    const nodeId = spesa.wbs_node_id;
    const importo = decimalToNumber(spesa.importo) ?? 0;
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
