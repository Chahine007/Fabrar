/**
 * Client HTTP verso l'API Telegram (invio messaggi, file, webhook).
 * Policy GDPR / validazione report / geofence sono applicate in `bot.js`, non qui.
 */
import axios from "axios";
import { withRetry } from "./retry.js";

function getApiBase() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  return `https://api.telegram.org/bot${token}`;
}

function getFileBase() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  return `https://api.telegram.org/file/bot${token}`;
}

export async function tgCall(method, payload) {
  const url = `${getApiBase()}/${method}`;
  return withRetry(
    async () => {
      const res = await axios.post(url, payload, { timeout: 15000 });
      if (!res.data?.ok) {
        const err = new Error(`Telegram error: ${res.data?.description || "unknown"}`);
        err.status = res.data?.error_code;
        err.tg = res.data;
        throw err;
      }
      return res.data.result;
    },
    { name: `telegram.${method}` }
  );
}

export async function tgSendMessage(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return tgCall("sendMessage", payload);
}

export async function tgEditMessageText(chatId, messageId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, message_id: messageId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return tgCall("editMessageText", payload);
}

export async function tgAnswerCallbackQuery(callbackQueryId, text = null) {
  const payload = { callback_query_id: callbackQueryId };
  if (text) payload.text = text;
  return tgCall("answerCallbackQuery", payload);
}

export async function tgGetFile(fileId) {
  return tgCall("getFile", { file_id: fileId });
}

export async function tgDownloadFile(filePath) {
  const url = `${getFileBase()}/${filePath}`;
  return withRetry(
    async () => {
      const res = await axios.get(url, { responseType: "stream", timeout: 30000 });
      return res.data;
    },
    { name: "telegram.download" }
  );
}

export async function tgSetWebhook(url, secretToken, allowedUpdates = ["message", "callback_query"]) {
  const payload = { url };
  if (secretToken) payload.secret_token = secretToken;
  if (allowedUpdates) payload.allowed_updates = allowedUpdates;
  return tgCall("setWebhook", payload);
}
