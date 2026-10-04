import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { build, stop } from "esbuild";

const root = path.resolve(".artifacts/fframes-2717");
await mkdir(root, { recursive: true });
const compiled = path.join(root, "adapter.mjs");
await build({ entryPoints: ["core/media/fframes-local-media-engine.ts"], bundle: true, platform: "node", format: "esm", outfile: compiled, logLevel: "silent" });
stop();
const { FFramesLocalMediaEngine } = await import(pathToFileURL(compiled).href);
const colors = ["#ff0000", "#00ff00", "#0000ff"];
const frames = [];
for (let index = 0; index < colors.length; index++) {
  const file = path.join(root, `synthetic-${index + 1}.png`);
  await sharp({ create: { width: 1280, height: 720, channels: 3, background: colors[index] } }).png().toFile(file);
  frames.push({ position: index + 1, assetId: `synthetic-${index + 1}`, assetUrl: "synthetic-fixture", localFilePath: file, authoritative: true, durationMs: 500, sourceRefs: [] });
}
const evidence = await new FFramesLocalMediaEngine().renderMiniBlock({ schemaVersion: 1, requestId: "synthetic-fframes-2717", projectId: "synthetic-2717", blockNumber: 1, miniBlockNumber: 1, fps: 24, width: 1280, height: 720, frames }, { evidenceDirectory: root, timeoutMs: 120_000 });
assert.equal(evidence.state, "succeeded", JSON.stringify(evidence.diagnostics));
const binary = name => process.env.FFMPEG_DIR ? path.join(process.env.FFMPEG_DIR, "bin", `${name}${process.platform === "win32" ? ".exe" : ""}`) : name;
const video = evidence.artifacts.videoPath;
const probe = JSON.parse(execFileSync(binary("ffprobe"), ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", video], { encoding: "utf8", timeout: 30_000 }));
const stream = probe.streams.find(stream => stream.codec_type === "video");
assert.equal(stream.codec_name, "mpeg4"); assert.equal(stream.width, 1280); assert.equal(stream.height, 720);
assert.equal(stream.avg_frame_rate, "24/1"); assert.equal(Number(stream.nb_read_frames), 36);
assert.ok(Math.abs(Number(probe.format.duration) - 1.5) < 1 / 24);
const pixels = execFileSync(binary("ffmpeg"), ["-v", "error", "-i", video, "-vf", "scale=1:1:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { timeout: 30_000 });
assert.equal(pixels.length, 36 * 3);
for (let frame = 0; frame < 36; frame++) {
  const expected = Math.floor(frame / 12);
  for (let channel = 0; channel < 3; channel++) assert.ok(channel === expected ? pixels[frame * 3 + channel] > 180 : pixels[frame * 3 + channel] < 60, `Color/order mismatch at frame ${frame}, channel ${channel}`);
}
const report = { issue: 2717, status: "PASS", head: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || "local", platform: process.platform, engine: evidence.engineVersion, encoder: stream.codec_name, durationSeconds: Number(probe.format.duration), decodedFrames: 36, everyFrameColorAndOrder: "PASS", finalFrame: "PASS", gpuAcceleration: "UNPROVEN", redistribution: "not enabled" };
await writeFile(path.join(root, "proof.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
