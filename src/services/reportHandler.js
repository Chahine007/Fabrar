import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";
import logger from "../logger.js";
import {
    cantiereExists,
    getCantieriAttivi,
    ensureDailyReportHeader,
    createReportEntry,
    upsertReportEntry,
    updateReportHeader,
    listReportEntriesByEmployeeAndDate,
    updateEmployee,
    insertMessageLog,
    getWbsFasiAttive,
} from "../db/index.js";

import { tgSendMessage, tgGetFile, tgDownloadFile } from "./telegram.js";
import { transcribeAudio, extractReport, getOpenAIUserFacingMessage } from "./openai.js";
import { maybeConvertToWav } from "./audio.js";
import { ValidationStatus } from "../constants.js";

const TIMEZONE = process.env.TIMEZONE || "Europe/Rome";

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
        ore_lavorate: null, ingresso: null, pausa_inizio: null, pausa_fine: null, uscita: null,
        attivita_svolte: null, luogo_cantiere: null, problemi_riscontrati: null,
    };
    let oreSum = 0;
    let hasOre = false;
    for (const e of entries) {
        if (e.ore_lavorate != null && Number.isFinite(e.ore_lavorate)) {
            oreSum += e.ore_lavorate;
            hasOre = true;
        }
        for (const field of ["ingresso", "pausa_inizio", "pausa_fine", "uscita", "attivita_svolte", "luogo_cantiere", "problemi_riscontrati"]) {
            if (e[field] != null && e[field] !== "") state[field] = e[field];
        }
    }
    state.ore_lavorate = hasOre ? oreSum : null;
    return state;
}

export function calcOreFromOrari({ ingresso, uscita, pausa_inizio, pausa_fine }) {
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

export function buildConfirmMessage(extracted, oreCalcolate, title = "Report salvato con successo!") {
    const lines = [title, ""];
    if (extracted.ingresso) lines.push(`🕐 Ingresso: ${extracted.ingresso}`);
    if (extracted.pausa_inizio && extracted.pausa_fine) lines.push(`☕ Pausa: ${extracted.pausa_inizio}–${extracted.pausa_fine}`);
    else if (extracted.pausa_inizio) lines.push(`☕ Pausa: ${extracted.pausa_inizio}`);
    else if (extracted.pausa_fine) lines.push(`☕ Pausa: ${extracted.pausa_fine}`);
    if (extracted.uscita) lines.push(`🚪 Uscita: ${extracted.uscita}`);
    const oreLavorate = extracted.ore_totali ?? oreCalcolate;
    if (oreLavorate !== null) lines.push(`⏱️ Ore lavorate: ${oreLavorate}h`);
    if (extracted.attivita_svolte) lines.push(`🛠️ Attività: ${extracted.attivita_svolte}`);
    if (extracted.luogo_cantiere) lines.push(`📍 Luogo: ${extracted.luogo_cantiere}`);
    if (extracted.problemi_riscontrati) lines.push(`⚠️ Problemi: ${extracted.problemi_riscontrati}`);
    return lines.join("\n");
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

async function safeUnlink(filePath) {
    if (!filePath) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (err) { }
}

export async function saveManualReportRows(employeeId, reportDate, extracted, originalText, fonte) {
    const reportId = await ensureDailyReportHeader(employeeId, reportDate);
    let cantiereId = null;

    // 1) Priorità: cantiere_id esplicito dall'AI
    if (extracted.cantiere_id != null) {
        const ok = await cantiereExists(extracted.cantiere_id);
        if (ok) cantiereId = extracted.cantiere_id;
    }

    // 2) Fallback: fuzzy-match sul luogo_cantiere testuale estratto dall'AI
    //    (es. "cantiere via Roma" → cerca tra i cantieri attivi quello più simile)
    if (!cantiereId && extracted.luogo_cantiere) {
        const cantieri = await getCantieriAttivi();
        const luogo = extracted.luogo_cantiere.toLowerCase().trim();
        const match = cantieri.find(c => {
            const nome = c.nome.toLowerCase();
            return nome.includes(luogo) || luogo.includes(nome);
        });
        if (match) cantiereId = match.id;
    }

    const oreCalcolate = calcOreFromOrari(extracted);
    const oreLavorate = extracted.ore_totali ?? oreCalcolate;
    // Usa upsert: aggiorna la entry esistente per (report+cantiere+fonte) invece di crearne una nuova
    await upsertReportEntry({
        report_id: reportId,
        cantiere_id: cantiereId,
        wbs_node_id: extracted.wbs_node_id ?? null,
        ore_lavorate: oreLavorate ?? null,
        ingresso: extracted.ingresso ?? null,
        pausa_inizio: extracted.pausa_inizio ?? null,
        pausa_fine: extracted.pausa_fine ?? null,
        uscita: extracted.uscita ?? null,
        attivita_svolte: extracted.attivita_svolte ?? null,
        luogo_cantiere: extracted.luogo_cantiere ?? null,
        problemi_riscontrati: extracted.problemi_riscontrati ?? null,
        testo_originale: originalText,
        stato_validazione: ValidationStatus.PENDING,
        fonte
    });
    await updateReportHeader(reportId, {
        data_utc: new Date().toISOString(),
        testo_originale: originalText,
        stato_validazione: ValidationStatus.PENDING,
        ...(cantiereId ? { cantiere_id: cantiereId } : {}),
    });
}

/**
 * Costruisce l'inline keyboard per la selezione della fase WBS.
 * Usato dal bot quando un cantiere ha 2+ fasi attive.
 */
export function buildWbsKeyboard(fasi) {
    const buttons = fasi.map(f => [{ text: `📂 ${f.nome}`, callback_data: `wbs:${f.id}` }]);
    return { inline_keyboard: buttons };
}

export async function processWbsAndConfirm(employeeId, chatId, payload, originalText, reportDate, cantiere) {
    const oreCalcolate = calcOreFromOrari(payload);
    let finalPayload = { ...payload };

    if (finalPayload.cantiere_id != null) {
        const fasi = await getWbsFasiAttive(finalPayload.cantiere_id);
        const wbsPromptThr = cantiere?.bot_wbs_prompt_thr ?? 3; // Usa la soglia dinamica

        if (fasi.length >= wbsPromptThr) { // Usiamo la soglia invece di 2 fissi
            const payloadWithFlag = { ...finalPayload, __awaiting_wbs: true };
            await setPending(employeeId, payloadWithFlag, originalText, reportDate);
            const keyboard = buildWbsKeyboard(fasi);
            const baseMsg = buildConfirmMessage(finalPayload, oreCalcolate, "📋 Bozza report:");
            await tgSendMessage(
                chatId,
                baseMsg + "\n\n🏗️ Su quale *fase* stai lavorando?",
                keyboard
            );
            return; 
        } else if (fasi.length > 0) { // Se è sotto la soglia (o = 1), assegna automaticamente alla prima fase se serve? O non assegna?
            // "Se è sotto la soglia salva alla root del cantiere" - Ma c'era una logica precedente che se fasi.length === 1 assegnava a fasi[0]
            // Facciamo che se fasi.length === 1 assegna automaticamente, se > 1 ma < thr salva alla root (nessun wbs).
            if (fasi.length === 1) {
                finalPayload.wbs_node_id = fasi[0].id;
            }
        }
    }

    await setPending(employeeId, finalPayload, originalText, reportDate);
    const baseMsg = buildConfirmMessage(finalPayload, oreCalcolate, "Bozza del tuo report:");
    
    // Se è stata loggata un'anomalia GPS, la mostriamo nella conferma
    const anomaliaText = finalPayload.__gps_anomalia ? "\n\n[⚠️ ANOMALIA GPS: Distanza dal cantiere eccessiva]" : "";

    const replyMarkup = {
        inline_keyboard: [[
            { text: "✅ Conferma e Salva", callback_data: "confirm" },
            { text: "❌ Annulla / Riscrivi", callback_data: "cancel" }
        ]]
    };

    await tgSendMessage(chatId, baseMsg + anomaliaText + "\nVuoi confermare questi dati?", replyMarkup);
}

export async function handleReport(message, employee, reportDate, sendStatus) {
    const chatId = message.chat.id;
    const { text, voice } = message;
    let originalText = text;
    let extracted;

    const currentState = await getExtractionState(employee.id, reportDate, employee.pending_json);

    if (voice) {
        if (voice.file_size && voice.file_size > 20 * 1024 * 1024) {
            await tgSendMessage(chatId, "⚠️ Il vocale è troppo grande (max 20MB)...");
            return;
        }

        await sendStatus("🎤 Messaggio vocale ricevuto. Download in corso...");

        let tmpPath;
        let convertedPath;
        try {
            const fileInfo = await tgGetFile(voice.file_id);
            tmpPath = path.join(os.tmpdir(), `tg_${Date.now()}_${path.basename(fileInfo.file_path)}`);
            const stream = await tgDownloadFile(fileInfo.file_path);
            await writeStreamToFile(stream, tmpPath);

            await sendStatus("🎧 Transcodifica del formato audio...");
            const converted = await maybeConvertToWav(tmpPath, voice.mime_type);
            convertedPath = converted.path;

            await sendStatus("🧠 Trascrizione AI in corso...");
            originalText = await transcribeAudio(convertedPath);
        } catch (err) {
            logger.error({ err, event: "voice_transcription_failed" }, "voice_transcription_failed");
            await sendStatus(getOpenAIUserFacingMessage(err, { default: "❌ Errore nella trascrizione. Riprova o invia testo." }));
            return;
        } finally {
            await safeUnlink(tmpPath);
            await safeUnlink(convertedPath);
        }

        await sendStatus("✅ Trascrizione completata! Elaborazione dati...");
        await tgSendMessage(chatId, `📝 Trascrizione: "${originalText}"`);
    } else {
        await sendStatus("📝 Elaborazione testo in corso...");
    }

    try {
        extracted = await extractReport(originalText, currentState);
    } catch (err) {
        logger.error({ err, event: "extract_failed" }, "extract_failed");
        await sendStatus(getOpenAIUserFacingMessage(err, { default: "❌ Errore in estrazione. Riprova con un testo più semplice." }));
        return;
    }

    extracted = mergeWithCurrentState(extracted, currentState);

    if (!originalText) {
        await sendStatus("❌ Nessun testo ricavato.");
        return;
    }

    let targetCantiere = null;
    if (extracted && extracted.cantiere_id) {
        const { getDb } = await import('../db/index.js');
        const prisma = getDb();
        targetCantiere = await prisma.cantiere.findUnique({ where: { id: extracted.cantiere_id } });
        if (!targetCantiere || targetCantiere.attivo === 0 || targetCantiere.attivo === false) {
            await sendStatus("⚠️ Errore: Il cantiere indicato non esiste o è chiuso. Verifica e reinvia il messaggio.");
            return;
        }

        // ─ Gatekeeper GPS ─────────────────────────────────────────────
        if (targetCantiere.bot_checkin_gps) {
            const reportId = await ensureDailyReportHeader(employee.id, reportDate);
            const gpsEntry = await prisma.reportEntry.findFirst({
                where: { report_id: reportId, cantiere_id: targetCantiere.id, fonte: "GPS" }
            });
            if (!gpsEntry) {
                const payloadWithFlag = { ...extracted, __awaiting_gps: true, __cantiere_id: targetCantiere.id, __voice: voice ? true : false };
                await setPending(employee.id, payloadWithFlag, originalText, reportDate);
                await sendStatus("📍 Per questo cantiere è obbligatorio allegare la posizione. Usa la graffetta 📎 e invia la tua 'Posizione' per registrare le ore.");
                return;
            }
        }
    }

    try {
        await insertMessageLog(employee.id, voice ? "voice" : "text", originalText, JSON.stringify(extracted));
    } catch (err) {
        logger.error({ err, event: "audit_log_failed" }, "audit_log_failed");
    }

    const oreCalcolate = calcOreFromOrari(extracted);
    const oreLavorate = extracted.ore_totali ?? oreCalcolate;

    await sendStatus("✅ Elaborazione completata!");

    if (oreLavorate !== null) {
        const payload = voice ? { ...extracted, __bot_fonte: "TELEGRAM_AUDIO" } : extracted;
        await processWbsAndConfirm(employee.id, chatId, payload, originalText, reportDate, targetCantiere);
    } else {
        const fonte = voice ? "TELEGRAM_AUDIO" : "TELEGRAM_TESTO";
        await saveManualReportRows(employee.id, reportDate, extracted, originalText, fonte);
        await updateEmployee(employee.id, { pending_report_date: null, pending_json: null });
        const msg = buildConfirmMessage(extracted, oreCalcolate, "Aggiornamento report registrato.");
        await tgSendMessage(chatId, msg);
    }
}
