import pino from "pino";

const level = process.env.LOG_LEVEL || "info";
const prettyRequested = process.env.NODE_ENV !== "production";

let transport;
if (prettyRequested) {
  try {
    // Verifica presenza modulo in runtime (puo' mancare in image production)
    await import("pino-pretty");
    transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    };
  } catch {
    transport = undefined;
  }
}

const logger = pino(
  { level, base: null },
  transport ? pino.transport(transport) : undefined
);

export default logger;
