import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import logger from "../logger.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseBackupDate(name) {
  const match = /^app_backup_(\d{4}-\d{2}-\d{2})\.dump$/.exec(name);
  if (!match) return null;
  const [y, m, d] = match[1].split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function getBackupDir() {
  return path.resolve(process.env.DB_BACKUP_DIR || path.join(process.cwd(), "backups"));
}

function getPgDumpTarget() {
  const rawUrl = process.env.PRISMA_DB_URL;
  if (!rawUrl) {
    throw new Error("PRISMA_DB_URL non configurata.");
  }

  const parsed = new URL(rawUrl);
  const schema = parsed.searchParams.get("schema");
  parsed.searchParams.delete("schema");

  return {
    connectionString: parsed.toString(),
    schema,
  };
}

async function runPgDump(backupPath) {
  const { connectionString, schema } = getPgDumpTarget();
  const args = [
    "--format=custom",
    "--file",
    backupPath,
    "--no-owner",
    "--no-privileges",
    `--dbname=${connectionString}`,
  ];

  if (schema) {
    args.push("--schema", schema);
  }

  await new Promise((resolve, reject) => {
    const child = spawn("pg_dump", args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: process.env,
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `pg_dump terminato con codice ${code}`));
    });
  });
}

export async function runDbBackup() {
  const dir = getBackupDir();
  await fs.mkdir(dir, { recursive: true });

  const today = new Date();
  const stamp = formatDate(today);
  const backupName = `app_backup_${stamp}.dump`;
  const backupPath = path.join(dir, backupName);

  await runPgDump(backupPath);
  logger.info({ event: "db_backup_ok", backupPath }, "db_backup_ok");

  if (process.env.ONEDRIVE_BACKUP_PATH) {
    try {
      const oneDrivePath = path.resolve(process.env.ONEDRIVE_BACKUP_PATH);
      await fs.mkdir(oneDrivePath, { recursive: true });
      const oneDriveBackupFile = path.join(oneDrivePath, backupName);
      await fs.copyFile(backupPath, oneDriveBackupFile);
      logger.info({ event: "onedrive_backup_ok", path: oneDriveBackupFile }, "onedrive_backup_ok");
    } catch (err) {
      logger.warn({ err, event: "onedrive_backup_failed" }, "onedrive_backup_failed");
    }
  }

  const files = await fs.readdir(dir);
  const cutoff = new Date();
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS) || 7;
  cutoff.setDate(cutoff.getDate() - retentionDays);

  await Promise.all(
    files.map(async (name) => {
      const date = parseBackupDate(name);
      if (!date) return;
      if (date < cutoff) {
        const fullPath = path.join(dir, name);
        await fs.unlink(fullPath);
        logger.info({ event: "db_backup_pruned", path: fullPath }, "db_backup_pruned");
      }
    })
  );
}

export function scheduleDbBackups() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const delay = next.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await runDbBackup();
    } catch (err) {
      logger.error({ err, event: "db_backup_failed" }, "db_backup_failed");
    }

    setInterval(async () => {
      try {
        await runDbBackup();
      } catch (err) {
        logger.error({ err, event: "db_backup_failed" }, "db_backup_failed");
      }
    }, ONE_DAY_MS);
  }, delay);
}
