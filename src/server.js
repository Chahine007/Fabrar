import "./env.js";
import logger from "./logger.js";
import { initDb } from "./db/index.js";
import { createApp } from "./app.js";
import { scheduleDbBackups } from "./cron/backup.js";
import { scheduleDraftsCleanup } from "./cron/drafts.js";

const required = ["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY", "BASE_URL"];
for (const key of required) {
  if (!process.env[key]) {
    logger.warn({ key, event: "missing_env" }, "missing_env");
  }
}

await initDb();
scheduleDbBackups();
scheduleDraftsCleanup();

const app = createApp();
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  logger.info({ event: "server_start", port }, "server_start");
});
