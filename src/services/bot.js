import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";
import logger from "../logger.js";
import {
  findEmployeeByTelegramId,
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
import { handleGdprAccept, sendGdprNotice } from "./registration.js";
import { handleReport, saveManualReportRows, buildConfirmMessage, calcOreFromOrari, buildWbsKeyboard } from "./reportHandler.js";

import { handleExpensePhoto, consumePendingExpense } from "./expenseHandler.js";
import { ValidationStatus } from "../constants.js";

const log = logger.child({ module: "bot" });
const TIMEZONE = process.env.TIMEZONE || "Europe/Rome";

function isGdprAccepted(employee) {
  return employee.gdpr_accettato === 1;
}

// getMissingFields rimossa: era sempre vuota e non conteneva logica reale.

async function withProgressMessage(chatId, asyncFn) {
  const timer = setTimeout(() => {
    tgSendMessage(chatId, "⏳ Elaborazione in corso...").catch(() => { });
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

async function writeStreamToFile(stream, filePath) {
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    stream.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) { } // Ignora silenziosamente (es. file già eliminato o non trovato)
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
    // Format: spesa:<sessionId (UUID with dashes)>:<cantiereId>
    // UUID has 4 dashes → parts.length >= 6. cantiereId is last part.
    if (parts.length < 3) return;
    const cantiereId = parseInt(parts[parts.length - 1], 10);
    const sessionId  = parts.slice(1, parts.length - 1).join(":");

    const expenseData = await consumePendingExpense(sessionId);
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
      await tgEditMessageText(chatId, messageId, `💶 Spesa di ${expenseData.importo}€ salvata e assegnata al cantiere!`);
      await tgAnswerCallbackQuery(cq.id, "Spesa salvata!");
    } catch (err) {
      log.error({ err, event: "insert_spesa_failed" }, "insert_spesa_failed");
      await tgAnswerCallbackQuery(cq.id, "Errore durante il salvataggio.");
    }
    return;
  }

  // ─ WBS fase selezione (callback_data: "wbs:<nodeId>") ───────────────────────
  if (data.startsWith("wbs:")) {
    const wbsNodeId = parseInt(data.split(":")[1], 10);
    if (isNaN(wbsNodeId)) {
      await tgAnswerCallbackQuery(cq.id, "Fase non valida.");
      return;
    }

    if (!employee.pending_json) {
      await tgAnswerCallbackQuery(cq.id, "Sessione scaduta. Reinvia il report.");
      await tgEditMessageText(chatId, messageId, "⏳ Sessione WBS scaduta. Invia di nuovo il report.");
      return;
    }

    let parsed;
    try { parsed = JSON.parse(employee.pending_json); } catch {
      await tgAnswerCallbackQuery(cq.id, "Errore dati. Reinvia il report.");
      return;
    }

    if (!parsed.__awaiting_wbs) {
      await tgAnswerCallbackQuery(cq.id, "Nessuna selezione fase in attesa.");
      return;
    }

    // Inietta il wbs_node_id e rimuovi il flag
    const { __awaiting_wbs, __bot_fonte, ...rest } = parsed;
    const fonte = __bot_fonte ?? "TELEGRAM_TESTO";
    const updatedPayload = { ...rest, wbs_node_id: wbsNodeId, __bot_fonte: fonte };

    // Aggiorna il pending e mostra Conferma/Annulla
    await updateEmployee(employee.id, { pending_json: JSON.stringify(updatedPayload) });

    const oreCalcolate = calcOreFromOrari(rest);
    const baseMsg = buildConfirmMessage(rest, oreCalcolate, "\ud83d\udccb Report con fase assegnata:");
    const replyMarkup = {
      inline_keyboard: [[
        { text: "\u2705 Conferma e Salva", callback_data: "confirm" },
        { text: "\u274c Annulla / Riscrivi", callback_data: "cancel" }
      ]]
    };
    await tgEditMessageText(chatId, messageId, baseMsg + "\nVuoi confermare?", replyMarkup);
    await tgAnswerCallbackQuery(cq.id, "Fase selezionata!");
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
    await updateEmployee(employee.id, { pending_json: null, pending_text: null, pending_date: null, pending_report_date: null });
    const oreCalcolate = calcOreFromOrari(extracted);
    const msg = buildConfirmMessage(extracted, oreCalcolate, "Aggiornamento report registrato.");

    await tgEditMessageText(chatId, messageId, msg);
    await tgAnswerCallbackQuery(cq.id, "Salvato con successo!");
  } else if (data === "cancel") {
    await updateEmployee(employee.id, { pending_json: null, pending_text: null, pending_date: null, pending_report_date: null });
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

  if (!employee) {
    if (text.toUpperCase().startsWith("TG-")) {
      const { getDb } = await import("../db/index.js");
      const code = text.toUpperCase();
      const empByCode = await getDb().employee.findUnique({ where: { telegram_pairing_code: code } });
      if (empByCode) {
        await updateEmployee(empByCode.id, { 
          telegram_id: telegramId, 
          chat_id: chatId, 
          telegram_pairing_code: null,
          stato_registrazione: "registrato"
        });
        await tgSendMessage(chatId, `✅ Account collegato con successo! Benvenuto ${empByCode.nome || "Dipendente"}. Usa /accetto_gdpr per continuare.`);
        return;
      } else {
        await tgSendMessage(chatId, "❌ Codice non valido o scaduto.");
        return;
      }
    }

    await tgSendMessage(chatId, "Account non riconosciuto. Vai sulla Web App Fabrar, entra in 'Il mio Account', genera un codice Telegram e scrivilo qui per collegare il tuo profilo.");
    return;
  }

  if (text === "/start") {
    if (employee.gdpr_accettato !== 1) {
      await sendGdprNotice(chatId);
      return;
    }
    await tgSendMessage(chatId, "ℹ️ Sei già collegato e registrato. Inviami il report di oggi (testo o vocale).");
    return;
  }

  if (
    employee.stato_registrazione !== "in_attesa_nome" &&
    text.toLowerCase() !== "/accetto_gdpr" &&
    !isGdprAccepted(employee)
  ) {
    await sendGdprNotice(chatId);
    return;
  }

  await updateEmployee(employee.id, { chat_id: chatId });

  if (isCancel(text)) {
    await updateEmployee(employee.id, { pending_json: null, pending_text: null, pending_date: null, pending_report_date: null });
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



  if (text.toLowerCase() === "/accetto_gdpr") {
    await handleGdprAccept(employee, chatId);
    return;
  }

  if (!isGdprAccepted(employee)) {
    await sendGdprNotice(chatId);
    return;
  }

  // logica isConfirm rimossa: si gestisce tutto o via testo incrementale o via callback_query

  const reportDate = employee.pending_report_date || localReportDate();

  // ── F9: Comando /imposta_gps — solo admin/PM verificati via tabella User ──
  if (text.toLowerCase() === '/imposta_gps') {
    const { getDb } = await import('../db/index.js');
    const adminUser = await getDb().user.findFirst({
      where: {
        employee_id: employee.id,
        is_active:   1,
        role:        { in: ['ADMIN', 'EXTERNAL_PM'] },
      },
    });
    if (!adminUser) {
      await tgSendMessage(chatId, '\u26d4 Comando riservato agli amministratori e ai Project Manager.');
      return;
    }
    // Salva il flag nel pending_json
    await updateEmployee(employee.id, {
      pending_json: JSON.stringify({ __awaiting_gps_admin: true }),
    });
    await tgSendMessage(chatId, '\ud83d\udccd Invia la tua posizione GPS. Le coordinate verranno assegnate al cantiere pi\u00f9 vicino tra quelli esistenti.');
    return;
  }

  if (message.location) {
    const userLat = message.location.latitude;
    const userLng = message.location.longitude;

    let targetCantiere = null;
    let dist = Infinity;
    let pendingData = null;

    // ── F9: Check admin GPS override (\/imposta_gps) ──
    if (employee.pending_json) {
      try {
        const parsed = JSON.parse(employee.pending_json);
        if (parsed.__awaiting_gps_admin) {
          // Trova il cantiere più vicino tra tutti quelli attivi
          const allCantieri = await getCantieriConCoordinate();
          let nearestId = null;
          let nearestNome = 'N/D';
          let nearestDist = Infinity;
          for (const c of allCantieri) {
            const d = calculateDistance(userLat, userLng, c.lat, c.lng);
            if (d < nearestDist) { nearestDist = d; nearestId = c.id; nearestNome = c.nome; }
          }
          // Aggiorna le coordinate anche se già presenti (override esplicito admin)
          const { getDb } = await import('../db/index.js');
          const cantieriAll = await getDb().cantiere.findMany({ where: { attivo: 1 }, select: { id: true, nome: true } });
          // Prendi il cantiere più vicino con coordinate O il primo senza coordinate
          let targetId = nearestId;
          let targetNome = nearestNome;
          if (!targetId && cantieriAll.length > 0) { targetId = cantieriAll[0].id; targetNome = cantieriAll[0].nome; }
          if (targetId) {
            await getDb().cantiere.update({ where: { id: targetId }, data: { lat: userLat, lng: userLng } });
            log.info({ cantiereId: targetId, lat: userLat, lng: userLng }, 'cantiere_gps_admin_set');
            await tgSendMessage(chatId, `\u2705 Coordinate aggiornate per il cantiere \u00ab${targetNome}\u00bb (${userLat.toFixed(6)}, ${userLng.toFixed(6)}).`);
          } else {
            await tgSendMessage(chatId, '\u26a0\ufe0f Nessun cantiere trovato nel sistema. Creane uno prima di impostare le coordinate.');
          }
          await updateEmployee(employee.id, { pending_json: null });
          return;
        }
      } catch (e) { }
    }

    if (employee.pending_json) {
      try {
        const parsed = JSON.parse(employee.pending_json);
        if (parsed.__awaiting_gps && parsed.__cantiere_id) {
          pendingData = parsed;
          const { getDb } = await import('../db/index.js');
          const prisma = getDb();
          targetCantiere = await prisma.cantiere.findUnique({ where: { id: parsed.__cantiere_id } });
          if (targetCantiere && targetCantiere.lat && targetCantiere.lng) {
            dist = calculateDistance(userLat, userLng, targetCantiere.lat, targetCantiere.lng);
          }
        }
      } catch (e) { }
    }

    if (!targetCantiere) {
      // Logic for generic checkin
      const cantieri = await getCantieriConCoordinate();
      if (cantieri.length === 0) {
        await tgSendMessage(chatId, "Nessun cantiere geolocalizzato nel sistema.");
        return;
      }
      for (const c of cantieri) {
        const d = calculateDistance(userLat, userLng, c.lat, c.lng);
        if (d < dist) { dist = d; targetCantiere = c; }
      }
    }

    const rawRadius = targetCantiere.raggio_tolleranza;
    const radiusNum = rawRadius != null && rawRadius !== "" ? Number(rawRadius) : NaN;
    const effectiveRadius = Number.isFinite(radiusNum) && radiusNum > 0 ? radiusNum : 200;

    let isAnomaly = dist > effectiveRadius;
    const anomalyAction = targetCantiere.bot_anomaly_action || "LOG";

    if (isAnomaly) {
      if (pendingData && anomalyAction === 'BLOCK') {
        await updateEmployee(employee.id, { pending_json: null, pending_text: null, pending_date: null, pending_report_date: null });
        await tgSendMessage(chatId, `⛔ Sei fuori dal cantiere (${Math.round(dist)}m > ${effectiveRadius}m). Il sistema è configurato per BLOCCARE l'invio delle ore. Operazione annullata.`);
        return;
      } else if (!pendingData) {
        // generic checkin outside radius
        await tgSendMessage(chatId, `⚠️ Ti trovi a ${Math.round(dist)}m dal cantiere più vicino (${targetCantiere.nome}). Sei fuori dal raggio consentito (${effectiveRadius}m). Avvicinati al cantiere o segnala l'anomalia.`);
        return;
      }
    }

    // Pass the GPS check
    const reportId = await ensureDailyReportHeader(employee.id, reportDate);
    await createReportEntry({
      report_id: reportId,
      cantiere_id: targetCantiere.id,
      stato_validazione: ValidationStatus.APPROVED,
      fonte: "GPS",
    });
    await updateReportHeader(reportId, { data_utc: new Date().toISOString() });

    // ── F9: Auto-update GPS — imposta le coordinate del cantiere se non le ha ancora ──
    if (!targetCantiere.lat || !targetCantiere.lng) {
      try {
        const { getDb } = await import('../db/index.js');
        await getDb().cantiere.update({
          where: { id: targetCantiere.id },
          data:  { lat: userLat, lng: userLng },
        });
        log.info({ cantiereId: targetCantiere.id, lat: userLat, lng: userLng }, 'cantiere_gps_auto_set');
        // Notifica solo per check-in generico (non interrompere il flusso WBS pending)
        if (!pendingData) {
          await tgSendMessage(chatId, `📍 Coordinate GPS del cantiere «${targetCantiere.nome}» impostate automaticamente da questo check-in.`);
        }
      } catch (gpsErr) {
        log.warn({ err: gpsErr, cantiereId: targetCantiere.id }, 'cantiere_gps_auto_set_failed');
      }
    }

    if (pendingData) {
      // proceed to WBS
      const { processWbsAndConfirm } = await import('./reportHandler.js');
      const { __awaiting_gps, __cantiere_id, __voice, ...rest } = pendingData;
      if (isAnomaly) rest.__gps_anomalia = true; // pass the anomaly to the confirmation dialog
      const originalText = employee.pending_text || "";
      await tgSendMessage(chatId, `📍 Posizione ricevuta (${Math.round(dist)}m). Procediamo!`);
      const payload = __voice ? { ...rest, __bot_fonte: "TELEGRAM_AUDIO" } : rest;
      await processWbsAndConfirm(employee.id, chatId, payload, originalText, reportDate, targetCantiere);
    } else {
      await tgSendMessage(chatId, `📍 Check-in certificato al cantiere **${targetCantiere.nome}** (distanza: ${Math.round(dist)}m).`);
    }
    return;
  }

  let statusMsgId = null;
  const sendStatus = async (statusText) => {
    try {
      if (!statusMsgId) {
        const res = await tgSendMessage(chatId, statusText);
        if (res && res.message_id) statusMsgId = res.message_id;
      } else {
        await tgEditMessageText(chatId, statusMsgId, statusText);
      }
    } catch (e) { }
  };

  if (message.text || message.voice) {
    await handleReport(message, employee, reportDate, sendStatus);
    return;
  }

  if (message.photo) {
    await sendStatus("🖼️ Foto ricevuta. Elaborazione in corso...");
    await handleExpensePhoto(message, employee, sendStatus, statusMsgId);

    return;
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
