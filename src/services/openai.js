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
  required: ["importo", "fornitore", "descrizione"],
  properties: {
    importo: { type: ["number", "null"] },
    fornitore: { type: ["string", "null"] },
    descrizione: { type: ["string", "null"] },
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
              content: "Sei un assistente esperto nell'estrazione dati da scontrini e fatture. Estrarre in formato JSON l'importo totale (come numero libero da valute, es. 15.50), il fornitore (nome negozio) e una generica e breve descrizione degli articoli. Se l'immagine è illeggibile, non è uno scontrino o manca l'importo totale, RESTITUISCI importo: null.",
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
    
    if (parsed.importo === null || typeof parsed.importo !== "number" || parsed.importo <= 0) {
      throw new Error("L'immagine non sembra contenere un importo valido o chiaro.");
    }
    
    return parsed;
  } catch (err) {
    logger.error({ err: serializeOpenAIError(err), event: "extract_spesa_failed" }, "extract_spesa_failed");
    throw err;
  }
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
