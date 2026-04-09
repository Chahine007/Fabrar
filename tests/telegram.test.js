import { describe, it, expect, vi, beforeEach } from "vitest";

// Strategia mocking: mock di axios per verificare URL e payload senza chiamate reali.

const postMock = vi.fn();

vi.mock("axios", () => ({
  default: {
    post: postMock,
  },
}));

describe("telegram service", () => {
  beforeEach(() => {
    postMock.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = "TEST_TOKEN";
  });

  it("tgSendMessage costruisce URL e payload corretti", async () => {
    postMock.mockResolvedValue({ data: { ok: true, result: { ok: true } } });

    const { tgSendMessage } = await import("../src/services/telegram.js");
    await tgSendMessage(123, "ciao");

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, payload] = postMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botTEST_TOKEN/sendMessage");
    expect(payload).toEqual({ chat_id: 123, text: "ciao" });
  });
});
