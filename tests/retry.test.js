import { describe, it, expect, vi, afterEach } from "vitest";
import { withRetry } from "../src/services/retry.js";

describe("retry service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ritenta sugli errori di connessione OpenAI con causa socket hang up", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const transientError = Object.assign(new Error("Connection error."), {
      name: "APIConnectionError",
      type: "APIConnectionError",
      cause: Object.assign(new Error("request failed, reason: socket hang up"), {
        code: "ECONNRESET",
        name: "FetchError",
      }),
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, {
      name: "openai.transcribe",
      baseDelayMs: 0,
      maxDelayMs: 0,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("non ritenta sugli errori non transienti", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("validation failed"));

    await expect(withRetry(fn, { baseDelayMs: 0, maxDelayMs: 0 })).rejects.toThrow("validation failed");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("non ritenta su 429 insufficient_quota", async () => {
    const fn = vi.fn().mockRejectedValue(
      Object.assign(new Error("quota"), {
        status: 429,
        code: "insufficient_quota",
      })
    );

    await expect(withRetry(fn, { baseDelayMs: 0, maxDelayMs: 0 })).rejects.toThrow("quota");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
