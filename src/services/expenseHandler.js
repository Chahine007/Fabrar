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
import { getCantieriAttivi, insertSpesa, getDb } from '../db/index.js';
import { tgGetFile, tgDownloadFile, tgEditMessageText } from './telegram.js';
import { extractInvoiceOcrFromFile, getOpenAIUserFacingMessage } from './openai.js';
import {
    createPendingExpense,
    createPendingWarehouseLoad,
    getPendingExpense,
    getPendingWarehouseLoad,
    deletePendingExpense,
    deletePendingWarehouseLoad,
} from '../domain/bot/botSessionService.js';
import { normalizeAutomaticLoadLine } from '../domain/magazzino/warehouseService.js';
import {
    matchSpesaOcr,
    normalizeInvoiceOcrPayload,
} from '../domain/logistica/speseOcrService.js';

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

function getLoadableMaterialRows(rows = []) {
    return rows
        .map((row) => normalizeAutomaticLoadLine(row))
        .filter((row) => row.codice_sku && row.quantita && row.costo_unitario);
}

function getReconcileMaterialRows(rows = []) {
    return rows
        .map((row) => normalizeAutomaticLoadLine(row))
        .filter((row) => !row.codice_sku || !row.quantita || !row.costo_unitario);
}

function formatMaterialPreview(rows) {
    return rows
        .slice(0, 6)
        .map((row) => `• ${row.codice_sku} - ${row.descrizione} x ${row.quantita.toString()} ${row.unita_misura}`)
        .join('\n');
}

function formatReconcilePreview(rows) {
    return rows
        .slice(0, 4)
        .map((row) => {
            const reason = !row.codice_sku ? 'SKU mancante' : 'quantita/costo mancanti';
            return `• ${row.descrizione || 'Riga senza descrizione'} (${reason})`;
        })
        .join('\n');
}

export async function handleExpensePhoto(message, employee, sendStatus, statusMsgId) {
    const chatId = message.chat.id;
    const document = message.document ?? null;
    if (document && document.mime_type !== 'application/pdf' && !String(document.mime_type ?? '').startsWith('image/')) {
        await sendStatus('⛔ Documento non supportato. Invia una foto o un PDF da gestire via web.');
        return;
    }
    const photo  = message.photo?.[message.photo.length - 1] ?? document;
    const mimeType = document?.mime_type ?? 'image/jpeg';
    const filename = document?.file_name ?? 'telegram-documento';

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

    await sendStatus('🧠 Lettura del documento tramite AI in corso...');
    let ocrPayload;
    try {
        ocrPayload = normalizeInvoiceOcrPayload(await extractInvoiceOcrFromFile(base64Image, mimeType, filename));
    } catch (err) {
        logger.error({ err, event: 'extract_invoice_ocr_error' }, 'extract_invoice_ocr_error');
        await sendStatus(getOpenAIUserFacingMessage(err, {
            default: '⚠️ Non sono riuscito a leggere il documento. Assicurati che l\'immagine sia chiara o inserisci la spesa manualmente.',
        }));
        return;
    }

    const loadableRows = getLoadableMaterialRows(ocrPayload.righe_materiali);
    if (loadableRows.length > 0) {
        const prisma = getDb();
        if (!employee.user_id) {
            await tgEditMessageText(
                chatId,
                statusMsgId,
                'Documento materiali rilevato, ma il dipendente non è collegato a un utente web. Collega l’account prima di registrare carichi da Telegram.'
            );
            return;
        }
        const linkedUser = await prisma.user.findUnique({
            where: { id: employee.user_id },
            select: { role: true },
        });
        const { candidates: matches } = await matchSpesaOcr(prisma, {
            ocrPayload,
            user: {
                id: employee.user_id,
                employee_id: employee.id,
                role: linkedUser?.role ?? employee.ruolo,
            },
        });
        const bestMatch = matches[0];
        if (!bestMatch || bestMatch.strength === 'none') {
            await tgEditMessageText(
                chatId,
                statusMsgId,
                [
                    '📦 **Documento materiali rilevato**',
                    `Tipo: ${ocrPayload.document_type || 'UNKNOWN'}`,
                    ocrPayload.fornitore?.ragione_sociale ? `Fornitore: ${ocrPayload.fornitore.ragione_sociale}` : null,
                    ocrPayload.totale_documento ? `Totale: ${ocrPayload.totale_documento}€` : null,
                    '',
                    formatMaterialPreview(loadableRows),
                    '',
                    'Non ho trovato una spesa Genya compatibile in coda logistica.',
                    'Nessuna spesa o carico è stato creato. Apri Tabulati e usa "Analizza fattura" sulla riga Genya corretta.',
                ].filter(Boolean).join('\n')
            );
            return;
        }

        const reconcileRows = getReconcileMaterialRows(ocrPayload.righe_materiali);
        const sessionId = await createPendingWarehouseLoad(employee.id, {
            mode: 'genya_ocr_match',
            spesa_id: bestMatch.spesa.id,
            document_id: bestMatch.spesa.documento_id ?? null,
            match: {
                score: bestMatch.score,
                strength: bestMatch.strength,
                reasons: bestMatch.reasons,
            },
            ocr_payload: ocrPayload,
            righe_materiali: ocrPayload.righe_materiali,
        });

        const moreRows = loadableRows.length > 6 ? `\n...altre ${loadableRows.length - 6} righe` : '';
        const txt = [
            '📦 **Documento materiali rilevato**',
            `Tipo: ${ocrPayload.document_type || 'UNKNOWN'}`,
            ocrPayload.fornitore?.ragione_sociale ? `Fornitore: ${ocrPayload.fornitore.ragione_sociale}` : null,
            ocrPayload.totale_documento ? `Totale: ${ocrPayload.totale_documento}€` : null,
            '',
            `Match Genya: spesa #${bestMatch.spesa.id} (${bestMatch.strength}, score ${bestMatch.score})`,
            bestMatch.reasons?.length ? `Motivo: ${bestMatch.reasons.join(', ')}` : null,
            '',
            formatMaterialPreview(loadableRows) + moreRows,
            reconcileRows.length ? `\nDa riconciliare manualmente:\n${formatReconcilePreview(reconcileRows)}` : null,
            '',
            "Vuoi agganciare questa fattura alla spesa Genya e registrare il carico a magazzino?",
        ].filter(Boolean).join('\n');

        await tgEditMessageText(chatId, statusMsgId, txt, {
            inline_keyboard: [
                [{ text: '✅ Conferma carico Genya', callback_data: `carico:${sessionId}:ok` }],
                [{ text: '❌ Annulla', callback_data: `carico:${sessionId}:no` }],
            ],
        });
        return;
    }

    const simpleExpense = {
        importo: ocrPayload.totale_documento,
        fornitore: ocrPayload.fornitore?.ragione_sociale ?? null,
        descrizione: [
            ocrPayload.numero_documento ? `Doc. ${ocrPayload.numero_documento}` : null,
            ocrPayload.document_type,
        ].filter(Boolean).join(' - ') || null,
    };

    if (typeof simpleExpense.importo !== 'number' || simpleExpense.importo <= 0) {
        await sendStatus('⚠️ Non ho trovato un totale valido. Inserisci la spesa manualmente o invia una foto più leggibile.');
        return;
    }

    const cantieri = await getCantieriAttivi();
    if (!cantieri || cantieri.length === 0) {
        try {
            await insertSpesa(employee.id, null, simpleExpense.importo, simpleExpense.fornitore, simpleExpense.descrizione, 'TELEGRAM_OCR', null);
            await sendStatus(`🧾 Spesa rilevata: ${simpleExpense.importo}€ (${simpleExpense.fornitore || 'Ignoto'}).\n⚠️ Salvata come 'In sospeso': nessun cantiere attivo.`);
        } catch (err) {
            logger.error({ err, event: 'insert_orphan_spesa_failed' }, 'insert_orphan_spesa_failed');
            await sendStatus(`🧾 Spesa rilevata: ${simpleExpense.importo}€.\n⚠️ Errore salvataggio e nessun cantiere attivo.`);
        }
        return;
    }

    // Persiste la sessione su DB e usa il sessionId come chiave nel callback
    const sessionId = await createPendingExpense(employee.id, {
        importo:     simpleExpense.importo,
        fornitore:   simpleExpense.fornitore,
        descrizione: simpleExpense.descrizione,
    });

    const fornitoreStr = simpleExpense.fornitore ? ` presso **${simpleExpense.fornitore}**` : '';
    const descStr      = simpleExpense.descrizione ? `\n🧾 Dettaglio: ${simpleExpense.descrizione}` : '';
    const txt = `🧾 **Nuova Spesa Rilevata**\n💶 Importo: **${simpleExpense.importo}€**${fornitoreStr}${descStr}\n\n🏗️ A quale cantiere vuoi assegnarla?`;

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

export async function consumePendingWarehouseLoad(sessionId) {
    const data = await getPendingWarehouseLoad(sessionId);
    if (data) await deletePendingWarehouseLoad(sessionId);
    return data;
}
