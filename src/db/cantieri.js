import { DEFAULTS, ValidationStatus } from '../constants.js';
import { getDb } from './client.js';
import { Prisma, decimalOrNull, decimalToNumber, roundMoney } from './shared.js';

export async function cantiereExists(cantiereId) {
  const cantiere = await getDb().cantiere.findFirst({
    where: { id: cantiereId, attivo: 1 },
  });
  return Boolean(cantiere);
}

export async function getCantieriAttivi() {
  return getDb().cantiere.findMany({
    where: { attivo: 1 },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
}

async function getApprovedLaborCostByCantiere(prismaClient, cantiereIds) {
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

function buildStatusMoneyMap(rows, getValue) {
  const map = new Map();

  for (const row of rows ?? []) {
    const cantiereId = Number(row?.cantiere_id);
    if (!Number.isInteger(cantiereId) || cantiereId <= 0) continue;
    map.set(cantiereId, roundMoney(decimalToNumber(getValue(row))));
  }

  return map;
}

export async function getCantieriStatus({ activeOnly = true } = {}, prismaClient = getDb()) {
  const cantieri = await prismaClient.cantiere.findMany({
    ...(activeOnly ? { where: { attivo: 1 } } : {}),
    select: { id: true, nome: true, budget: true },
    orderBy: { nome: 'asc' },
  });

  const cantiereIds = cantieri.map((cantiere) => cantiere.id);
  if (cantiereIds.length === 0) return [];

  const [laborRows, expenseRows] = await Promise.all([
    getApprovedLaborCostByCantiere(prismaClient, cantiereIds),
    prismaClient.spesa.groupBy({
      by: ["cantiere_id"],
      where: {
        cantiere_id: { in: cantiereIds },
        NOT: { stato_validazione: ValidationStatus.REJECTED },
      },
      _sum: { importo: true },
    }),
  ]);

  const laborMap = buildStatusMoneyMap(laborRows, (row) => row.costo_manodopera);
  const expenseMap = buildStatusMoneyMap(expenseRows, (row) => row._sum?.importo);

  return cantieri.map((cantiere) => {
    const costo_manodopera = laborMap.get(cantiere.id) ?? 0;
    const costo_materiali = expenseMap.get(cantiere.id) ?? 0;

    return {
      id: cantiere.id,
      nome: cantiere.nome,
      budget: decimalToNumber(cantiere.budget) || 0,
      costo_manodopera,
      costo_materiali,
      costo_totale: roundMoney(costo_manodopera + costo_materiali),
    };
  });
}

export async function getAllCantieri() {
  const cantieri = await getDb().cantiere.findMany({
    orderBy: [{ attivo: 'desc' }, { id: 'desc' }],
  });

  return cantieri.map((cantiere) => ({
    ...cantiere,
    budget: decimalToNumber(cantiere.budget),
    valore_contratto: decimalToNumber(cantiere.valore_contratto),
    budget_spese: decimalToNumber(cantiere.budget_spese),
  }));
}

export async function createCantiere({ nome, indirizzo, lat, lng, budget, valore_contratto, budget_spese }) {
  const prisma = getDb();
  const cantiere = await prisma.$transaction(async (tx) => {
    const created = await tx.cantiere.create({
      data: {
        nome,
        indirizzo: indirizzo || null,
        lat: lat || null,
        lng: lng || null,
        budget: decimalOrNull(budget),
        valore_contratto: decimalOrNull(valore_contratto),
        budget_spese: decimalOrNull(budget_spese),
        attivo: 1,
      },
    });

    await tx.wbsNode.create({
      data: {
        cantiere_id: created.id,
        nome: DEFAULTS.WBS_ROOT_NAME,
        budget_preventivato: decimalOrNull(budget ?? 0),
      },
    });

    return created;
  });

  return cantiere.id;
}

export async function toggleCantiere(id) {
  const prisma = getDb();
  const numericId = Number(id);
  const cantiere = await prisma.cantiere.findUnique({ where: { id: numericId } });

  if (cantiere) {
    await prisma.cantiere.update({
      where: { id: numericId },
      data: { attivo: cantiere.attivo === 1 ? 0 : 1 },
    });
  }
}

export async function getCantieriConCoordinate() {
  return getDb().cantiere.findMany({
    where: { attivo: 1, lat: { not: null }, lng: { not: null } },
    select: { id: true, nome: true, lat: true, lng: true, raggio_tolleranza: true },
  });
}

export async function updateCantiere(id, fields) {
  const prisma = getDb();
  const allowed = ["nome", "indirizzo", "lat", "lng", "budget", "valore_contratto", "budget_spese", "raggio_tolleranza", "attivo"];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.budget !== undefined) data.budget = decimalOrNull(data.budget);
  if (data.valore_contratto !== undefined) data.valore_contratto = decimalOrNull(data.valore_contratto);
  if (data.budget_spese !== undefined) data.budget_spese = decimalOrNull(data.budget_spese);
  if (Object.keys(data).length > 0) {
    await prisma.cantiere.update({ where: { id }, data });
  }
}
