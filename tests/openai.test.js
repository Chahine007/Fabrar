import { describe, it, expect, vi, beforeEach } from "vitest";

// Strategia mocking: mock completo del client OpenAI per evitare chiamate reali.
// Usiamo vi.hoisted per garantire che i mock siano disponibili durante l'hoist di vi.mock.

const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  audioCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    constructor() {
      this.chat = { completions: { create: mocks.chatCreate } };
      this.audio = { transcriptions: { create: mocks.audioCreate } };
    }
  },
}));

describe("openai service", () => {
  beforeEach(() => {
    mocks.chatCreate.mockReset();
    mocks.audioCreate.mockReset();
  });

  it("extractReport ritorna JSON parsato", async () => {
    mocks.chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ingresso: "08:00",
              pausa_inizio: "13:00",
              pausa_fine: "14:00",
              uscita: "17:00",
              attivita_svolte: "Attivita",
              luogo_cantiere: "Luogo",
              problemi_riscontrati: "Nessuno",
            }),
          },
        },
      ],
    });

    const { extractReport } = await import("../src/services/openai.js");
    const result = await extractReport("testo");

    expect(result.ore_lavorate).toBe(8);
    expect(result.attivita_svolte).toBe("Attivita");
  });

  it("extractReport gestisce errore API", async () => {
    mocks.chatCreate.mockRejectedValue(new Error("boom"));

    const { extractReport } = await import("../src/services/openai.js");
    await expect(extractReport("testo")).rejects.toThrow("boom");
  });

  it("riconosce insufficient_quota e produce messaggio utente coerente", async () => {
    const quotaError = Object.assign(new Error("quota"), {
      status: 429,
      code: "insufficient_quota",
    });

    const { isInsufficientQuotaError, getOpenAIUserFacingMessage } = await import("../src/services/openai.js");

    expect(isInsufficientQuotaError(quotaError)).toBe(true);
    expect(getOpenAIUserFacingMessage(quotaError)).toContain("quota esaurita");
  });
});
