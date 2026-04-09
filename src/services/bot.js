import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";
import logger from "../logger.js";
import {
  findEmployeeByTelegramId,
  createEmployee,
  updateEmployee,
  insertMessageLog,
  cantiereExists,
  getCantieriAttivi,
  insertSpesa,
  getCantieriConCoordinate,
  getEmployeesWithoutReport,
  ensureDailyReportHeader,
  createReportEntry,
  listReportEntriesByEmployeeAndDate,
  updateReportHeader,
} from "../db/index.js";
import { tgSendMessage, tgGetFile, tgDownloadFile, tgEditMessageText, tgAnswerCallbackQuery } from "./telegram.js";
import { transcribeAudio, extractReport, extractSpesaFromImage, getOpenAIUserFacingMessage } from "./openai.js";
import { maybeConvertToWav } from "./audio.js";
import { calculateDistance } from "../utils/geo.js";

const pendingExpenses = new Map();

const log = logger.child({ module: "bot" });
const TIMEZONE = process.env.TIMEZONE || "Europe/Rome";

const PRIVACY_TEXT = [
  "INFORMATIVA PRIVACY",
  "",
  "Titolare del trattamento: Fabdar di Chtioui Souhaiel & C. SAS, con sede in Via dell'Artigianato 17, Sona VR, PEC: fabdarsas@legalmail.it.",
  "",
  "Il bot aziendale tratta i dati personali conferiti per gestire report giornalieri, spese, organizzazione operativa del personale e certificazione della presenza in cantiere.",
  "",
  "Possono essere trattati dati identificativi e di contatto associati all'utenza Telegram, contenuti inviati tramite il bot (testi, audio, immagini e dati di spesa) e dati di posizione GPS solo quando inviati dall'utente.",
  "",
  "La geolocalizzazione GPS e' puntuale e volontaria: viene usata solo quando il lavoratore decide di inviare la posizione per certificare la presenza in cantiere. Non costituisce monitoraggio continuo, in background o h24.",
  "",
  "Il trattamento avviene con strumenti elettronici da parte di personale autorizzato, nei limiti delle finalita aziendali, amministrative e organizzative connesse al rapporto di lavoro o collaborazione e agli eventuali obblighi di legge.",
  "",
  "I dati raccolti tramite il bot sono conservati per 12 mesi, salvo tempi diversi imposti dalla legge o necessari per la tutela dei diritti del titolare.",
  "",
  "L'interessato puo' esercitare i diritti previsti dalla normativa applicabile, inclusi accesso, rettifica, cancellazione, limitazione del trattamento, opposizione e reclamo al Garante per la protezione dei dati personali, scrivendo alla PEC fabdarsas@legalmail.it.",
].join("\n");

const GDPR_ACCEPT_COMMAND_MESSAGE =
  "Se accetti l'informativa sopra riportata e acconsenti al trattamento, invia ora il comando /accetto_gdpr";

const GDPR_NOTICE_MESSAGE = [PRIVACY_TEXT, GDPR_ACCEPT_COMMAND_MESSAGE].join("\n\n");

const GDPR_BLOCK_MESSAGE = [
  "⚠️ Per usare il bot devi accettare l'informativa privacy e il trattamento dei dati personali (GDPR).",
  "",
  "Invia il comando /accetto_gdpr quando hai letto e accetti l'informativa fornita dall'azienda.",
  "",
  "Fino ad allora non verranno salvati report, spese, posizione né altri dati.",
].join("\n");

function isGdprAccepted(employee) {
  return employee.gdpr_accettato === 1;
}

async function sendGdprNotice(chatId) {
  await tgSendMessage(chatId, GDPR_NOTICE_MESSAGE);
}

/** Stato per extractReport: bozza pending_json oppure righe già salvate in report_entries. */
async function getExtractionState(employeeId, reportDate, pendingJson) {
  if (pendingJson) {
    try {
      const p = JSON.parse(pendingJson);
      const { __bot_fonte, ...rest } = p;
      void __bot_fonte;
      return {
        ...rest,
        ore_lavorate: rest.ore_lavorate ?? rest.ore_totali ?? null,
      };
    } catch {
      return null;
    }
  }
  const entries = await listReportEntriesByEmployeeAndDate(employeeId, reportDate);
  if (!entries.length) return null;
  const state = {
    ore_lavorate: null,
    ingresso: null,
    pausa_inizio: null,
    pausa_fine: null,
    uscita: null,
    attivita_svolte: null,
    luogo_cantiere: null,
    problemi_riscontrati: null,
  };
  let oreSum = 0;
  let hasOre = false;
  for (const e of entries) {
    if (e.ore_lavorate != null && Number.isFinite(e.ore_lavorate)) {
      oreSum += e.ore_lavorate;
      hasOre = true;
    }
    for (const field of [
      "ingresso",
      "pausa_inizio",
      "pausa_fine",
      "uscita",
      "attivita_svolte",
      "luogo_cantiere",
      "problemi_riscontrati",
    ]) {
      if (e[field] != null && e[field] !== "") {
        state[field] = e[field];
      }
    }
  }
  state.ore_lavorate = hasOre ? oreSum : null;
  return state;
}

/** Salva ore su report_entries (PENDING); aggiorna solo metadati sulla testata reports. */
async function saveManualReportRows(employeeId, reportDate, extracted, originalText, fonte) {
  const reportId = await ensureDailyReportHeader(employeeId, reportDate);
  let cantiereId = null;
  if (extracted.cantiere_id != null) {
    const ok = await cantiereExists(extracted.cantiere_id);
    if (ok) cantiereId = extracted.cantiere_id;
  }
  const oreCalcolate = calcOreFromOrari(extracted);
  const oreLavorate = extracted.ore_totali ?? oreCalcolate;
  await createReportEntry({
    report_id: reportId,
    cantiere_id: cantiereId,
    ore_lavorate: oreLavorate ?? null,
    ingresso: extracted.ingresso ?? null,
    pausa_inizio: extracted.pausa_inizio ?? null,
    pausa_fine: extracted.pausa_fine ?? null,
    uscita: extracted.uscita ?? null,
    attivita_svolte: extracted.attivita_svolte ?? null,
    luogo_cantiere: extracted.luogo_cantiere ?? null,
    problemi_riscontrati: extracted.problemi_riscontrati ?? null,
    testo_originale: originalText,
    stato_validazione: "PENDING",
    fonte,
  });
  await updateReportHeader(reportId, {
    data_utc: new Date().toISOString(),
    testo_originale: originalText,
    stato_validazione: "PENDING",
  });
}

function calcOreFromOrari({ ingresso, uscita, pausa_inizio, pausa_fine }) {
  if (!ingresso || !uscita) return null;
  const start = DateTime.fromFormat(ingresso, "HH:mm", { zone: TIMEZONE });
  const end = DateTime.fromFormat(uscita, "HH:mm", { zone: TIMEZONE });
  if (!start.isValid || !end.isValid) return null;

  let diff = end.diff(start, "hours").hours;
  if (!Number.isFinite(diff)) return null;

  if (pausa_inizio && pausa_fine && diff > 0) {
    const pIn = DateTime.fromFormat(pausa_inizio, "HH:mm", { zone: TIMEZONE });
    const pOut = DateTime.fromFormat(pausa_fine, "HH:mm", { zone: TIMEZONE });
    if (pIn.isValid && pOut.isValid) {
      const pause = pOut.diff(pIn, "hours").hours;
      if (Number.isFinite(pause)) diff -= pause;
    }
  }

  const rounded = Math.round(diff * 100) / 100;
  return Math.max(0, rounded);
}

function mergeWithCurrentState(extracted, currentState) {
  if (!currentState) return extracted;
  const merged = { ...extracted };
  const current = {
    ore_totali: currentState.ore_totali ?? currentState.ore_lavorate ?? null,
    ore_lavorate: currentState.ore_lavorate ?? currentState.ore_totali ?? null,
    ingresso: currentState.ingresso ?? null,
    pausa_inizio: currentState.pausa_inizio ?? null,
    pausa_fine: currentState.pausa_fine ?? null,
    uscita: currentState.uscita ?? null,
    attivita_svolte: currentState.attivita_svolte ?? null,
    luogo_cantiere: currentState.luogo_cantiere ?? null,
    problemi_riscontrati: currentState.problemi_riscontrati ?? null,
  };
  for (const field of Object.keys(current)) {
    if (merged[field] == null || merged[field] === "") {
      merged[field] = current[field];
    }
  }
  return merged;
}

function buildConfirmMessage(extracted, oreCalcolate, title = "Report salvato con successo!") {
  const lines = [title, ""];
  
  if (extracted.ingresso) lines.push(`🕐 Ingresso: ${extracted.ingresso}`);
  
  if (extracted.pausa_inizio && extracted.pausa_fine) {
    lines.push(`☕ Pausa: ${extracted.pausa_inizio}–${extracted.pausa_fine}`);
  } else if (extracted.pausa_inizio) {
    lines.push(`☕ Pausa: ${extracted.pausa_inizio}`);
  } else if (extracted.pausa_fine) {
    lines.push(`☕ Pausa: ${extracted.pausa_fine}`);
  }
  
  if (extracted.uscita) lines.push(`🚪 Uscita: ${extracted.uscita}`);
  
  const oreLavorate = extracted.ore_totali ?? oreCalcolate;
  if (oreLavorate !== null) {
    lines.push(`⏱️ Ore lavorate: ${oreLavorate}h`);
  }
  
  if (extracted.attivita_svolte) lines.push(`🛠️ Attività: ${extracted.attivita_svolte}`);
  if (extracted.luogo_cantiere) lines.push(`📍 Luogo: ${extracted.luogo_cantiere}`);
  if (extracted.problemi_riscontrati) lines.push(`⚠️ Problemi: ${extracted.problemi_riscontrati}`);
  
  return lines.join("\n");
}

// getMissingFields rimossa: era sempre vuota e non conteneva logica reale.

async function withProgressMessage(chatId, asyncFn) {
  const timer = setTimeout(() => {
    tgSendMessage(chatId, "⏳ Elaborazione in corso...").catch(() => {});
  }, 2000);
  try {
    return await asyncFn();
  } finally {
    clearTimeout(timer);
  }
}

// rimossi isConfirm e isModify

function isCancel(t) {
  const lower = t.toLowerCase();
  return lower === "/annulla" || lower === "annulla";
}

function parseEditCommand(text) {
  const match = text.match(/^\/edit(?:\s+(\S+))?$/i);
  if (!match) return { ok: false, error: "Comando non valido." };
  const rawDate = match[1];
  if (!rawDate) return { ok: true, date: localReportDate(-1) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { ok: false, error: "Formato non valido. Usa esattamente YYYY-MM-DD (es. /edit 2026-03-20)." };
  }
  const dt = DateTime.fromISO(rawDate, { zone: TIMEZONE });
  if (!dt.isValid) {
    return { ok: false, error: "Data non valida. Usa una data reale (es. /edit 2026-03-20)." };
  }
  const today = DateTime.now().setZone(TIMEZONE).startOf("day");
  if (dt.startOf("day") > today) {
    return { ok: false, error: "La data non può essere nel futuro. Usa una data passata o oggi (es. /edit 2026-03-20)." };
  }
  return { ok: true, date: dt.toFormat("yyyy-LL-dd") };
}

function localReportDate(offsetDays = 0) {
  return DateTime.now().setZone(TIMEZONE).plus({ days: offsetDays }).toFormat("yyyy-LL-dd");
}

async function clearPending(employeeId) {
  await updateEmployee(employeeId, {
    pending_json: null,
    pending_text: null,
    pending_date: null,
    pending_report_date: null,
  });
}

async function setPending(employeeId, extracted, originalText, reportDate) {
  await updateEmployee(employeeId, {
    pending_json: JSON.stringify(extracted),
    pending_text: originalText,
    pending_date: DateTime.now().setZone(TIMEZONE).toISO(),
    pending_report_date: reportDate,
  });
}

async function writeStreamToFile(stream, filePath) {
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    stream.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

export async function handleCallbackQuery(cq) {
  const data = cq.data;
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const telegramId = cq.from.id;
  
  const employee = await findEmployeeByTelegramId(telegramId);
  if (!employee) {
    await tgAnswerCallbackQuery(cq.id, "Utente non trovato.");
    return;
  }

  if (!isGdprAccepted(employee)) {
    await tgAnswerCallbackQuery(cq.id, "Accetta prima il GDPR con /accetto_gdpr.");
    await sendGdprNotice(chatId);
    return;
  }

  if (data.startsWith("spesa:")) {
    const parts = data.split(":");
    if (parts.length < 3) return;
    const refMsgId = parts[1];
    const cantiereId = parseInt(parts[2], 10);

    const expenseData = pendingExpenses.get(refMsgId);
    if (!expenseData) {
      await tgAnswerCallbackQuery(cq.id, "Sessione scaduta o spesa già assegnata.");
      await tgEditMessageText(chatId, messageId, "⌛ Scontrino: sessione scaduta.");
      return;
    }

    try {
      await insertSpesa(
        expenseData.employeeId,
        cantiereId,
        expenseData.importo,
        expenseData.fornitore,
        expenseData.descrizione,
        "TELEGRAM_OCR",
        null
      );
      
      clearTimeout(expenseData.timeoutId);
      pendingExpenses.delete(refMsgId);

      await tgEditMessageText(chatId, messageId, `💶 Spesa di ${expenseData.importo}€ salvata e assegnata al cantiere!`);
      await tgAnswerCallbackQuery(cq.id, "Spesa salvata!");
    } catch (err) {
      log.error({ err, event: "insert_spesa_failed" }, "insert_spesa_failed");
      await tgAnswerCallbackQuery(cq.id, "Errore durante il salvataggio.");
    }
    return;
  }

  if (!employee.pending_json) {
    await tgAnswerCallbackQuery(cq.id, "Nessuna bozza in sospeso o già confermata.");
    return;
  }

  if (data === "confirm") {
    const parsed = JSON.parse(employee.pending_json);
    const fonte = parsed.__bot_fonte === "TELEGRAM_AUDIO" ? "TELEGRAM_AUDIO" : "TELEGRAM_TESTO";
    const { __bot_fonte, ...extracted } = parsed;
    const reportDate = employee.pending_report_date || localReportDate();
    await saveManualReportRows(employee.id, reportDate, extracted, employee.pending_text || "", fonte);
    await clearPending(employee.id);
    const oreCalcolate = calcOreFromOrari(extracted);
    const msg = buildConfirmMessage(extracted, oreCalcolate, "Aggiornamento report registrato.");
    
    await tgEditMessageText(chatId, messageId, msg);
    await tgAnswerCallbackQuery(cq.id, "Salvato con successo!");
  } else if (data === "cancel") {
    await clearPending(employee.id);
    await tgEditMessageText(chatId, messageId, "❌ Bozza annullata. Invia un nuovo messaggio per ricominciare.");
    await tgAnswerCallbackQuery(cq.id, "Annullato.");
  }
}

export async function handleTelegramUpdate(update) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const telegramId = message.from.id;
  const text = (message.text || "").trim();

  if (message.video || message.animation || message.sticker) {
    await tgSendMessage(chatId, "⛔ Questo tipo di messaggio non è supportato. Inviami testo, nota vocale o la foto di uno scontrino.");
    return;
  }
  if (message.document && !message.voice) {
    await tgSendMessage(chatId, "⛔ I documenti non sono supportati. Inviami testo o nota vocale.");
    return;
  }

  let employee = await findEmployeeByTelegramId(telegramId);

  if (text === "/start") {
    if (!employee) employee = await createEmployee(telegramId, chatId);
    if (employee.stato_registrazione === "in_attesa_nome") {
      await tgSendMessage(chatId, "👋 Benvenuto! Inviami Nome e Cognome...");
    } else if (!isGdprAccepted(employee)) {
      await sendGdprNotice(chatId);
    } else {
      await tgSendMessage(chatId, "ℹ️ Sei già registrato. Inviami il report di oggi (testo o vocale)." );
    }
    return;
  }

  if (!employee) {
    await tgSendMessage(chatId, "Prima registrati con /start.");
    return;
  }

  if (
    employee.stato_registrazione !== "in_attesa_nome" &&
    text.trim().toLowerCase() !== "/accetto_gdpr" &&
    !isGdprAccepted(employee)
  ) {
    await sendGdprNotice(chatId);
    return;
  }

  await updateEmployee(employee.id, { chat_id: chatId });

  if (isCancel(text)) {
    await clearPending(employee.id);
    await tgSendMessage(chatId, "ℹ️ Operazione annullata. Sono pronto a ricevere il report di oggi.");
    return;
  }

  if (text.toLowerCase().startsWith("/edit")) {
    const parsed = parseEditCommand(text);
    if (!parsed.ok) {
      await tgSendMessage(chatId, parsed.error);
      return;
    }
    await updateEmployee(employee.id, {
      pending_report_date: parsed.date,
      pending_json: null,
      pending_text: null,
      pending_date: null,
    });
    await tgSendMessage(chatId, `📅 Ok, inviami il report per il giorno ${parsed.date}.`);
    return;
  }

  if (employee.stato_registrazione === "in_attesa_nome") {
    const parts = text.split(" ").filter(Boolean);
    await updateEmployee(employee.id, {
      nome: parts[0] || null,
      cognome: parts.slice(1).join(" ") || null,
      stato_registrazione: "registrato",
    });
    await sendGdprNotice(chatId);
    return;
    await tgSendMessage(
      chatId,
      "✅ Registrazione completata. Ora invia /accetto_gdpr per accettare l'informativa privacy e GDPR; poi potrai inviare report, spese e posizione."
    );
    return;
  }

  if (text.trim().toLowerCase() === "/accetto_gdpr") {
    await updateEmployee(employee.id, { gdpr_accettato: 1, chat_id: chatId });
    await tgSendMessage(
      chatId,
      "✅ Grazie. Hai accettato l'informativa. Ora puoi inviare report (testo o vocale), spese e posizione."
    );
    return;
  }

  if (!isGdprAccepted(employee)) {
    await sendGdprNotice(chatId);
    return;
  }

  // logica isConfirm rimossa: si gestisce tutto o via testo incrementale o via callback_query

  const reportDate = employee.pending_report_date || localReportDate();

  if (message.location) {
    const userLat = message.location.latitude;
    const userLng = message.location.longitude;

    const cantieri = await getCantieriConCoordinate();
    if (cantieri.length === 0) {
      await tgSendMessage(chatId, "Nessun cantiere geolocalizzato nel sistema.");
      return;
    }

    let nearest = null;
    let minDistance = Infinity;

    for (const c of cantieri) {
      const dist = calculateDistance(userLat, userLng, c.lat, c.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = c;
      }
    }

    const rawRadius = nearest.raggio_tolleranza;
    const radiusNum =
      rawRadius != null && rawRadius !== "" ? Number(rawRadius) : NaN;
    const effectiveRadius = Number.isFinite(radiusNum) && radiusNum > 0 ? radiusNum : 200;

    if (minDistance <= effectiveRadius) {
      const reportId = await ensureDailyReportHeader(employee.id, reportDate);
      await createReportEntry({
        report_id: reportId,
        cantiere_id: nearest.id,
        stato_validazione: "VERIFIED",
        fonte: "GPS",
      });
      await updateReportHeader(reportId, {
        data_utc: new Date().toISOString(),
      });

      await tgSendMessage(
        chatId,
        `📍 Check-in certificato al cantiere **${nearest.nome}** (distanza: ${Math.round(minDistance)}m, raggio: ${effectiveRadius}m).`
      );
    } else {
      await tgSendMessage(
        chatId,
        `⚠️ Ti trovi a ${Math.round(minDistance)}m dal cantiere più vicino (${nearest.nome}). Sei fuori dal raggio consentito (${effectiveRadius}m). Avvicinati al cantiere o segnala l'anomalia all'ufficio.`
      );
    }

    return;
  }

  let originalText = text;
  let extracted;
  
  const currentState = await getExtractionState(
    employee.id,
    reportDate,
    employee.pending_json
  );

  let statusMsgId = null;
  const sendStatus = async (statusText) => {
    try {
      if (!statusMsgId) {
        const res = await tgSendMessage(chatId, statusText);
        if (res && res.message_id) statusMsgId = res.message_id;
      } else {
        await tgEditMessageText(chatId, statusMsgId, statusText);
      }
    } catch(e) {}
  };

  if (message.photo) {
    await sendStatus("🖼️ Foto ricevuta. Elaborazione in corso...");
    const photo = message.photo[message.photo.length - 1];
    
    let tmpPath;
    let base64Image;
    try {
      const fileInfo = await tgGetFile(photo.file_id);
      tmpPath = path.join(os.tmpdir(), `tg_${Date.now()}_${path.basename(fileInfo.file_path)}`);
      const stream = await tgDownloadFile(fileInfo.file_path);
      await writeStreamToFile(stream, tmpPath);
      
      const buffer = fs.readFileSync(tmpPath);
      base64Image = buffer.toString("base64");
    } catch (err) {
      log.error({ err, event: "photo_download_failed" }, "photo_download_failed");
      await sendStatus("❌ Errore nel download della foto. Riprova.");
      if (tmpPath) fs.unlink(tmpPath, () => {});
      return;
    } finally {
      if (tmpPath) fs.unlink(tmpPath, () => {});
    }

    await sendStatus("🧠 Lettura dello scontrino tramite AI in corso...");
    let spesa;
    try {
      spesa = await extractSpesaFromImage(base64Image);
    } catch(err) {
      log.error({ err, event: "extract_spesa_error" }, "extract_spesa_error");
      await sendStatus(
        getOpenAIUserFacingMessage(err, {
          insufficientQuota:
            "⚠️ Il servizio AI per leggere lo scontrino non è disponibile per quota esaurita. Inserisci la spesa manualmente o avvisa l'amministrazione.",
          rateLimit:
            "⚠️ Il servizio AI per leggere lo scontrino è temporaneamente occupato. Riprova tra qualche minuto o inserisci la spesa manualmente.",
          default:
            "⚠️ Non sono riuscito a leggere l'importo dallo scontrino. Assicurati che l'immagine sia chiara o inserisci la spesa manualmente.",
        })
      );
      return;
    }

    const cantieri = await getCantieriAttivi();
    if (!cantieri || cantieri.length === 0) {
      await sendStatus(`🧾 Spesa rilevata: ${spesa.importo}€ (${spesa.fornitore || "Ignoto"}).\n⚠️ Attenzione: Nessun cantiere attivo nel sistema a cui assegnarla!`);
      return;
    }

    let fornitoreStr = spesa.fornitore ? ` presso *${spesa.fornitore}*` : "";
    let descStr = spesa.descrizione ? `\n🧾 Dettaglio: ${spesa.descrizione}` : "";
    const txt = `🧾 *Nuova Spesa Rilevata*\n💶 Importo: *${spesa.importo}€*${fornitoreStr}${descStr}\n\n🏗️ A quale cantiere vuoi assegnarla?`;

    const inline_keyboard = [];
    for (const c of cantieri) {
      inline_keyboard.push([{ text: `📍 ${c.nome}`, callback_data: `spesa:${statusMsgId}:${c.id}` }]);
    }

    await tgEditMessageText(chatId, statusMsgId, txt, { inline_keyboard });

    const timeoutId = setTimeout(() => {
      pendingExpenses.delete(statusMsgId.toString());
      tgEditMessageText(chatId, statusMsgId, "⌛ Sessione scaduta per questa spesa.").catch(() => {});
    }, 10 * 60 * 1000);

    pendingExpenses.set(statusMsgId.toString(), {
      employeeId: employee.id,
      importo: spesa.importo,
      fornitore: spesa.fornitore,
      descrizione: spesa.descrizione,
      timeoutId
    });

    return;
  }

  if (message.voice) {
    if (message.voice.file_size && message.voice.file_size > 20 * 1024 * 1024) {
      await tgSendMessage(chatId, "⚠️ Il vocale è troppo grande (max 20MB)...");
      return;
    }

    await sendStatus("🎤 Messaggio vocale ricevuto. Download in corso...");

    let tmpPath;
    let convertedPath;
    try {
      const fileInfo = await tgGetFile(message.voice.file_id);
      tmpPath = path.join(os.tmpdir(), `tg_${Date.now()}_${path.basename(fileInfo.file_path)}`);
      const stream = await tgDownloadFile(fileInfo.file_path);
      await writeStreamToFile(stream, tmpPath);

      await sendStatus("🎧 Transcodifica del formato audio...");
      const converted = await maybeConvertToWav(tmpPath, message.voice.mime_type);
      convertedPath = converted.path;
      
      await sendStatus("🧠 Trascrizione AI in corso...");
      originalText = await transcribeAudio(converted.path);
    } catch (err) {
      log.error({ err, event: "voice_transcription_failed" }, "voice_transcription_failed");
      await sendStatus(
        getOpenAIUserFacingMessage(err, {
          insufficientQuota:
            "⚠️ Il servizio AI di trascrizione non è disponibile per quota esaurita. Invia il report in testo oppure avvisa l'amministrazione.",
          rateLimit:
            "⚠️ Il servizio AI di trascrizione è temporaneamente occupato. Riprova tra qualche minuto oppure invia il report in testo.",
          default: "❌ Errore nella trascrizione. Riprova o invia testo.",
        })
      );
      return;
    } finally {
      if (tmpPath) fs.unlink(tmpPath, () => {});
      if (convertedPath && convertedPath !== tmpPath) fs.unlink(convertedPath, () => {});
    }

    await sendStatus("✅ Trascrizione completata! Elaborazione dati...");
    await tgSendMessage(chatId, `📝 Trascrizione: "${originalText}"`);
    try {
      extracted = await extractReport(originalText, currentState);
    } catch (err) {
      log.error({ err, event: "extract_failed" }, "extract_failed");
      await sendStatus(
        getOpenAIUserFacingMessage(err, {
          insufficientQuota:
            "⚠️ Il servizio AI di elaborazione report non è disponibile per quota esaurita. Riprova più tardi o avvisa l'amministrazione.",
          rateLimit:
            "⚠️ Il servizio AI di elaborazione report è temporaneamente occupato. Riprova tra qualche minuto.",
          default: "❌ Errore in estrazione. Riprova con un testo più semplice.",
        })
      );
      return;
    }
  } else {
    try {
      await sendStatus("📝 Elaborazione testo in corso...");
      extracted = await extractReport(originalText, currentState);
    } catch (err) {
      log.error({ err, event: "extract_failed" }, "extract_failed");
      await sendStatus(
        getOpenAIUserFacingMessage(err, {
          insufficientQuota:
            "⚠️ Il servizio AI di elaborazione report non è disponibile per quota esaurita. Riprova più tardi o avvisa l'amministrazione.",
          rateLimit:
            "⚠️ Il servizio AI di elaborazione report è temporaneamente occupato. Riprova tra qualche minuto.",
          default: "❌ Errore in estrazione. Riprova con un testo più semplice.",
        })
      );
      return;
    }
  }

  extracted = mergeWithCurrentState(extracted, currentState);

  if (!originalText) {
    await sendStatus("❌ Nessun testo ricavato.");
    return;
  }

  if (extracted && extracted.cantiere_id) {
    const isCantiereValido = await cantiereExists(extracted.cantiere_id);
    if (!isCantiereValido) {
      await sendStatus("⚠️ Errore: Il cantiere indicato non esiste o è chiuso. Verifica e reinvia il messaggio.");
      return;
    }
  }

  try {
    await insertMessageLog(
      employee.id,
      message.voice ? "voice" : "text",
      originalText,
      JSON.stringify(extracted)
    );
  } catch (err) {
    log.error({ err, event: "audit_log_failed" }, "audit_log_failed");
  }

  const oreCalcolate = calcOreFromOrari(extracted);
  const oreLavorate = extracted.ore_totali ?? oreCalcolate;

  await sendStatus("✅ Elaborazione completata!");

  if (oreLavorate !== null) {
    const payload = message.voice ? { ...extracted, __bot_fonte: "TELEGRAM_AUDIO" } : extracted;
    await setPending(employee.id, payload, originalText, reportDate);
    const baseMsg = buildConfirmMessage(extracted, oreCalcolate, "Bozza del tuo report:");
    
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Conferma e Salva", callback_data: "confirm" },
          { text: "❌ Annulla / Riscrivi", callback_data: "cancel" }
        ]
      ]
    };
    
    const finalMsg = baseMsg + "\nVuoi confermare questi dati?";
    if (statusMsgId) {
      await tgEditMessageText(chatId, statusMsgId, finalMsg, replyMarkup);
    } else {
      await tgSendMessage(chatId, finalMsg, replyMarkup);
    }
  } else {
    await saveManualReportRows(
      employee.id,
      reportDate,
      extracted,
      originalText,
      message.voice ? "TELEGRAM_AUDIO" : "TELEGRAM_TESTO"
    );
    await updateEmployee(employee.id, { pending_report_date: null, pending_json: null });
    const msg = buildConfirmMessage(extracted, oreCalcolate, "Aggiornamento report registrato.");
    
    if (statusMsgId) {
      await tgEditMessageText(chatId, statusMsgId, msg);
    } else {
      await tgSendMessage(chatId, msg);
    }
  }
}

/**
 * Invia reminder ai dipendenti attivi che non hanno ancora rendicontato oggi.
 * Usa una singola query SQL con NOT IN invece del pattern N+1 (una query per dipendente).
 */
export async function sendReminders() {
  const today = localReportDate();
  const employees = await getEmployeesWithoutReport(today);
  for (const emp of employees) {
    await tgSendMessage(emp.chat_id, "Reminder: manca il report di oggi. Invia testo o vocale.");
  }
}














