import express from "express";
import logger from "../logger.js";
import { tgSetWebhook } from "../services/telegram.js";
import { handleTelegramUpdate } from "../services/bot.js";

const router = express.Router();

const MAX_SEEN_UPDATES = Number(process.env.IDEMPOTENCY_CACHE_SIZE || 200);
const seenUpdates = new Set();
const seenQueue = [];

function isDuplicateUpdate(updateId) {
  if (updateId == null) return false;
  if (seenUpdates.has(updateId)) return true;
  seenUpdates.add(updateId);
  seenQueue.push(updateId);
  if (seenQueue.length > MAX_SEEN_UPDATES) {
    const old = seenQueue.shift();
    seenUpdates.delete(old);
  }
  return false;
}

router.post("/telegram/webhook", async (req, res) => {
  try {
    const expected = process.env.TELEGRAM_SECRET;
    if (!expected) {
      logger.fatal("TELEGRAM_SECRET non configurato — exit");
      process.exit(1);
    }
    const secret = req.header("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== expected) {
      return res.status(401).send("unauthorized");
    }

    const updateId = req.body?.update_id;
    if (isDuplicateUpdate(updateId)) {
      logger.info({ event: "duplicate_update", updateId }, "duplicate_update");
      return res.sendStatus(200);
    }

    // Respond immediately to avoid Telegram retries, process async.
    res.sendStatus(200);
    setImmediate(async () => {
      try {
        await handleTelegramUpdate(req.body);
      } catch (err) {
        logger.error({ err, event: "webhook_async_error" }, "webhook_async_error");
      }
    });
  } catch (err) {
    logger.error({ err, event: "webhook_error" }, "webhook_error");
    res.sendStatus(200);
  }
});

async function handleSetWebhook(req, res) {
  try {
    const baseUrl = process.env.BASE_URL || "";
    if (!baseUrl) return res.status(400).json({ ok: false, error: "Missing BASE_URL" });
    const url = `${baseUrl.replace(/\/$/, "")}/telegram/webhook`;
    const secret = process.env.TELEGRAM_SECRET || "";
    // Note: To preserve inline buttons (callback_query) we include it along with "message"
    const result = await tgSetWebhook(url, secret, ["message", "callback_query"]);
    res.json({ ok: true, result });
  } catch (err) {
    logger.error({ err, event: "set_webhook_failed" }, "set_webhook_failed");
    res.status(500).json({ ok: false, error: err.message });
  }
}

router.post("/set-webhook", handleSetWebhook);

export default router;
