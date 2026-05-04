import { getDb, formatDateOnly, parseDateOnly } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeOptionalText } from "../utils/helpers.js";

function mapCreatedEmployeeResponse(employee, tariffa) {
  return {
    ...employee,
    telegram_id: employee.telegram_id?.toString() ?? null,
    chat_id: employee.chat_id?.toString() ?? null,
    email: employee.email_personale ?? null,
    hourly_rate: tariffa ? Number(tariffa.costo_orario) : null,
  };
}

export const createEmployee = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { firstName, lastName, role, hourly_rate, email } = req.body;

  const today = parseDateOnly(formatDateOnly(new Date()));

  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        nome: firstName.trim(),
        cognome: lastName.trim(),
        ruolo: role,
        email_personale: normalizeOptionalText(email),
        attivo: 1,
      },
    });

    let tariffa = null;
    if (hourly_rate != null) {
      tariffa = await tx.tariffa.create({
        data: {
          employee_id: employee.id,
          costo_orario: hourly_rate,
          valido_dal: today,
        },
      });
    }

    return { employee, tariffa };
  });

  res.status(201).json(mapCreatedEmployeeResponse(created.employee, created.tariffa));
});
