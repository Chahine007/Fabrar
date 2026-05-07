import path from "path";
import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFile, resolveStoredPath, saveFile } from "../services/storage.service.js";
import { canAccessCantiere } from "../domain/shared/accessControl.js";
import { writeAuditLog } from "../domain/audit/auditLogService.js";
import { domainBus, EVENTS } from "../domain/events/domainBus.js";

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNullableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNullableDecimal(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function detectDocType(mimetype, originalname) {
  if (mimetype?.startsWith("image/")) return "image";
  if (mimetype === "application/pdf") return "pdf";
  const ext = path.extname(originalname ?? "").toLowerCase();
  if ([".xls", ".xlsx"].includes(ext)) return "excel";
  if ([".doc", ".docx"].includes(ext)) return "document";
  return "document";
}

async function ensureCantiere(prisma, cantiereId) {
  const cantiere = await prisma.cantiere.findUnique({
    where: { id: cantiereId },
    select: { id: true },
  });

  return Boolean(cantiere);
}

async function ensureDocumentAccess(prisma, user, cantiereId) {
  return canAccessCantiere(prisma, user, cantiereId, {
    globalRoles: ["ADMIN", "HR"],
    warehouseRoles: ["WAREHOUSEMAN"],
    ownerRoles: ["PROJECT_MANAGER"],
    allowWorkerTasks: true,
  });
}

async function validateOptionalRecordLinks(prisma, body, cantiereId) {
  const spesaId = parsePositiveInt(body.spesa_id);
  const movimentoId = parsePositiveInt(body.movimento_id);
  const fatturaId = parsePositiveInt(body.fattura_id);

  if (spesaId) {
    const spesa = await prisma.spesa.findFirst({
      where: { id: spesaId, cantiere_id: cantiereId },
      select: { id: true },
    });
    if (!spesa) return "Spesa non valida per questo cantiere.";
  }

  if (movimentoId) {
    const movimento = await prisma.movimentoMagazzino.findFirst({
      where: { id: movimentoId, cantiere_id: cantiereId },
      select: { id: true },
    });
    if (!movimento) return "Movimento magazzino non valido per questo cantiere.";
  }

  if (fatturaId) {
    const fattura = await prisma.fattura.findFirst({
      where: { id: fatturaId, cantiere_id: cantiereId },
      select: { id: true },
    });
    if (!fattura) return "Fattura non valida per questo cantiere.";
  }

  return null;
}

async function linkDocumentToOptionalRecords(prisma, documentId, body) {
  const spesaId = parsePositiveInt(body.spesa_id);
  const movimentoId = parsePositiveInt(body.movimento_id);
  const fatturaId = parsePositiveInt(body.fattura_id);

  const operations = [];

  if (spesaId) {
    operations.push(
      prisma.spesa.update({
        where: { id: spesaId },
        data: { documento_id: documentId },
      })
    );
  }

  if (movimentoId) {
    operations.push(
      prisma.movimentoMagazzino.update({
        where: { id: movimentoId },
        data: { documento_id: documentId },
      })
    );
  }

  if (fatturaId) {
    operations.push(
      prisma.fattura.update({
        where: { id: fatturaId },
        data: { documento_id: documentId },
      })
    );
  }

  if (operations.length) {
    for (const operation of operations) {
      await operation;
    }
  }
}

export const uploadDocument = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const cantiereId = parsePositiveInt(req.body.cantiere_id);

  if (!cantiereId) {
    return res.status(400).json({ error: "cantiere_id obbligatorio o non valido." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Nessun file caricato." });
  }

  const exists = await ensureCantiere(prisma, cantiereId);
  if (!exists) {
    return res.status(404).json({ error: "Cantiere non trovato." });
  }
  if (!(await ensureDocumentAccess(prisma, req.user, cantiereId))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const linkError = await validateOptionalRecordLinks(prisma, req.body, cantiereId);
  if (linkError) {
    return res.status(400).json({ error: linkError });
  }

  const storedFile = await saveFile(req.file, {
    folder: path.join("cantieri", String(cantiereId)),
  });

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        cantiere_id: cantiereId,
        name: req.file.originalname,
        file_path: storedFile.relativePath,
        type: detectDocType(req.file.mimetype, req.file.originalname),
        size: formatFileSize(req.file.size),
        mime_type: req.file.mimetype,
        dimensione: req.file.size,
        employee_id: parsePositiveInt(req.user?.employee_id),
        uploader: req.user?.employee_id
          ? `employee:${req.user.employee_id}`
          : `user:${req.user?.id ?? "unknown"}`,
        tag: req.body.tag || "generic",
        numero_fattura: req.body.numero_fattura || null,
        data_emissione: parseNullableDate(req.body.data_emissione),
        importo: parseNullableDecimal(req.body.importo),
      },
    });

    await linkDocumentToOptionalRecords(tx, created.id, req.body);
    await writeAuditLog(tx, req.user, {
      entityType: "Document",
      entityId: created.id,
      action: "DOCUMENT_LINKED",
      nextState: {
        cantiere_id: cantiereId,
        spesa_id: parsePositiveInt(req.body.spesa_id),
        movimento_id: parsePositiveInt(req.body.movimento_id),
        fattura_id: parsePositiveInt(req.body.fattura_id),
      },
    });
    return created;
  });

  domainBus.emit(EVENTS.DOCUMENT_LINKED, { documentId: doc.id, cantiereId });

  res.status(201).json(doc);
});

export const getDocumentsByCantiere = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const cantiereId = parsePositiveInt(req.params.id);

  if (!cantiereId) {
    return res.status(400).json({ error: "ID cantiere non valido." });
  }
  if (!(await ensureDocumentAccess(prisma, req.user, cantiereId))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const where = { cantiere_id: cantiereId };
  if (req.query.tag) where.tag = String(req.query.tag);

  const documents = await prisma.document.findMany({
    where,
    include: {
      uploaded_by: {
        select: { id: true, nome: true, cognome: true, ruolo: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  res.json(documents);
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const documentId = parsePositiveInt(req.params.id);

  if (!documentId) {
    return res.status(400).json({ error: "ID documento non valido." });
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return res.status(404).json({ error: "Documento non trovato." });
  }
  if (!doc.cantiere_id || !(await ensureDocumentAccess(prisma, req.user, doc.cantiere_id))) {
    return res.status(403).json({ error: "Accesso negato al documento richiesto." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.spesa.updateMany({ where: { documento_id: documentId }, data: { documento_id: null } });
    await tx.movimentoMagazzino.updateMany({ where: { documento_id: documentId }, data: { documento_id: null } });
    await tx.fattura.updateMany({ where: { documento_id: documentId }, data: { documento_id: null } });
    await tx.document.delete({ where: { id: documentId } });
    await writeAuditLog(tx, req.user, {
      entityType: "Document",
      entityId: documentId,
      action: "DOCUMENT_DELETED",
      previousState: { cantiere_id: doc.cantiere_id, name: doc.name },
    });
  });

  await deleteFile(doc.file_path);

  res.json({ message: "Documento eliminato." });
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const documentId = parsePositiveInt(req.params.id);

  if (!documentId) {
    return res.status(400).json({ error: "ID documento non valido." });
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return res.status(404).json({ error: "Documento non trovato." });
  }
  if (!doc.cantiere_id || !(await ensureDocumentAccess(prisma, req.user, doc.cantiere_id))) {
    return res.status(403).json({ error: "Accesso negato al documento richiesto." });
  }

  if (!doc.file_path) {
    return res.status(404).json({ error: "File fisico non disponibile." });
  }

  const absolutePath = resolveStoredPath(doc.file_path);
  res.download(absolutePath, doc.name);
});
