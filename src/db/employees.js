import { getDb } from './client.js';
import { parseDateOnly } from './date.js';
import { decimalOrNull } from './shared.js';

export async function findEmployeeByTelegramId(telegramId) {
  return getDb().employee.findUnique({ where: { telegram_id: BigInt(telegramId) } });
}

export async function createEmployee(telegramId, chatId) {
  return getDb().employee.create({
    data: {
      telegram_id: telegramId ? BigInt(telegramId) : null,
      chat_id: chatId ? BigInt(chatId) : null,
      attivo: 1,
      stato_registrazione: 'in_attesa_nome',
      gdpr_accettato: 0,
    },
  });
}

export async function updateEmployee(id, fields) {
  if (Object.keys(fields).length === 0) return;

  const data = { ...fields };
  if (data.telegram_id) data.telegram_id = BigInt(data.telegram_id);
  if (data.chat_id) data.chat_id = BigInt(data.chat_id);

  await getDb().employee.update({
    where: { id },
    data,
  });
}

export async function listEmployees() {
  return getDb().employee.findMany();
}

export async function employeeHasTariffa(employeeId) {
  const count = await getDb().tariffa.count({ where: { employee_id: employeeId } });
  return count > 0;
}

export async function listEmployeesWithPendingDrafts() {
  return getDb().employee.findMany({
    where: {
      OR: [
        { pending_json: { not: null, not: "" } },
        { pending_text: { not: null, not: "" } },
      ],
    },
  });
}

export async function getEmployeesWithoutReport(reportDate) {
  const prisma = getDb();
  const [allEmployees, reports] = await Promise.all([
    prisma.employee.findMany({
      where: { attivo: 1, chat_id: { not: null } },
    }),
    prisma.report.findMany({
      where: { report_date: parseDateOnly(reportDate) },
      select: { employee_id: true },
    }),
  ]);

  const reportedIds = new Set(reports.map((report) => report.employee_id));
  return allEmployees.filter((employee) => !reportedIds.has(employee.id));
}

export async function createTariffa({ employee_id, costo_orario, valido_dal }) {
  return getDb().tariffa.create({
    data: {
      employee_id,
      costo_orario: decimalOrNull(costo_orario),
      valido_dal: parseDateOnly(valido_dal),
    },
  });
}
