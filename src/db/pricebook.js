import { getDb } from './client.js';
import { decimalOrNull, decimalToNumber } from './shared.js';

export async function getPricebookById(id) {
  return getDb().pricebook.findUnique({ where: { id } });
}

export async function listPricebook() {
  const items = await getDb().pricebook.findMany({ orderBy: { nome: 'asc' } });
  return items.map((item) => ({
    ...item,
    costo_unitario: decimalToNumber(item.costo_unitario),
  }));
}

export async function createPricebookItem({ nome, unita = null, costo_unitario }) {
  return getDb().pricebook.create({
    data: {
      nome,
      unita,
      costo_unitario: decimalOrNull(costo_unitario),
    },
  });
}

export async function updatePricebookItem(id, fields) {
  const allowed = ["nome", "unita", "costo_unitario"];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.costo_unitario !== undefined) data.costo_unitario = decimalOrNull(data.costo_unitario);
  if (Object.keys(data).length > 0) {
    await getDb().pricebook.update({ where: { id }, data });
  }
}

export async function deletePricebookItem(id) {
  await getDb().pricebook.delete({ where: { id } });
}
