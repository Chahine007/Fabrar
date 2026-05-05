import path from "node:path";
import JSZip from "jszip";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DETAILED_EMPTY_MESSAGE = "Il file dettagliato Genya non contiene importi riga; usa il file semplice oppure esporta il dettaglio con valori.";

export class GenyaImportFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = "GenyaImportFormatError";
        this.status = 400;
    }
}

function normalizeHeaderKey(header) {
    return String(header ?? "")
        .trim()
        .toLowerCase()
        .replace(/^\uFEFF/, "")
        .replace(/[()]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function normalizeImportHeader(header) {
    const key = normalizeHeaderKey(header);
    const aliases = {
        cantiere: "cantiere_id",
        cantiereid: "cantiere_id",
        idcantiere: "cantiere_id",
        id_cantiere: "cantiere_id",
        commessa: "cantiere_id",
        id_commessa: "cantiere_id",
        commessa_id: "cantiere_id",
        progetto: "cantiere_id",
        id_progetto: "cantiere_id",
        progetto_id: "cantiere_id",
        data: "timestamp_utc",
        giorno: "timestamp_utc",
        date: "timestamp_utc",
        data_spesa: "timestamp_utc",
        data_documento: "timestamp_utc",
        data_registrazione: "timestamp_utc",
        totale: "importo",
        totale_documento: "importo",
        totale_val: "importo",
        importo_totale: "importo",
        importo_eur: "importo",
        imponibile: "importo",
        imponibile_val: "importo",
        prezzo_tot: "importo",
        prezzo_totale: "importo",
        amount: "importo",
        amount_eur: "importo",
        costo: "importo",
        valore: "importo",
        prezzo: "importo",
        numero_rif: "fattura_rif",
        numero_rif_fornitore: "fattura_rif",
        riferimento: "fattura_rif",
        data_rif: "data_rif",
        data_rif_fornitore: "data_rif",
        tipo_documento: "tipo_documento",
        note_piede: "descrizione",
        fornitore_ragione_sociale: "fornitore",
        supplier: "fornitore",
        vendor: "fornitore",
        note: "descrizione",
        causale: "descrizione",
        descrizione_spesa: "descrizione",
    };

    return aliases[key] ?? key;
}

export function parseImportedMoney(value) {
    if (typeof value === "number") return value;
    let text = String(value ?? "").trim().replace(/\s/g, "").replace(/[€]/g, "");
    if (!text) return NaN;

    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    if (lastComma !== -1 && lastDot !== -1) {
        text = lastComma > lastDot
            ? text.replace(/\./g, "").replace(",", ".")
            : text.replace(/,/g, "");
    } else if (lastComma !== -1) {
        text = text.replace(/\./g, "").replace(",", ".");
    }

    return Number(text);
}

function excelSerialToDate(serial) {
    const serialNumber = Number(serial);
    if (!Number.isFinite(serialNumber) || serialNumber < 20000 || serialNumber > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + serialNumber * 86400000 + 12 * 60 * 60 * 1000);
}

export function parseImportedTimestamp(value) {
    if (!value) return new Date();
    if (value instanceof Date) return value;

    if (typeof value === "number") {
        const serialDate = excelSerialToDate(value);
        if (serialDate) return serialDate;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
            const serialDate = excelSerialToDate(trimmed.replace(",", "."));
            if (serialDate) return serialDate;
        }

        if (trimmed.includes("/")) {
            const [day, month, year] = trimmed.split("/");
            if (day && month && year) {
                return new Date(`${year}-${month}-${day}T12:00:00.000Z`);
            }
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Timestamp non valido: ${value}`);
    }

    return parsed;
}

function parseCsvLine(line, delimiter) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            i += 1;
            continue;
        }

        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === delimiter && !inQuotes) {
            values.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values.map((value) => value.replace(/^['"]|['"]$/g, ""));
}

function detectCsvDelimiter(line) {
    const semicolonCount = (line.match(/;/g) || []).length;
    const commaCount = (line.match(/,/g) || []).length;
    return semicolonCount >= commaCount ? ";" : ",";
}

function detectCsvDocumentDelimiter(lines) {
    const candidate = lines.find((line) => {
        const semicolonCount = (line.match(/;/g) || []).length;
        const commaCount = (line.match(/,/g) || []).length;
        return semicolonCount > 0 || commaCount > 0;
    });
    return detectCsvDelimiter(candidate ?? lines[0] ?? "");
}

function normalizeCellValue(value) {
    if (value == null) return null;
    if (value instanceof Date) return value;
    const text = String(value).trim();
    return text === "" ? null : text;
}

function isDetailedHeader(rawHeaders) {
    return rawHeaders.includes("numero_riga")
        || rawHeaders.includes("codice_articolo")
        || rawHeaders.includes("prezzo_tot")
        || rawHeaders.includes("totale_val")
        || rawHeaders.includes("imponibile_val");
}

function findTableHeader(table, fallbackCantiereId) {
    const maxHeaderScan = Math.min(table.length, 30);

    for (let index = 0; index < maxHeaderScan; index++) {
        const rawHeaders = table[index].map(normalizeHeaderKey);
        const headers = table[index].map(normalizeImportHeader);
        const hasImporto = headers.includes("importo");
        const hasFornitore = headers.includes("fornitore");
        const hasCantiere = headers.includes("cantiere_id") || Boolean(fallbackCantiereId);
        const looksLikeGenya = hasFornitore && (rawHeaders.includes("numero_rif") || rawHeaders.includes("numero_rif_fornitore"));

        if (hasImporto && hasFornitore && (hasCantiere || looksLikeGenya || isDetailedHeader(rawHeaders))) {
            return {
                index,
                headers,
                rawHeaders,
                isDetailed: isDetailedHeader(rawHeaders),
            };
        }
    }

    return null;
}

function assignImportedValue(row, column, value) {
    if (value == null) return;

    if (column === "importo") {
        const currentAmount = parseImportedMoney(row.importo);
        const nextAmount = parseImportedMoney(value);
        if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
            row.importo = value;
            return;
        }
        if (Number.isFinite(nextAmount) && nextAmount > 0 && !row.importo) {
            row.importo = value;
        }
        return;
    }

    if (row[column] == null || row[column] === "") {
        row[column] = value;
    }
}

function buildGenyaDescription(row) {
    if (row.descrizione) return row.descrizione;

    const parts = ["Documento Genya"];
    if (row.fattura_rif) parts.push(`rif. ${row.fattura_rif}`);
    if (row.anno) parts.push(`anno ${row.anno}`);
    if (row.stato) parts.push(`stato ${row.stato}`);
    return parts.join(" - ");
}

export function parseExpenseRowsFromTable(table, fallbackCantiereId = null) {
    const rows = table
        .map((row) => row.map(normalizeCellValue))
        .filter((row) => row.some((cell) => cell != null));

    if (rows.length <= 1) return [];

    const header = findTableHeader(rows, fallbackCantiereId);
    if (!header) return [];

    const parsedRows = rows.slice(header.index + 1).map((values) => {
        const row = {};
        header.headers.forEach((column, idx) => {
            assignImportedValue(row, column, values[idx]);
        });
        if (!row.cantiere_id && fallbackCantiereId) row.cantiere_id = fallbackCantiereId;
        if (row.importo) row.descrizione = buildGenyaDescription(row);
        return row;
    }).filter((row) => {
        const amount = parseImportedMoney(row.importo);
        return row.cantiere_id && Number.isFinite(amount) && amount > 0;
    });

    if (header.isDetailed && parsedRows.length === 0) {
        throw new GenyaImportFormatError(DETAILED_EMPTY_MESSAGE);
    }

    return parsedRows;
}

export function parseExpenseRowsFromCsv(csvText, fallbackCantiereId = null) {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return [];

    const delimiter = detectCsvDocumentDelimiter(lines);
    const table = lines.map((line) => parseCsvLine(line, delimiter));
    return parseExpenseRowsFromTable(table, fallbackCantiereId);
}

function decodeXmlEntities(value) {
    return String(value ?? "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function getXmlAttribute(tagAttributes, name) {
    const match = String(tagAttributes ?? "").match(new RegExp(`(?:^|\\s)${name}=(["'])(.*?)\\1`));
    return match ? decodeXmlEntities(match[2]) : null;
}

function columnIndexFromRef(ref) {
    const letters = String(ref ?? "").match(/[A-Z]+/i)?.[0];
    if (!letters) return null;

    let index = 0;
    for (const letter of letters.toUpperCase()) {
        index = index * 26 + letter.charCodeAt(0) - 64;
    }
    return index;
}

function extractXmlTextNodes(xml) {
    const texts = [];
    const textPattern = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g;
    let match;
    while ((match = textPattern.exec(xml)) !== null) {
        texts.push(decodeXmlEntities(match[1]));
    }
    return texts;
}

async function readSharedStrings(zip) {
    const file = zip.file("xl/sharedStrings.xml");
    if (!file) return [];

    const xml = await file.async("string");
    const strings = [];
    const itemPattern = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g;
    let match;
    while ((match = itemPattern.exec(xml)) !== null) {
        strings.push(extractXmlTextNodes(match[1]).join(""));
    }
    return strings;
}

function getCellValue(cellAttributes, cellXml, sharedStrings) {
    const type = getXmlAttribute(cellAttributes, "t");
    const inlineText = extractXmlTextNodes(cellXml).join("");
    const valueMatch = cellXml.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/);
    const rawValue = valueMatch ? decodeXmlEntities(valueMatch[1]) : inlineText;

    if (rawValue == null || rawValue === "") return null;
    if (type === "s") return sharedStrings[Number(rawValue)] ?? null;
    if (type === "inlineStr") return inlineText || null;
    return rawValue;
}

function worksheetXmlToTable(xml, sharedStrings) {
    const rows = [];
    const rowPattern = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(xml)) !== null) {
        const cells = [];
        let sequentialColumn = 1;
        const cellPattern = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
        let cellMatch;

        while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
            const attributes = cellMatch[1] ?? "";
            const cellXml = cellMatch[2] ?? "";
            const refColumn = columnIndexFromRef(getXmlAttribute(attributes, "r"));
            const columnIndex = refColumn ?? sequentialColumn;
            cells[columnIndex - 1] = getCellValue(attributes, cellXml, sharedStrings);
            sequentialColumn = columnIndex + 1;
        }

        rows.push(cells);
    }

    return rows;
}

function sortWorksheetPaths(paths) {
    return [...paths].sort((a, b) => {
        const aNumber = Number(a.match(/sheet(\d+)\.xml$/)?.[1] ?? 0);
        const bNumber = Number(b.match(/sheet(\d+)\.xml$/)?.[1] ?? 0);
        return aNumber - bNumber || a.localeCompare(b);
    });
}

export async function parseExpenseRowsFromXlsx(buffer, fallbackCantiereId = null) {
    let zip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch {
        throw new GenyaImportFormatError("File XLSX Genya non leggibile. Esporta nuovamente il file da One Click Genia e riprova.");
    }

    const sharedStrings = await readSharedStrings(zip);
    const worksheetPaths = sortWorksheetPaths(Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)));
    const sheets = [];
    for (const worksheetPath of worksheetPaths) {
        const xml = await zip.file(worksheetPath).async("string");
        sheets.push({ sheet: worksheetPath, data: worksheetXmlToTable(xml, sharedStrings) });
    }

    let detailedEmptyError = null;
    for (const sheet of sheets) {
        try {
            const rows = parseExpenseRowsFromTable(sheet.data ?? [], fallbackCantiereId);
            if (rows.length > 0) return rows;
        } catch (err) {
            if (err instanceof GenyaImportFormatError && err.message === DETAILED_EMPTY_MESSAGE) {
                detailedEmptyError = err;
                continue;
            }
            throw err;
        }
    }

    if (detailedEmptyError) throw detailedEmptyError;
    return [];
}

export function parseCantiereIdFromReferer(referer) {
    if (!referer) return null;
    const text = String(referer);

    try {
        const url = new URL(text);
        const match = url.pathname.match(/\/projects\/(\d+)(?:\/|$)/);
        return match ? Number(match[1]) : null;
    } catch {
        const match = text.match(/\/projects\/(\d+)(?:\/|$)/);
        return match ? Number(match[1]) : null;
    }
}

function getUploadedFileExtension(file) {
    return path.extname(file?.originalname ?? "").toLowerCase();
}

export async function parseExpenseRowsFromUploadedFile(file, fallbackCantiereId = null) {
    const ext = getUploadedFileExtension(file);
    const mime = String(file?.mimetype ?? "").toLowerCase();
    const buffer = file?.buffer;

    if (!buffer) {
        throw new GenyaImportFormatError("File Genya mancante o vuoto.");
    }

    if (ext === ".csv" || mime === "text/csv" || mime === "application/csv") {
        return parseExpenseRowsFromCsv(buffer.toString("utf-8"), fallbackCantiereId);
    }

    if (ext === ".xlsx" || mime === XLSX_MIME) {
        return parseExpenseRowsFromXlsx(buffer, fallbackCantiereId);
    }

    throw new GenyaImportFormatError("Formato file non supportato. Carica un CSV o XLSX Genya.");
}
