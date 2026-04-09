import express from "express";
import { listReports } from "../db/index.js";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { sendReminders } from "../services/bot.js";
import logger from "../logger.js";

const router = express.Router();

router.get("/admin/export.csv", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const normalizeDate = (value) => {
    if (typeof value !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  };
  const start = normalizeDate(req.query.start);
  const end = normalizeDate(req.query.end);

  const rows = await listReports({ start, end });

  const headers = [
    "id",
    "data_utc",
    "report_date",
    "employee_id",
    "nome",
    "cognome",
    "telegram_id",
    "ore_lavorate",
    "ingresso",
    "inizio_pausa",
    "fine_pausa",
    "uscita",
    "attivita_svolte",
    "luogo_cantiere",
    "problemi_riscontrati",
    "testo_originale",
  ];

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (s.includes("\"") || s.includes(",") || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/\"/g, "\"\"")}"`;
    }
    return s;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    const line = [
      r.id,
      r.data_utc,
      r.report_date,
      r.employee_id,
      r.nome,
      r.cognome,
      r.telegram_id,
      r.ore_lavorate,
      r.ora_ingresso ?? "",
      r.ora_pausa_inizio ?? "",
      r.ora_pausa_fine ?? "",
      r.ora_uscita ?? "",
      r.attivita_svolte,
      r.luogo_cantiere,
      r.problemi_riscontrati,
      r.testo_originale,
    ].map(escapeCsv).join(",");
    lines.push(line);
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"reports.csv\"");
  res.send(lines.join("\n"));
});

router.post("/cron/reminders", async (req, res) => {
  try {
    await sendReminders();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, event: "reminder_failed" }, "reminder_failed");
    res.status(500).json({ ok: false });
  }
});

export default router;
