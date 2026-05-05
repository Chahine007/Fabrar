import { getDb, formatDateOnly } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { formatEmployeeName } from "../utils/helpers.js";
import { round2 } from "../utils/helpers.js";
import { calculateTrueCost } from "../domain/finance/financeService.js";

const TASK_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WORKER"];

const TASK_STATUS_LABELS = {
  TODO: "Da Fare",
  IN_PROGRESS: "In Corso",
  DONE: "Completato",
};

const TASK_PRIORITY_LABELS = {
  LOW: "Bassa",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Critica",
};

function mapTask(task) {
  const assigneeName = task.assignee_id
    ? formatEmployeeName(task.assignee, task.assignee_id)
    : "Non Assegnato";

  return {
    id: task.id,
    cantiere_id: task.cantiere_id,
    title: task.title,
    description: task.description,
    status: TASK_STATUS_LABELS[task.status] ?? task.status,
    status_code: task.status,
    priority: TASK_PRIORITY_LABELS[task.priority] ?? task.priority,
    priority_code: task.priority,
    assignee_id: task.assignee_id,
    assignee: assigneeName,
    assignee_employee: task.assignee
      ? {
          id: task.assignee.id,
          nome: task.assignee.nome,
          cognome: task.assignee.cognome,
          ruolo: task.assignee.ruolo,
        }
      : null,
    due: formatDateOnly(task.due_date) ?? "-",
    due_date: task.due_date,
    budget_stimato: task.budget_stimato == null ? null : Number(task.budget_stimato),
    costo_previsto: task.costo_previsto == null ? null : Number(task.costo_previsto),
    created_at: task.created_at,
    updated_at: task.updated_at,
    cantiere: task.cantiere
      ? {
          id: task.cantiere.id,
          nome: task.cantiere.nome,
        }
      : null,
  };
}

async function mapTaskWithCosts(task) {
  const mappedTask = mapTask(task);
  const costs = await calculateTrueCost(task.cantiere_id, task.id);

  return {
    ...mappedTask,
    ...costs,
    deltaBudget:
      mappedTask.budget_stimato == null
        ? null
        : round2(mappedTask.budget_stimato - costs.costoTotale),
  };
}

async function ensureCantiereExists(prisma, cantiereId) {
  const cantiere = await prisma.cantiere.findUnique({
    where: { id: cantiereId },
    select: { id: true },
  });

  return Boolean(cantiere);
}

async function ensureEmployeeExists(prisma, employeeId) {
  if (employeeId == null) return true;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, attivo: true },
  });

  return Boolean(employee && employee.attivo === 1);
}

function buildTaskInclude() {
  return {
    cantiere: {
      select: {
        id: true,
        nome: true,
      },
    },
    assignee: {
      select: {
        id: true,
        nome: true,
        cognome: true,
        ruolo: true,
      },
    },
  };
}

export const getAllTasks = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const { cantiere_id, status, assignee_id, priority } = req.query;

  const tasks = await prisma.task.findMany({
    where: {
      ...(cantiere_id != null ? { cantiere_id: Number(cantiere_id) } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignee_id != null ? { assignee_id: Number(assignee_id) } : {}),
    },
    include: buildTaskInclude(),
    orderBy: [{ cantiere_id: "asc" }, { updated_at: "desc" }, { id: "desc" }],
  });

  if (cantiere_id == null) {
    return res.json(tasks.map(mapTask));
  }

  const tasksWithCosts = await Promise.all(tasks.map(mapTaskWithCosts));
  res.json(tasksWithCosts);
});

export const createTask = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const {
    cantiere_id,
    title,
    description = null,
    status = "TODO",
    priority = "MEDIUM",
    due_date = null,
    assignee_id = null,
    budget_stimato = null,
    costo_previsto = null,
  } = req.body;

  const cantiereId = Number(cantiere_id);
  if (!(await ensureCantiereExists(prisma, cantiereId))) {
    return res.status(404).json({ error: "Cantiere non trovato." });
  }

  if (!(await ensureEmployeeExists(prisma, assignee_id))) {
    return res.status(404).json({ error: "Dipendente assegnatario non trovato o inattivo." });
  }

  const task = await prisma.task.create({
    data: {
      cantiere_id: cantiereId,
      title,
      description,
      status,
      priority,
      due_date,
      assignee_id,
      budget_stimato,
      costo_previsto,
    },
    include: buildTaskInclude(),
  });

  res.status(201).json(mapTask(task));
});

export const updateTask = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const taskId = Number(req.params.taskId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: buildTaskInclude(),
  });

  if (!task) {
    return res.status(404).json({ error: "Task non trovato." });
  }

  const isWorker = req.user?.role === "WORKER";
  const nextData = isWorker
    ? Object.fromEntries(Object.entries(req.body).filter(([key]) => key === "status"))
    : Object.fromEntries(
        Object.entries(req.body).filter(([key]) =>
          ["cantiere_id", "title", "description", "status", "priority", "due_date", "assignee_id", "budget_stimato", "costo_previsto"].includes(key)
        )
      );

  if (isWorker && nextData.status == null) {
    return res.status(403).json({ error: "I WORKER possono modificare solo lo stato del task." });
  }

  if (nextData.cantiere_id != null) {
    const cantiereId = Number(nextData.cantiere_id);
    if (!(await ensureCantiereExists(prisma, cantiereId))) {
      return res.status(404).json({ error: "Cantiere non trovato." });
    }
    nextData.cantiere_id = cantiereId;
  }

  if (Object.prototype.hasOwnProperty.call(nextData, "assignee_id")) {
    if (!(await ensureEmployeeExists(prisma, nextData.assignee_id))) {
      return res.status(404).json({ error: "Dipendente assegnatario non trovato o inattivo." });
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: nextData,
    include: buildTaskInclude(),
  });

  res.json(mapTask(updatedTask));
});

export const deleteTask = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const taskId = Number(req.params.taskId);
  const userRole = req.user?.role;

  if (!TASK_ROLES.includes(userRole)) {
    return res.status(403).json({ error: "Accesso negato: privilegi insufficienti" });
  }

  if (userRole === "WORKER") {
    return res.status(403).json({ error: "I WORKER non possono eliminare task esistenti." });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    return res.status(404).json({ error: "Task non trovato." });
  }

  await prisma.task.delete({
    where: { id: taskId },
  });

  res.json({ ok: true, taskId });
});
