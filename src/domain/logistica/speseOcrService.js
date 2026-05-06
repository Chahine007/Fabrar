import path from "path";
import { Prisma } from "@prisma/client";
import { LogisticaStatus } from "../../constants.js";
import { canAccessCantiere } from "../shared/accessControl.js";
import {
  getDefaultWarehouseLocation,
  upsertArticleAndCreateLoadMovement,
} from "../magazzino/warehouseService.js";
import { extractInvoiceOcrFromFile } from "../../services/openai.js";
import { saveFile } from "../../services/storage.service.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const GENYA_SOURCE = "IMPORT_GENYA";
const LOGISTIC_MATCH_STATUSES = [
  LogisticaStatus.PENDING_OCR,
  LogisticaStatus.OCR_REVIEW,
  LogisticaStatus.RECONCILIATION_REQUIRED,
  LogisticaStatus.NOT_REQUIRED,
];

function httpError(message, status = 400, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

function normalizeOptionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactAlnum(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeVat(value) {
  return compactAlnum(value).replace(/^IT/, "");
}

function parseMoney(value) {
  if (value == null || value === "") return null;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned
      .replace(new RegExp(`\\${thousandSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(",", ".");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveNumber(value) {
  const parsed = parseMoney(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const euro = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (euro) {
    const [, d, m, rawY] = euro;
    const year = rawY.length === 2 ? `20${rawY}` : rawY;
    const date = new Date(Date.UTC(Number(year), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(Math.round((start - end) / dayMs));
}

function decimalOrNull(value) {
  const parsed = parseMoney(value);
  if (parsed == null) return null;
  try {
    return new Prisma.Decimal(parsed);
  } catch {
    return null;
  }
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectDocumentType(payload = {}, file = null) {
  const type = String(payload.document_type ?? "").toUpperCase();
  if (type === "DDT") return "ddt";
  if (type === "ACCOMPANYING_INVOICE") return "fattura_accompagnatoria";
  if (type === "RECEIPT") return "scontrino";
  if (file?.mimetype === "application/pdf") return "pdf";
  return "fattura";
}

function supplierNameFromPayload(payload = {}) {
  return normalizeOptionalText(payload.fornitore?.ragione_sociale ?? payload.fornitore);
}

function supplierVatFromPayload(payload = {}) {
  return normalizeOptionalText(payload.fornitore?.partita_iva ?? payload.partita_iva_fornitore);
}

function normalizeLine(line = {}) {
  const quantita = parsePositiveNumber(line.quantita ?? line.qta ?? line.qty);
  const prezzoUnitario = parsePositiveNumber(line.prezzo_unitario ?? line.costo_unitario);
  const prezzoTotale = parsePositiveNumber(line.prezzo_totale ?? line.importo_riga ?? line.valore_riga);
  const codiceArticolo = normalizeOptionalText(
    line.codice_articolo ?? line.codice_sku ?? line.sku ?? line.cod_articolo
  );

  return {
    codice_articolo: codiceArticolo,
    codice_sku: codiceArticolo,
    descrizione: normalizeOptionalText(line.descrizione ?? line.descrizione_articolo ?? line.prodotto),
    quantita,
    unita_misura: normalizeOptionalText(line.unita_misura ?? line.um ?? line.unita) ?? "pz",
    prezzo_unitario: prezzoUnitario,
    costo_unitario: prezzoUnitario,
    prezzo_totale: prezzoTotale,
    importo_riga: prezzoTotale,
    iva_percentuale: parseMoney(line.iva_percentuale ?? line.iva),
    raw: line,
  };
}

export function normalizeInvoiceOcrPayload(payload = {}) {
  const righe = Array.isArray(payload.righe_materiali) ? payload.righe_materiali : [];
  const normalizedLines = righe.map(normalizeLine);

  return {
    document_type: normalizeOptionalText(payload.document_type)?.toUpperCase() ?? "UNKNOWN",
    numero_documento: normalizeOptionalText(payload.numero_documento ?? payload.numero_fattura),
    data_documento: normalizeOptionalText(payload.data_documento ?? payload.data_emissione),
    codice_destinatario: normalizeOptionalText(payload.codice_destinatario),
    fornitore: {
      ragione_sociale: supplierNameFromPayload(payload),
      partita_iva: supplierVatFromPayload(payload),
      codice_fiscale: normalizeOptionalText(payload.fornitore?.codice_fiscale),
      indirizzo: normalizeOptionalText(payload.fornitore?.indirizzo),
      comune: normalizeOptionalText(payload.fornitore?.comune),
      provincia: normalizeOptionalText(payload.fornitore?.provincia),
      cap: normalizeOptionalText(payload.fornitore?.cap),
    },
    cliente: {
      ragione_sociale: normalizeOptionalText(payload.cliente?.ragione_sociale),
      partita_iva: normalizeOptionalText(payload.cliente?.partita_iva),
      codice_fiscale: normalizeOptionalText(payload.cliente?.codice_fiscale),
    },
    totale_imponibile: parseMoney(payload.totale_imponibile),
    totale_imposta: parseMoney(payload.totale_imposta),
    totale_documento: parseMoney(payload.totale_documento ?? payload.importo_totale),
    righe_materiali: normalizedLines,
  };
}

export async function extractInvoiceFromUploadedFile(file) {
  if (!file) {
    throw httpError("Carica una fattura o un DDT da analizzare.", 400);
  }
  if (file.mimetype !== "application/pdf" && !IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw httpError(`Tipo file non supportato per OCR: ${file.mimetype}.`, 415);
  }
  if (!file.buffer) {
    throw httpError("File non disponibile per l'analisi OCR.", 400);
  }

  const rawPayload = await extractInvoiceOcrFromFile(
    file.buffer.toString("base64"),
    file.mimetype,
    file.originalname || "documento"
  );
  return normalizeInvoiceOcrPayload(rawPayload);
}

export function scoreSpesaMatch(spesa, ocrPayload) {
  const reasons = [];
  let score = 0;

  const spesaInvoice = compactAlnum(spesa?.fattura_rif);
  const ocrInvoice = compactAlnum(ocrPayload?.numero_documento);
  if (spesaInvoice && ocrInvoice && spesaInvoice === ocrInvoice) {
    score += 55;
    reasons.push("numero documento coincidente");
  } else if (spesaInvoice && ocrInvoice && (spesaInvoice.includes(ocrInvoice) || ocrInvoice.includes(spesaInvoice))) {
    score += 35;
    reasons.push("numero documento simile");
  }

  const spesaAmount = parseMoney(spesa?.importo);
  const ocrAmount = parseMoney(ocrPayload?.totale_documento);
  if (spesaAmount != null && ocrAmount != null) {
    const diff = Math.abs(spesaAmount - ocrAmount);
    if (diff <= 0.05) {
      score += 35;
      reasons.push("importo coincidente");
    } else if (diff <= 1) {
      score += 20;
      reasons.push("importo quasi coincidente");
    }
  }

  const spesaSupplier = normalizeSearchText(spesa?.fornitore);
  const ocrSupplier = normalizeSearchText(supplierNameFromPayload(ocrPayload));
  if (spesaSupplier && ocrSupplier) {
    if (spesaSupplier === ocrSupplier) {
      score += 20;
      reasons.push("fornitore coincidente");
    } else {
      const shorter = spesaSupplier.length < ocrSupplier.length ? spesaSupplier : ocrSupplier;
      const longer = spesaSupplier.length < ocrSupplier.length ? ocrSupplier : spesaSupplier;
      if (shorter.length >= 6 && longer.includes(shorter)) {
        score += 12;
        reasons.push("fornitore simile");
      }
    }
  }

  const spesaDate = parseDateOnly(spesa?.timestamp_utc);
  const ocrDate = parseDateOnly(ocrPayload?.data_documento);
  const dayDiff = daysBetween(spesaDate, ocrDate);
  if (dayDiff != null) {
    if (dayDiff === 0) {
      score += 10;
      reasons.push("data coincidente");
    } else if (dayDiff <= 7) {
      score += 5;
      reasons.push("data vicina");
    }
  }

  const strength = score >= 80 ? "strong" : score >= 55 ? "weak" : "none";
  return { score, strength, reasons };
}

export async function findOcrExpenseMatches(prisma, ocrPayload, options = {}) {
  const cantiereId = options.cantiereId ? Number(options.cantiereId) : null;
  const limit = Math.min(Math.max(Number(options.limit) || 5, 1), 20);
  const where = {
    OR: [{ fonte: GENYA_SOURCE }, { input_method: "import_genya" }],
    logistica_status: { in: LOGISTIC_MATCH_STATUSES },
  };
  if (cantiereId) where.cantiere_id = cantiereId;

  const candidates = await prisma.spesa.findMany({
    where,
    include: {
      cantiere: { select: { id: true, nome: true } },
      documento: { select: { id: true, name: true } },
    },
    orderBy: { timestamp_utc: "desc" },
    take: 200,
  });

  return candidates
    .map((spesa) => ({
      spesa,
      ...scoreSpesaMatch(spesa, ocrPayload),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function createOcrDocument(prisma, { spesa, file, user, ocrPayload }) {
  const saved = await saveFile(file, { folder: path.join("cantieri", String(spesa.cantiere_id), "ocr") });
  return prisma.document.create({
    data: {
      cantiere_id: spesa.cantiere_id,
      name: file.originalname || saved.filename,
      file_path: saved.relativePath,
      type: detectDocumentType(ocrPayload, file),
      size: formatFileSize(file.size),
      mime_type: file.mimetype,
      dimensione: file.size ?? null,
      employee_id: user?.employee_id ?? null,
      uploader: user?.employee_id ? `employee:${user.employee_id}` : `user:${user?.id ?? "system"}`,
      tag: "invoice_ocr",
      numero_fattura: ocrPayload.numero_documento,
      data_emissione: parseDateOnly(ocrPayload.data_documento),
      importo: decimalOrNull(ocrPayload.totale_documento),
    },
  });
}

async function ensureSpesaAccess(prisma, user, spesaId) {
  const spesa = await prisma.spesa.findUnique({
    where: { id: Number(spesaId) },
    include: {
      cantiere: { select: { id: true, nome: true } },
      documento: { select: { id: true, name: true } },
    },
  });

  if (!spesa) throw httpError("Spesa Genya non trovata.", 404);

  const allowed = await canAccessCantiere(prisma, user, spesa.cantiere_id, {
    globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
    ownerRoles: ["PROJECT_MANAGER"],
  });
  if (!allowed) throw httpError("Accesso negato alla spesa del cantiere.", 403);

  if (spesa.fonte !== GENYA_SOURCE && spesa.input_method !== "import_genya") {
    throw httpError("OCR logistico disponibile solo per spese importate da Genya.", 400);
  }

  return spesa;
}

export async function analyzeSpesaOcr(prisma, { spesaId, file, user }) {
  const spesa = await ensureSpesaAccess(prisma, user, spesaId);
  if (spesa.logistica_status === LogisticaStatus.LOADED_TO_WAREHOUSE) {
    throw httpError("Questa spesa risulta già caricata a magazzino.", 409);
  }

  const ocrPayload = await extractInvoiceFromUploadedFile(file);
  const document = await createOcrDocument(prisma, { spesa, file, user, ocrPayload });
  const match = scoreSpesaMatch(spesa, ocrPayload);
  const nextStatus = match.strength === "none"
    ? LogisticaStatus.RECONCILIATION_REQUIRED
    : LogisticaStatus.OCR_REVIEW;

  const updatedSpesa = await prisma.spesa.update({
    where: { id: spesa.id },
    data: {
      documento_id: document.id,
      ocr_payload: ocrPayload,
      logistica_status: nextStatus,
    },
    include: {
      cantiere: { select: { id: true, nome: true } },
      documento: { select: { id: true, name: true } },
    },
  });

  return {
    spesa: updatedSpesa,
    document,
    ocrPayload,
    suggestedLines: ocrPayload.righe_materiali,
    matchStatus: {
      ...match,
      canConfirm: match.strength !== "none" && ocrPayload.righe_materiali.some((line) => line.codice_articolo),
    },
  };
}

async function upsertSupplierFromOcr(tx, ocrPayload) {
  const ragioneSociale = supplierNameFromPayload(ocrPayload);
  if (!ragioneSociale) return null;

  const partitaIva = supplierVatFromPayload(ocrPayload);
  if (partitaIva) {
    const byVat = await tx.fornitore.findFirst({
      where: { partita_iva: { equals: partitaIva, mode: "insensitive" } },
    });
    if (byVat) {
      return tx.fornitore.update({
        where: { id: byVat.id },
        data: {
          ragione_sociale: byVat.ragione_sociale || ragioneSociale,
          indirizzo: byVat.indirizzo ?? ocrPayload.fornitore?.indirizzo ?? undefined,
        },
      });
    }
  }

  const byName = await tx.fornitore.findFirst({
    where: { ragione_sociale: { equals: ragioneSociale, mode: "insensitive" } },
  });
  if (byName) return byName;

  return tx.fornitore.create({
    data: {
      ragione_sociale: ragioneSociale,
      partita_iva: partitaIva,
      indirizzo: ocrPayload.fornitore?.indirizzo ?? null,
      note: "Creato automaticamente da OCR fattura/DDT.",
    },
  });
}

function normalizeConfirmLines(lines, fallbackPayload) {
  const source = Array.isArray(lines) && lines.length > 0
    ? lines
    : fallbackPayload?.righe_materiali ?? [];
  return source.map(normalizeLine);
}

export async function confirmSpesaOcr(prisma, { spesaId, documentId = null, lines = [], ubicazioneId = null, user }) {
  const spesaForAccess = await ensureSpesaAccess(prisma, user, spesaId);
  if (spesaForAccess.logistica_status === LogisticaStatus.LOADED_TO_WAREHOUSE) {
    throw httpError("Questa spesa è già stata caricata a magazzino.", 409);
  }

  return prisma.$transaction(async (tx) => {
    const spesa = await tx.spesa.findUnique({
      where: { id: Number(spesaId) },
      include: { documento: { select: { id: true, cantiere_id: true } } },
    });
    if (!spesa) throw httpError("Spesa Genya non trovata.", 404);
    if (spesa.logistica_status === LogisticaStatus.LOADED_TO_WAREHOUSE) {
      throw httpError("Questa spesa è già stata caricata a magazzino.", 409);
    }

    const targetDocumentId = documentId ? Number(documentId) : spesa.documento_id;
    if (targetDocumentId) {
      const document = await tx.document.findFirst({
        where: { id: targetDocumentId, cantiere_id: spesa.cantiere_id },
        select: { id: true },
      });
      if (!document) throw httpError("Documento OCR non trovato o non collegato al cantiere.", 400);

      const existingMovements = await tx.movimentoMagazzino.count({
        where: { documento_id: targetDocumentId },
      });
      if (existingMovements > 0) {
        throw httpError("Questo documento ha già generato movimenti di carico.", 409);
      }
    }

    const fallbackPayload = normalizeInvoiceOcrPayload(spesa.ocr_payload ?? {});
    const confirmedLines = normalizeConfirmLines(lines, fallbackPayload);
    if (!confirmedLines.length) {
      throw httpError("Nessuna riga materiale confermata.", 400);
    }

    const targetLocation = ubicazioneId
      ? await tx.ubicazione.findUnique({ where: { id: Number(ubicazioneId) } })
      : await getDefaultWarehouseLocation(tx);
    if (!targetLocation) {
      throw httpError("Carico non registrato: manca una ubicazione magazzino con codice DEFAULT o PRINCIPALE.", 400);
    }

    const ocrPayload = {
      ...fallbackPayload,
      righe_materiali: confirmedLines,
    };
    const supplier = await upsertSupplierFromOcr(tx, ocrPayload);

    const results = [];
    for (const line of confirmedLines) {
      const result = await upsertArticleAndCreateLoadMovement(tx, line, {
        ubicazioneId: targetLocation.id,
        userId: user?.id,
        documentId: targetDocumentId ?? null,
        fornitoreId: supplier?.id ?? null,
      });
      results.push(result);
    }

    const loaded = results.filter((result) => result.status === "loaded");
    const reconcile = results.filter((result) => result.status !== "loaded");
    const nextStatus = loaded.length > 0 && reconcile.length === 0
      ? LogisticaStatus.LOADED_TO_WAREHOUSE
      : LogisticaStatus.RECONCILIATION_REQUIRED;

    const updatedSpesa = await tx.spesa.update({
      where: { id: spesa.id },
      data: {
        documento_id: targetDocumentId ?? spesa.documento_id,
        ocr_payload: {
          ...ocrPayload,
          confirmation: {
            confirmed_at: new Date().toISOString(),
            confirmed_by_user_id: user?.id ?? null,
            ubicazione_id: targetLocation.id,
            loaded_lines: loaded.length,
            reconcile_lines: reconcile.length,
          },
        },
        ocr_reviewed_at: new Date(),
        logistica_status: nextStatus,
      },
      include: {
        documento: { select: { id: true, name: true } },
        cantiere: { select: { id: true, nome: true } },
      },
    });

    return {
      spesa: updatedSpesa,
      document_id: targetDocumentId ?? null,
      ubicazione: targetLocation,
      fornitore: supplier,
      movimentiCaricoCreati: loaded.length,
      articoliCreati: loaded.filter((result) => result.articleCreated).length,
      righeDaRiconciliare: reconcile.length,
      righeDaRiconciliareDettaglio: reconcile.map((result) => ({
        reason: result.reason,
        line: result.line,
      })),
    };
  });
}

export async function matchSpesaOcr(prisma, { ocrPayload, user, cantiereId = null }) {
  const normalizedPayload = normalizeInvoiceOcrPayload(ocrPayload);
  const matches = await findOcrExpenseMatches(prisma, normalizedPayload, { cantiereId });
  const visibleMatches = [];

  for (const match of matches) {
    const allowed = await canAccessCantiere(prisma, user, match.spesa.cantiere_id, {
      globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
      ownerRoles: ["PROJECT_MANAGER"],
    });
    if (allowed) visibleMatches.push(match);
  }

  return {
    ocrPayload: normalizedPayload,
    candidates: visibleMatches,
  };
}
