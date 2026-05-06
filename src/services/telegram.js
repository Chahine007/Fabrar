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

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyLightweightFormatting(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s([{])\*([^*\n][^*\n]*?[^*\n])\*(?=$|[\s\]).,;:!?])/g, "$1<b>$2</b>");
}

function buildTextPayload(basePayload, options = {}) {
  const parseMode = options.parseMode ?? "HTML";
  if (parseMode === "HTML") {
    return {
      ...basePayload,
      text: applyLightweightFormatting(basePayload.text),
      parse_mode: "HTML",
    };
  }
  if (parseMode) {
    return { ...basePayload, parse_mode: parseMode };
  }
  return basePayload;
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

export async function tgSendMessage(chatId, text, replyMarkup = null, options = {}) {
  const payload = buildTextPayload({ chat_id: chatId, text }, options);
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return tgCall("sendMessage", payload);
}

export async function tgEditMessageText(chatId, messageId, text, replyMarkup = null, options = {}) {
  const payload = buildTextPayload({ chat_id: chatId, message_id: messageId, text }, options);
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
