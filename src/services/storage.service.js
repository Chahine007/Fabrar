import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DEFAULT_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export function getUploadRoot() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : DEFAULT_UPLOAD_DIR;
}

function normalizeRelativePath(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function sanitizeBaseName(originalName) {
  const parsed = path.parse(originalName || "file");
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return base || "file";
}

export function generateUniqueFileName(originalName) {
  const parsed = path.parse(originalName || "file");
  const ext = parsed.ext ? parsed.ext.toLowerCase() : "";
  return `${randomUUID()}-${sanitizeBaseName(originalName)}${ext}`;
}

export function ensureUploadRoot() {
  const root = getUploadRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function resolveStoredPath(relativePath) {
  const root = ensureUploadRoot();
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(root, normalized);

  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    const error = new Error("Percorso file non autorizzato.");
    error.statusCode = 403;
    throw error;
  }

  return absolutePath;
}

export async function saveFile(file, options = {}) {
  if (!file) {
    const error = new Error("Nessun file da salvare.");
    error.statusCode = 400;
    throw error;
  }

  const root = ensureUploadRoot();
  const folder = normalizeRelativePath(options.folder ?? "");
  const targetDir = path.resolve(root, folder);

  if (targetDir !== root && !targetDir.startsWith(`${root}${path.sep}`)) {
    const error = new Error("Cartella upload non autorizzata.");
    error.statusCode = 403;
    throw error;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const filename = generateUniqueFileName(file.originalname);
  const absolutePath = path.join(targetDir, filename);

  if (file.buffer) {
    await fs.promises.writeFile(absolutePath, file.buffer);
  } else if (file.path) {
    await fs.promises.copyFile(file.path, absolutePath);
  } else {
    const error = new Error("File non disponibile per il salvataggio.");
    error.statusCode = 400;
    throw error;
  }

  return {
    filename,
    absolutePath,
    relativePath: normalizeRelativePath(path.join(folder, filename)),
    url: `/${normalizeRelativePath(path.join("uploads", folder, filename))}`,
  };
}

export async function deleteFile(relativePath) {
  if (!relativePath) return false;
  const absolutePath = resolveStoredPath(relativePath);
  try {
    await fs.promises.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
