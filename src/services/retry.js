import logger from "../logger.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(err) {
  const header = err?.headers?.["retry-after"] || err?.response?.headers?.["retry-after"];
  const value = Number(header);
  if (Number.isFinite(value) && value > 0) return value * 1000;
  return null;
}

function collectErrorChain(err, seen = new Set()) {
  if (!err || (typeof err !== "object" && typeof err !== "function")) return [];
  if (seen.has(err)) return [];
  seen.add(err);
  return [
    err,
    ...collectErrorChain(err.cause, seen),
    ...collectErrorChain(err.error, seen),
  ];
}

function shouldRetry(err) {
  const retryableStatuses = new Set([408, 409, 429, 500, 502, 503, 504]);
  const nonRetryableCodes = new Set(["insufficient_quota"]);
  const retryableCodes = new Set([
    "ECONNABORTED",
    "ECONNRESET",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "ENETDOWN",
    "ENETRESET",
    "ENETUNREACH",
    "ENOTFOUND",
    "EPIPE",
    "ESOCKETTIMEDOUT",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
  ]);
  const retryableTypes = new Set(["APIConnectionError", "APIConnectionTimeoutError"]);
  const retryableSnippets = [
    "connection error",
    "socket hang up",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "network error",
    "fetch failed",
  ];

  for (const current of collectErrorChain(err)) {
    const normalizedCode = String(current?.code || current?.error?.code || "").toLowerCase();
    if (normalizedCode && nonRetryableCodes.has(normalizedCode)) return false;

    const status = current?.status || current?.response?.status;
    if (status && retryableStatuses.has(status)) return true;

    const code = String(current?.code || "").toUpperCase();
    if (code && retryableCodes.has(code)) return true;

    const type = current?.type || current?.name;
    if (type && retryableTypes.has(type)) return true;

    const msg = String(current?.message || "").toLowerCase();
    if (retryableSnippets.some((snippet) => msg.includes(snippet))) return true;
  }

  return false;
}

export async function withRetry(fn, opts = {}) {
  const {
    name = "call",
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
  } = opts;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || attempt >= maxRetries) {
        throw err;
      }
      const retryAfter = getRetryAfterMs(err);
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 200);
      const delay = retryAfter ?? backoff + jitter;
      logger.warn(
        {
          event: "retry",
          name,
          attempt: attempt + 1,
          delay,
          status: err?.status || err?.response?.status,
          code: err?.code || err?.error?.code,
        },
        "retry"
      );
      await sleep(delay);
      attempt += 1;
    }
  }
}
