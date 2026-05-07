import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createDischargeInTransaction } from "../domain/magazzino/warehouseService.js";
import { domainBus, EVENTS } from "../domain/events/domainBus.js";
import { parsePagination, positiveCursor } from "../utils/pagination.js";
import { canAccessCantiere } from "../domain/shared/accessControl.js";
import { writeAuditLog } from "../domain/audit/auditLogService.js";

const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "FULFILLED"];

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function materialRequestInclude() {
  return {
    cantiere: {
      select: {
        id: true,
        nome: true,
        indirizzo: true,
      },
    },
    task: {
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
      },
    },
    richiedente: {
      select: {
        id: true,
        nome: true,
        cognome: true,
        ruolo: true,
      },
    },
    righe: {
      include: {
        articolo: {
          include: {
            fornitore_default: true,
          },
        },
      },
      orderBy: { id: "asc" },
    },
  };
}

function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];

  return lines
    .map((line) => ({
      articolo_id: parsePositiveInt(line?.articolo_id),
      quantita: parsePositiveInt(line?.quantita),
      note: line?.note ? String(line.note).trim() : null,
    }))
    .filter((line) => line.articolo_id && line.quantita);
}

async function ensureRequestInput(prisma, body) {
  const cantiereId = parsePositiveInt(body.cantiere_id);
  const taskId = parsePositiveInt(body.task_id);
  const righe = normalizeLines(body.righe ?? body.lines ?? body.items);
  let task = null;

  if (!cantiereId) {
    throw httpError("cantiere_id obbligatorio o non valido.", 400);
  }

  if (righe.length === 0) {
    throw httpError("La richiesta deve contenere almeno una riga materiale valida.", 400);
  }

  const cantiere = await prisma.cantiere.findUnique({
    where: { id: cantiereId },
    select: { id: true },
  });

  if (!cantiere) {
    throw httpError("Cantiere non trovato.", 404);
  }

  if (taskId) {
    task = await prisma.task.findFirst({
      where: {
        id: taskId,
        cantiere_id: cantiereId,
      },
      select: { id: true, assignee_id: true },
    });

    if (!task) {
      throw httpError("Task non trovato o non appartenente al cantiere selezionato.", 404);
    }
  }

  const uniqueArticleIds = [...new Set(righe.map((line) => line.articolo_id))];
  const articleCount = await prisma.articolo.count({
    where: { id: { in: uniqueArticleIds } },
  });

  if (articleCount !== uniqueArticleIds.length) {
    throw httpError("Uno o più articoli non esistono.", 404);
  }

  return { cantiereId, taskId, task, righe };
}

async function reserveStockForRequest(tx, richiesta) {
  for (const line of richiesta.righe) {
    let remaining = Number(line.quantita);
    const giacenze = await tx.giacenza.findMany({
      where: {
        articolo_id: line.articolo_id,
        quantita_disponibile: { gt: 0 },
      },
      orderBy: { id: "asc" },
    });

    const totalAvailable = giacenze.reduce(
      (sum, giacenza) => sum + Number(giacenza.quantita_disponibile),
      0
    );
    if (totalAvailable < remaining) {
      throw httpError(
        `Giacenza insufficiente per ${line.articolo.codice_sku}: richiesta ${line.quantita}, disponibile ${totalAvailable}.`,
        409
      );
    }

    for (const giacenza of giacenze) {
      if (remaining <= 0) break;

      const available = Number(giacenza.quantita_disponibile);
      const reserved = Math.min(available, remaining);
      const updated = await tx.giacenza.updateMany({
        where: {
          id: giacenza.id,
          quantita_disponibile: { gte: reserved },
        },
        data: {
          quantita_disponibile: { decrement: reserved },
          quantita_riservata: { increment: reserved },
        },
      });
      if (updated.count !== 1) {
        throw httpError(`Giacenza concorrente insufficiente per ${line.articolo.codice_sku}.`, 409);
      }

      await tx.stockReservation.create({
        data: {
          richiesta_id: richiesta.id,
          riga_richiesta_id: line.id,
          giacenza_id: giacenza.id,
          articolo_id: line.articolo_id,
          quantita: reserved,
          status: "ACTIVE",
        },
      });
      remaining -= reserved;
    }
  }
}

async function releaseActiveReservations(tx, requestId) {
  const reservations = await tx.stockReservation.findMany({
    where: { richiesta_id: requestId, status: "ACTIVE" },
  });

  for (const reservation of reservations) {
    const qty = Number(reservation.quantita);
    await tx.giacenza.update({
      where: { id: reservation.giacenza_id },
      data: {
        quantita_disponibile: { increment: qty },
        quantita_riservata: { decrement: qty },
      },
    });
    await tx.stockReservation.update({
      where: { id: reservation.id },
      data: { status: "RELEASED", released_at: new Date() },
    });
  }
}

export const createRequest = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const richiedenteId = parsePositiveInt(req.user?.employee_id);

  if (!richiedenteId) {
    return res.status(400).json({ error: "Utente non collegato a un dipendente." });
  }

  const { cantiereId, taskId, task, righe } = await ensureRequestInput(prisma, req.body);

  if (req.user?.role === "WORKER") {
    if (!taskId || task?.assignee_id !== richiedenteId) {
      return res.status(403).json({ error: "I WORKER possono richiedere materiali solo per task assegnati a loro." });
    }
  } else if (!(await canAccessCantiere(prisma, req.user, cantiereId, {
    globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
    ownerRoles: ["PROJECT_MANAGER"],
  }))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const richiesta = await prisma.$transaction(async (tx) => {
    return tx.richiestaMateriale.create({
      data: {
        cantiere_id: cantiereId,
        task_id: taskId,
        richiedente_id: richiedenteId,
        note: req.body.note ? String(req.body.note).trim() : null,
        righe: {
          create: righe.map((line) => ({
            articolo_id: line.articolo_id,
            quantita: line.quantita,
            note: line.note,
          })),
        },
      },
      include: materialRequestInclude(),
    });
  });

  res.status(201).json(richiesta);
});

export const getRequests = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const role = req.user?.role;
  const employeeId = parsePositiveInt(req.user?.employee_id);
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  const cantiereId = req.query.cantiere_id ? parsePositiveInt(req.query.cantiere_id) : null;
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 250 });
  const cursor = positiveCursor(req.query.cursor);

  if (status && !REQUEST_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Stato richiesta non valido." });
  }

  if (role === "WORKER" && !employeeId) {
    return res.status(403).json({ error: "Utente non collegato a un dipendente." });
  }
  if (role === "PROJECT_MANAGER" && cantiereId && !(await canAccessCantiere(prisma, req.user, cantiereId, {
    globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
    ownerRoles: ["PROJECT_MANAGER"],
  }))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const requests = await prisma.richiestaMateriale.findMany({
    where: {
      ...(role === "WORKER" ? { richiedente_id: employeeId } : {}),
      ...(role === "PROJECT_MANAGER" && !cantiereId
        ? { cantiere: { OR: [{ pm_id: Number(req.user?.id) }, { site_manager_id: Number(req.user?.id) }] } }
        : {}),
      ...(status ? { status } : {}),
      ...(cantiereId ? { cantiere_id: cantiereId } : {}),
    },
    include: materialRequestInclude(),
    orderBy: [{ data_richiesta: "desc" }, { id: "desc" }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: offset }),
  });

  res.json(requests);
});

export const updateRequestStatus = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const requestId = parsePositiveInt(req.params.id);
  const nextStatus = req.body.status ? String(req.body.status).toUpperCase() : null;

  if (!requestId) {
    return res.status(400).json({ error: "ID richiesta non valido." });
  }

  if (!nextStatus || !REQUEST_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: "Stato richiesta non valido." });
  }

  if (nextStatus === "FULFILLED") {
    return res.status(400).json({
      error: "Usa l'endpoint di evasione per impostare una richiesta come FULFILLED.",
    });
  }

  const existing = await prisma.richiestaMateriale.findUnique({
    where: { id: requestId },
    include: {
      righe: {
        include: { articolo: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: "Richiesta materiale non trovata." });
  }
  if (!(await canAccessCantiere(prisma, req.user, existing.cantiere_id, {
    globalRoles: ["ADMIN"],
    ownerRoles: ["PROJECT_MANAGER"],
  }))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }
  if (existing.richiedente_id === parsePositiveInt(req.user?.employee_id) && req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Non puoi approvare o respingere una richiesta creata da te." });
  }
  const canTransition =
    existing.status === "PENDING" ||
    (existing.status === "APPROVED" && nextStatus === "REJECTED");
  if (!canTransition) {
    return res.status(409).json({ error: "Transizione stato richiesta non consentita." });
  }

  const events = [];
  const richiesta = await prisma.$transaction(async (tx) => {
    if (existing.status === "PENDING" && nextStatus === "APPROVED") {
      await reserveStockForRequest(tx, existing);
    }
    if (existing.status === "APPROVED" && nextStatus === "REJECTED") {
      await releaseActiveReservations(tx, requestId);
    }

    const updated = await tx.richiestaMateriale.updateMany({
      where: { id: requestId, status: existing.status },
      data: { status: nextStatus },
    });

    if (updated.count !== 1) {
      throw httpError("La richiesta è già stata aggiornata da un'altra operazione.", 409);
    }

    await writeAuditLog(tx, req.user, {
      entityType: "RichiestaMateriale",
      entityId: requestId,
      action: "MATERIAL_REQUEST_STATUS_CHANGED",
      previousState: { status: existing.status },
      nextState: { status: nextStatus },
    });

    events.push({
      type: EVENTS.MATERIAL_REQUEST_STATUS_CHANGED,
      payload: { requestId, cantiereId: existing.cantiere_id, status: nextStatus },
    });

    return tx.richiestaMateriale.findUnique({
      where: { id: requestId },
      include: materialRequestInclude(),
    });
  });

  for (const event of events) {
    domainBus.emit(event.type, event.payload);
  }

  res.json(richiesta);
});

export const fulfillRequest = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const requestId = parsePositiveInt(req.params.id);
  const userId = parsePositiveInt(req.user?.id);
  const executorEmployeeId = parsePositiveInt(req.user?.employee_id);

  if (!requestId) {
    return res.status(400).json({ error: "ID richiesta non valido." });
  }

  if (!userId) {
    return res.status(401).json({ error: "Utente non identificato per l'operazione." });
  }

  const events = [];
  const result = await prisma.$transaction(async (tx) => {
    const richiesta = await tx.richiestaMateriale.findUnique({
      where: { id: requestId },
      include: {
        righe: {
          include: { articolo: true },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!richiesta) {
      throw httpError("Richiesta materiale non trovata.", 404);
    }

    if (!(await canAccessCantiere(tx, req.user, richiesta.cantiere_id, {
      globalRoles: ["ADMIN", "WAREHOUSEMAN"],
      ownerRoles: ["PROJECT_MANAGER"],
    }))) {
      throw httpError("Accesso negato al cantiere richiesto.", 403);
    }

    if (richiesta.status !== "APPROVED") {
      throw httpError("Solo le richieste APPROVED possono essere evase.", 409);
    }

    const createdMovements = [];
    const createdExpenses = [];
    const expenseEmployeeId = executorEmployeeId ?? richiesta.richiedente_id;

    let reservations = await tx.stockReservation.findMany({
      where: { richiesta_id: requestId, status: "ACTIVE" },
      include: {
        giacenza: true,
        articolo: true,
      },
      orderBy: { id: "asc" },
    });

    if (reservations.length === 0) {
      await reserveStockForRequest(tx, richiesta);
      reservations = await tx.stockReservation.findMany({
        where: { richiesta_id: requestId, status: "ACTIVE" },
        include: {
          giacenza: true,
          articolo: true,
        },
        orderBy: { id: "asc" },
      });
    }

    for (const reservation of reservations) {
      const consumed = Number(reservation.quantita);
      await tx.giacenza.update({
        where: { id: reservation.giacenza_id },
        data: {
          quantita_disponibile: { increment: consumed },
          quantita_riservata: { decrement: consumed },
        },
      });

      const discharge = await createDischargeInTransaction(tx, {
        articolo_id: reservation.articolo_id,
        quantita: consumed,
        ubicazione_da_id: reservation.giacenza.ubicazione_id,
        cantiere_id: richiesta.cantiere_id,
        task_id: richiesta.task_id ?? null,
      }, userId, expenseEmployeeId, {
        description: `Evasione richiesta materiale #${richiesta.id}: ${reservation.articolo.descrizione} (${reservation.articolo.codice_sku})`,
      });

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "CONSUMED", consumed_at: new Date() },
      });

      createdMovements.push(discharge.movimento);
      createdExpenses.push(discharge.spesa);
      events.push({ type: EVENTS.WAREHOUSE_DISCHARGED, payload: discharge.eventPayload });
    }

    const updatedRequest = await tx.richiestaMateriale.update({
      where: { id: requestId },
      data: { status: "FULFILLED" },
      include: materialRequestInclude(),
    });

    await writeAuditLog(tx, req.user, {
      entityType: "RichiestaMateriale",
      entityId: requestId,
      action: "MATERIAL_REQUEST_STATUS_CHANGED",
      previousState: { status: "APPROVED" },
      nextState: { status: "FULFILLED" },
    });
    events.push({
      type: EVENTS.MATERIAL_REQUEST_STATUS_CHANGED,
      payload: { requestId, cantiereId: richiesta.cantiere_id, status: "FULFILLED" },
    });

    return {
      richiesta: updatedRequest,
      movimenti: createdMovements,
      spese: createdExpenses,
    };
  });

  for (const event of events) {
    domainBus.emit(event.type, event.payload);
  }

  res.json(result);
});
