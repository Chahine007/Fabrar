import express from "express";
import bcrypt from "bcrypt";
import {
  listEmployees,
  listReportsWithEntries,
  getAuditLogs,
  getCantieriStatus,
  getAllCantieri,
  createCantiere,
  toggleCantiere,
  getDb,
  findUserByUsername,
  updateUserLastLogin,
  getReportEntryById,
  getReportById,
  updateReportEntry,
  employeeHasTariffa,
  listPricebook,
  insertSpesa,
} from "../db/index.js";
import jwt from "jsonwebtoken";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { extractCVData } from "../services/openai.js";

const router = express.Router();
const MAX_DAILY_HOURS_ALERT = 12;

router.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Username e password obbligatori." });
    }

    const user = await findUserByUsername(username);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Credenziali non valide." });
    }

    await updateUserLastLogin(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({ message: "Login effettuato", token });
  } catch (err) {
    console.error("[auth] login error", err);
    return res.status(500).json({ error: "Errore durante il login." });
  }
});

router.get("/api/employees", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const rows = await listEmployees();
  res.json(rows);
});

router.get("/api/reports", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const normalizeDate = (value) => {
    if (typeof value !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  };
  const start = normalizeDate(req.query.start);
  const end = normalizeDate(req.query.end);

  const rows = await listReportsWithEntries({ start, end });
  res.json(rows);
});

// ─── GET /api/pricebook — listino materiali (Policy 4.3) ─────────────────────
router.get("/api/pricebook", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const rows = await listPricebook();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Errore listino." });
  }
});

// ─── POST /api/admin/spese/manual — spesa da ufficio (con pricebook opzionale) ─
router.post("/api/admin/spese/manual", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const uploaderId = req.user?.employee_id;
    if (uploaderId == null || uploaderId === "") {
      return res.status(400).json({ error: "Utente senza employee_id collegato." });
    }
    const { cantiere_id, importo, fornitore, descrizione, pricebook_id, quantita, fonte } = req.body || {};
    const importoNum = typeof importo === "number" ? importo : parseFloat(String(importo), 10);
    if (!Number.isFinite(importoNum) || importoNum <= 0) {
      return res.status(400).json({ error: "Importo obbligatorio e > 0." });
    }
    if (!cantiere_id) {
      return res.status(400).json({ error: "cantiere_id obbligatorio." });
    }
    let extra = null;
    if (pricebook_id != null && pricebook_id !== "") {
      extra = {
        pricebook_id: Number(pricebook_id),
        quantita: quantita != null && quantita !== "" ? Number(quantita) : 1,
        stato_validazione: "PENDING",
      };
    }
    await insertSpesa(
      uploaderId,
      Number(cantiere_id),
      importoNum,
      fornitore || null,
      descrizione || null,
      fonte || "MANUAL_OFFICE",
      null,
      extra
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Errore inserimento spesa." });
  }
});

// ─── PATCH /api/admin/entries/:id/approve | reject — righe report (Policy 4.2) ─
router.patch("/api/admin/entries/:id/approve", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const entry = await getReportEntryById(id);
    if (!entry) return res.status(404).json({ error: "Riga non trovata." });
    const report = await getReportById(entry.report_id);
    if (!report) return res.status(404).json({ error: "Report non trovato." });
    if (!(await employeeHasTariffa(report.employee_id))) {
      return res.status(400).json({
        error: "Impossibile approvare: il dipendente non ha una tariffa oraria valida nel sistema (Policy 4.2).",
      });
    }
    await updateReportEntry(id, {
      stato_validazione: "VERIFIED",
      modified_by_admin_at: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore approvazione." });
  }
});

router.patch("/api/admin/entries/:id/reject", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const entry = await getReportEntryById(id);
    if (!entry) return res.status(404).json({ error: "Riga non trovata." });
    await updateReportEntry(id, {
      stato_validazione: "REJECTED",
      modified_by_admin_at: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore rifiuto." });
  }
});

router.get("/api/logs", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const rows = await getAuditLogs();
  res.json(rows);
});

// --- ROTTE CANTIERI (Alias per compatibilità frontend/cache) ---
router.get(["/api/cantieri", "/api/admin/cantieri"], verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const rows = await getAllCantieri();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Errore dal database" });
  }
});


router.post("/api/admin/cantieri", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { nome, indirizzo, lat, lng, budget } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome cantiere obbligatorio." });
    
    await createCantiere({
      nome, 
      indirizzo, 
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      budget: budget ? parseFloat(budget) : null
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante la creazione del cantiere." });
  }
});

router.patch("/api/admin/cantieri/:id/toggle", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    await toggleCantiere(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il cambio stato del cantiere." });
  }
});
router.post("/api/admin/spese/bulk", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const { spese_bulk } = req.body;

  if (!Array.isArray(spese_bulk) || spese_bulk.length === 0) {
    return res.status(400).json({ error: "Nessuna spesa fornita." });
  }

  const uploaderEmployeeId = req.user?.employee_id;
  if (uploaderEmployeeId == null || uploaderEmployeeId === "") {
    return res.status(400).json({
      error: "Utente senza employee_id collegato: impossibile registrare l'import. Verificare il record users → employees.",
    });
  }

  const db = getDb();
  await db.run("BEGIN TRANSACTION;");
  try {
    const stmt = await db.prepare(
      `INSERT INTO spese (timestamp_utc, employee_id, cantiere_id, importo, fornitore, descrizione, fonte, fattura_rif, stato_validazione)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
    );
    for (const s of spese_bulk) {
      if (typeof s.importo !== "number" || s.importo <= 0) {
        throw new Error("Tutti gli importi devono essere maggiori di zero.");
      }
      if (!s.cantiere_id) {
        throw new Error("Ogni spesa deve essere associata a un cantiere.");
      }

      // Converti DD/MM/YYYY → ISO se necessario
      let isoDate = s.timestamp_utc || new Date().toISOString();
      if (isoDate && isoDate.includes("/")) {
        const [day, month, year] = isoDate.split("/");
        if (day && month && year) {
          isoDate = new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
        }
      }

      await stmt.run(
        isoDate,
        uploaderEmployeeId,
        s.cantiere_id,
        s.importo,
        s.fornitore,
        s.descrizione,
        s.fonte || "IMPORT",
        s.fattura_rif || null
      );
    }
    await stmt.finalize();
    await db.run("COMMIT;");
    res.json({ ok: true, salvate: spese_bulk.length });
  } catch (e) {
    await db.run("ROLLBACK;");
    res.status(500).json({ error: e.message || "Errore durante l'inserimento massivo" });
  }
});

router.get("/api/admin/employees/:id/timeline", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [reports, logs, spese] = await Promise.all([
      db.all("SELECT * FROM reports WHERE employee_id = ?", [id]),
      db.all("SELECT * FROM message_logs WHERE employee_id = ?", [id]),
      db.all("SELECT * FROM spese WHERE employee_id = ? AND fonte = 'TELEGRAM'", [id])
    ]);

    const timeline = [];

    reports.forEach((r) => {
      timeline.push({
        type: "REPORT",
        timestamp: r.data_utc || r.report_date,
        data: {
          ore: r.ore_lavorate,
          cantiere_id: r.cantiere_id,
          note: r.attivita_svolte || r.testo_originale,
        },
      });
    });

    logs.forEach((m) => {
      timeline.push({
        type: "LOG",
        timestamp: m.timestamp_utc,
        data: {
          messaggio: m.raw_text,
          has_audio: m.message_type === "voice" || m.message_type === "audio",
        },
      });
    });

    spese.forEach((s) => {
      timeline.push({
        type: "EXPENSE",
        timestamp: s.timestamp_utc,
        data: {
          importo: s.importo,
          cantiere_id: s.cantiere_id,
        },
      });
    });

    timeline.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });

    res.json(timeline.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: "Errore durante il fetch della timeline." });
  }
});

router.get("/api/hr/alerts", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const reportsPending = await db.get(`
      SELECT COUNT(*) as count FROM report_entries
      WHERE LOWER(COALESCE(TRIM(stato_validazione), '')) = 'pending'
    `);
    const spesePending = await db.get(`
      SELECT COUNT(*) as count FROM spese
      WHERE LOWER(COALESCE(TRIM(stato_validazione), TRIM(status), 'pending')) = 'pending'
    `);

    const anomalies = [];
    const highHours = await db.all(`
      SELECT r.employee_id, e.nome, e.cognome, r.report_date, SUM(re.ore_lavorate) as total_hours
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE LOWER(COALESCE(re.stato_validazione, '')) != 'rejected'
      GROUP BY r.employee_id, r.report_date, e.nome, e.cognome
      HAVING total_hours > ?
    `, [MAX_DAILY_HOURS_ALERT]);

    highHours.forEach((row) => {
      anomalies.push(`Il dipendente ${row.nome} ${row.cognome} ha registrato ${row.total_hours}h il ${row.report_date}.`);
    });

    const reportRows = await db.all(`
      SELECT r.*, e.nome, e.cognome
      FROM reports r
      JOIN employees e ON r.employee_id = e.id
      WHERE r.report_date >= date('now', '-30 days')
      AND (r.ore_lavorate > 12 OR (r.metodo = 'manuale' AND (r.note IS NULL OR length(trim(r.note)) < 2)))
      ORDER BY r.report_date DESC
    `);

    const warnings = reportRows.map((r) => ({
      type: r.ore_lavorate > 12 ? "ORE ELEVATE" : "NO NOTA",
      name: `${r.nome} ${r.cognome}`,
      text:
        r.ore_lavorate > 12
          ? `${r.ore_lavorate}h il ${r.report_date}`
          : `Manuale senza nota il ${r.report_date}`,
    }));

    res.json({
      pending: {
        reports: reportsPending.count || 0,
        spese: spesePending.count || 0,
        total: (reportsPending.count || 0) + (spesePending.count || 0),
      },
      anomalies,
      warnings,
    });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il recupero degli alerts." });
  }
});

router.get("/api/hr/users/:id/kpi", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    // Mese Corrente (YYYY-MM)
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const kpiData = await db.get(`
      SELECT SUM(re.ore_lavorate) as total_hours
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      WHERE r.employee_id = ? AND r.report_date LIKE ?
        AND LOWER(COALESCE(re.stato_validazione, '')) != 'rejected'
    `, [id, `${currentMonthPrefix}%`]);

    const inputStats = await db.all(`
      SELECT
        CASE WHEN COALESCE(LOWER(re.fonte), '') IN ('timer', 'gps', 'app') THEN 'timer' ELSE 'manual' END as input_method,
        COUNT(*) as count,
        SUM(re.ore_lavorate) as hours
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      WHERE r.employee_id = ? AND r.report_date LIKE ?
        AND LOWER(COALESCE(re.stato_validazione, '')) != 'rejected'
      GROUP BY CASE WHEN COALESCE(LOWER(re.fonte), '') IN ('timer', 'gps', 'app') THEN 'timer' ELSE 'manual' END
    `, [id, `${currentMonthPrefix}%`]);

    const pendingSpese = await db.get(`
      SELECT COUNT(*) as count
      FROM spese
      WHERE employee_id = ? AND LOWER(COALESCE(TRIM(stato_validazione), TRIM(status), 'pending')) = 'pending'
    `, [id]);

    // get the latest costo_orario
    const currentCost = await db.get(`
      SELECT costo_orario, valido_dal FROM tariffe 
      WHERE employee_id = ? 
      ORDER BY valido_dal DESC LIMIT 1
    `, [id]);

    res.json({
      month: currentMonthPrefix,
      totalHours: kpiData?.total_hours || 0,
      inputStats,
      pendingSpese: pendingSpese?.count || 0,
      costo_orario: currentCost ? currentCost.costo_orario : 0
    });
  } catch (err) {
    res.status(500).json({ error: "Errore durante il recupero dei KPI utente." });
  }
});

router.get("/api/hr/audit", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { type, status, employee_id } = req.query;

    let queryOre = `
      SELECT
        re.id,
        'ore' as type,
        LOWER(COALESCE(re.stato_validazione, 'pending')) as status,
        COALESCE(re.fonte, r.input_method, 'manual') as input_method,
        r.report_date as date,
        re.ore_lavorate as value,
        r.employee_id,
        e.nome, e.cognome,
        re.attivita_svolte as note,
        c.nome as cantiere_nome,
        r.id as report_id
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      JOIN employees e ON e.id = r.employee_id
      LEFT JOIN cantieri c ON c.id = re.cantiere_id
    `;
    let querySpese = `
      SELECT s.id, 'spese' as type,
        LOWER(COALESCE(s.stato_validazione, s.status, 'pending')) as status,
        COALESCE(s.input_method, s.fonte, 'manual') as input_method,
        s.timestamp_utc as date, s.importo as value, s.employee_id, e.nome, e.cognome,
        s.descrizione as note, c.nome as cantiere_nome
      FROM spese s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN cantieri c ON s.cantiere_id = c.id
    `;

    const wheresOre = [];
    const wheresSpese = [];
    const paramsOre = [];
    const paramsSpese = [];

    if (status) {
      wheresOre.push("LOWER(COALESCE(TRIM(re.stato_validazione), '')) = ?");
      paramsOre.push(String(status).toLowerCase());
      wheresSpese.push("LOWER(COALESCE(TRIM(s.stato_validazione), TRIM(s.status), 'pending')) = ?");
      paramsSpese.push(String(status).toLowerCase());
    }

    if (employee_id) {
      wheresOre.push("r.employee_id = ?");
      paramsOre.push(employee_id);
      wheresSpese.push("s.employee_id = ?");
      paramsSpese.push(employee_id);
    }

    if (wheresOre.length) queryOre += " WHERE " + wheresOre.join(" AND ");
    if (wheresSpese.length) querySpese += " WHERE " + wheresSpese.join(" AND ");

    let allData = [];
    if (!type || type === "ore") {
      const oreRows = await db.all(queryOre, paramsOre);
      allData = allData.concat(oreRows);
    }
    if (!type || type === "spese") {
      const speseRows = await db.all(querySpese, paramsSpese);
      allData = allData.concat(speseRows);
    }

    allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(allData);
  } catch (err) {
    res.status(500).json({ error: "Errore durante il recupero audit." });
  }
});

function mapAuditStatusToDb(s) {
  const x = String(s || "").toLowerCase();
  if (x === "verified") return "VERIFIED";
  if (x === "rejected") return "REJECTED";
  if (x === "pending") return "PENDING";
  return String(s || "").toUpperCase();
}

router.put("/api/hr/audit/bulk", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  const db = getDb();
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Formato non valido." });

  const iso = new Date().toISOString();
  try {
    await db.run("BEGIN TRANSACTION");
    for (const item of items) {
      const newSt = mapAuditStatusToDb(item.newStatus);
      if (item.type === "ore") {
        const entry = await getReportEntryById(item.id);
        if (!entry) {
          await db.run("ROLLBACK");
          return res.status(400).json({ error: `Riga ore non trovata: ${item.id}` });
        }
        if (newSt === "VERIFIED") {
          const report = await getReportById(entry.report_id);
          if (!report) {
            await db.run("ROLLBACK");
            return res.status(400).json({ error: "Report non trovato." });
          }
          if (!(await employeeHasTariffa(report.employee_id))) {
            await db.run("ROLLBACK");
            return res.status(400).json({
              error:
                "Impossibile approvare: il dipendente non ha una tariffa oraria valida nel sistema (Policy 4.2).",
            });
          }
        }
        await updateReportEntry(item.id, { stato_validazione: newSt, modified_by_admin_at: iso });
      } else if (item.type === "spese") {
        await db.run(
          `UPDATE spese SET stato_validazione = ?, status = ?, modified_by_admin_at = ? WHERE id = ?`,
          [newSt, newSt.toLowerCase(), iso, item.id]
        );
      }
    }
    await db.run("COMMIT");
    res.json({ success: true, count: items.length });
  } catch (err) {
    await db.run("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message || "Errore durante il bulk update." });
  }
});

router.post("/api/hr/users/:id/cost", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { costo_orario, valido_dal } = req.body;
    
    if (costo_orario === undefined || !valido_dal) {
      return res.status(400).json({ error: "costo_orario e valido_dal sono obbligatori." });
    }

    await db.run(
      "INSERT INTO tariffe (employee_id, costo_orario, valido_dal) VALUES (?, ?, ?)",
      [id, parseFloat(costo_orario), valido_dal]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore inserimento nuova tariffa." });
  }
});

// ─── PATCH /api/admin/employees/:id — Modifica profilo dipendente ──────────────
router.patch("/api/admin/employees/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const allowed = ["nome", "cognome", "ruolo", "telefono", "skills", "note_admin", "documenti", "attivo"];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }
    const set = Object.keys(fields).map(k => `${k} = ?`).join(", ");
    const values = Object.values(fields);
    await db.run(`UPDATE employees SET ${set} WHERE id = ?`, [...values, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento dipendente." });
  }
});

// ─── PATCH /api/hr/reports/:id — Modifica record ore con audit trail admin ────
router.patch("/api/hr/reports/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const allowed = ["ore_lavorate", "report_date", "cantiere_id", "attivita_svolte", "luogo_cantiere", "admin_note", "status"];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }
    fields.modified_by_admin_at = new Date().toISOString();
    const set = Object.keys(fields).map(k => `${k} = ?`).join(", ");
    const values = Object.values(fields);
    await db.run(`UPDATE reports SET ${set} WHERE id = ?`, [...values, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento report." });
  }
});

// ─── PATCH /api/hr/spese/:id — Modifica record spesa con audit trail admin ────
router.patch("/api/hr/spese/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const allowed = ["importo", "fornitore", "descrizione", "cantiere_id", "admin_note", "status"];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }
    fields.modified_by_admin_at = new Date().toISOString();
    const set = Object.keys(fields).map(k => `${k} = ?`).join(", ");
    const values = Object.values(fields);
    await db.run(`UPDATE spese SET ${set} WHERE id = ?`, [...values, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento spesa." });
  }
});

// ─── PATCH /api/admin/cantieri/:id — Modifica completa cantiere ───────────────
router.patch("/api/admin/cantieri/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const allowed = ["nome", "indirizzo", "lat", "lng", "budget", "raggio_tolleranza", "attivo"];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = ["lat","lng","budget","raggio_tolleranza"].includes(key)
          ? (req.body[key] !== null && req.body[key] !== "" ? parseFloat(req.body[key]) : null)
          : req.body[key];
      }
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }
    const set = Object.keys(fields).map(k => `${k} = ?`).join(", ");
    const values = Object.values(fields);
    await db.run(`UPDATE cantieri SET ${set} WHERE id = ?`, [...values, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore aggiornamento cantiere." });
  }
});

// ─── GET /api/cantieri/:id/financial-timeline — Costo cumulativo per grafico ──
router.get("/api/cantieri/:id/financial-timeline", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Recupera budget cantiere
    const cantiere = await db.get("SELECT nome, budget, raggio_tolleranza FROM cantieri WHERE id = ?", [id]);
    if (!cantiere) return res.status(404).json({ error: "Cantiere non trovato." });

    // Manodopera: solo righe VERIFIED (coerente con job costing / cantieri status).
    const manodopera = await db.all(`
      WITH UltimaTariffa AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT employee_id, costo_orario,
                 ROW_NUMBER() OVER(PARTITION BY employee_id ORDER BY valido_dal DESC) as rn
          FROM tariffe
        ) WHERE rn = 1
      )
      SELECT 
        strftime('%Y-%m', r.report_date) as month,
        SUM(IFNULL(re.ore_lavorate, 0) * IFNULL(t.costo_orario, 0)) as costo
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      LEFT JOIN UltimaTariffa t ON r.employee_id = t.employee_id
      WHERE re.cantiere_id = ? AND LOWER(COALESCE(re.stato_validazione, '')) = 'verified'
      GROUP BY month
      ORDER BY month ASC
    `, [id]);

    const materiali = await db.all(`
      SELECT 
        strftime('%Y-%m', timestamp_utc) as month,
        SUM(importo) as costo
      FROM spese
      WHERE cantiere_id = ? AND LOWER(COALESCE(stato_validazione, status, 'pending')) != 'rejected'
      GROUP BY month
      ORDER BY month ASC
    `, [id]);

    // Merge mesi unici e somma
    const byMonth = {};
    for (const r of manodopera) {
      byMonth[r.month] = (byMonth[r.month] || 0) + (r.costo || 0);
    }
    for (const r of materiali) {
      byMonth[r.month] = (byMonth[r.month] || 0) + (r.costo || 0);
    }

    // Costruisce array ordinato con cumulativo
    const sortedMonths = Object.keys(byMonth).sort();
    let cumulative = 0;
    const costoReale = sortedMonths.map(m => {
      cumulative += byMonth[m];
      return parseFloat(cumulative.toFixed(2));
    });

    res.json({
      nome: cantiere.nome,
      budget: cantiere.budget || 0,
      raggio_tolleranza: cantiere.raggio_tolleranza || 300,
      months: sortedMonths,
      costoReale,
      costoPerMese: sortedMonths.map(m => parseFloat((byMonth[m] || 0).toFixed(2)))
    });
  } catch (err) {
    res.status(500).json({ error: "Errore financial timeline: " + err.message });
  }
});

// ─── GET /api/cantieri/:id/details — KPI e operativi per scheda cantiere ──────
router.get("/api/cantieri/:id/details", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const cantiere = await db.get("SELECT * FROM cantieri WHERE id = ?", [id]);
    if (!cantiere) return res.status(404).json({ error: "Cantiere non trovato." });

    // KPI: costo totale attuale
    const costoManodopera = await db.get(`
      WITH UltimaTariffa AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT employee_id, costo_orario,
                 ROW_NUMBER() OVER(PARTITION BY employee_id ORDER BY valido_dal DESC) as rn
          FROM tariffe
        ) WHERE rn = 1
      )
      SELECT SUM(IFNULL(re.ore_lavorate,0) * IFNULL(t.costo_orario,0)) as totale
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      LEFT JOIN UltimaTariffa t ON r.employee_id = t.employee_id
      WHERE re.cantiere_id = ? AND LOWER(COALESCE(re.stato_validazione, '')) = 'verified'
    `, [id]);

    const costoMateriali = await db.get(`
      SELECT SUM(importo) as totale FROM spese
      WHERE cantiere_id = ? AND LOWER(COALESCE(stato_validazione, status, 'pending')) != 'rejected'
    `, [id]);

    const perDipendente = await db.all(`
      WITH UltimaTariffa AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT employee_id, costo_orario,
                 ROW_NUMBER() OVER(PARTITION BY employee_id ORDER BY valido_dal DESC) as rn
          FROM tariffe
        ) WHERE rn = 1
      )
      SELECT 
        e.nome, e.cognome,
        SUM(re.ore_lavorate) as ore_tot,
        SUM(IFNULL(re.ore_lavorate,0) * IFNULL(t.costo_orario,0)) as costo_calcolato,
        MAX(r.report_date) as ultimo_accesso
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN UltimaTariffa t ON r.employee_id = t.employee_id
      WHERE re.cantiere_id = ? AND LOWER(COALESCE(re.stato_validazione, '')) = 'verified'
      GROUP BY r.employee_id
      ORDER BY ore_tot DESC
    `, [id]);

    const cM = parseFloat((costoManodopera?.totale || 0).toFixed(2));
    const cMat = parseFloat((costoMateriali?.totale || 0).toFixed(2));
    const costoTotale = parseFloat((cM + cMat).toFixed(2));
    const budget = cantiere.budget || 0;
    const margine = parseFloat((budget - costoTotale).toFixed(2));

    // Burn rate: costo totale / numero mesi distinti con attività
    const mesiAttivi = await db.get(`
      SELECT COUNT(DISTINCT strftime('%Y-%m', r.report_date)) as cnt
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      WHERE re.cantiere_id = ? AND LOWER(COALESCE(re.stato_validazione, '')) = 'verified'
    `, [id]);
    const nMesi = mesiAttivi?.cnt || 1;
    const burnRate = parseFloat((costoTotale / nMesi).toFixed(2));

    res.json({
      cantiere,
      kpi: { budget, costoTotale, costoManodopera: cM, costoMateriali: cMat, margine, burnRate, nMesi },
      perDipendente
    });
  } catch (err) {
    res.status(500).json({ error: "Errore details cantiere: " + err.message });
  }
});

// ─── POST /api/admin/employees/parse-cv — AI CV Text Parsing ──────────────────
router.post("/api/admin/employees/parse-cv", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const body = req.body || {};
    const text = body.text;
    console.log("[parse-cv] Content-Type:", req.headers["content-type"], "| body keys:", Object.keys(body), "| text length:", text?.length || 0);
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return res.status(400).json({ 
        error: "Testo CV troppo corto o mancante (minimo 20 caratteri).",
        debug: { bodyKeys: Object.keys(body), textType: typeof text, textLen: text?.length || 0, contentType: req.headers["content-type"] }
      });
    }
    const result = await extractCVData(text.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Errore AI nell'analisi del CV: " + (err.message || "sconosciuto") });
  }
});

// ─── GET /api/dashboard/radar — KPI aggregati per Radar Aziendale ─────────────
router.get("/api/dashboard/radar", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();

    // Cantieri attivi con semaforo
    const cantieriRaw = await db.all(`
      WITH UltimaTariffa AS (
        SELECT employee_id, costo_orario
        FROM (SELECT employee_id, costo_orario, ROW_NUMBER() OVER(PARTITION BY employee_id ORDER BY valido_dal DESC) as rn FROM tariffe) WHERE rn = 1
      ),
      CostoManodopera AS (
        SELECT re.cantiere_id, SUM(IFNULL(re.ore_lavorate,0)*IFNULL(t.costo_orario,0)) as costo
        FROM report_entries re
        JOIN reports r ON r.id = re.report_id
        LEFT JOIN UltimaTariffa t ON r.employee_id = t.employee_id
        WHERE re.cantiere_id IS NOT NULL AND LOWER(COALESCE(re.stato_validazione,'')) = 'verified'
        GROUP BY re.cantiere_id
      ),
      CostoMateriali AS (
        SELECT cantiere_id, SUM(importo) as costo FROM spese
        WHERE LOWER(COALESCE(stato_validazione, status, 'pending')) != 'rejected'
        GROUP BY cantiere_id
      )
      SELECT c.id, c.nome, IFNULL(c.budget,0) as budget,
        (IFNULL(m.costo,0)+IFNULL(mat.costo,0)) as costo_totale
      FROM cantieri c
      LEFT JOIN CostoManodopera m ON c.id=m.cantiere_id
      LEFT JOIN CostoMateriali mat ON c.id=mat.cantiere_id
      WHERE c.attivo=1
    `);
    const cantieri = cantieriRaw.map(c => {
      const pct = c.budget > 0 ? c.costo_totale / c.budget : null;
      let status = 'gray';
      if (pct !== null) { if (pct < 0.75) status = 'green'; else if (pct <= 0.90) status = 'amber'; else status = 'red'; }
      return { id: c.id, nome: c.nome, budget: c.budget, costo: c.costo_totale, pct, status };
    });

    // Pending approvazioni
    const pendingR = await db.get(`
      SELECT COUNT(*) as c FROM report_entries WHERE LOWER(COALESCE(TRIM(stato_validazione), '')) = 'pending'
    `);
    const pendingS = await db.get(`
      SELECT COUNT(*) as c FROM spese WHERE LOWER(COALESCE(TRIM(stato_validazione), TRIM(status), 'pending')) = 'pending'
    `);

    // Ore questa settimana vs scorsa
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // 1=Mon...7=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    const mondayStr = monday.toISOString().slice(0, 10);
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastMondayStr = lastMonday.toISOString().slice(0, 10);
    const lastSundayStr = new Date(monday.getTime() - 86400000).toISOString().slice(0, 10);

    const thisWeek = await db.get(`
      SELECT IFNULL(SUM(re.ore_lavorate),0) as h
      FROM report_entries re JOIN reports r ON r.id = re.report_id
      WHERE r.report_date >= ? AND LOWER(COALESCE(re.stato_validazione,'')) != 'rejected'
    `, [mondayStr]);
    const lastWeek = await db.get(`
      SELECT IFNULL(SUM(re.ore_lavorate),0) as h
      FROM report_entries re JOIN reports r ON r.id = re.report_id
      WHERE r.report_date >= ? AND r.report_date <= ? AND LOWER(COALESCE(re.stato_validazione,'')) != 'rejected'
    `, [lastMondayStr, lastSundayStr]);

    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const activeWorkers = await db.get(`
      SELECT COUNT(DISTINCT r.employee_id) as c
      FROM report_entries re JOIN reports r ON r.id = re.report_id
      WHERE r.report_date >= ? AND LOWER(COALESCE(re.stato_validazione,'')) != 'rejected'
    `, [sevenDaysAgo]);

    res.json({
      cantieri,
      pending: { reports: pendingR?.c || 0, spese: pendingS?.c || 0 },
      oreSettimana: { corrente: thisWeek?.h || 0, scorsa: lastWeek?.h || 0 },
      operaiAttivi: activeWorkers?.c || 0
    });
  } catch (err) {
    res.status(500).json({ error: "Errore radar: " + err.message });
  }
});

// ─── GET /api/cantieri/status — Costo totale per ogni cantiere ───────────────
router.get("/api/cantieri/status", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    // Manodopera: ore da report_entries VERIFIED × tariffa (allineato a getCantieriStatus in db).
    const rows = await db.all(`
      WITH UltimaTariffa AS (
        SELECT employee_id, costo_orario
        FROM (
          SELECT employee_id, costo_orario,
                 ROW_NUMBER() OVER(PARTITION BY employee_id ORDER BY valido_dal DESC) as rn
          FROM tariffe
        ) WHERE rn = 1
      ),
      CostoManodopera AS (
        SELECT re.cantiere_id, SUM(IFNULL(re.ore_lavorate, 0) * IFNULL(t.costo_orario, 0)) as costo_manodopera
        FROM report_entries re
        JOIN reports r ON r.id = re.report_id
        LEFT JOIN UltimaTariffa t ON r.employee_id = t.employee_id
        WHERE re.cantiere_id IS NOT NULL AND LOWER(COALESCE(re.stato_validazione, '')) = 'verified'
        GROUP BY re.cantiere_id
      ),
      CostoMateriali AS (
        SELECT s.cantiere_id, SUM(IFNULL(s.importo, 0)) as costo_materiali
        FROM spese s
        WHERE LOWER(COALESCE(s.stato_validazione, s.status, 'pending')) != 'rejected'
        GROUP BY s.cantiere_id
      )
      SELECT c.id, (IFNULL(m.costo_manodopera,0) + IFNULL(mat.costo_materiali, 0)) as costo_totale
      FROM cantieri c
      LEFT JOIN CostoManodopera m ON c.id = m.cantiere_id
      LEFT JOIN CostoMateriali mat ON c.id = mat.cantiere_id
    `);

    const map = {};
    rows.forEach((r) => {
      map[r.id] = { costo_totale: r.costo_totale };
    });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Errore calcolo status cantieri: " + err.message });
  }
});

// ─── PATCH /api/hr/report-entries/:id — Modifica riga rendiconto (testata/righe) ─
router.patch("/api/hr/report-entries/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { ore_lavorate, attivita_svolte, admin_note, cantiere_id } = req.body || {};
    const fields = {};
    if (ore_lavorate !== undefined && ore_lavorate !== null) fields.ore_lavorate = parseFloat(ore_lavorate);
    if (attivita_svolte !== undefined) fields.attivita_svolte = attivita_svolte;
    if (admin_note !== undefined) fields.admin_note = admin_note;
    if (cantiere_id !== undefined) {
      fields.cantiere_id = cantiere_id === "" || cantiere_id === null ? null : Number(cantiere_id);
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "Nessun campo da aggiornare." });
    }
    fields.modified_by_admin_at = new Date().toISOString();
    await updateReportEntry(id, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Errore modifica riga report." });
  }
});

// ─── PATCH /api/hr/reports/:id — Modifica amministrativa report ───────────
router.patch("/api/hr/reports/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { ore_lavorate, report_date, cantiere_id, note, admin_note } = req.body;
    const db = getDb();
    await db.run(`
      UPDATE reports SET 
        ore_lavorate = COALESCE(?, ore_lavorate),
        report_date = COALESCE(?, report_date),
        cantiere_id = COALESCE(?, cantiere_id),
        note = COALESCE(?, note),
        admin_note = ?,
        modified_by_admin_at = CURRENT_TIMESTAMP
      WHERE id = ?`, 
      [ore_lavorate, report_date, cantiere_id, note, admin_note, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore modifica report: " + err.message });
  }
});

// ─── PATCH /api/hr/spese/:id — Modifica amministrativa spesa ────────────
router.patch("/api/hr/spese/:id", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { importo, fornitore, cantiere_id, descrizione, admin_note } = req.body;
    const db = getDb();
    await db.run(`
      UPDATE spese SET 
        importo = COALESCE(?, importo),
        fornitore = COALESCE(?, fornitore),
        cantiere_id = COALESCE(?, cantiere_id),
        descrizione = COALESCE(?, descrizione),
        admin_note = ?,
        modified_by_admin_at = CURRENT_TIMESTAMP
      WHERE id = ?`, 
      [importo, fornitore, cantiere_id, descrizione, admin_note, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore modifica spesa: " + err.message });
  }
});

// ─── GET /api/admin/pending-summary — Conteggio approvazioni pendenti ────────
router.get("/api/admin/pending-summary", verifyTokenAndRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const db = getDb();
    const reports = await db.get(`
      SELECT COUNT(*) as c FROM report_entries WHERE LOWER(COALESCE(TRIM(stato_validazione), '')) = 'pending'
    `);
    const spese = await db.get(`
      SELECT COUNT(*) as c FROM spese WHERE LOWER(COALESCE(TRIM(stato_validazione), TRIM(status), 'pending')) = 'pending'
    `);
    res.json({ reports: reports?.c || 0, spese: spese?.c || 0 });
  } catch (err) {
    res.status(500).json({ error: "Errore pending summary: " + err.message });
  }
});

export default router;
