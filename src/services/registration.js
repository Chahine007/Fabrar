import { createEmployee, updateEmployee } from "../db/index.js";
import { tgSendMessage } from "./telegram.js";

const PRIVACY_TEXT = [
    "INFORMATIVA PRIVACY",
    "",
    "Titolare del trattamento: Fabdar di Chtioui Souhaiel & C. SAS, con sede in Via dell'Artigianato 17, Sona VR, PEC: fabdarsas@legalmail.it.",
    "",
    "Il bot aziendale tratta i dati personali conferiti per gestire report giornalieri, spese, organizzazione operativa del personale e certificazione della presenza in cantiere.",
    "",
    "Possono essere trattati dati identificativi e di contatto associati all'utenza Telegram, contenuti inviati tramite il bot (testi, audio, immagini e dati di spesa) e dati di posizione GPS solo quando inviati dall'utente.",
    "",
    "La geolocalizzazione GPS e' puntuale e volontaria: viene usata solo quando il lavoratore decide di inviare la posizione per certificare la presenza in cantiere. Non costituisce monitoraggio continuo, in background o h24.",
    "",
    "Il trattamento avviene con strumenti elettronici da parte di personale autorizzato, nei limiti delle finalita aziendali, amministrative e organizzative connesse al rapporto di lavoro o collaborazione e agli eventuali obblighi di legge.",
    "",
    "I dati raccolti tramite il bot sono conservati per 12 mesi, salvo tempi diversi imposti dalla legge o necessari per la tutela dei diritti del titolare.",
    "",
    "L'interessato puo' esercitare i diritti previsti dalla normativa applicabile, inclusi accesso, rettifica, cancellazione, limitazione del trattamento, opposizione e reclamo al Garante per la protezione dei dati personali, scrivendo alla PEC fabdarsas@legalmail.it.",
].join("\n");

const GDPR_ACCEPT_COMMAND_MESSAGE =
    "Se accetti l'informativa sopra riportata e acconsenti al trattamento, invia ora il comando /accetto_gdpr";

const GDPR_NOTICE_MESSAGE = [PRIVACY_TEXT, GDPR_ACCEPT_COMMAND_MESSAGE].join("\n\n");

export async function sendGdprNotice(chatId) {
    await tgSendMessage(chatId, GDPR_NOTICE_MESSAGE);
}

export async function handleStartCommand(employee, telegramId, chatId) {
    if (!employee) {
        await createEmployee(telegramId, chatId);
        await tgSendMessage(chatId, "👋 Benvenuto! Inviami Nome e Cognome...");
        return true; // Indica che il flusso è stato gestito
    }
    if (employee.stato_registrazione === "in_attesa_nome") {
        await tgSendMessage(chatId, "👋 Benvenuto! Inviami Nome e Cognome...");
        return true;
    }
    if (employee.gdpr_accettato !== 1) {
        await sendGdprNotice(chatId);
        return true;
    }
    await tgSendMessage(chatId, "ℹ️ Sei già registrato. Inviami il report di oggi (testo o vocale).");
    return true;
}

export async function handleNameRegistration(employee, text, chatId) {
    const parts = text.split(" ").filter(Boolean);
    await updateEmployee(employee.id, {
        nome: parts[0] || null,
        cognome: parts.slice(1).join(" ") || null,
        stato_registrazione: "registrato",
    });
    await sendGdprNotice(chatId);
    await tgSendMessage(chatId, "✅ Registrazione completata. Ora invia /accetto_gdpr per accettare l'informativa privacy e GDPR; poi potrai inviare report, spese e posizione.");
}

export async function handleGdprAccept(employee, chatId) {
    await updateEmployee(employee.id, { gdpr_accettato: 1, chat_id: chatId });
    await tgSendMessage(chatId, "✅ Grazie. Hai accettato l'informativa. Ora puoi inviare report (testo o vocale), spese e posizione.");
}