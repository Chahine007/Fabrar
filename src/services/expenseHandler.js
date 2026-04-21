import fs from "fs";
import os from "os";
import path from "path";
import logger from "../logger.js";
import { getCantieriAttivi, insertSpesa } from "../db/index.js";
import { tgGetFile, tgDownloadFile, tgEditMessageText } from "./telegram.js";
import { extractSpesaFromImage, getOpenAIUserFacingMessage } from "./openai.js";

const pendingExpenses = new Map();

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
    } catch (err) { /* ignore */ }
}

export async function handleExpensePhoto(message, employee, sendStatus, statusMsgId) {
    const chatId = message.chat.id;
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
        logger.error({ err, event: "photo_download_failed" }, "photo_download_failed");
        await sendStatus("❌ Errore nel download della foto. Riprova.");
        return;
    } finally {
        await safeUnlink(tmpPath);
    }

    await sendStatus("🧠 Lettura dello scontrino tramite AI in corso...");
    let spesa;
    try {
        spesa = await extractSpesaFromImage(base64Image);
    } catch (err) {
        logger.error({ err, event: "extract_spesa_error" }, "extract_spesa_error");
        await sendStatus(getOpenAIUserFacingMessage(err, { default: "⚠️ Non sono riuscito a leggere l'importo dallo scontrino. Assicurati che l'immagine sia chiara o inserisci la spesa manualmente." }));
        return;
    }

    const cantieri = await getCantieriAttivi();
    if (!cantieri || cantieri.length === 0) {
        try {
            await insertSpesa(employee.id, null, spesa.importo, spesa.fornitore, spesa.descrizione, "TELEGRAM_OCR", null);
            await sendStatus(`🧾 Spesa rilevata: ${spesa.importo}€ (${spesa.fornitore || "Ignoto"}).\n⚠️ Salvata come 'In sospeso': nessun cantiere attivo nel sistema per l'assegnazione.`);
        } catch (err) {
            logger.error({ err, event: "insert_orphan_spesa_failed" }, "insert_orphan_spesa_failed");
            await sendStatus(`🧾 Spesa rilevata: ${spesa.importo}€ (${spesa.fornitore || "Ignoto"}).\n⚠️ Errore salvataggio e nessun cantiere attivo per l'assegnazione automatica.`);
        }
        return;
    }

    const fornitoreStr = spesa.fornitore ? ` presso *${spesa.fornitore}*` : "";
    const descStr = spesa.descrizione ? `\n🧾 Dettaglio: ${spesa.descrizione}` : "";
    const txt = `🧾 *Nuova Spesa Rilevata*\n💶 Importo: *${spesa.importo}€*${fornitoreStr}${descStr}\n\n🏗️ A quale cantiere vuoi assegnarla?`;

    const inline_keyboard = cantieri.map(c => ([{ text: `📍 ${c.nome}`, callback_data: `spesa:${statusMsgId}:${c.id}` }]));

    await tgEditMessageText(chatId, statusMsgId, txt, { inline_keyboard });

    const timeoutId = setTimeout(() => {
        pendingExpenses.delete(statusMsgId.toString());
        tgEditMessageText(chatId, statusMsgId, "⌛ Sessione scaduta per questa spesa.").catch(() => { });
    }, 10 * 60 * 1000);

    pendingExpenses.set(statusMsgId.toString(), {
        employeeId: employee.id,
        importo: spesa.importo,
        fornitore: spesa.fornitore,
        descrizione: spesa.descrizione,
        timeoutId
    });
}

export function getPendingExpenses() {
    return pendingExpenses;
}