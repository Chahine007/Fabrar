import pino from "pino";

const level = process.env.LOG_LEVEL || "info";
const pretty = process.env.NODE_ENV !== "production";

const transport = pretty
  ? {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    }
  : undefined;

const logger = pino(
  { level, base: null },
  transport ? pino.transport(transport) : undefined
);

export default logger;
