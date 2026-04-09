import path from "path";
import { spawn } from "child_process";
import logger from "../logger.js";

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

export async function maybeConvertToWav(inputPath, mimeType) {
  const ext = path.extname(inputPath).toLowerCase();
  const isOgg = ext === ".ogg" || ext === ".oga" || mimeType === "audio/ogg" || mimeType === "audio/opus";
  if (!isOgg) return { path: inputPath, converted: false };
  const outputPath = `${inputPath}.wav`;
  const ok = await runCommand("ffmpeg", ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", outputPath]);
  if (!ok) {
    logger.warn({ event: "ffmpeg_failed" }, "ffmpeg_failed");
    return { path: inputPath, converted: false };
  }
  return { path: outputPath, converted: true };
}
