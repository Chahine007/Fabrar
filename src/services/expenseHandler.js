/**
 * expenseHandler — gestione foto scontrini Telegram.
 *
 * La sessione pending è ora persistita su DB tramite botSessionService
 * invece di una Map in-process. Resistente ai riavvii e scalabile.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../logger.js';
import { getCantieriAttivi, insertSpesa } from '../db/index.js';
import { tgGetFile, tgDownloadFile, tgEditMessageText } from './telegram.js';
import { extractSpesaFromImage, getOpenAIUserFacingMessage } from './openai.js';
import {
    createPendingExpense,
    getPendingExpense,
    deletePendingExpense,
} from '../domain/bot/botSessionService.js';

async function writeStreamToFile(stream, filePath) {
    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        stream.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function safeUnlink(filePath) {
    if (!filePath) return;
    try { await fs.promises.unlink(filePath); } catch { /* ignore */ }
}

export async function handleExpensePhoto(message, employee, sendStatus, statusMsgId) {
    const chatId = message.chat.id;
    const photo  = message.photo[message.photo.length - 1];

    let tmpPath;
    let base64Image;
    try {
        const fileInfo = await tgGetFile(photo.file_id);
        tmpPath = path.join(os.tmpdir(), `tg_${Date.now()}_${path.basename(fileInfo.file_path)}`);
        const stream = await tgDownloadFile(fileInfo.file_path);
        await writeStreamToFile(stream, tmpPath);

        const buffer = fs.readFileSync(tmpPath);
        base64Image = buffer.toString('base64');
    } catch (err) {
        logger.error({ err, event: 'photo_download_failed' }, 'photo_download_failed');
        await sendStatus('❌ Errore nel download della foto. Riprova.');
        return;
    } finally {
        await safeUnlink(tmpPath);
    }

    await sendStatus('🧠 Lettura dello scontrino tramite AI in corso...');
    let spesa;
    try {
        spesa = await extractSpesaFromImage(base64Image);
    } catch (err) {
        logger.error({ err, event: 'extract_spesa_error' }, 'extract_spesa_error');
        await sendStatus(getOpenAIUserFacingMessage(err, {
            default: '⚠️ Non sono riuscito a leggere l\'importo. Assicurati che l\'immagine sia chiara o inserisci la spesa manualmente.',
        }));
        return;
    }

    const cantieri = await getCantieriAttivi();
    if (!cantieri || cantieri.length === 0) {
        try {
            await insertSpesa(employee.id, null, spesa.importo, spesa.fornitore, spesa.descrizione, 'TELEGRAM_OCR', null);
            await sendStatus(`🧾 Spesa rilevata: ${spesa.importo}€ (${spesa.fornitore || 'Ignoto'}).\n⚠️ Salvata come 'In sospeso': nessun cantiere attivo.`);
        } catch (err) {
            logger.error({ err, event: 'insert_orphan_spesa_failed' }, 'insert_orphan_spesa_failed');
            await sendStatus(`🧾 Spesa rilevata: ${spesa.importo}€.\n⚠️ Errore salvataggio e nessun cantiere attivo.`);
        }
        return;
    }

    // Persiste la sessione su DB e usa il sessionId come chiave nel callback
    const sessionId = await createPendingExpense(employee.id, {
        importo:     spesa.importo,
        fornitore:   spesa.fornitore,
        descrizione: spesa.descrizione,
    });

    const fornitoreStr = spesa.fornitore ? ` presso *${spesa.fornitore}*` : '';
    const descStr      = spesa.descrizione ? `\n🧾 Dettaglio: ${spesa.descrizione}` : '';
    const txt = `🧾 *Nuova Spesa Rilevata*\n💶 Importo: *${spesa.importo}€*${fornitoreStr}${descStr}\n\n🏗️ A quale cantiere vuoi assegnarla?`;

    // callback_data usa sessionId (UUID DB) invece del msgId in-memory
    const inline_keyboard = cantieri.map((c) => ([{
        text:          `📍 ${c.nome}`,
        callback_data: `spesa:${sessionId}:${c.id}`,
    }]));

    await tgEditMessageText(chatId, statusMsgId, txt, { inline_keyboard });
}

/**
 * Recupera e rimuove una sessione pending expense dal DB.
 * Chiamato da bot.js nel handler del callback_query "spesa:*".
 */
export async function consumePendingExpense(sessionId) {
    const data = await getPendingExpense(sessionId);
    if (data) await deletePendingExpense(sessionId);
    return data;
}