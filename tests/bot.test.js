import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = {
  findEmployeeByTelegramId: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  insertMessageLog: vi.fn(),
  cantiereExists: vi.fn(),
  getCantieriAttivi: vi.fn(),
  insertSpesa: vi.fn(),
  getCantieriConCoordinate: vi.fn(),
  getEmployeesWithoutReport: vi.fn(),
  ensureDailyReportHeader: vi.fn(),
  createReportEntry: vi.fn(),
  listReportEntriesByEmployeeAndDate: vi.fn(),
  updateReportHeader: vi.fn(),
};

const telegramMocks = {
  tgSendMessage: vi.fn(),
  tgGetFile: vi.fn(),
  tgDownloadFile: vi.fn(),
  tgEditMessageText: vi.fn(),
  tgAnswerCallbackQuery: vi.fn(),
};

const openAiMocks = {
  transcribeAudio: vi.fn(),
  extractReport: vi.fn(),
  extractSpesaFromImage: vi.fn(),
  getOpenAIUserFacingMessage: vi.fn((_err, messages = {}) => messages.default || "fallback"),
};

const audioMocks = {
  maybeConvertToWav: vi.fn(),
};

vi.mock("../src/db/index.js", () => dbMocks);
vi.mock("../src/services/telegram.js", () => telegramMocks);
vi.mock("../src/services/openai.js", () => openAiMocks);
vi.mock("../src/services/audio.js", () => audioMocks);

function buildUpdate(text) {
  return {
    message: {
      chat: { id: 10 },
      from: { id: 20 },
      text,
    },
  };
}

describe("bot flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    openAiMocks.getOpenAIUserFacingMessage.mockImplementation((_err, messages = {}) => messages.default || "fallback");
    dbMocks.listReportEntriesByEmployeeAndDate.mockResolvedValue([]);
  });

  it("utente non registrato + /start -> crea utente e invia benvenuto", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue(null);
    dbMocks.createEmployee.mockResolvedValue({
      id: 1,
      stato_registrazione: "in_attesa_nome",
      gdpr_accettato: 0,
    });

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("/start"));

    expect(dbMocks.createEmployee).toHaveBeenCalledWith(20, 10);
    expect(telegramMocks.tgSendMessage).toHaveBeenCalledTimes(1);
    expect(telegramMocks.tgSendMessage).toHaveBeenCalledWith(10, expect.stringContaining("Benvenuto"));
  });

  it("utente registrato con gdpr non accettato + /start -> mostra informativa completa", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue({
      id: 1,
      stato_registrazione: "registrato",
      gdpr_accettato: 0,
    });

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("/start"));

    expect(telegramMocks.tgSendMessage).toHaveBeenCalledTimes(1);
    const [, message] = telegramMocks.tgSendMessage.mock.calls[0];
    expect(message).toContain("Fabdar di Chtioui Souhaiel & C. SAS");
    expect(message).toContain("Via dell'Artigianato 17, Sona VR");
    expect(message).toContain("fabdarsas@legalmail.it");
    expect(message).toContain("puntuale e volontaria");
    expect(message).toContain("Non costituisce monitoraggio continuo");
    expect(message).toContain("12 mesi");
    expect(message).toContain(
      "Se accetti l'informativa sopra riportata e acconsenti al trattamento, invia ora il comando /accetto_gdpr"
    );
  });

  it("utente in_attesa_nome -> completa registrazione e riceve l'informativa privacy", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue({
      id: 1,
      stato_registrazione: "in_attesa_nome",
      gdpr_accettato: 0,
    });

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("Mario Rossi"));

    expect(dbMocks.updateEmployee).toHaveBeenCalledWith(1, {
      nome: "Mario",
      cognome: "Rossi",
      stato_registrazione: "registrato",
    });
    // Il bot invia: (1) informativa GDPR, (2) conferma registrazione
    expect(telegramMocks.tgSendMessage).toHaveBeenCalledTimes(2);
    const gdprMsg = telegramMocks.tgSendMessage.mock.calls[0][1];
    expect(gdprMsg).toContain("INFORMATIVA PRIVACY");
    const confirmMsg = telegramMocks.tgSendMessage.mock.calls[1][1];
    expect(confirmMsg).toContain("accetto_gdpr");
  });

  it("utente registrato senza gdpr non puo usare /edit e riceve solo informativa", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue({
      id: 1,
      stato_registrazione: "registrato",
      gdpr_accettato: 0,
    });

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("/edit 2026-03-20"));

    expect(dbMocks.updateEmployee).not.toHaveBeenCalled();
    expect(telegramMocks.tgSendMessage).toHaveBeenCalledTimes(1);
    expect(telegramMocks.tgSendMessage.mock.calls[0][1]).toContain("/accetto_gdpr");
  });

  it("comando /accetto_gdpr -> aggiorna il consenso", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue({
      id: 1,
      stato_registrazione: "registrato",
      gdpr_accettato: 0,
    });

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("/accetto_gdpr"));

    expect(dbMocks.updateEmployee).toHaveBeenCalledWith(1, {
      gdpr_accettato: 1,
      chat_id: 10,
    });
    expect(telegramMocks.tgSendMessage).toHaveBeenCalledTimes(1);
    expect(telegramMocks.tgSendMessage.mock.calls[0][1]).toContain("Hai accettato l'informativa");
  });

  it("errore quota OpenAI su report testuale -> mostra messaggio specifico", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue({
      id: 1,
      stato_registrazione: "registrato",
      gdpr_accettato: 1,
      pending_json: null,
      pending_report_date: null,
    });
    dbMocks.updateEmployee.mockResolvedValue(undefined);
    openAiMocks.extractReport.mockRejectedValue(new Error("quota"));
    openAiMocks.getOpenAIUserFacingMessage.mockReturnValue(
      "⚠️ Il servizio AI di elaborazione report non è disponibile per quota esaurita. Riprova più tardi o avvisa l'amministrazione."
    );

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("ho lavorato 8 ore"));

    expect(openAiMocks.getOpenAIUserFacingMessage).toHaveBeenCalled();
    expect(telegramMocks.tgSendMessage).toHaveBeenCalledWith(
      10,
      "⚠️ Il servizio AI di elaborazione report non è disponibile per quota esaurita. Riprova più tardi o avvisa l'amministrazione."
    );
  });

  it("aggiorna una fine pausa mantenendo lo stato precedente del report", async () => {
    dbMocks.findEmployeeByTelegramId.mockResolvedValue({
      id: 1,
      stato_registrazione: "registrato",
      gdpr_accettato: 1,
      pending_json: null,
      pending_report_date: null,
    });
    dbMocks.updateEmployee.mockResolvedValue(undefined);
    dbMocks.ensureDailyReportHeader.mockResolvedValue(99);
    dbMocks.createReportEntry.mockResolvedValue(undefined);
    dbMocks.listReportEntriesByEmployeeAndDate.mockResolvedValue([
      {
        ore_lavorate: null,
        ingresso: "08:00",
        pausa_inizio: "11:00",
        pausa_fine: null,
        uscita: null,
        attivita_svolte: null,
        luogo_cantiere: null,
        problemi_riscontrati: null,
      },
    ]);
    openAiMocks.extractReport.mockResolvedValue({
      ore_totali: null,
      ingresso: null,
      pausa_inizio: null,
      pausa_fine: "12:00",
      uscita: null,
      attivita_svolte: null,
      luogo_cantiere: null,
      problemi_riscontrati: null,
    });

    const { handleTelegramUpdate } = await import("../src/services/bot.js");

    await handleTelegramUpdate(buildUpdate("Fine pausa alle 12"));

    expect(dbMocks.createReportEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: 99,
        ingresso: "08:00",
        pausa_inizio: "11:00",
        pausa_fine: "12:00",
      })
    );
    const lastMessage = telegramMocks.tgSendMessage.mock.calls.at(-1)[1];
    expect(lastMessage).toContain("Aggiornamento report registrato.");
    expect(lastMessage).toContain("11:00");
    expect(lastMessage).toContain("12:00");
  });
});
