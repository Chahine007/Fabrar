import { ValidationStatus } from '../constants.js';
import { getDb } from './client.js';
import { decimalOrNull } from './shared.js';
import { cantiereExists } from './cantieri.js';

export async function insertSpesa(employeeId, cantiereId, importo, fornitore, descrizione, fonte = "TELEGRAM", fattura_rif = null, extra = null) {
  const prisma = getDb();
  if (typeof importo !== "number" || importo <= 0) {
    throw new Error("L'importo deve essere maggiore di zero.");
  }

  let pricebook_id = extra?.pricebook_id ?? null;
  let quantita = extra?.quantita ?? null;
  let stato_validazione = extra?.stato_validazione ?? ValidationStatus.PENDING;
  let wbs_node_id = extra?.wbs_node_id ?? null;
  let task_id = extra?.task_id ?? null;
  let documento_id = extra?.documento_id ?? null;

  if (pricebook_id != null && quantita == null) {
    quantita = 1;
  }

  const isValidCantiere = await cantiereExists(cantiereId);
  if (!isValidCantiere) throw new Error("Cantiere non valido o inattivo.");

  if (wbs_node_id == null) {
    const rootWbs = await prisma.wbsNode.findFirst({
      where: { cantiere_id: cantiereId, parent_id: null },
    });
    wbs_node_id = rootWbs ? rootWbs.id : null;
  }

  const created = await prisma.spesa.create({
    data: {
      timestamp_utc: new Date(),
      employee_id: employeeId,
      cantiere_id: cantiereId,
      wbs_node_id,
      task_id,
      importo: decimalOrNull(importo),
      fornitore,
      descrizione,
      fonte,
      fattura_rif,
      documento_id,
      pricebook_id,
      quantita: decimalOrNull(quantita),
      stato_validazione,
    },
  });

  return created.id;
}

export async function getSpesaById(id) {
  return getDb().spesa.findUnique({ where: { id } });
}

export async function updateSpesa(id, fields) {
  const prisma = getDb();
  const allowed = ["timestamp_utc", "employee_id", "cantiere_id", "importo", "fornitore", "descrizione", "fonte", "fattura_rif", "pricebook_id", "quantita", "stato_validazione", "input_method", "admin_note", "modified_by_admin_at", "wbs_node_id", "task_id", "documento_id"];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.timestamp_utc) data.timestamp_utc = new Date(data.timestamp_utc);
  if (data.importo !== undefined) data.importo = decimalOrNull(data.importo);
  if (data.quantita !== undefined) data.quantita = decimalOrNull(data.quantita);
  if (data.modified_by_admin_at) data.modified_by_admin_at = new Date(data.modified_by_admin_at);
  if (Object.keys(data).length > 0) {
    if (data.cantiere_id && !data.wbs_node_id) {
      const wbs = await prisma.wbsNode.findFirst({
        where: { cantiere_id: data.cantiere_id, parent_id: null },
      });
      data.wbs_node_id = wbs ? wbs.id : null;
    }

    await prisma.spesa.update({ where: { id }, data });
  }
}

export async function deleteSpesaById(id) {
  await getDb().spesa.delete({ where: { id } });
}
