import { DateTime } from "luxon";
import logger from "../logger.js";
import {
  listEmployeesWithPendingDrafts,
  ensureDailyReportHeader,
  createReportEntry,
  updateEmployee,
  cantiereExists,
} from "../db/index.js";

const ZONE = "Europe/Rome";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Chiude le bozze Telegram non confermate: salva una riga in report_entries (PENDING)
 * con nota "Bozza non confermata" e azzera pending_*.
 */
export async function runDraftFlush() {
  const employees = await listEmployeesWithPendingDrafts();
  if (employees.length === 0) {
    logger.info({ event: "draft_flush_skip", reason: "none" }, "draft_flush_skip");
    return;
  }

  for (const emp of employees) {
    try {
      const reportDate =
        emp.pending_report_date ||
        DateTime.now().setZone(ZONE).toFormat("yyyy-LL-dd");

      let extracted = {};
      if (emp.pending_json) {
        try {
          extracted = JSON.parse(emp.pending_json);
        } catch {
          extracted = {};
        }
      }

      const originalText = emp.pending_text || "";

      let cantiereId = null;
      if (extracted.cantiere_id != null) {
        const cid = Number(extracted.cantiere_id);
        if (Number.isFinite(cid) && (await cantiereExists(cid))) {
          cantiereId = cid;
        }
      }

      const reportId = await ensureDailyReportHeader(emp.id, reportDate);

      await createReportEntry({
        report_id: reportId,
        cantiere_id: cantiereId,
        ore_lavorate:
          extracted.ore_totali != null && typeof extracted.ore_totali === "number"
            ? extracted.ore_totali
            : null,
        ingresso: extracted.ingresso ?? null,
        pausa_inizio: extracted.pausa_inizio ?? null,
        pausa_fine: extracted.pausa_fine ?? null,
        uscita: extracted.uscita ?? null,
        attivita_svolte: extracted.attivita_svolte ?? null,
        luogo_cantiere: extracted.luogo_cantiere ?? null,
        problemi_riscontrati: extracted.problemi_riscontrati ?? null,
        testo_originale: originalText || null,
        stato_validazione: "PENDING",
        fonte: "TELEGRAM_TESTO",
        admin_note: "Bozza non confermata",
      });

      await updateEmployee(emp.id, {
        pending_json: null,
        pending_text: null,
        pending_date: null,
        pending_report_date: null,
      });

      logger.info({ event: "draft_flushed", employeeId: emp.id, reportDate }, "draft_flushed");
    } catch (err) {
      logger.error({ err, event: "draft_flush_employee_failed", employeeId: emp.id }, "draft_flush_employee_failed");
    }
  }
}

function msUntilNext0300Rome() {
  const now = DateTime.now().setZone(ZONE);
  let next = now.set({ hour: 3, minute: 0, second: 0, millisecond: 0 });
  if (next <= now) {
    next = next.plus({ days: 1 });
  }
  return next.diff(now).as("milliseconds");
}

export function scheduleDraftsCleanup() {
  const delay = msUntilNext0300Rome();
  logger.info({ event: "draft_cron_scheduled", delayMs: Math.round(delay) }, "draft_cron_scheduled");

  setTimeout(async () => {
    try {
      await runDraftFlush();
    } catch (err) {
      logger.error({ err, event: "draft_flush_failed" }, "draft_flush_failed");
    }

    setInterval(async () => {
      try {
        await runDraftFlush();
      } catch (err) {
        logger.error({ err, event: "draft_flush_failed" }, "draft_flush_failed");
      }
    }, ONE_DAY_MS);
  }, delay);
}
