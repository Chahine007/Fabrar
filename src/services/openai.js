import fs from "fs";
import OpenAI from "openai";
import logger from "../logger.js";
import { withRetry } from "./retry.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "ore_totali",
    "ingresso",
    "pausa_inizio",
    "pausa_fine",
    "uscita",
    "attivita_svolte",
    "luogo_cantiere",
    "problemi_riscontrati",
  ],
  properties: {
    ore_totali: { type: ["number", "null"], minimum: 0, maximum: 24 },
    ingresso: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    pausa_inizio: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    pausa_fine: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    uscita: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    attivita_svolte: { type: ["string", "null"] },
    luogo_cantiere: { type: ["string", "null"] },
    problemi_riscontrati: { type: ["string", "null"] },
  },
};

const SYSTEM_PROMPT_BASE = [
  "Sei un assistente che estrae dati strutturati da un resoconto lavorativo.",
  "Restituisci SOLO JSON conforme allo schema.",
  "REGOLE FONDAMENTALI:",
  "1. I 'Dati gia' salvati' (se presenti) sono la base. DEVI ri-emettere questi valori identici per evitare di perdere dati precedenti, a meno che l'utente non modifichi specificamente quel campo. NON usare null se c'era gia' un valore e l'utente non lo sta cancellando.",
  "2. Orari sempre nel formato HH:mm (24h).",
  "3. SIGNIFICATI: 'ingresso' = inizio turno (es. arrivato); 'pausa_inizio' = inizio pranzo/sosta; 'pausa_fine' = fine pausa (es. 'tornato a lavorare'); 'uscita' = fine turno (es. 'finito di lavorare', 'uscito').",
  "4. Se l'utente dichiara le ore lavorate totali (es. 'ho lavorato 8 ore'), scrivi il numero in 'ore_totali'.",
  "5. INTEGRAZIONE: Se l'utente usa 'aggiungi' o 'inoltre', fai la somma matematica delle ore ('ore_totali') e concatena le nuove descrizioni a quelle esistenti.",
  "Evita testo extra."
].join(" ");

function buildSystemPrompt(currentState) {
  if (!currentState) return SYSTEM_PROMPT_BASE;
  const state = {
    ore_totali: currentState.ore_lavorate ?? null,
    ingresso: currentState.ingresso ?? null,
    pausa_inizio: currentState.pausa_inizio ?? null,
    pausa_fine: currentState.pausa_fine ?? null,
    uscita: currentState.uscita ?? null,
    attivita_svolte: currentState.attivita_svolte ?? null,
    luogo_cantiere: currentState.luogo_cantiere ?? null,
    problemi_riscontrati: currentState.problemi_riscontrati ?? null,
  };
  return [
    SYSTEM_PROMPT_BASE,
    "DATI GIA' SALVATI PER OGGI (USALI COME PUNTI DI PARTENZA, NON CANCELLARLI SE L'UTENTE NON LO RICHIEDE):",
    JSON.stringify(state),
  ].join("\n\n");
}

function serializeOpenAIError(err) {
  const cause = err?.cause;
  return {
    name: err?.name,
    message: err?.message,
    status: err?.status || err?.response?.status,
    code: err?.code || err?.error?.code,
    type: err?.type || err?.error?.type,
    cause: cause
      ? {
          name: cause?.name,
          message: cause?.message,
          code: cause?.code,
          type: cause?.type,
        }
      : undefined,
  };
}

function collectOpenAIErrorChain(err, seen = new Set()) {
  if (!err || (typeof err !== "object" && typeof err !== "function")) return [];
  if (seen.has(err)) return [];
  seen.add(err);
  return [err, ...collectOpenAIErrorChain(err.cause, seen), ...collectOpenAIErrorChain(err.error, seen)];
}

export function isInsufficientQuotaError(err) {
  return collectOpenAIErrorChain(err).some((current) => {
    const code = String(current?.code || current?.error?.code || "").toLowerCase();
    return code === "insufficient_quota";
  });
}

export function getOpenAIUserFacingMessage(err, messages = {}) {
  if (isInsufficientQuotaError(err)) {
    return (
      messages.insufficientQuota ||
      "⚠️ Il servizio AI non è disponibile per quota esaurita. Avvisa l'amministrazione o riprova più tardi."
    );
  }

  const hasRateLimit = collectOpenAIErrorChain(err).some((current) => {
    const status = current?.status || current?.response?.status;
    return status === 429;
  });
  if (hasRateLimit) {
    return (
      messages.rateLimit ||
      "⚠️ Il servizio AI è temporaneamente occupato. Riprova tra qualche minuto."
    );
  }

  return messages.default || "❌ Il servizio AI non è disponibile. Riprova più tardi.";
}

export async function transcribeAudio(filePath) {
  try {
    const transcription = await withRetry(
      () =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
        }),
      { name: "openai.transcribe" }
    );
    return transcription.text;
  } catch (err) {
    logger.error({ err: serializeOpenAIError(err), event: "transcription_failed" }, "transcription_failed");
    throw err;
  }
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function calculateExactHours(inTime, pauseIn, pauseOut, outTime) {
  const start = parseTimeToMinutes(inTime);
  const end = parseTimeToMinutes(outTime);
  if (start == null || end == null) return null;
  const total = end - start;
  if (total <= 0) return null;

  let pause = 0;
  if (pauseIn || pauseOut) {
    const pIn = parseTimeToMinutes(pauseIn);
    const pOut = parseTimeToMinutes(pauseOut);
    if (pIn == null || pOut == null) return null;
    pause = pOut - pIn;
    if (pause < 0 || pause > total) return null;
  }

  const minutes = total - pause;
  if (minutes <= 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

export async function extractReport(text, currentState = null) {
  try {
    const completion = await withRetry(
      () =>
        openai.chat.completions.create({
          model: process.env.OPENAI_EXTRACT_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: buildSystemPrompt(currentState) },
            { role: "user", content: text },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "daily_report", schema: EXTRACTION_SCHEMA, strict: true },
          },
        }),
      { name: "openai.extract" }
    );

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    
    let ore_lavorate = parsed.ore_totali;
    if (ore_lavorate == null) {
      ore_lavorate = calculateExactHours(
        parsed.ingresso,
        parsed.pausa_inizio,
        parsed.pausa_fine,
        parsed.uscita
      );
    }
    return { ...parsed, ore_lavorate };
  } catch (err) {
    logger.error({ err: serializeOpenAIError(err), event: "extract_failed" }, "extract_failed");
    throw err;
  }
}

const SPESA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "importo", "fornitore", "descrizione", "righe_materiali"],
  properties: {
    document_type: {
      type: "string",
      enum: ["RECEIPT", "DDT", "ACCOMPANYING_INVOICE", "UNKNOWN"],
    },
    importo: { type: ["number", "null"] },
    fornitore: { type: ["string", "null"] },
    descrizione: { type: ["string", "null"] },
    righe_materiali: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["codice_sku", "descrizione", "quantita", "unita_misura", "costo_unitario"],
        properties: {
          codice_sku: { type: ["string", "null"] },
          descrizione: { type: ["string", "null"] },
          quantita: { type: ["number", "null"] },
          unita_misura: { type: ["string", "null"] },
          costo_unitario: { type: ["number", "null"] },
        },
      },
    },
  },
};

export async function extractSpesaFromImage(base64Image) {
  try {
    const completion = await withRetry(
      () =>
        openai.chat.completions.create({
          model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "Sei un assistente esperto nell'estrazione dati da scontrini, DDT e fatture accompagnatorie.",
                "Classifica il documento in document_type: RECEIPT, DDT, ACCOMPANYING_INVOICE oppure UNKNOWN.",
                "Estrai sempre importo totale, fornitore e una descrizione breve quando presenti.",
                "Se il documento contiene righe materiali, estrai righe_materiali con codice_sku, descrizione, quantita, unita_misura e costo_unitario.",
                "Compila codice_sku solo quando il codice articolo e' chiaramente leggibile; non inventare SKU.",
                "Per scontrini semplici senza codici articolo, righe_materiali deve essere [].",
                "Se l'immagine e' illeggibile o non contiene importo totale, restituisci importo: null.",
              ].join(" "),
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Estrai i dati da questa immagine." },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "spesa_schema", schema: SPESA_SCHEMA, strict: true },
          },
        }),
      { name: "openai.extractSpesa" }
    );

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    parsed.righe_materiali = Array.isArray(parsed.righe_materiali) ? parsed.righe_materiali : [];
    const hasMaterialRows = parsed.righe_materiali.length > 0;
    
    if (!hasMaterialRows && (parsed.importo === null || typeof parsed.importo !== "number" || parsed.importo <= 0)) {
      throw new Error("L'immagine non sembra contenere un importo valido o chiaro.");
    }
    
    return parsed;
  } catch (err) {
    logger.error({ err: serializeOpenAIError(err), event: "extract_spesa_failed" }, "extract_spesa_failed");
    throw err;
  }
}

const INVOICE_OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "document_type",
    "cost_category",
    "allocation_scope",
    "logistica_required",
    "tipo_documento",
    "numero_documento",
    "data_documento",
    "codice_destinatario",
    "fornitore",
    "cliente",
    "totale_imponibile",
    "totale_imposta",
    "totale_documento",
    "pagamento",
    "righe_materiali",
    "righe_costo",
  ],
  properties: {
    document_type: {
      type: "string",
      enum: ["INVOICE", "DDT", "ACCOMPANYING_INVOICE", "CREDIT_NOTE", "RECEIPT", "UNKNOWN"],
    },
    cost_category: {
      type: "string",
      enum: [
        "INVENTORY_MATERIAL",
        "CONSUMABLE_SUPPLY",
        "SERVICE",
        "LEASING_RENTAL",
        "UTILITY",
        "INSURANCE",
        "TAX_FEE",
        "PROFESSIONAL_SERVICE",
        "TRAVEL_VEHICLE",
        "OTHER",
        "UNKNOWN",
      ],
    },
    allocation_scope: {
      type: "string",
      enum: ["PROJECT", "OVERHEAD", "REVIEW"],
    },
    logistica_required: { type: "boolean" },
    tipo_documento: { type: ["string", "null"] },
    numero_documento: { type: ["string", "null"] },
    data_documento: { type: ["string", "null"] },
    codice_destinatario: { type: ["string", "null"] },
    fornitore: {
      type: "object",
      additionalProperties: false,
      required: ["ragione_sociale", "partita_iva", "codice_fiscale", "indirizzo", "comune", "provincia", "cap"],
      properties: {
        ragione_sociale: { type: ["string", "null"] },
        partita_iva: { type: ["string", "null"] },
        codice_fiscale: { type: ["string", "null"] },
        indirizzo: { type: ["string", "null"] },
        comune: { type: ["string", "null"] },
        provincia: { type: ["string", "null"] },
        cap: { type: ["string", "null"] },
      },
    },
    cliente: {
      type: "object",
      additionalProperties: false,
      required: ["ragione_sociale", "partita_iva", "codice_fiscale", "indirizzo", "comune", "provincia", "cap"],
      properties: {
        ragione_sociale: { type: ["string", "null"] },
        partita_iva: { type: ["string", "null"] },
        codice_fiscale: { type: ["string", "null"] },
        indirizzo: { type: ["string", "null"] },
        comune: { type: ["string", "null"] },
        provincia: { type: ["string", "null"] },
        cap: { type: ["string", "null"] },
      },
    },
    totale_imponibile: { type: ["number", "null"] },
    totale_imposta: { type: ["number", "null"] },
    totale_documento: { type: ["number", "null"] },
    pagamento: {
      type: "object",
      additionalProperties: false,
      required: ["modalita_pagamento", "iban", "scadenza", "importo_scadenza"],
      properties: {
        modalita_pagamento: { type: ["string", "null"] },
        iban: { type: ["string", "null"] },
        scadenza: { type: ["string", "null"] },
        importo_scadenza: { type: ["number", "null"] },
      },
    },
    righe_materiali: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "codice_articolo",
          "descrizione",
          "quantita",
          "unita_misura",
          "prezzo_unitario",
          "iva_percentuale",
          "prezzo_totale",
          "cost_category",
          "stockable",
        ],
        properties: {
          codice_articolo: { type: ["string", "null"] },
          descrizione: { type: ["string", "null"] },
          quantita: { type: ["number", "null"] },
          unita_misura: { type: ["string", "null"] },
          prezzo_unitario: { type: ["number", "null"] },
          iva_percentuale: { type: ["number", "null"] },
          prezzo_totale: { type: ["number", "null"] },
          cost_category: {
            type: "string",
            enum: [
              "INVENTORY_MATERIAL",
              "CONSUMABLE_SUPPLY",
              "SERVICE",
              "LEASING_RENTAL",
              "UTILITY",
              "INSURANCE",
              "TAX_FEE",
              "PROFESSIONAL_SERVICE",
              "TRAVEL_VEHICLE",
              "OTHER",
              "UNKNOWN",
            ],
          },
          stockable: { type: "boolean" },
        },
      },
    },
    righe_costo: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "descrizione",
          "cost_category",
          "allocation_scope",
          "importo",
          "iva_percentuale",
          "quantita",
          "unita_misura",
          "prezzo_unitario",
        ],
        properties: {
          descrizione: { type: ["string", "null"] },
          cost_category: {
            type: "string",
            enum: [
              "INVENTORY_MATERIAL",
              "CONSUMABLE_SUPPLY",
              "SERVICE",
              "LEASING_RENTAL",
              "UTILITY",
              "INSURANCE",
              "TAX_FEE",
              "PROFESSIONAL_SERVICE",
              "TRAVEL_VEHICLE",
              "OTHER",
              "UNKNOWN",
            ],
          },
          allocation_scope: {
            type: "string",
            enum: ["PROJECT", "OVERHEAD", "REVIEW"],
          },
          importo: { type: ["number", "null"] },
          iva_percentuale: { type: ["number", "null"] },
          quantita: { type: ["number", "null"] },
          unita_misura: { type: ["string", "null"] },
          prezzo_unitario: { type: ["number", "null"] },
        },
      },
    },
  },
};

function buildInvoiceOcrUserContent(base64File, mimeType, filename = "documento") {
  const prompt = { type: "text", text: "Estrai i dati strutturati da questa fattura/DDT." };
  if (mimeType === "application/pdf") {
    return [
      prompt,
      {
        type: "file",
        file: {
          filename: filename || "documento.pdf",
          file_data: `data:${mimeType};base64,${base64File}`,
        },
      },
    ];
  }

  return [
    prompt,
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64File}` },
    },
  ];
}

export async function extractInvoiceOcrFromFile(base64File, mimeType = "image/jpeg", filename = "documento") {
  try {
    const completion = await withRetry(
      () =>
        openai.chat.completions.create({
          model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "Sei un assistente OCR per fatture, DDT e fatture accompagnatorie italiane.",
                "Estrai i dati leggibili senza inventare campi mancanti.",
                "Estrai tipo_documento come testo leggibile dalla tabella, ad esempio 'TD01 fattura'.",
                "Usa numero_documento dal campo Numero documento e data_documento dal campo Data documento.",
                "Estrai codice_destinatario se presente.",
                "Classifica il costo contabile: INVENTORY_MATERIAL per materiali fisici stockabili; CONSUMABLE_SUPPLY per forniture consumabili; SERVICE per servizi generici; LEASING_RENTAL per leasing, noleggi, canoni auto o locazioni operative; UTILITY per utenze; INSURANCE per assicurazioni; TAX_FEE per tasse/diritti; PROFESSIONAL_SERVICE per consulenze; TRAVEL_VEHICLE per carburante, pedaggi, manutenzione veicoli; OTHER o UNKNOWN se non chiaro.",
                "allocation_scope deve essere OVERHEAD per leasing, noleggi auto, utenze, assicurazioni, tasse, servizi aziendali e costi generali; PROJECT solo per costi chiaramente imputabili a un cantiere; REVIEW se serve decisione manuale.",
                "logistica_required deve essere true solo quando il documento contiene materiali fisici da caricare in magazzino.",
                "Nelle righe_materiali inserisci solo articoli fisici stockabili. codice_articolo deve essere compilato solo se la colonna Cod. articolo e' leggibile; non usare numeri pratica, targa, modello auto, numero rata o codici servizio come SKU.",
                "Le righe di servizi, leasing, spese di incasso, canoni, rimborsi e costi non stockabili vanno in righe_costo, non in righe_materiali.",
                "Per fatture di leasing/noleggio auto: cost_category LEASING_RENTAL, allocation_scope OVERHEAD, logistica_required false, righe_materiali vuoto.",
                "I totali devono essere numeri senza simbolo valuta e con punto decimale.",
                "Estrai anche modalita_pagamento, IBAN, scadenza e importo_scadenza quando sono presenti.",
              ].join(" "),
            },
            {
              role: "user",
              content: buildInvoiceOcrUserContent(base64File, mimeType, filename),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "invoice_ocr_schema", schema: INVOICE_OCR_SCHEMA, strict: true },
          },
        }),
      { name: "openai.extractInvoiceOcr" }
    );

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    parsed.righe_materiali = Array.isArray(parsed.righe_materiali) ? parsed.righe_materiali : [];
    parsed.righe_costo = Array.isArray(parsed.righe_costo) ? parsed.righe_costo : [];
    return parsed;
  } catch (err) {
    logger.error({ err: serializeOpenAIError(err), event: "extract_invoice_ocr_failed" }, "extract_invoice_ocr_failed");
    throw err;
  }
}

export async function extractInvoiceOcrFromImage(base64Image, mimeType = "image/jpeg") {
  return extractInvoiceOcrFromFile(base64Image, mimeType, "immagine-fattura");
}

// ─── CV TEXT PARSING ──────────────────────────────────────────
const CV_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ruolo", "skills"],
  properties: {
    ruolo: { type: ["string", "null"] },
    skills: { type: "array", items: { type: "string" } },
  },
};

export async function extractCVData(text) {
  try {
    const completion = await withRetry(
      () =>
        openai.chat.completions.create({
          model: process.env.OPENAI_EXTRACT_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "Sei un assistente HR esperto nell'analisi di Curriculum Vitae.",
                "Dal testo del CV, estrai:",
                "- ruolo: il titolo professionale principale o la qualifica più recente (es. 'Muratore specializzato', 'Carpentiere', 'Elettricista'). Se non identificabile, null.",
                "- skills: un array di competenze tecniche e professionali rilevanti per il settore edile/costruzioni. Max 10 skills, ordinate per rilevanza. Usa nomi brevi (es. 'Cartongesso', 'Saldatura', 'Ponteggi', 'Patente C').",
                "Restituisci SOLO JSON conforme allo schema. Nessun testo extra.",
              ].join(" "),
            },
            { role: "user", content: text },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "cv_parsing", schema: CV_SCHEMA, strict: true },
          },
        }),
      { name: "openai.extractCV" }
    );

    const raw = completion.choices?.[0]?.message?.content || "{}";
    return JSON.parse(raw);
  } catch (err) {
    logger.error({ err: serializeOpenAIError(err), event: "extract_cv_failed" }, "extract_cv_failed");
    throw err;
  }
}
