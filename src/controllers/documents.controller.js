import path from "path";
import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFile, resolveStoredPath, saveFile } from "../services/storage.service.js";

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
    await prisma.$transaction(operations);
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

  const storedFile = await saveFile(req.file, {
    folder: path.join("cantieri", String(cantiereId)),
  });

  const doc = await prisma.document.create({
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

  await linkDocumentToOptionalRecords(prisma, doc.id, req.body);

  res.status(201).json(doc);
});

export const getDocumentsByCantiere = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const cantiereId = parsePositiveInt(req.params.id);

  if (!cantiereId) {
    return res.status(400).json({ error: "ID cantiere non valido." });
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

  await prisma.$transaction([
    prisma.spesa.updateMany({ where: { documento_id: documentId }, data: { documento_id: null } }),
    prisma.movimentoMagazzino.updateMany({ where: { documento_id: documentId }, data: { documento_id: null } }),
    prisma.fattura.updateMany({ where: { documento_id: documentId }, data: { documento_id: null } }),
    prisma.document.delete({ where: { id: documentId } }),
  ]);

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

  if (!doc.file_path) {
    return res.status(404).json({ error: "File fisico non disponibile." });
  }

  const absolutePath = resolveStoredPath(doc.file_path);
  res.download(absolutePath, doc.name);
});
