import { getDb, formatDateOnly } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { formatEmployeeName } from "../utils/helpers.js";
import { round2 } from "../utils/helpers.js";
import { getTaskCostsMap } from "../domain/finance/financeService.js";
import { canAccessCantiere } from "../domain/shared/accessControl.js";

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

function mapTaskWithCosts(task, costs = null) {
  const mappedTask = mapTask(task);
  const resolvedCosts = costs ?? {
    costoManodopera: 0,
    costoMateriali: 0,
    costoSpese: 0,
    costoTotale: 0,
  };

  return {
    ...mappedTask,
    ...resolvedCosts,
    deltaBudget:
      mappedTask.budget_stimato == null
        ? null
        : round2(mappedTask.budget_stimato - resolvedCosts.costoTotale),
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
  const role = req.user?.role;
  const userId = Number(req.user?.id);
  const employeeId = Number(req.user?.employee_id);
  const requestedCantiereId = cantiere_id != null ? Number(cantiere_id) : null;

  if (requestedCantiereId && !(await canAccessCantiere(prisma, req.user, requestedCantiereId, {
    globalRoles: ["ADMIN", "HR"],
    ownerRoles: ["PROJECT_MANAGER"],
  })) && role !== "WORKER") {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  if (role === "WORKER" && (!Number.isInteger(employeeId) || employeeId <= 0)) {
    return res.status(403).json({ error: "Utente non collegato a un dipendente." });
  }

  const tasks = await prisma.task.findMany({
    where: {
      ...(requestedCantiereId != null ? { cantiere_id: requestedCantiereId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(role === "WORKER" ? { assignee_id: employeeId } : assignee_id != null ? { assignee_id: Number(assignee_id) } : {}),
      ...(role === "PROJECT_MANAGER" && !requestedCantiereId
        ? { cantiere: { OR: [{ pm_id: userId }, { site_manager_id: userId }] } }
        : {}),
    },
    include: buildTaskInclude(),
    orderBy: [{ cantiere_id: "asc" }, { updated_at: "desc" }, { id: "desc" }],
  });

  if (cantiere_id == null) {
    return res.json(tasks.map(mapTask));
  }

  const costsMap = await getTaskCostsMap(Number(cantiere_id), tasks.map((task) => task.id), prisma);
  const tasksWithCosts = tasks.map((task) => mapTaskWithCosts(task, costsMap.get(task.id)));
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

  if (req.user?.role === "WORKER") {
    return res.status(403).json({ error: "I WORKER non possono creare task." });
  }

  const cantiereId = Number(cantiere_id);
  if (!(await ensureCantiereExists(prisma, cantiereId))) {
    return res.status(404).json({ error: "Cantiere non trovato." });
  }
  if (!(await canAccessCantiere(prisma, req.user, cantiereId, {
    globalRoles: ["ADMIN", "HR"],
    ownerRoles: ["PROJECT_MANAGER"],
  }))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
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
  if (isWorker) {
    const employeeId = Number(req.user?.employee_id);
    if (!Number.isInteger(employeeId) || task.assignee_id !== employeeId) {
      return res.status(403).json({ error: "I WORKER possono modificare solo task assegnati a loro." });
    }
  } else if (!(await canAccessCantiere(prisma, req.user, task.cantiere_id, {
    globalRoles: ["ADMIN", "HR"],
    ownerRoles: ["PROJECT_MANAGER"],
  }))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

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
    if (cantiereId !== task.cantiere_id && req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Solo ADMIN può spostare task tra cantieri." });
    }
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
    select: { id: true, cantiere_id: true },
  });

  if (!task) {
    return res.status(404).json({ error: "Task non trovato." });
  }
  if (!(await canAccessCantiere(prisma, req.user, task.cantiere_id, {
    globalRoles: ["ADMIN", "HR"],
    ownerRoles: ["PROJECT_MANAGER"],
  }))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  await prisma.task.delete({
    where: { id: taskId },
  });

  res.json({ ok: true, taskId });
});
