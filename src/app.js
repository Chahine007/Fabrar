import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import logger from "./logger.js";
import webhookRoutes from "./routes/webhook.js";
import apiRoutes from "./routes/api.js";
import adminRoutes from "./routes/admin.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  // Fiducie per proxy (Cloudflare/Tunnel)
  app.set("trust proxy", 1); 
  app.disable("etag");
  app.use(express.json({ limit: "2mb" }));

  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
    "https://accounts.google.com",
    "https://apis.google.com",
  ];

  // Security headers – Configurazione CSP Manuale (per evitare conflitti con i default di Helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": scriptSources,
        "script-src-elem": scriptSources,
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:", "https://ui-avatars.com", "https://*.tile.openstreetmap.org", "https://cdnjs.cloudflare.com", "https://lh3.googleusercontent.com"],
        "connect-src": ["'self'", "ws:", "wss:", "https://gestionale.myfabdar.com", "https://accounts.google.com", "https://oauth2.googleapis.com"],
        "frame-src": ["https://accounts.google.com"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
        "object-src": ["'none'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }));

  app.use(pinoHttp({ logger }));
  app.use("/telegram/webhook", rateLimit({ windowMs: 60_000, max: 300 }));
  app.use("/api/login", rateLimit({ windowMs: 60_000, max: 10 }));

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

  app.get("*", (req, res) => {
    // Se la richiesta è per un'API o un asset non trovato, non servire index.html
    if (req.path.startsWith("/api") || req.path.includes(".")) {
      return res.status(404).json({ error: "Not Found" });
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((err, req, res, next) => {
    logger.error({ err, event: "unhandled_error" }, "unhandled_error");
    res.status(500).json({ ok: false });
  });

  return app;
}
