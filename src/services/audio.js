import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import logger from "../logger.js";

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => resolve({ ok: false, error: err.message, stderr }));
    child.on("exit", (code) => resolve({ ok: code === 0, code, stderr }));
  });
}

async function copyOgaAsOgg(inputPath) {
  const outputPath = `${inputPath}.ogg`;
  await fs.copyFile(inputPath, outputPath);
  return outputPath;
}

export async function maybeConvertToWav(inputPath, mimeType) {
  const ext = path.extname(inputPath).toLowerCase();
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  const isOgg = ext === ".ogg" || ext === ".oga" || normalizedMimeType === "audio/ogg" || normalizedMimeType === "audio/opus";
  if (!isOgg) return { path: inputPath, converted: false };

  const outputPath = `${inputPath}.wav`;
  const result = await runCommand("ffmpeg", ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", outputPath]);
  if (result.ok) {
    return { path: outputPath, converted: true };
  }

  logger.warn(
    {
      event: "ffmpeg_failed",
      code: result.code,
      error: result.error,
      stderr: result.stderr?.slice(0, 500),
      inputExt: ext,
      mimeType: normalizedMimeType || null,
    },
    "ffmpeg_failed"
  );

  if (ext === ".oga") {
    const oggPath = await copyOgaAsOgg(inputPath);
    return { path: oggPath, converted: true, fallback: "oga_as_ogg" };
  }

  if (ext === ".ogg") {
    return { path: inputPath, converted: false };
  }

  const oggPath = await copyOgaAsOgg(inputPath);
  return { path: oggPath, converted: true, fallback: "ogg_extension" };
}
