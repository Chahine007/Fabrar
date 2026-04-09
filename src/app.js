import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./logger.js";
import webhookRoutes from "./routes/webhook.js";
import apiRoutes from "./routes/api.js";
import adminRoutes from "./routes/admin.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("etag");
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use(webhookRoutes);
  app.use(apiRoutes);
  app.use(adminRoutes);

  const publicDir = path.join(__dirname, "../public");
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    const pathName = req.path;
    if (pathName === "/" || pathName === "/index.html" || pathName === "/sw.js" || pathName === "/manifest.json") {
      res.setHeader("Cache-Control", "no-store, max-age=0");
    }
    next();
  });

  app.use(express.static(publicDir, {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      const lowerPath = filePath.toLowerCase();
      if (
        lowerPath.endsWith(".html") ||
        lowerPath.endsWith(".js") ||
        lowerPath.endsWith(".css") ||
        lowerPath.endsWith(`${path.sep}sw.js`) ||
        lowerPath.endsWith(`${path.sep}manifest.json`)
      ) {
        res.setHeader("Cache-Control", "no-store, max-age=0");
      }
    }
  }));

  app.use((err, req, res, next) => {
    logger.error({ err, event: "unhandled_error" }, "unhandled_error");
    res.status(500).json({ ok: false });
  });

  return app;
}
