import fs from "fs";
import path from "path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import logger from "../logger.js";

let db;

export async function initDb() {
  if (db) return db;

  const envPath = process.env.DB_PATH;
  const dockerPath = "/app/data/app.db";
  const localPath = path.join(process.cwd(), "data", "app.db");
  const dbPath = envPath || (fs.existsSync(dockerPath) ? dockerPath : localPath);
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.run("PRAGMA journal_mode=WAL;");
  await db.run("PRAGMA foreign_keys=ON;");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE,
      chat_id INTEGER,
      nome TEXT,
      cognome TEXT,
      attivo INTEGER DEFAULT 1,
      stato_registrazione TEXT DEFAULT 'in_attesa_nome',
      gdpr_accettato INTEGER DEFAULT 0,
      pending_json TEXT,
      pending_text TEXT,
      pending_date TEXT,
      pending_report_date TEXT
    );

    -- Tabella utenti dashboard (Policy 4.1)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN','HR')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_utc TEXT NOT NULL,
      report_date TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      cantiere_id INTEGER,
      ore_lavorate REAL,
      ingresso TEXT,
      pausa_inizio TEXT,
      pausa_fine TEXT,
      uscita TEXT,
      attivita_svolte TEXT,
      luogo_cantiere TEXT,
      problemi_riscontrati TEXT,
      testo_originale TEXT,
      -- Policy 1: stati canonici PENDING/VERIFIED/REJECTED
      stato_validazione TEXT NOT NULL DEFAULT 'PENDING',
      -- Policy 1: traccia fonte del dato (TELEGRAM_TESTO, TELEGRAM_AUDIO, GPS, IMPORT, ...)
      fonte TEXT,
      status TEXT DEFAULT 'verified',
      input_method TEXT DEFAULT 'timer',
      UNIQUE(employee_id, report_date)
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp_utc TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      message_type TEXT,
      raw_text TEXT,
      extracted_json TEXT
    );

    CREATE TABLE IF NOT EXISTS cantieri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      indirizzo TEXT,
      lat REAL,
      lng REAL,
      budget REAL,
      attivo INTEGER DEFAULT 1,
      -- Policy 3.1: raggio per cantiere (default 200m)
      raggio_tolleranza INTEGER DEFAULT 200
    );

    -- Policy 3.2: Multi-cantiere (segmenti/voci giornaliere) — dopo cantieri (FK)
    CREATE TABLE IF NOT EXISTS report_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      cantiere_id INTEGER,
      ore_lavorate REAL,
      ingresso TEXT,
      pausa_inizio TEXT,
      pausa_fine TEXT,
      uscita TEXT,
      attivita_svolte TEXT,
      luogo_cantiere TEXT,
      problemi_riscontrati TEXT,
      testo_originale TEXT,
      stato_validazione TEXT NOT NULL DEFAULT 'PENDING',
      fonte TEXT,
      admin_note TEXT,
      modified_by_admin_at DATETIME,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (cantiere_id) REFERENCES cantieri(id)
    );

    CREATE TABLE IF NOT EXISTS tariffe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      costo_orario REAL NOT NULL,
      valido_dal TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS pricebook (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      unita TEXT,
      costo_unitario REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spese (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp_utc TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      cantiere_id INTEGER NOT NULL,
      importo REAL NOT NULL,
      fornitore TEXT,
      descrizione TEXT,
      -- Policy 4.3: collegamento al listino materiali
      pricebook_id INTEGER,
      quantita REAL,
      -- Policy 1: stati canonici PENDING/VERIFIED/REJECTED
      stato_validazione TEXT NOT NULL DEFAULT 'PENDING',
      -- Policy 1: fonte (TELEGRAM_TESTO, TELEGRAM_AUDIO, GPS, IMPORT, ...)
      fonte TEXT,
      status TEXT DEFAULT 'verified',
      input_method TEXT DEFAULT 'telegram_ocr',
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (cantiere_id) REFERENCES cantieri(id),
      FOREIGN KEY (pricebook_id) REFERENCES pricebook(id)
    );
  `);


  for (const col of ["ingresso", "pausa_inizio", "pausa_fine", "uscita"]) {
    try {
      await db.exec(`ALTER TABLE reports ADD COLUMN ${col} TEXT`);
    } catch {}
  }

  try {
    await db.exec(`ALTER TABLE reports ADD COLUMN cantiere_id INTEGER;`);
  } catch (err) {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN stato_validazione TEXT DEFAULT 'PENDING';`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN fonte TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'verified';`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN input_method TEXT DEFAULT 'timer';`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN admin_note TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN modified_by_admin_at DATETIME;`); } catch {}

  try {
    await db.exec(`ALTER TABLE spese ADD COLUMN fonte TEXT DEFAULT 'TELEGRAM';`);
  } catch (err) {}

  try {
    await db.exec(`ALTER TABLE spese ADD COLUMN fattura_rif TEXT;`);
  } catch (err) {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN stato_validazione TEXT DEFAULT 'PENDING';`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN pricebook_id INTEGER;`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN quantita REAL;`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN status TEXT DEFAULT 'verified';`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN input_method TEXT DEFAULT 'telegram_ocr';`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN admin_note TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN modified_by_admin_at DATETIME;`); } catch {}

  // --- MIGRAZIONE Sprint 1: Policy 3.1 (raggio per-cantiere, default 200) ---
  try { await db.exec(`ALTER TABLE cantieri ADD COLUMN raggio_tolleranza INTEGER DEFAULT 200;`); } catch {}
  try { await db.exec(`UPDATE cantieri SET raggio_tolleranza = 200 WHERE raggio_tolleranza IS NULL;`); } catch {}

  // --- MIGRAZIONE Sprint 1: Policy 4.1 (users) ---
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN','HR')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );
      CREATE INDEX IF NOT EXISTS idx_users_employee    ON users(employee_id);
      CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
    `);
  } catch (err) {
    logger.warn({ err, event: "create_users_failed" }, "create_users_failed");
  }

  // --- MIGRAZIONE Sprint 1: Policy 1 (stati + fonte) su reports/spese ---
  try { await db.exec(`ALTER TABLE reports ADD COLUMN stato_validazione TEXT NOT NULL DEFAULT 'PENDING';`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN fonte TEXT;`); } catch {}

  // spese.fonte esiste già in alcuni DB; qui garantiamo anche stato_validazione + pricebook fields
  try { await db.exec(`ALTER TABLE spese ADD COLUMN stato_validazione TEXT NOT NULL DEFAULT 'PENDING';`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN pricebook_id INTEGER;`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN quantita REAL;`); } catch {}
  try { await db.exec(`UPDATE spese SET quantita = 1 WHERE quantita IS NULL;`); } catch {}

  // report_entries: columns added after the initial version
  try { await db.exec(`ALTER TABLE report_entries ADD COLUMN stato_validazione TEXT NOT NULL DEFAULT 'PENDING';`); } catch {}
  try { await db.exec(`ALTER TABLE report_entries ADD COLUMN fonte TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE report_entries ADD COLUMN admin_note TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE report_entries ADD COLUMN modified_by_admin_at DATETIME;`); } catch {}
  try { await db.exec(`ALTER TABLE report_entries ADD COLUMN created_at TEXT;`); } catch {}

  // Indexes on migrated columns (run after ALTER TABLE to avoid SQLITE_ERROR)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_stato_validazione ON reports(stato_validazione);
    CREATE INDEX IF NOT EXISTS idx_spese_stato_validazione   ON spese(stato_validazione);
    CREATE INDEX IF NOT EXISTS idx_report_entries_stato      ON report_entries(stato_validazione);
  `);

  // Backfill coerente da vecchi campi status → stato_validazione (senza cambiare status legacy)
  try {
    await db.exec(`
      UPDATE reports
      SET stato_validazione =
        CASE
          WHEN status = 'rejected' THEN 'REJECTED'
          WHEN status = 'verified' THEN 'VERIFIED'
          WHEN status = 'pending'  THEN 'PENDING'
          ELSE 'PENDING'
        END
      WHERE stato_validazione IS NULL OR TRIM(stato_validazione) = '';
    `);
  } catch {}

  try {
    await db.exec(`
      UPDATE spese
      SET stato_validazione =
        CASE
          WHEN status = 'rejected' THEN 'REJECTED'
          WHEN status = 'verified' THEN 'VERIFIED'
          WHEN status = 'pending'  THEN 'PENDING'
          ELSE 'PENDING'
        END
      WHERE stato_validazione IS NULL OR TRIM(stato_validazione) = '';
    `);
  } catch {}

  try {
    await db.exec(`
      UPDATE report_entries
      SET stato_validazione = COALESCE(
        (
          SELECT COALESCE(
            r.stato_validazione,
            CASE
              WHEN r.status = 'rejected' THEN 'REJECTED'
              WHEN r.status = 'verified' THEN 'VERIFIED'
              WHEN r.status = 'pending' THEN 'PENDING'
              ELSE 'PENDING'
            END
          )
          FROM reports r
          WHERE r.id = report_entries.report_id
        ),
        'PENDING'
      )
      WHERE stato_validazione IS NULL OR TRIM(stato_validazione) = '';
    `);
  } catch {}

  try {
    await db.exec(`
      UPDATE report_entries
      SET fonte = COALESCE(
        (
          SELECT COALESCE(r.fonte, r.input_method, 'LEGACY')
          FROM reports r
          WHERE r.id = report_entries.report_id
        ),
        'LEGACY'
      )
      WHERE fonte IS NULL OR TRIM(fonte) = '';
    `);
  } catch {}

  try {
    await db.exec(`
      UPDATE report_entries
      SET created_at = COALESCE(
        (
          SELECT COALESCE(r.data_utc, datetime('now'))
          FROM reports r
          WHERE r.id = report_entries.report_id
        ),
        datetime('now')
      )
      WHERE created_at IS NULL OR TRIM(created_at) = '';
    `);
  } catch {}

  // --- MIGRAZIONE Sprint 1: Policy 3.2 (report_entries) ---
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS report_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        cantiere_id INTEGER,
        ore_lavorate REAL,
        ingresso TEXT,
        pausa_inizio TEXT,
        pausa_fine TEXT,
        uscita TEXT,
        attivita_svolte TEXT,
        luogo_cantiere TEXT,
        problemi_riscontrati TEXT,
        testo_originale TEXT,
        stato_validazione TEXT NOT NULL DEFAULT 'PENDING',
        fonte TEXT,
        admin_note TEXT,
        modified_by_admin_at DATETIME,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (cantiere_id) REFERENCES cantieri(id)
        );
        CREATE INDEX IF NOT EXISTS idx_report_entries_report   ON report_entries(report_id);
        CREATE INDEX IF NOT EXISTS idx_report_entries_cantiere ON report_entries(cantiere_id);
      `);
    } catch (err) {
      logger.warn({ err, event: "create_report_entries_failed" }, "create_report_entries_failed");
    }

  // Backfill: crea 1 entry per report legacy che non ne ha ancora
  try {
    await db.exec(`
      INSERT INTO report_entries (
        report_id, cantiere_id,
        ore_lavorate, ingresso, pausa_inizio, pausa_fine, uscita,
        attivita_svolte, luogo_cantiere, problemi_riscontrati,
        testo_originale, stato_validazione, fonte, admin_note, modified_by_admin_at, created_at
      )
      SELECT
        r.id, r.cantiere_id,
        r.ore_lavorate, r.ingresso, r.pausa_inizio, r.pausa_fine, r.uscita,
        r.attivita_svolte, r.luogo_cantiere, r.problemi_riscontrati,
        r.testo_originale,
        COALESCE(r.stato_validazione,
          CASE
            WHEN r.status = 'rejected' THEN 'REJECTED'
            WHEN r.status = 'verified' THEN 'VERIFIED'
            WHEN r.status = 'pending'  THEN 'PENDING'
            ELSE 'PENDING'
          END
        ) as stato_validazione,
        COALESCE(r.fonte, r.input_method, 'LEGACY') as fonte,
        r.admin_note,
        r.modified_by_admin_at,
        COALESCE(r.data_utc, datetime('now')) as created_at
      FROM reports r
      WHERE NOT EXISTS (
        SELECT 1 FROM report_entries e WHERE e.report_id = r.id
      );
    `);
  } catch (err) {
    logger.warn({ err, event: "backfill_report_entries_failed" }, "backfill_report_entries_failed");
  }

  try { await db.exec(`ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'verified';`); } catch (err) {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN input_method TEXT DEFAULT 'timer';`); } catch (err) {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN status TEXT DEFAULT 'verified';`); } catch (err) {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN input_method TEXT DEFAULT 'telegram_ocr';`); } catch (err) {}

  try { await db.exec(`UPDATE reports SET status = 'verified' WHERE status IS NULL;`); } catch (err) {}
  try { await db.exec(`UPDATE reports SET input_method = 'timer' WHERE input_method IS NULL;`); } catch (err) {}
  try { await db.exec(`UPDATE spese SET status = 'verified' WHERE status IS NULL;`); } catch (err) {}
  try { await db.exec(`UPDATE spese SET input_method = 'telegram_ocr' WHERE input_method IS NULL;`); } catch (err) {}

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_cantiere        ON reports(cantiere_id);
    CREATE INDEX IF NOT EXISTS idx_spese_cantiere          ON spese(cantiere_id);
    CREATE INDEX IF NOT EXISTS idx_tariffe_lookup          ON tariffe(employee_id, valido_dal DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_status          ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_spese_status            ON spese(status);
    CREATE INDEX IF NOT EXISTS idx_message_logs_ts         ON message_logs(timestamp_utc DESC);
    CREATE INDEX IF NOT EXISTS idx_report_entries_report   ON report_entries(report_id);
    CREATE INDEX IF NOT EXISTS idx_report_entries_cantiere ON report_entries(cantiere_id);
    CREATE INDEX IF NOT EXISTS idx_users_employee          ON users(employee_id);
    CREATE INDEX IF NOT EXISTS idx_users_role_active       ON users(role, is_active);
  `);

  const employeeColumns = await db.all("PRAGMA table_info(employees)");
  const employeeColumnSet = new Set(employeeColumns.map((c) => c.name));
  const addEmployeeColumn = async (name, type) => {
    if (employeeColumnSet.has(name)) return;
    try {
      await db.exec(`ALTER TABLE employees ADD COLUMN ${name} ${type}`);
      employeeColumnSet.add(name);
    } catch (err) {
      logger.warn({ err, event: "alter_employees_failed", column: name }, "alter_employees_failed");
    }
  };
  await addEmployeeColumn("pending_json", "TEXT");
  await addEmployeeColumn("pending_text", "TEXT");
  await addEmployeeColumn("pending_date", "TEXT");
  await addEmployeeColumn("pending_report_date", "TEXT");

  // --- MIGRAZIONE v2: Scheda Dipendente Avanzata ---
  await addEmployeeColumn("ruolo", "TEXT");
  await addEmployeeColumn("telefono", "TEXT");
  await addEmployeeColumn("skills", "TEXT");       // JSON array, es. '["Muratura","Ponteggi"]'
  await addEmployeeColumn("note_admin", "TEXT");
  await addEmployeeColumn("documenti", "TEXT");    // JSON array di {nome, url, tipo}

  // --- MIGRAZIONE legacy: Cantieri ---
  // Nota: policy attuale impone default 200. Su DB già esistenti con default diverso,
  // garantiamo almeno che il valore NULL venga riportato a 200 (vedi sopra).
  try { await db.exec(`ALTER TABLE cantieri ADD COLUMN raggio_tolleranza INTEGER DEFAULT 200;`); } catch {}
  try { await db.exec(`UPDATE cantieri SET raggio_tolleranza = 200 WHERE raggio_tolleranza IS NULL;`); } catch {}

  // --- MIGRAZIONE v2: Audit Trail Admin ---
  try { await db.exec(`ALTER TABLE reports ADD COLUMN admin_note TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE reports ADD COLUMN modified_by_admin_at DATETIME;`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN admin_note TEXT;`); } catch {}
  try { await db.exec(`ALTER TABLE spese ADD COLUMN modified_by_admin_at DATETIME;`); } catch {}

  logger.info({ event: "db_ready", path: dbPath }, "db_ready");
  return db;
}

export function getDb() {
  if (!db) throw new Error("DB not initialized");
  return db;
}

export async function findEmployeeByTelegramId(telegramId) {
  return getDb().get("SELECT * FROM employees WHERE telegram_id = ?", [telegramId]);
}

export async function createEmployee(telegramId, chatId) {
  const result = await getDb().run(
    "INSERT INTO employees (telegram_id, chat_id, attivo, stato_registrazione, gdpr_accettato) VALUES (?, ?, 1, 'in_attesa_nome', 0)",
    [telegramId, chatId]
  );
  return getDb().get("SELECT * FROM employees WHERE id = ?", [result.lastID]);
}

export async function updateEmployee(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await getDb().run(`UPDATE employees SET ${set} WHERE id = ?`, [...values, id]);
}

export async function findReportForDate(employeeId, reportDate) {
  return getDb().get(
    "SELECT * FROM reports WHERE employee_id = ? AND report_date = ?",
    [employeeId, reportDate]
  );
}

export async function findReportForToday(employeeId, reportDate) {
  const date = reportDate || new Date().toISOString().slice(0, 10);
  return findReportForDate(employeeId, date);
}

export async function upsertReport(employeeId, reportDate, fields) {
  const existing = await findReportForDate(employeeId, reportDate);
  const payload = {
    data_utc: new Date().toISOString(),
    report_date: reportDate,
    employee_id: employeeId,
    cantiere_id: fields.cantiere_id ?? null,
    ore_lavorate: fields.ore_lavorate ?? null,
    ingresso: fields.ingresso ?? null,
    pausa_inizio: fields.pausa_inizio ?? null,
    pausa_fine: fields.pausa_fine ?? null,
    uscita: fields.uscita ?? null,
    attivita_svolte: fields.attivita_svolte ?? null,
    luogo_cantiere: fields.luogo_cantiere ?? null,
    problemi_riscontrati: fields.problemi_riscontrati ?? null,
    testo_originale: fields.testo_originale ?? null,
  };

  if (existing) {
    // UPDATE: preserva status e input_method (campi di audit) - aggiorna solo i dati della prestazione.
    // cantiere_id usa COALESCE: aggiorna se il bot ne fornisce uno nuovo, altrimenti mantiene quello esistente.
    await getDb().run(
      `UPDATE reports
       SET data_utc = ?,
           ore_lavorate = ?,
           ingresso = ?,
           pausa_inizio = ?,
           pausa_fine = ?,
           uscita = ?,
           attivita_svolte = ?,
           luogo_cantiere = ?,
           problemi_riscontrati = ?,
           testo_originale = ?,
           cantiere_id = COALESCE(?, cantiere_id)
       WHERE id = ?`,
      [
        payload.data_utc,
        payload.ore_lavorate,
        payload.ingresso,
        payload.pausa_inizio,
        payload.pausa_fine,
        payload.uscita,
        payload.attivita_svolte,
        payload.luogo_cantiere,
        payload.problemi_riscontrati,
        payload.testo_originale,
        payload.cantiere_id,
        existing.id,
      ]
    );
    return existing.id;
  }

  const result = await getDb().run(
    `INSERT INTO reports
       (data_utc, report_date, employee_id, cantiere_id, ore_lavorate,
        ingresso, pausa_inizio, pausa_fine, uscita,
        attivita_svolte, luogo_cantiere, problemi_riscontrati, testo_originale)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.data_utc,
      payload.report_date,
      payload.employee_id,
      payload.cantiere_id,
      payload.ore_lavorate,
      payload.ingresso,
      payload.pausa_inizio,
      payload.pausa_fine,
      payload.uscita,
      payload.attivita_svolte,
      payload.luogo_cantiere,
      payload.problemi_riscontrati,
      payload.testo_originale,
    ]
  );
  return result.lastID;
}

export async function insertMessageLog(employeeId, messageType, rawText, extractedJson) {
  await getDb().run(
    `INSERT INTO message_logs (timestamp_utc, employee_id, message_type, raw_text, extracted_json)
     VALUES (?, ?, ?, ?, ?)`,
    [new Date().toISOString(), employeeId, messageType, rawText, extractedJson]
  );
}

export async function getAuditLogs() {
  return getDb().all(
    `SELECT m.*, e.nome, e.cognome
     FROM message_logs m
     LEFT JOIN employees e ON e.id = m.employee_id
     ORDER BY m.timestamp_utc DESC
     LIMIT 200`
  );
}

export async function listEmployees() {
  return getDb().all("SELECT * FROM employees");
}

export async function listReports({ start, end } = {}) {
  const where = [];
  const params = [];
  if (start) {
    where.push("r.report_date >= ?");
    params.push(start);
  }
  if (end) {
    where.push("r.report_date <= ?");
    params.push(end);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return getDb().all(
    `SELECT r.*, e.nome, e.cognome, e.telegram_id
     FROM reports r
     LEFT JOIN employees e ON e.id = r.employee_id
     ${whereSql}
     ORDER BY r.data_utc DESC`,
    params
  );
}

/** Report giornalieri con righe (report_entries) annidate. */
export async function listReportsWithEntries({ start, end } = {}) {
  const rows = await listReports({ start, end });
  const db = getDb();
  for (const r of rows) {
    r.entries = await db.all(
      `SELECT * FROM report_entries WHERE report_id = ? ORDER BY id ASC`,
      [r.id]
    );
  }
  return rows;
}

/** Policy 4.2: almeno una tariffa per il dipendente (prerequisito approvazione ore). */
export async function employeeHasTariffa(employeeId) {
  const row = await getDb().get(
    "SELECT 1 as ok FROM tariffe WHERE employee_id = ? LIMIT 1",
    [employeeId]
  );
  return !!row;
}

// listReportsRaw rimossa: era un duplicato identico di listReports.
// admin.js usa ora listReports direttamente.

export async function cantiereExists(cantiereId) {
  const result = await getDb().get(
    "SELECT id FROM cantieri WHERE id = ? AND attivo = 1",
    [cantiereId]
  );
  return !!result;
}

export async function getCantieriAttivi() {
  return getDb().all(
    "SELECT id, nome FROM cantieri WHERE attivo = 1 ORDER BY nome"
  );
}

/**
 * @param {string|null} fattura_rif
 * @param {{ pricebook_id?: number|null, quantita?: number|null, stato_validazione?: string }|null} extra
 */
export async function insertSpesa(
  employeeId,
  cantiereId,
  importo,
  fornitore,
  descrizione,
  fonte = "TELEGRAM",
  fattura_rif = null,
  extra = null
) {
  if (typeof importo !== "number" || importo <= 0) {
    throw new Error("L'importo deve essere maggiore di zero.");
  }

  let pricebook_id = null;
  let quantita = null;
  let stato_validazione = "PENDING";
  if (extra && typeof extra === "object") {
    pricebook_id = extra.pricebook_id ?? null;
    quantita = extra.quantita ?? null;
    if (extra.stato_validazione) stato_validazione = extra.stato_validazione;
  }
  if (pricebook_id != null && (quantita == null || quantita === undefined)) {
    quantita = 1;
  }

  const ok = await cantiereExists(cantiereId);
  if (!ok) {
    throw new Error("Cantiere non valido o inattivo.");
  }

  const result = await getDb().run(
    `INSERT INTO spese (
       timestamp_utc, employee_id, cantiere_id, importo, fornitore, descrizione,
       fonte, fattura_rif, pricebook_id, quantita, stato_validazione
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      new Date().toISOString(),
      employeeId,
      cantiereId,
      importo,
      fornitore,
      descrizione,
      fonte,
      fattura_rif,
      pricebook_id,
      quantita,
      stato_validazione,
    ]
  );

  return result.lastID;
}

export async function getCantieriStatus() {
  // Manodopera: solo ore da report_entries VERIFIED × ultima tariffa dipendente.
  // (PENDING/REJECTED non contano nel costo "impegnato" — coerente con job costing.)
  const query = `
    WITH UltimaTariffa AS (
      SELECT employee_id, costo_orario
      FROM (
        SELECT employee_id, costo_orario, 
               ROW_NUMBER() OVER(PARTITION BY employee_id ORDER BY valido_dal DESC) as rn
        FROM tariffe
      )
      WHERE rn = 1
    ),
    CostoManodopera AS (
      SELECT re.cantiere_id, SUM(IFNULL(re.ore_lavorate, 0) * IFNULL(t.costo_orario, 0)) as costo_manodopera
      FROM report_entries re
      JOIN reports r ON r.id = re.report_id
      LEFT JOIN UltimaTariffa t ON r.employee_id = t.employee_id
      WHERE re.cantiere_id IS NOT NULL
        AND LOWER(COALESCE(re.stato_validazione, '')) = 'verified'
      GROUP BY re.cantiere_id
    ),
    CostoMateriali AS (
      SELECT s.cantiere_id, SUM(IFNULL(s.importo, 0)) as costo_materiali
      FROM spese s
      WHERE LOWER(COALESCE(s.stato_validazione, s.status, 'pending')) != 'rejected'
      GROUP BY s.cantiere_id
    )
    SELECT 
      c.id, 
      c.nome, 
      IFNULL(c.budget, 0) as budget,
      IFNULL(m.costo_manodopera, 0) as costo_manodopera,
      IFNULL(mat.costo_materiali, 0) as costo_materiali,
      (IFNULL(m.costo_manodopera, 0) + IFNULL(mat.costo_materiali, 0)) as costo_totale
    FROM cantieri c
    LEFT JOIN CostoManodopera m ON c.id = m.cantiere_id
    LEFT JOIN CostoMateriali mat ON c.id = mat.cantiere_id
    WHERE c.attivo = 1
    ORDER BY c.nome COLLATE NOCASE;
  `;
  return getDb().all(query);
}

export async function getAllCantieri() {
  return getDb().all("SELECT * FROM cantieri ORDER BY attivo DESC, id DESC");
}

export async function createCantiere({ nome, indirizzo, lat, lng, budget }) {
  const result = await getDb().run(
    `INSERT INTO cantieri (nome, indirizzo, lat, lng, budget, attivo) VALUES (?, ?, ?, ?, ?, 1)`,
    [nome, indirizzo || null, lat || null, lng || null, budget || null]
  );
  return result.lastID;
}

export async function toggleCantiere(id) {
  await getDb().run(
    `UPDATE cantieri SET attivo = CASE WHEN attivo = 1 THEN 0 ELSE 1 END WHERE id = ?`,
    [id]
  );
}

export async function getCantieriConCoordinate() {
  return getDb().all(
    `SELECT id, nome, lat, lng, raggio_tolleranza FROM cantieri WHERE attivo = 1 AND lat IS NOT NULL AND lng IS NOT NULL`
  );
}

/**
 * Garantisce la testata giornaliera (reports) senza scrivere ore nelle colonne legacy:
 * crea la riga se assente, aggiorna solo data_utc se esiste.
 */
export async function ensureDailyReportHeader(employeeId, reportDate) {
  const existing = await findReportForDate(employeeId, reportDate);
  const now = new Date().toISOString();
  if (existing) {
    await getDb().run(`UPDATE reports SET data_utc = ? WHERE id = ?`, [now, existing.id]);
    return existing.id;
  }
  const result = await getDb().run(
    `INSERT INTO reports (data_utc, report_date, employee_id, stato_validazione)
     VALUES (?, ?, ?, 'PENDING')`,
    [now, reportDate, employeeId]
  );
  return result.lastID;
}

/** Dipendenti con bozza Telegram ancora aperta (per cron 03:00). */
export async function listEmployeesWithPendingDrafts() {
  return getDb().all(
    `SELECT * FROM employees
     WHERE (pending_json IS NOT NULL AND TRIM(pending_json) != '')
        OR (pending_text IS NOT NULL AND TRIM(pending_text) != '')`
  );
}

export async function updateReportCantiere(employeeId, reportDate, cantiereId) {
  await getDb().run(
    `UPDATE reports SET cantiere_id = ? WHERE employee_id = ? AND report_date = ?`,
    [cantiereId, employeeId, reportDate]
  );
}

/**
 * Restituisce i dipendenti attivi che NON hanno ancora un report per la data indicata.
 * Sostituisce il pattern N+1 in sendReminders.
 */
export async function getEmployeesWithoutReport(reportDate) {
  return getDb().all(
    `SELECT e.id, e.chat_id, e.nome, e.cognome
     FROM employees e
     WHERE e.attivo = 1
       AND e.chat_id IS NOT NULL
       AND e.id NOT IN (
         SELECT employee_id FROM reports WHERE report_date = ?
       )`,
    [reportDate]
  );
}

// ─── users (Policy 4.1) ───────────────────────────────────────────────────────

export async function findUserByUsername(username) {
  if (!username || typeof username !== "string") return null;
  return getDb().get(
    `SELECT * FROM users WHERE username = ? COLLATE NOCASE`,
    [username.trim()]
  );
}

export async function findUserById(id) {
  return getDb().get(`SELECT * FROM users WHERE id = ?`, [id]);
}

export async function findUserByEmployeeId(employeeId) {
  return getDb().get(`SELECT * FROM users WHERE employee_id = ?`, [employeeId]);
}

export async function listUsers() {
  return getDb().all(
    `SELECT u.*, e.nome, e.cognome
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     ORDER BY u.username COLLATE NOCASE`
  );
}

export async function createUser({ employee_id, username, password_hash, role, is_active = 1 }) {
  const result = await getDb().run(
    `INSERT INTO users (employee_id, username, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [employee_id, username, password_hash, role, is_active ? 1 : 0]
  );
  return findUserById(result.lastID);
}

const USER_ALLOWED = new Set(["employee_id", "username", "password_hash", "role", "is_active"]);

export async function updateUser(id, fields) {
  const keys = Object.keys(fields).filter((k) => USER_ALLOWED.has(k));
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await getDb().run(`UPDATE users SET ${set} WHERE id = ?`, [...values, id]);
}

export async function updateUserLastLogin(id) {
  await getDb().run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [id]);
}

export async function deactivateUser(id) {
  await getDb().run(`UPDATE users SET is_active = 0 WHERE id = ?`, [id]);
}

export async function deleteUserById(id) {
  await getDb().run(`DELETE FROM users WHERE id = ?`, [id]);
}

// ─── report_entries (multi-cantiere) ─────────────────────────────────────────

export async function createReportEntry(fields) {
  const {
    report_id,
    cantiere_id = null,
    ore_lavorate = null,
    ingresso = null,
    pausa_inizio = null,
    pausa_fine = null,
    uscita = null,
    attivita_svolte = null,
    luogo_cantiere = null,
    problemi_riscontrati = null,
    testo_originale = null,
    stato_validazione = "PENDING",
    fonte = null,
    admin_note = null,
    modified_by_admin_at = null,
  } = fields;
  if (report_id == null) throw new Error("report_id obbligatorio.");
  const result = await getDb().run(
    `INSERT INTO report_entries (
       report_id, cantiere_id, ore_lavorate, ingresso, pausa_inizio, pausa_fine, uscita,
       attivita_svolte, luogo_cantiere, problemi_riscontrati, testo_originale,
       stato_validazione, fonte, admin_note, modified_by_admin_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report_id,
      cantiere_id,
      ore_lavorate,
      ingresso,
      pausa_inizio,
      pausa_fine,
      uscita,
      attivita_svolte,
      luogo_cantiere,
      problemi_riscontrati,
      testo_originale,
      stato_validazione,
      fonte,
      admin_note,
      modified_by_admin_at,
    ]
  );
  return result.lastID;
}

export async function getReportEntryById(id) {
  return getDb().get(`SELECT * FROM report_entries WHERE id = ?`, [id]);
}

export async function listReportEntriesByReportId(reportId) {
  return getDb().all(
    `SELECT * FROM report_entries WHERE report_id = ? ORDER BY id ASC`,
    [reportId]
  );
}

export async function listReportEntriesByEmployeeAndDate(employeeId, reportDate) {
  return getDb().all(
    `SELECT e.*, r.report_date, r.employee_id
     FROM report_entries e
     JOIN reports r ON r.id = e.report_id
     WHERE r.employee_id = ? AND r.report_date = ?
     ORDER BY e.id ASC`,
    [employeeId, reportDate]
  );
}

const REPORT_ENTRY_ALLOWED = new Set([
  "cantiere_id",
  "ore_lavorate",
  "ingresso",
  "pausa_inizio",
  "pausa_fine",
  "uscita",
  "attivita_svolte",
  "luogo_cantiere",
  "problemi_riscontrati",
  "testo_originale",
  "stato_validazione",
  "fonte",
  "admin_note",
  "modified_by_admin_at",
]);

export async function updateReportEntry(id, fields) {
  const keys = Object.keys(fields).filter((k) => REPORT_ENTRY_ALLOWED.has(k));
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await getDb().run(`UPDATE report_entries SET ${set} WHERE id = ?`, [...values, id]);
}

export async function deleteReportEntry(id) {
  await getDb().run(`DELETE FROM report_entries WHERE id = ?`, [id]);
}

export async function deleteReportEntriesByReportId(reportId) {
  await getDb().run(`DELETE FROM report_entries WHERE report_id = ?`, [reportId]);
}

// ─── reports (testata giornaliera) — helper aggiuntivi ───────────────────────

export async function getReportById(id) {
  return getDb().get(`SELECT * FROM reports WHERE id = ?`, [id]);
}

const REPORT_HEADER_ALLOWED = new Set([
  "data_utc",
  "report_date",
  "employee_id",
  "cantiere_id",
  "ore_lavorate",
  "ingresso",
  "pausa_inizio",
  "pausa_fine",
  "uscita",
  "attivita_svolte",
  "luogo_cantiere",
  "problemi_riscontrati",
  "testo_originale",
  "stato_validazione",
  "fonte",
  "status",
  "input_method",
  "admin_note",
  "modified_by_admin_at",
]);

export async function updateReportHeader(id, fields) {
  const keys = Object.keys(fields).filter((k) => REPORT_HEADER_ALLOWED.has(k));
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await getDb().run(`UPDATE reports SET ${set} WHERE id = ?`, [...values, id]);
}

// ─── spese — CRUD aggiuntivo ─────────────────────────────────────────────────

export async function getSpesaById(id) {
  return getDb().get(`SELECT * FROM spese WHERE id = ?`, [id]);
}

const SPESA_ALLOWED = new Set([
  "timestamp_utc",
  "employee_id",
  "cantiere_id",
  "importo",
  "fornitore",
  "descrizione",
  "fonte",
  "fattura_rif",
  "pricebook_id",
  "quantita",
  "stato_validazione",
  "status",
  "input_method",
  "admin_note",
  "modified_by_admin_at",
]);

export async function updateSpesa(id, fields) {
  const keys = Object.keys(fields).filter((k) => SPESA_ALLOWED.has(k));
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await getDb().run(`UPDATE spese SET ${set} WHERE id = ?`, [...values, id]);
}

export async function deleteSpesaById(id) {
  await getDb().run(`DELETE FROM spese WHERE id = ?`, [id]);
}

// ─── pricebook ────────────────────────────────────────────────────────────────

export async function getPricebookById(id) {
  return getDb().get(`SELECT * FROM pricebook WHERE id = ?`, [id]);
}

export async function listPricebook() {
  return getDb().all(`SELECT * FROM pricebook ORDER BY nome COLLATE NOCASE`);
}

export async function createPricebookItem({ nome, unita = null, costo_unitario }) {
  if (!nome) throw new Error("Nome listino obbligatorio.");
  const result = await getDb().run(
    `INSERT INTO pricebook (nome, unita, costo_unitario) VALUES (?, ?, ?)`,
    [nome, unita, costo_unitario]
  );
  return getPricebookById(result.lastID);
}

const PRICEBOOK_ALLOWED = new Set(["nome", "unita", "costo_unitario"]);

export async function updatePricebookItem(id, fields) {
  const keys = Object.keys(fields).filter((k) => PRICEBOOK_ALLOWED.has(k));
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  await getDb().run(`UPDATE pricebook SET ${set} WHERE id = ?`, [...values, id]);
}

export async function deletePricebookItem(id) {
  await getDb().run(`DELETE FROM pricebook WHERE id = ?`, [id]);
}
