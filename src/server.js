import "./env.js";
import logger from "./logger.js";
import { initDb, getDb } from "./db/index.js";
import { createApp } from "./app.js";
import { scheduleDbBackups } from "./cron/backup.js";
import { scheduleDraftsCleanup } from "./cron/drafts.js";

const required = ["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY", "BASE_URL", "JWT_SECRET", "TELEGRAM_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    logger.fatal({ key, event: "missing_env" }, "missing_env — shutting down");
    process.exit(1);
  }
}

await initDb();
scheduleDbBackups();
scheduleDraftsCleanup();

const app = createApp();
const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
  logger.info({ event: "server_start", port }, "server_start");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
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
