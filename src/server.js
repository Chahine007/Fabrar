import "./env.js";
import logger from "./logger.js";
import { initDb, getDb } from "./db/index.js";
import { createApp } from "./app.js";
import { scheduleDbBackups } from "./cron/backup.js";
import { scheduleDraftsCleanup } from "./cron/drafts.js";
import { initSockets } from "./sockets/index.js";
import { registerKpiListeners } from "./sockets/kpiListener.js";
import { startOutboxWorker } from "./domain/events/outboxService.js";

const required = ["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY", "BASE_URL", "JWT_SECRET", "TELEGRAM_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    logger.fatal({ key, event: "missing_env" }, "missing_env — shutting down");
    process.exit(1);
  }
}

// Global crash handlers
process.on("unhandledRejection", (reason, promise) => {
  logger.fatal({ promise, reason, event: "unhandled_rejection" }, "unhandled_rejection — process exit");
  // Permetti al logger di scrivere prima di uscire
  setTimeout(() => process.exit(1), 500);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err, event: "uncaught_exception" }, "uncaught_exception — process exit");
  setTimeout(() => process.exit(1), 500);
});

await initDb();
scheduleDbBackups();
scheduleDraftsCleanup();

const app = createApp();
const port = Number(process.env.PORT || 3000);

// Start server
const server = app.listen(port, "0.0.0.0", () => {
    logger.info({ event: "server_start", port }, "server_start");
});

// Initialize Socket.io after server is listening
const io = initSockets(server);
app.set("io", io);
registerKpiListeners(io);

const stopOutboxWorker = startOutboxWorker(getDb(), {
  intervalMs: process.env.OUTBOX_POLL_INTERVAL_MS,
  batchSize: process.env.OUTBOX_BATCH_SIZE,
  logger,
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  stopOutboxWorker?.();
  server.close(async () => {
    try {
      const db = getDb();
      if (db) await db.close();
      logger.info("DB closed");
    } catch (err) {
      logger.error({ err }, "Error closing DB");
    }
    process.exit(0);
  });
});
