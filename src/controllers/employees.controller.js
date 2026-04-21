import {
    listEmployees as dbListEmployees,
    updateEmployee as dbUpdateEmployee,
    getDb,
    formatDateOnly,
} from "../db/index.js";
import { extractCVData } from "../services/openai.js";
import { normalizeOptionalText, toNumber } from "../utils/helpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../logger.js";

export const listEmployees = asyncHandler(async (req, res) => {
    const rows = await dbListEmployees();
    res.json(rows);
});

export const updateEmployeeCtrl = asyncHandler(async (req, res) => {
    const employeeId = req.params.id; // Validato da Zod

    await dbUpdateEmployee(employeeId, req.body);
    res.json({ success: true });
});

export const getEmployeeTimeline = asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.id); // Validato da Zod

    const prisma = getDb();
    const [reports, logs, spese] = await Promise.all([
        prisma.report.findMany({
            where: { employee_id: employeeId },
            orderBy: { data_utc: "desc" },
        }),
        prisma.messageLog.findMany({
            where: { employee_id: employeeId },
            orderBy: { timestamp_utc: "desc" },
        }),
        prisma.spesa.findMany({
            where: {
                employee_id: employeeId,
                fonte: { equals: "TELEGRAM", mode: "insensitive" },
            },
            orderBy: { timestamp_utc: "desc" },
        }),
    ]);

    const timeline = [];

    reports.forEach((report) => {
        timeline.push({
            type: "REPORT",
            timestamp: report.data_utc || report.report_date,
            data: {
                ore: toNumber(report.ore_lavorate),
                cantiere_id: report.cantiere_id,
                note: report.attivita_svolte || report.testo_originale,
                report_date: formatDateOnly(report.report_date),
            },
        });
    });

    logs.forEach((log) => {
        timeline.push({
            type: "LOG",
            timestamp: log.timestamp_utc,
            data: {
                messaggio: log.raw_text,
                has_audio: log.message_type === "voice" || log.message_type === "audio",
            },
        });
    });

    spese.forEach((spesa) => {
        timeline.push({
            type: "EXPENSE",
            timestamp: spesa.timestamp_utc,
            data: {
                importo: toNumber(spesa.importo),
                cantiere_id: spesa.cantiere_id,
            },
        });
    });

    timeline.sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));

    res.json(timeline.slice(0, 100));
});

export const parseCv = asyncHandler(async (req, res) => {
    const { text } = req.body; // Validato da Zod
    logger.info({ event: "parse_cv_request", contentType: req.headers["content-type"], textLen: text?.length || 0 }, "parse_cv_request");
    const result = await extractCVData(text.trim());
    res.json(result);
});