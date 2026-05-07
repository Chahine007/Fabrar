import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

function mockFailedSpawn(errorMessage = "spawn ffmpeg ENOENT") {
  spawnMock.mockImplementation(() => {
    const handlers = {};
    return {
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
        if (event === "error") {
          queueMicrotask(() => handler(new Error(errorMessage)));
        }
      }),
    };
  });
}

describe("audio conversion", () => {
  afterEach(() => {
    spawnMock.mockReset();
    vi.resetModules();
  });

  it("copia i vocali Telegram .oga come .ogg quando ffmpeg non e disponibile", async () => {
    mockFailedSpawn();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fabrar-audio-"));
    const inputPath = path.join(dir, "telegram.oga");
    await fs.writeFile(inputPath, Buffer.from("fake ogg opus"));

    const { maybeConvertToWav } = await import("../src/services/audio.js");
    const result = await maybeConvertToWav(inputPath, "audio/ogg");

    expect(result).toEqual({
      path: `${inputPath}.ogg`,
      converted: true,
      fallback: "oga_as_ogg",
    });
    await expect(fs.stat(result.path)).resolves.toBeTruthy();
  });

  it("non tocca file audio gia supportati fuori dal path ogg/opus", async () => {
    const { maybeConvertToWav } = await import("../src/services/audio.js");

    await expect(maybeConvertToWav("/tmp/report.m4a", "audio/mp4")).resolves.toEqual({
      path: "/tmp/report.m4a",
      converted: false,
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
