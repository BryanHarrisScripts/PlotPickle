import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { storyboardFramePrompt } from "../app/_components/storyboard/storyboard-editorial-model.ts";
import { saveWebpFrameCandidate } from "../build/media-provider-common.ts";

test("#2411 prepares a frame from observed context without inventing story structure", () => {
  const prompt = storyboardFramePrompt({ title: "Afterglow", blockNumber: 1, miniBlockNumber: 2, position: 7, scene: "Santa Cruz pier", beat: "", shot: "Wide angle; morning", source: "She sees the water." });
  assert.match(prompt, /Block 01, Mini-Block 2, position 07/u);
  assert.match(prompt, /Observed scene: Santa Cruz pier/u);
  assert.match(prompt, /No beat is authored here; do not invent a beat/u);
  assert.match(prompt, /Authored shot: Wide angle; morning/u);
  assert.match(prompt, /Screenplay evidence: She sees the water/u);
  assert.match(prompt, /WebP visual candidate/u);
});

test("#2411 converts a real generated PNG into a decodable WebP asset", async () => {
  const originalHome = process.env.PLOTPICKLE_HOME;
  const temporaryHome = await mkdtemp(path.join(os.tmpdir(), "plotpickle-frame-webp-"));
  process.env.PLOTPICKLE_HOME = temporaryHome;
  try {
    const assets = path.join(temporaryHome, "assets");
    await mkdir(assets);
    await writeFile(path.join(assets, "generated.png"), await sharp({ create: { width: 3, height: 2, channels: 3, background: "#226644" } }).png().toBuffer());
    const url = await saveWebpFrameCandidate("/api/local-ai/assets/generated.png", "storyboard-position-7");
    assert.match(url, /^\/api\/local-ai\/assets\/storyboard-position-7-\d+\.webp$/u);
    const image = await readFile(path.join(assets, path.basename(url)));
    assert.equal((await sharp(image).metadata()).format, "webp");
    await assert.rejects(() => saveWebpFrameCandidate("/api/local-ai/assets/../../secrets.json", "bad"), /safe local asset/u);
  } finally {
    if (originalHome === undefined) delete process.env.PLOTPICKLE_HOME;
    else process.env.PLOTPICKLE_HOME = originalHome;
    await rm(temporaryHome, { recursive: true, force: true });
  }
});
