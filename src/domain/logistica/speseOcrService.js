import path from "path";
import { Prisma } from "@prisma/client";
import { CostAllocationScope, CostCategory, LogisticaStatus } from "../../constants.js";
import { canAccessCantiere } from "../shared/accessControl.js";
import {
  getDefaultWarehouseLocation,
  upsertArticleAndCreateLoadMovement,
} from "../magazzino/warehouseService.js";
import { extractInvoiceOcrFromFile } from "../../services/openai.js";
import { resolveStoredPath, saveFile } from "../../services/storage.service.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const GENYA_SOURCE = "IMPORT_GENYA";
const LOGISTIC_MATCH_STATUSES = [
  LogisticaStatus.PENDING_OCR,
  LogisticaStatus.OCR_REVIEW,
  LogisticaStatus.RECONCILIATION_REQUIRED,
  LogisticaStatus.NOT_REQUIRED,
];
const OVERHEAD_COST_CATEGORIES = new Set([
  CostCategory.LEASING_RENTAL,
  CostCategory.UTILITY,
  CostCategory.INSURANCE,
  CostCategory.TAX_FEE,
  CostCategory.PROFESSIONAL_SERVICE,
  CostCategory.TRAVEL_VEHICLE,
  CostCategory.SERVICE,
]);
const PROJECT_COST_CATEGORIES = new Set([
  CostCategory.INVENTORY_MATERIAL,
  CostCategory.CONSUMABLE_SUPPLY,
]);
const COST_CATEGORY_VALUES = new Set(Object.values(CostCategory));
const ALLOCATION_SCOPE_VALUES = new Set(Object.values(CostAllocationScope));

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

function normalizeVatCandidates(value) {
  const raw = compactAlnum(value);
  const withoutCountry = normalizeVat(value);
  return [...new Set([raw, withoutCountry, withoutCountry ? `IT${withoutCountry}` : null].filter(Boolean))];
}

function normalizeOcrSku(value) {
  const compact = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return compact || null;
}

function normalizeCostCategory(value, fallback = CostCategory.UNKNOWN) {
  const category = String(value ?? "").trim().toUpperCase();
  return COST_CATEGORY_VALUES.has(category) ? category : fallback;
}

function normalizeAllocationScope(value, costCategory = CostCategory.UNKNOWN) {
  const scope = String(value ?? "").trim().toUpperCase();
  if (ALLOCATION_SCOPE_VALUES.has(scope)) return scope;
  if (OVERHEAD_COST_CATEGORIES.has(costCategory)) return CostAllocationScope.OVERHEAD;
  if (PROJECT_COST_CATEGORIES.has(costCategory)) return CostAllocationScope.PROJECT;
  return CostAllocationScope.REVIEW;
}

function isWarehouseLoadableLine(line = {}) {
  return Boolean(
    line.codice_sku
      && line.quantita
      && line.quantita > 0
      && normalizeCostCategory(line.cost_category, CostCategory.INVENTORY_MATERIAL) === CostCategory.INVENTORY_MATERIAL
      && line.stockable !== false
  );
}

function shouldRequireWarehouse(ocrPayload = {}, lines = []) {
  const category = normalizeCostCategory(ocrPayload.cost_category);
  const explicit = Boolean(ocrPayload.logistica_required);
  return (
    category === CostCategory.INVENTORY_MATERIAL
    && (explicit || lines.some((line) => isWarehouseLoadableLine(line)))
  );
}

function resolveLogisticaStatus({ allocationScope, costCategory, warehouseRequired, loadedCount = 0, reconcileCount = 0 }) {
  if (loadedCount > 0 && reconcileCount === 0) return LogisticaStatus.LOADED_TO_WAREHOUSE;
  if (warehouseRequired && reconcileCount > 0) return LogisticaStatus.RECONCILIATION_REQUIRED;
  if (warehouseRequired) return LogisticaStatus.OCR_REVIEW;
  if (allocationScope === CostAllocationScope.OVERHEAD || OVERHEAD_COST_CATEGORIES.has(costCategory)) {
    return LogisticaStatus.NOT_REQUIRED;
  }
  if (costCategory === CostCategory.UNKNOWN || allocationScope === CostAllocationScope.REVIEW || reconcileCount > 0) {
    return LogisticaStatus.RECONCILIATION_REQUIRED;
  }
  return LogisticaStatus.NOT_REQUIRED;
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
  return normalizeOptionalText(
    payload.fornitore?.ragione_sociale
      ?? (typeof payload.fornitore === "string" ? payload.fornitore : null)
      ?? payload.ragione_sociale_fornitore
      ?? payload.nome_fornitore
  );
}

function supplierVatFromPayload(payload = {}) {
  return normalizeOptionalText(payload.fornitore?.partita_iva ?? payload.partita_iva_fornitore);
}

function formatSupplierAddress(fornitore = {}) {
  const indirizzo = normalizeOptionalText(fornitore.indirizzo);
  const cap = normalizeOptionalText(fornitore.cap);
  const comune = normalizeOptionalText(fornitore.comune);
  const provincia = normalizeOptionalText(fornitore.provincia);
  const locality = [cap, comune].filter(Boolean).join(" ");
  const province = provincia ? `(${provincia})` : null;
  return [indirizzo, [locality, province].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
}

function normalizeIban(value) {
  const text = normalizeOptionalText(value);
  return text ? text.replace(/\s+/g, "").toUpperCase() : null;
}

function supplierDataFromOcrPayload(ocrPayload = {}) {
  const fornitore = ocrPayload.fornitore ?? {};
  const partitaIva = supplierVatFromPayload(ocrPayload);
  return {
    ragione_sociale: supplierNameFromPayload(ocrPayload),
    partita_iva: partitaIva,
    partita_iva_normalizzata: partitaIva ? normalizeVat(partitaIva) : null,
    codice_fiscale: normalizeOptionalText(fornitore.codice_fiscale),
    indirizzo: formatSupplierAddress(fornitore),
    comune: normalizeOptionalText(fornitore.comune),
    provincia: normalizeOptionalText(fornitore.provincia),
    cap: normalizeOptionalText(fornitore.cap),
    paese: normalizeOptionalText(fornitore.paese) ?? "IT",
    iban_default: normalizeIban(ocrPayload.pagamento?.iban),
  };
}

function applyMissingSupplierFields(existing, incoming) {
  const data = {};
  for (const key of [
    "ragione_sociale",
    "partita_iva",
    "partita_iva_normalizzata",
    "codice_fiscale",
    "indirizzo",
    "comune",
    "provincia",
    "cap",
    "paese",
    "iban_default",
  ]) {
    if (!existing?.[key] && incoming?.[key]) data[key] = incoming[key];
  }
  return data;
}

function normalizeLine(line = {}) {
  const quantita = parsePositiveNumber(line.quantita ?? line.qta ?? line.qty);
  const prezzoUnitario = parsePositiveNumber(line.prezzo_unitario ?? line.costo_unitario);
  const prezzoTotale = parsePositiveNumber(line.prezzo_totale ?? line.importo_riga ?? line.valore_riga);
  const codiceArticolo = normalizeOptionalText(
    line.codice_articolo ?? line.codice_sku ?? line.sku ?? line.cod_articolo
  );
  const codiceSku = normalizeOcrSku(codiceArticolo);
  const costCategory = normalizeCostCategory(line.cost_category, CostCategory.INVENTORY_MATERIAL);
  const stockable = line.stockable === false ? false : costCategory === CostCategory.INVENTORY_MATERIAL;

  return {
    codice_articolo: codiceArticolo,
    codice_articolo_raw: codiceArticolo,
    codice_sku: codiceSku,
    descrizione: normalizeOptionalText(line.descrizione ?? line.descrizione_articolo ?? line.prodotto),
    cost_category: costCategory,
    stockable,
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

function normalizeCostLine(line = {}) {
  const costCategory = normalizeCostCategory(line.cost_category, CostCategory.OTHER);
  return {
    descrizione: normalizeOptionalText(line.descrizione ?? line.descrizione_costo ?? line.prodotto),
    cost_category: costCategory,
    allocation_scope: normalizeAllocationScope(line.allocation_scope, costCategory),
    importo: parseMoney(line.importo ?? line.prezzo_totale ?? line.importo_riga),
    iva_percentuale: parseMoney(line.iva_percentuale ?? line.iva),
    quantita: parsePositiveNumber(line.quantita ?? line.qta ?? line.qty),
    unita_misura: normalizeOptionalText(line.unita_misura ?? line.um ?? line.unita),
    prezzo_unitario: parseMoney(line.prezzo_unitario ?? line.costo_unitario),
    raw: line,
  };
}

export function normalizeInvoiceOcrPayload(payload = {}) {
  const righe = Array.isArray(payload.righe_materiali) ? payload.righe_materiali : [];
  const normalizedLines = righe.map(normalizeLine);
  const costLinesFromPayload = Array.isArray(payload.righe_costo) ? payload.righe_costo : [];
  const nonStockableLines = normalizedLines
    .filter((line) => line.stockable === false || line.cost_category !== CostCategory.INVENTORY_MATERIAL)
    .map((line) => normalizeCostLine({
      ...line.raw,
      descrizione: line.descrizione,
      cost_category: line.cost_category,
      importo: line.prezzo_totale,
      iva_percentuale: line.iva_percentuale,
      quantita: line.quantita,
      unita_misura: line.unita_misura,
      prezzo_unitario: line.prezzo_unitario,
    }));
  const normalizedCostLines = [
    ...costLinesFromPayload.map(normalizeCostLine),
    ...nonStockableLines,
  ];
  const tipoDocumento = normalizeOptionalText(payload.tipo_documento ?? payload.documento?.tipo_documento);
  const numeroDocumento = normalizeOptionalText(payload.numero_documento ?? payload.numero_fattura ?? payload.documento?.numero_documento);
  const dataDocumento = normalizeOptionalText(payload.data_documento ?? payload.data_emissione ?? payload.documento?.data_documento);
  const codiceDestinatario = normalizeOptionalText(payload.codice_destinatario ?? payload.documento?.codice_destinatario);
  const totaleImponibile = parseMoney(payload.totale_imponibile ?? payload.totali?.totale_imponibile);
  const totaleImposta = parseMoney(payload.totale_imposta ?? payload.totali?.totale_imposta);
  const totaleDocumento = parseMoney(payload.totale_documento ?? payload.importo_totale ?? payload.totali?.totale_documento);
  const pagamento = payload.pagamento ?? {};
  const normalizedMaterialLines = normalizedLines.filter((line) => line.cost_category === CostCategory.INVENTORY_MATERIAL);
  const fallbackCategory = normalizedMaterialLines.length > 0
    ? CostCategory.INVENTORY_MATERIAL
    : normalizedCostLines[0]?.cost_category ?? CostCategory.UNKNOWN;
  const costCategory = normalizeCostCategory(payload.cost_category, fallbackCategory);
  const allocationScope = normalizeAllocationScope(payload.allocation_scope, costCategory);
  const logisticaRequired = payload.logistica_required === true
    || (costCategory === CostCategory.INVENTORY_MATERIAL && normalizedMaterialLines.some((line) => line.codice_sku));

  return {
    document_type: normalizeOptionalText(payload.document_type)?.toUpperCase() ?? "UNKNOWN",
    cost_category: costCategory,
    allocation_scope: allocationScope,
    logistica_required: logisticaRequired,
    tipo_documento: tipoDocumento,
    numero_documento: numeroDocumento,
    data_documento: dataDocumento,
    codice_destinatario: codiceDestinatario,
    documento: {
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento,
      data_documento: dataDocumento,
      codice_destinatario: codiceDestinatario,
    },
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
      indirizzo: normalizeOptionalText(payload.cliente?.indirizzo),
      comune: normalizeOptionalText(payload.cliente?.comune),
      provincia: normalizeOptionalText(payload.cliente?.provincia),
      cap: normalizeOptionalText(payload.cliente?.cap),
    },
    totale_imponibile: totaleImponibile,
    totale_imposta: totaleImposta,
    totale_documento: totaleDocumento,
    totali: {
      totale_imponibile: totaleImponibile,
      totale_imposta: totaleImposta,
      totale_documento: totaleDocumento,
    },
    pagamento: {
      modalita_pagamento: normalizeOptionalText(pagamento.modalita_pagamento ?? payload.modalita_pagamento),
      iban: normalizeOptionalText(pagamento.iban ?? payload.iban),
      scadenza: normalizeOptionalText(pagamento.scadenza ?? payload.scadenza),
      importo_scadenza: parseMoney(pagamento.importo_scadenza ?? payload.importo_scadenza),
    },
    righe_materiali: normalizedMaterialLines,
    righe_costo: normalizedCostLines,
  };
}

function buildPurchaseInvoiceDraft(ocrPayload = {}, lines = null) {
  const payload = normalizeInvoiceOcrPayload(ocrPayload);
  const materialLines = Array.isArray(lines) ? lines : payload.righe_materiali;
  const righe = [
    ...materialLines.map((line) => ({
      codice_articolo_originale: line.codice_articolo ?? line.codice_articolo_raw ?? null,
      codice_sku_normalizzato: line.codice_sku ?? normalizeOcrSku(line.codice_articolo),
      descrizione: line.descrizione ?? null,
      quantita: line.quantita ?? null,
      unita_misura: line.unita_misura ?? null,
      prezzo_unitario: line.prezzo_unitario ?? line.costo_unitario ?? null,
      iva_percentuale: line.iva_percentuale ?? null,
      prezzo_totale: line.prezzo_totale ?? line.importo_riga ?? null,
      cost_category: normalizeCostCategory(line.cost_category, CostCategory.INVENTORY_MATERIAL),
      allocation_scope: normalizeAllocationScope(line.allocation_scope, line.cost_category),
      is_stockable: isWarehouseLoadableLine(line),
      reconciliation_status: isWarehouseLoadableLine(line)
        ? "READY"
        : (line.codice_sku ? "NOT_STOCKABLE" : "RECONCILIATION_REQUIRED"),
      articolo_id: line.articolo_id ?? null,
      magazzino_status: line.magazzino_status ?? null,
    })),
    ...payload.righe_costo.map((line) => {
      const category = normalizeCostCategory(line.cost_category, CostCategory.OTHER);
      return {
        codice_articolo_originale: null,
        codice_sku_normalizzato: null,
        descrizione: line.descrizione ?? null,
        quantita: line.quantita ?? null,
        unita_misura: line.unita_misura ?? null,
        prezzo_unitario: line.prezzo_unitario ?? null,
        iva_percentuale: line.iva_percentuale ?? null,
        prezzo_totale: line.importo ?? null,
        cost_category: category,
        allocation_scope: normalizeAllocationScope(line.allocation_scope, category),
        is_stockable: false,
        reconciliation_status: "NOT_STOCKABLE",
      };
    }),
  ];

  return {
    document_type: payload.document_type,
    tipo_documento: payload.tipo_documento,
    numero_documento: payload.numero_documento,
    data_documento: payload.data_documento,
    codice_destinatario: payload.codice_destinatario,
    fornitore: payload.fornitore,
    cliente: payload.cliente,
    totali: payload.totali,
    pagamento: payload.pagamento,
    cost_category: payload.cost_category,
    allocation_scope: payload.allocation_scope,
    logistica_required: payload.logistica_required,
    righe,
  };
}

function purchaseInvoiceInclude() {
  return {
    fornitore: {
      select: {
        id: true,
        ragione_sociale: true,
        partita_iva: true,
        partita_iva_normalizzata: true,
        codice_fiscale: true,
        indirizzo: true,
        comune: true,
        provincia: true,
        cap: true,
        paese: true,
        iban_default: true,
      },
    },
    documento: { select: { id: true, name: true, file_path: true, tag: true } },
    spesa: { select: { id: true, importo: true, fonte: true, input_method: true } },
    cantiere: { select: { id: true, nome: true } },
    righe: {
      orderBy: { id: "asc" },
      include: {
        articolo: { select: { id: true, codice_sku: true, descrizione: true } },
        movimento: { select: { id: true, tipo_movimento: true, quantita: true, valore_totale: true } },
      },
    },
  };
}

function buildPurchaseInvoiceData({ documentId, spesaId, fornitoreId, cantiereId, ocrPayload }) {
  const payload = normalizeInvoiceOcrPayload(ocrPayload);
  return {
    document_id: documentId ? Number(documentId) : null,
    spesa_id: spesaId ? Number(spesaId) : null,
    fornitore_id: fornitoreId ? Number(fornitoreId) : null,
    cantiere_id: cantiereId ? Number(cantiereId) : null,
    document_type: payload.document_type ?? null,
    tipo_documento: payload.tipo_documento ?? null,
    numero_documento: payload.numero_documento ?? null,
    data_documento: parseDateOnly(payload.data_documento),
    codice_destinatario: payload.codice_destinatario ?? null,
    cliente_partita_iva: payload.cliente?.partita_iva ?? null,
    cliente_ragione_sociale: payload.cliente?.ragione_sociale ?? null,
    cliente_codice_fiscale: payload.cliente?.codice_fiscale ?? null,
    cliente_indirizzo: payload.cliente?.indirizzo ?? null,
    cliente_comune: payload.cliente?.comune ?? null,
    cliente_provincia: payload.cliente?.provincia ?? null,
    cliente_cap: payload.cliente?.cap ?? null,
    totale_imponibile: decimalOrNull(payload.totale_imponibile),
    totale_imposta: decimalOrNull(payload.totale_imposta),
    totale_documento: decimalOrNull(payload.totale_documento),
    pagamento_modalita: payload.pagamento?.modalita_pagamento ?? null,
    pagamento_iban: normalizeIban(payload.pagamento?.iban),
    pagamento_scadenza: parseDateOnly(payload.pagamento?.scadenza),
    pagamento_importo: decimalOrNull(payload.pagamento?.importo_scadenza),
    cost_category: payload.cost_category,
    allocation_scope: payload.allocation_scope,
    logistica_required: Boolean(payload.logistica_required),
    ocr_payload: payload,
  };
}

function findMovementResultForLine(line, movementResults, usedResultIndexes) {
  const sku = line.codice_sku ?? normalizeOcrSku(line.codice_articolo);
  for (let index = 0; index < movementResults.length; index += 1) {
    if (usedResultIndexes.has(index)) continue;
    const result = movementResults[index];
    const resultSku = result?.line?.codice_sku ?? result?.articolo?.codice_sku ?? null;
    if (sku && resultSku && sku === resultSku) {
      usedResultIndexes.add(index);
      return result;
    }
  }
  return null;
}

function buildPurchaseInvoiceLinesData({ fatturaAcquistoId, ocrPayload, lines, movementResults = [] }) {
  const payload = normalizeInvoiceOcrPayload(ocrPayload);
  const sourceLines = normalizeConfirmLines(lines, payload);
  const usedResultIndexes = new Set();
  const materialRows = sourceLines.map((line) => {
    const category = normalizeCostCategory(line.cost_category, CostCategory.INVENTORY_MATERIAL);
    const movementResult = findMovementResultForLine(line, movementResults, usedResultIndexes);
    const loaded = movementResult?.status === "loaded";
    return {
      fattura_acquisto_id: fatturaAcquistoId,
      articolo_id: movementResult?.articolo?.id ?? line.articolo_id ?? null,
      movimento_id: movementResult?.movimento?.id ?? null,
      codice_articolo_originale: line.codice_articolo_raw ?? line.codice_articolo ?? null,
      codice_sku_normalizzato: line.codice_sku ?? normalizeOcrSku(line.codice_articolo),
      descrizione: line.descrizione ?? null,
      quantita: decimalOrNull(line.quantita),
      unita_misura: line.unita_misura ?? null,
      prezzo_unitario: decimalOrNull(line.prezzo_unitario ?? line.costo_unitario),
      iva_percentuale: decimalOrNull(line.iva_percentuale),
      prezzo_totale: decimalOrNull(line.prezzo_totale ?? line.importo_riga),
      cost_category: category,
      allocation_scope: normalizeAllocationScope(line.allocation_scope, category),
      is_stockable: isWarehouseLoadableLine(line),
      reconciliation_status: loaded
        ? "LOADED"
        : (isWarehouseLoadableLine(line) ? "READY" : "RECONCILIATION_REQUIRED"),
      raw_payload: line.raw ?? line,
    };
  });

  const costRows = payload.righe_costo.map((line) => {
    const category = normalizeCostCategory(line.cost_category, CostCategory.OTHER);
    return {
      fattura_acquisto_id: fatturaAcquistoId,
      articolo_id: null,
      movimento_id: null,
      codice_articolo_originale: null,
      codice_sku_normalizzato: null,
      descrizione: line.descrizione ?? null,
      quantita: decimalOrNull(line.quantita),
      unita_misura: line.unita_misura ?? null,
      prezzo_unitario: decimalOrNull(line.prezzo_unitario),
      iva_percentuale: decimalOrNull(line.iva_percentuale),
      prezzo_totale: decimalOrNull(line.importo),
      cost_category: category,
      allocation_scope: normalizeAllocationScope(line.allocation_scope, category),
      is_stockable: false,
      reconciliation_status: "NOT_STOCKABLE",
      raw_payload: line.raw ?? line,
    };
  });

  return [...materialRows, ...costRows];
}

async function upsertPurchaseInvoiceFromOcr(tx, {
  spesaId = null,
  documentId = null,
  fornitoreId = null,
  cantiereId = null,
  ocrPayload,
  lines = [],
  movementResults = [],
}) {
  const payload = normalizeInvoiceOcrPayload(ocrPayload);
  const data = buildPurchaseInvoiceData({
    documentId,
    spesaId,
    fornitoreId,
    cantiereId,
    ocrPayload: payload,
  });

  let existing = null;
  if (documentId) {
    existing = await tx.fatturaAcquisto.findUnique({ where: { document_id: Number(documentId) } });
  }
  if (!existing && spesaId) {
    existing = await tx.fatturaAcquisto.findUnique({ where: { spesa_id: Number(spesaId) } });
  }
  if (!existing && fornitoreId && payload.numero_documento) {
    existing = await tx.fatturaAcquisto.findFirst({
      where: {
        fornitore_id: Number(fornitoreId),
        numero_documento: payload.numero_documento,
        ...(data.data_documento ? { data_documento: data.data_documento } : {}),
      },
    });
  }

  if (existing?.spesa_id && spesaId && Number(existing.spesa_id) !== Number(spesaId)) {
    throw httpError("Questa fattura acquisto risulta già collegata a un'altra spesa.", 409);
  }
  if (existing?.document_id && documentId && Number(existing.document_id) !== Number(documentId)) {
    throw httpError("Questa fattura acquisto risulta già collegata a un altro documento.", 409);
  }

  const fatturaAcquisto = existing
    ? await tx.fatturaAcquisto.update({ where: { id: existing.id }, data })
    : await tx.fatturaAcquisto.create({ data });

  const existingLoadedLines = await tx.rigaFatturaAcquisto.count({
    where: {
      fattura_acquisto_id: fatturaAcquisto.id,
      movimento_id: { not: null },
    },
  });
  if (existingLoadedLines > 0 && movementResults.some((result) => result?.movimento?.id)) {
    throw httpError("Questa fattura ha già righe di magazzino collegate.", 409);
  }

  if (existingLoadedLines === 0) {
    await tx.rigaFatturaAcquisto.deleteMany({
      where: { fattura_acquisto_id: fatturaAcquisto.id },
    });
    const rows = buildPurchaseInvoiceLinesData({
      fatturaAcquistoId: fatturaAcquisto.id,
      ocrPayload: payload,
      lines,
      movementResults,
    });
    if (rows.length > 0) {
      await tx.rigaFatturaAcquisto.createMany({ data: rows });
    }
  }

  return tx.fatturaAcquisto.findUnique({
    where: { id: fatturaAcquisto.id },
    include: purchaseInvoiceInclude(),
  });
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

async function enrichLinePreviews(prisma, lines = []) {
  const skus = [...new Set(lines.map((line) => line.codice_sku).filter(Boolean))];
  const existingArticles = skus.length
    ? await prisma.articolo.findMany({
        where: { codice_sku: { in: skus } },
        select: { id: true, codice_sku: true },
      })
    : [];
  const existingBySku = new Map(existingArticles.map((article) => [article.codice_sku, article]));

  return lines.map((line) => {
    if (!isWarehouseLoadableLine(line)) {
      return {
        ...line,
        magazzino_status: "reconcile",
        reconcile_reason: line.codice_sku ? "NOT_STOCKABLE" : "SKU_MISSING",
      };
    }
    const existingArticle = existingBySku.get(line.codice_sku);
    return {
      ...line,
      magazzino_status: existingArticle ? "existing" : "new",
      articolo_id: existingArticle?.id ?? null,
    };
  });
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
  const folder = spesa.cantiere_id
    ? path.join("cantieri", String(spesa.cantiere_id), "ocr")
    : path.join("overhead", "ocr");
  const saved = await saveFile(file, { folder });
  return prisma.document.create({
    data: {
      cantiere_id: spesa.cantiere_id ?? null,
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

async function createOcrDocumentFromStoredUpload(prisma, { cantiereId = null, upload, user, ocrPayload }) {
  if (!upload?.token) throw httpError("File OCR temporaneo non disponibile.", 400);
  resolveStoredPath(upload.token);

  return prisma.document.create({
    data: {
      cantiere_id: cantiereId ? Number(cantiereId) : null,
      name: upload.originalName || path.basename(upload.token),
      file_path: upload.token,
      type: detectDocumentType(ocrPayload, { mimetype: upload.mimeType }),
      size: formatFileSize(upload.size),
      mime_type: upload.mimeType ?? null,
      dimensione: upload.size ?? null,
      employee_id: user?.employee_id ?? null,
      uploader: user?.employee_id ? `employee:${user.employee_id}` : `user:${user?.id ?? "system"}`,
      tag: "invoice_ocr",
      numero_fattura: ocrPayload.numero_documento,
      data_emissione: parseDateOnly(ocrPayload.data_documento),
      importo: decimalOrNull(ocrPayload.totale_documento),
    },
  });
}

async function ensureSpesaAccess(prisma, user, spesaId, options = {}) {
  const spesa = await prisma.spesa.findUnique({
    where: { id: Number(spesaId) },
    include: {
      cantiere: { select: { id: true, nome: true } },
      documento: { select: { id: true, name: true } },
    },
  });

  if (!spesa) throw httpError("Spesa Genya non trovata.", 404);

  let allowed = false;
  if (spesa.cantiere_id) {
    allowed = await canAccessCantiere(prisma, user, spesa.cantiere_id, {
      globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
      ownerRoles: ["PROJECT_MANAGER"],
    });
  } else {
    allowed = ["ADMIN", "HR", "WAREHOUSEMAN"].includes(user?.role)
      || (user?.employee_id && Number(user.employee_id) === Number(spesa.employee_id));
  }
  if (!allowed) throw httpError("Accesso negato alla spesa del cantiere.", 403);

  if (!options.allowNonGenya && spesa.fonte !== GENYA_SOURCE && spesa.input_method !== "import_genya") {
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
  const suggestedLines = await enrichLinePreviews(prisma, ocrPayload.righe_materiali);
  const document = await createOcrDocument(prisma, { spesa, file, user, ocrPayload });
  const match = scoreSpesaMatch(spesa, ocrPayload);
  const nextStatus = match.strength === "none"
    ? LogisticaStatus.RECONCILIATION_REQUIRED
    : resolveLogisticaStatus({
        allocationScope: ocrPayload.allocation_scope,
        costCategory: ocrPayload.cost_category,
        warehouseRequired: shouldRequireWarehouse(ocrPayload, suggestedLines),
        reconcileCount: suggestedLines.filter((line) => !isWarehouseLoadableLine(line)).length,
      });

  const updatedSpesa = await prisma.spesa.update({
    where: { id: spesa.id },
    data: {
      documento_id: document.id,
      ocr_payload: ocrPayload,
      logistica_status: nextStatus,
      cost_category: ocrPayload.cost_category,
      allocation_scope: ocrPayload.allocation_scope,
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
    fattura_acquisto_draft: buildPurchaseInvoiceDraft(ocrPayload, suggestedLines),
    suggestedLines,
    matchStatus: {
      ...match,
      canConfirm: match.strength !== "none",
    },
  };
}

export async function analyzeGenericInvoiceOcr(prisma, { file, user, cantiereId = null }) {
  const ocrPayload = await extractInvoiceFromUploadedFile(file);
  const suggestedLines = await enrichLinePreviews(prisma, ocrPayload.righe_materiali);
  const saved = await saveFile(file, { folder: path.join("ocr-pending") });
  const matches = await findOcrExpenseMatches(prisma, ocrPayload, { cantiereId });
  const visibleMatches = [];

  for (const match of matches) {
    const allowed = match.spesa.cantiere_id
      ? await canAccessCantiere(prisma, user, match.spesa.cantiere_id, {
          globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
          ownerRoles: ["PROJECT_MANAGER"],
        })
      : ["ADMIN", "HR", "WAREHOUSEMAN"].includes(user?.role)
        || (user?.employee_id && Number(user.employee_id) === Number(match.spesa.employee_id));
    if (allowed) visibleMatches.push(match);
  }

  return {
    upload: {
      token: saved.relativePath,
      originalName: file.originalname || saved.filename,
      mimeType: file.mimetype,
      size: file.size ?? null,
    },
    ocrPayload,
    fattura_acquisto_draft: buildPurchaseInvoiceDraft(ocrPayload, suggestedLines),
    suggestedLines,
    candidates: visibleMatches,
    matchStatus: {
      best: visibleMatches[0] ?? null,
      canConfirmExisting: Boolean(visibleMatches[0]?.spesa?.id),
      canCreateNew: Boolean(ocrPayload.totale_documento),
    },
  };
}

async function upsertSupplierFromOcr(tx, ocrPayload) {
  const incoming = supplierDataFromOcrPayload(ocrPayload);
  if (!incoming.ragione_sociale) return null;

  if (incoming.partita_iva) {
    const vatCandidates = normalizeVatCandidates(incoming.partita_iva);
    const byVat = await tx.fornitore.findFirst({
      where: {
        OR: [
          ...vatCandidates.map((candidate) => ({
            partita_iva: { equals: candidate, mode: "insensitive" },
          })),
          ...(incoming.partita_iva_normalizzata
            ? [{ partita_iva_normalizzata: incoming.partita_iva_normalizzata }]
            : []),
        ],
      },
    });
    if (byVat) {
      const data = applyMissingSupplierFields(byVat, incoming);
      const fornitore = Object.keys(data).length
        ? await tx.fornitore.update({ where: { id: byVat.id }, data })
        : byVat;
      return { fornitore, action: Object.keys(data).length ? "updated" : "found" };
    }
  }

  const byName = await tx.fornitore.findFirst({
    where: { ragione_sociale: { equals: incoming.ragione_sociale, mode: "insensitive" } },
  });
  if (byName) {
    const data = applyMissingSupplierFields(byName, incoming);
    const fornitore = Object.keys(data).length
      ? await tx.fornitore.update({ where: { id: byName.id }, data })
      : byName;
    return { fornitore, action: Object.keys(data).length ? "updated" : "found" };
  }

  const fornitore = await tx.fornitore.create({
    data: {
      ...incoming,
      note: "Creato automaticamente da OCR fattura/DDT.",
    },
  });
  return { fornitore, action: "created" };
}

function normalizeConfirmLines(lines, fallbackPayload) {
  const source = Array.isArray(lines) && lines.length > 0
    ? lines
    : fallbackPayload?.righe_materiali ?? [];
  return source.map(normalizeLine);
}

export async function confirmSpesaOcr(prisma, {
  spesaId,
  documentId = null,
  lines = [],
  ubicazioneId = null,
  costCategory = null,
  allocationScope = null,
  user,
  allowNonGenya = false,
}) {
  const spesaForAccess = await ensureSpesaAccess(prisma, user, spesaId, { allowNonGenya });
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
        where: { id: targetDocumentId, cantiere_id: spesa.cantiere_id ?? null },
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

    const fallbackPayload = normalizeInvoiceOcrPayload({
      ...(spesa.ocr_payload ?? {}),
      ...(costCategory ? { cost_category: costCategory } : {}),
      ...(allocationScope ? { allocation_scope: allocationScope } : {}),
    });
    const confirmedLines = normalizeConfirmLines(lines, fallbackPayload);
    const warehouseLines = confirmedLines.filter(isWarehouseLoadableLine);
    const normalizedCostCategory = normalizeCostCategory(fallbackPayload.cost_category, CostCategory.UNKNOWN);
    const normalizedAllocationScope = normalizeAllocationScope(fallbackPayload.allocation_scope, normalizedCostCategory);
    const warehouseRequired = shouldRequireWarehouse(fallbackPayload, confirmedLines);

    let targetLocation = null;
    if (warehouseRequired && warehouseLines.length > 0) {
      targetLocation = ubicazioneId
        ? await tx.ubicazione.findUnique({ where: { id: Number(ubicazioneId) } })
        : await getDefaultWarehouseLocation(tx);
      if (!targetLocation) {
        throw httpError("Carico non registrato: manca una ubicazione magazzino con codice DEFAULT o PRINCIPALE.", 400);
      }
    }

    const ocrPayload = {
      ...fallbackPayload,
      righe_materiali: confirmedLines,
    };
    const supplierResult = await upsertSupplierFromOcr(tx, ocrPayload);
    const supplier = supplierResult?.fornitore ?? null;

    const results = [];
    for (const line of warehouseLines) {
      const result = await upsertArticleAndCreateLoadMovement(tx, line, {
        ubicazioneId: targetLocation.id,
        userId: user?.id,
        documentId: targetDocumentId ?? null,
        fornitoreId: supplier?.id ?? null,
      });
      results.push({ ...result, line });
    }

    const loaded = results.filter((result) => result.status === "loaded");
    const reconcile = [
      ...results.filter((result) => result.status !== "loaded"),
      ...confirmedLines
        .filter((line) => !isWarehouseLoadableLine(line))
        .map((line) => ({
          status: "reconcile",
          reason: line.codice_articolo ? "Riga non classificata come materiale di magazzino" : "Codice articolo mancante",
          line,
        })),
    ];
    const nextStatus = resolveLogisticaStatus({
      allocationScope: normalizedAllocationScope,
      costCategory: normalizedCostCategory,
      warehouseRequired,
      loadedCount: loaded.length,
      reconcileCount: reconcile.length,
    });

    const updatedSpesa = await tx.spesa.update({
      where: { id: spesa.id },
      data: {
        documento_id: targetDocumentId ?? spesa.documento_id,
        fornitore_id: supplier?.id ?? spesa.fornitore_id ?? null,
        cost_category: normalizedCostCategory,
        allocation_scope: normalizedAllocationScope,
        ocr_payload: {
          ...ocrPayload,
          confirmation: {
            confirmed_at: new Date().toISOString(),
            confirmed_by_user_id: user?.id ?? null,
            ubicazione_id: targetLocation?.id ?? null,
            fornitore_id: supplier?.id ?? null,
            fornitore_action: supplierResult?.action ?? null,
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

    const fatturaAcquisto = await upsertPurchaseInvoiceFromOcr(tx, {
      spesaId: spesa.id,
      documentId: targetDocumentId ?? spesa.documento_id ?? null,
      fornitoreId: supplier?.id ?? spesa.fornitore_id ?? null,
      cantiereId: spesa.cantiere_id ?? null,
      ocrPayload,
      lines: confirmedLines,
      movementResults: results,
    });

    return {
      spesa: updatedSpesa,
      document_id: targetDocumentId ?? null,
      fatturaAcquisto,
      fattura_acquisto_draft: buildPurchaseInvoiceDraft(ocrPayload, confirmedLines),
      ubicazione: targetLocation,
      fornitore: supplier,
      fornitoreAction: supplierResult?.action ?? null,
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

export async function confirmGenericInvoiceOcr(prisma, {
  upload,
  ocrPayload,
  lines = [],
  spesaId = null,
  cantiereId = null,
  ubicazioneId = null,
  costCategory = null,
  allocationScope = null,
  user,
}) {
  const normalizedPayload = normalizeInvoiceOcrPayload({
    ...ocrPayload,
    ...(costCategory ? { cost_category: costCategory } : {}),
    ...(allocationScope ? { allocation_scope: allocationScope } : {}),
  });
  const confirmedLines = normalizeConfirmLines(lines, normalizedPayload);
  const warehouseLines = confirmedLines.filter(isWarehouseLoadableLine);
  const warehouseRequired = shouldRequireWarehouse(normalizedPayload, confirmedLines);
  const normalizedCostCategory = normalizeCostCategory(normalizedPayload.cost_category);
  const normalizedAllocationScope = normalizeAllocationScope(normalizedPayload.allocation_scope, normalizedCostCategory);
  const payloadForSave = {
    ...normalizedPayload,
    cost_category: normalizedCostCategory,
    allocation_scope: normalizedAllocationScope,
    logistica_required: warehouseRequired,
    righe_materiali: confirmedLines,
  };
  const targetSpesaId = spesaId ? Number(spesaId) : null;

  if (targetSpesaId) {
    const existingSpesa = await ensureSpesaAccess(prisma, user, targetSpesaId);
    if (existingSpesa.logistica_status === LogisticaStatus.LOADED_TO_WAREHOUSE) {
      throw httpError("Questa spesa è già stata caricata a magazzino.", 409);
    }
    const { document, updatedSpesa, supplierResult, fatturaAcquisto } = await prisma.$transaction(async (tx) => {
      const document = await createOcrDocumentFromStoredUpload(tx, {
        cantiereId: existingSpesa.cantiere_id,
        upload,
        user,
        ocrPayload: payloadForSave,
      });
      const supplierResult = warehouseRequired && warehouseLines.length > 0
        ? null
        : await upsertSupplierFromOcr(tx, payloadForSave);
      const updatedSpesa = await tx.spesa.update({
        where: { id: existingSpesa.id },
        data: {
          documento_id: document.id,
          ocr_payload: payloadForSave,
          fornitore_id: supplierResult?.fornitore?.id ?? existingSpesa.fornitore_id ?? null,
          cost_category: normalizedCostCategory,
          allocation_scope: normalizedAllocationScope,
          logistica_status: resolveLogisticaStatus({
            allocationScope: normalizedAllocationScope,
            costCategory: normalizedCostCategory,
            warehouseRequired,
            reconcileCount: confirmedLines.filter((line) => !isWarehouseLoadableLine(line)).length,
          }),
        },
        include: {
          cantiere: { select: { id: true, nome: true } },
          documento: { select: { id: true, name: true } },
        },
      });

      const fatturaAcquisto = await upsertPurchaseInvoiceFromOcr(tx, {
        spesaId: existingSpesa.id,
        documentId: document.id,
        fornitoreId: supplierResult?.fornitore?.id ?? existingSpesa.fornitore_id ?? null,
        cantiereId: existingSpesa.cantiere_id ?? null,
        ocrPayload: payloadForSave,
        lines: confirmedLines,
      });

      return { document, updatedSpesa, supplierResult, fatturaAcquisto };
    });

    if (!warehouseRequired || warehouseLines.length === 0) {
      return {
        spesa: updatedSpesa,
        document,
        ocrPayload: payloadForSave,
        fatturaAcquisto,
        fattura_acquisto_draft: buildPurchaseInvoiceDraft(payloadForSave, confirmedLines),
        suggestedLines: confirmedLines,
        fornitore: supplierResult?.fornitore ?? null,
        fornitoreAction: supplierResult?.action ?? null,
        movimentiCaricoCreati: 0,
        articoliCreati: 0,
        righeDaRiconciliare: warehouseRequired
          ? confirmedLines.filter((line) => !isWarehouseLoadableLine(line)).length
          : 0,
        righeDaRiconciliareDettaglio: confirmedLines.map((line) => ({
          reason: warehouseRequired
            ? (line.codice_articolo ? "SKU non normalizzabile" : "Codice articolo mancante")
            : "Costo non logistico: nessun carico magazzino richiesto",
          line,
        })),
      };
    }

    return confirmSpesaOcr(prisma, {
      spesaId: existingSpesa.id,
      documentId: document.id,
      lines: confirmedLines,
      ubicazioneId,
      user,
    });
  }

  const parsedCantiereId = Number(cantiereId);
  const hasProjectCantiere = Number.isInteger(parsedCantiereId) && parsedCantiereId > 0;
  if (normalizedAllocationScope === CostAllocationScope.PROJECT && !hasProjectCantiere) {
    throw httpError("Per una spesa di progetto seleziona un cantiere prima della registrazione.", 400);
  }
  if (!user?.employee_id) {
    throw httpError("Utente senza employee_id collegato: impossibile creare la spesa OCR.", 400);
  }

  if (hasProjectCantiere) {
    const allowed = await canAccessCantiere(prisma, user, parsedCantiereId, {
      globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
      ownerRoles: ["PROJECT_MANAGER"],
    });
    if (!allowed) throw httpError("Accesso negato al cantiere selezionato.", 403);
  } else if (!["ADMIN", "HR", "WAREHOUSEMAN"].includes(user?.role)) {
    throw httpError("Solo amministrazione o magazzino possono registrare costi overhead senza cantiere.", 403);
  }

  const importo = parseMoney(normalizedPayload.totale_documento);
  if (!importo || importo <= 0) {
    throw httpError("Totale documento mancante: impossibile creare una nuova spesa OCR.", 400);
  }

  const { spesa, document, supplierResult, fatturaAcquisto } = await prisma.$transaction(async (tx) => {
    const rootWbs = hasProjectCantiere
      ? await tx.wbsNode.findFirst({
          where: { cantiere_id: parsedCantiereId, parent_id: null },
          select: { id: true },
        })
      : null;
    const document = await createOcrDocumentFromStoredUpload(tx, {
      cantiereId: hasProjectCantiere ? parsedCantiereId : null,
      upload,
      user,
      ocrPayload: payloadForSave,
    });
    const supplierResult = warehouseRequired && warehouseLines.length > 0
      ? null
      : await upsertSupplierFromOcr(tx, payloadForSave);

    const spesa = await tx.spesa.create({
      data: {
        timestamp_utc: parseDateOnly(payloadForSave.data_documento) ?? new Date(),
        employee_id: Number(user.employee_id),
        cantiere_id: hasProjectCantiere ? parsedCantiereId : null,
        wbs_node_id: rootWbs?.id ?? null,
        importo,
        fornitore: supplierNameFromPayload(payloadForSave),
        fornitore_id: supplierResult?.fornitore?.id ?? null,
        descrizione: normalizeOptionalText(`OCR fattura ${payloadForSave.numero_documento ?? ""}`),
        fonte: "OCR_WEB",
        input_method: "invoice_ocr",
        fattura_rif: payloadForSave.numero_documento,
        stato_validazione: "PENDING",
        cost_category: normalizedCostCategory,
        allocation_scope: normalizedAllocationScope,
        logistica_status: resolveLogisticaStatus({
          allocationScope: normalizedAllocationScope,
          costCategory: normalizedCostCategory,
          warehouseRequired,
          reconcileCount: confirmedLines.filter((line) => !isWarehouseLoadableLine(line)).length,
        }),
        documento_id: document.id,
        ocr_payload: payloadForSave,
      },
      include: {
        cantiere: { select: { id: true, nome: true } },
        documento: { select: { id: true, name: true } },
      },
    });

    const fatturaAcquisto = await upsertPurchaseInvoiceFromOcr(tx, {
      spesaId: spesa.id,
      documentId: document.id,
      fornitoreId: supplierResult?.fornitore?.id ?? null,
      cantiereId: hasProjectCantiere ? parsedCantiereId : null,
      ocrPayload: payloadForSave,
      lines: confirmedLines,
    });

    return { spesa, document, supplierResult, fatturaAcquisto };
  });

  if (!warehouseRequired || warehouseLines.length === 0) {
    return {
      spesa,
      document,
      ocrPayload: payloadForSave,
      fatturaAcquisto,
      fattura_acquisto_draft: buildPurchaseInvoiceDraft(payloadForSave, confirmedLines),
      suggestedLines: confirmedLines,
      fornitore: supplierResult?.fornitore ?? null,
      fornitoreAction: supplierResult?.action ?? null,
      movimentiCaricoCreati: 0,
      articoliCreati: 0,
      righeDaRiconciliare: warehouseRequired
        ? confirmedLines.filter((line) => !isWarehouseLoadableLine(line)).length
        : 0,
      righeDaRiconciliareDettaglio: confirmedLines.map((line) => ({
        reason: warehouseRequired
          ? (line.codice_articolo ? "SKU non normalizzabile" : "Codice articolo mancante")
          : "Costo non logistico: nessun carico magazzino richiesto",
        line,
      })),
    };
  }

  return confirmSpesaOcr(prisma, {
    spesaId: spesa.id,
    documentId: spesa.documento_id,
    lines: confirmedLines,
    ubicazioneId,
    user,
    allowNonGenya: true,
  });
}

export async function matchSpesaOcr(prisma, { ocrPayload, user, cantiereId = null }) {
  const normalizedPayload = normalizeInvoiceOcrPayload(ocrPayload);
  const matches = await findOcrExpenseMatches(prisma, normalizedPayload, { cantiereId });
  const visibleMatches = [];

  for (const match of matches) {
    const allowed = match.spesa.cantiere_id
      ? await canAccessCantiere(prisma, user, match.spesa.cantiere_id, {
          globalRoles: ["ADMIN", "HR", "WAREHOUSEMAN"],
          ownerRoles: ["PROJECT_MANAGER"],
        })
      : ["ADMIN", "HR", "WAREHOUSEMAN"].includes(user?.role)
        || (user?.employee_id && Number(user.employee_id) === Number(match.spesa.employee_id));
    if (allowed) visibleMatches.push(match);
  }

  return {
    ocrPayload: normalizedPayload,
    candidates: visibleMatches,
  };
}
