import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ffmpegThreeSecondArgs, renderTimelineThreeSecondClip,
  sourceVideoFileName, verifyThreeSecondProbe,
} from "../build/timeline-72-frame-clip.mjs";

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom0000")]);
const verifiedProbe = { streams: [{ nb_read_frames: "72", avg_frame_rate: "24/1" }], format: { duration: "3.000000" } };

test("#2830 physical 3s MP4: input is only a local saved provider asset, never a URL or a traversal path", () => {
  assert.equal(sourceVideoFileName("/api/local-ai/assets/shot-1.mp4"), "shot-1.mp4");
  assert.equal(sourceVideoFileName("/api/local-ai/assets/shot-1.webm"), "shot-1.webm");
  for (const input of [
    "C:\\secrets\\clip.mp4", "https://example.com/clip.mp4",
    "/api/local-ai/assets/../clip.mp4", "/api/local-ai/assets/%2e%2e/clip.mp4",
    "/api/local-ai/assets/nested/clip.mp4",
    "/api/local-ai/assets/clip.mp4?file=x",
    "/api/local-ai/assets/clip.mov", "/api/local-ai/assets/clip.mp4\\trash",
    "/api/local-ai/assets/-bad.mp4",
  ]) assert.throws(() => sourceVideoFileName(input), /local|safe/u, input);
  const args = ffmpegThreeSecondArgs("source.mp4", "target.mp4");
  assert.deepEqual(args.slice(0, 5), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"]);
  assert.ok(args.includes("fps=24,trim=end_frame=72,setpts=PTS-STARTPTS"));
  assert.deepEqual(args.slice(-2), ["+faststart", "target.mp4"]);
  assert.ok(!args.includes("-c:a"), "Timeline 3s shot remains silent");
});

test("#2830 physical 3s MP4: 72-frame, 24 fps, verified duration required", () => {
  assert.deepEqual(verifyThreeSecondProbe(verifiedProbe), { durationSeconds: 3, frameCount: 72, fps: 24 });
  for (const probe of [
    { ...verifiedProbe, streams: [{ nb_read_frames: "71", avg_frame_rate: "24/1" }] },
    { ...verifiedProbe, streams: [{ nb_read_frames: "72", avg_frame_rate: "30/1" }] },
    { ...verifiedProbe, format: { duration: "4.000" } },
    { ...verifiedProbe, format: { duration: "NaN" } },
    {},
  ]) assert.throws(() => verifyThreeSecondProbe(probe), /72 frames/u);
});

test("#2830 physical 3s MP4: immutable provider source, bounded local output and deterministic repeat without extra ffmpeg", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-72f-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filename = "afterglow-provider-job-123.mp4";
  const sourcePath = path.join(root, filename);
  await writeFile(sourcePath, mp4);
  const before = await readFile(sourcePath);
  const calls = [];
  const runTool = async (binary, args) => {
    calls.push({ binary, args });
    if (binary === "ffmpeg") {
      assert.equal(args[args.indexOf("-i") + 1], sourcePath);
      assert.equal(args.at(-1).startsWith(root + path.sep), true);
      await writeFile(args.at(-1), mp4);
      return "";
    }
    assert.equal(binary, "ffprobe");
    return JSON.stringify(verifiedProbe);
  };
  const args = { sourceAssetUrl: "/api/local-ai/assets/" + filename, directory: root };
  const first = await renderTimelineThreeSecondClip(args, { runTool });
  assert.match(first.outputAssetUrl, /^\/api\/local-ai\/assets\/timeline-72f-[a-f0-9]{24}\.mp4$/u);
  assert.equal(first.sourceAssetUrl, args.sourceAssetUrl);
  assert.equal(first.frameCount, 72);
  assert.equal(first.fps, 24);
  assert.equal(first.durationSeconds, 3);
  assert.deepEqual(await readFile(sourcePath), before, "provider original is never trimmed or rewritten");
  assert.equal(calls.filter(x => x.binary === "ffmpeg").length, 1);
  const again = await renderTimelineThreeSecondClip(args, { runTool });
  assert.deepEqual(again, first);
  assert.equal(calls.filter(x => x.binary === "ffmpeg").length, 1, "reopening uses existing verified 72-frame video, not another render");
  const files = await readdir(root);
  assert.ok(files.includes(filename));
  assert.ok(files.includes(first.outputAssetUrl.split("/").at(-1)));
  assert.ok(!files.some(x => x.includes(".tmp.")), "no transient MP4 is retained");
});

test("#2830 physical 3s MP4: unverified output fails closed and no false playable asset remains", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-72f-fail-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "source.mp4"), mp4);
  let renders = 0;
  const runTool = async (binary, args) => {
    if (binary === "ffmpeg") {
      renders++;
      await writeFile(args.at(-1), mp4);
      return "";
    }
    return JSON.stringify({ ...verifiedProbe, streams: [{ nb_read_frames: "73", avg_frame_rate: "24/1" }] });
  };
  await assert.rejects(() => renderTimelineThreeSecondClip({
    sourceAssetUrl: "/api/local-ai/assets/source.mp4", directory: root,
  }, { runTool }), /72 frames/u);
  assert.equal(renders, 1);
  assert.deepEqual(await readdir(root), ["source.mp4"], "no unverified trimmed file survives");
});

test("#2830 physical 3s MP4: local source symlink may not escape persistent assets root", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-72f-symlink-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const remote = path.join(os.tmpdir(), "plotpickle-72f-outside-" + path.basename(root) + ".mp4");
  await writeFile(remote, mp4);
  t.after(() => rm(remote, { force: true }));
  try { await symlink(remote, path.join(root, "link.mp4")); }
  catch (error) {
    if (error.code === "EPERM") return t.skip("Windows runner cannot create a test symlink");
    throw error;
  }
  await assert.rejects(() => renderTimelineThreeSecondClip({
    sourceAssetUrl: "/api/local-ai/assets/link.mp4", directory: root,
  }), /outside/u);
});

test("#2830 physical MP4 path: success is gated on authenticated local render and verified frame count", async () => {
  const { readFile } = await import("node:fs/promises");
  const root = new URL("../", import.meta.url);
  const [client, route, engine] = await Promise.all([
    readFile(new URL("app/_components/timeline/timeline-assembly-workspace.tsx", root), "utf8"),
    readFile(new URL("app/api/timeline/motion/trim/route.ts", root), "utf8"),
    readFile(new URL("build/timeline-72-frame-clip.mjs", root), "utf8"),
  ]);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /renderTimelineThreeSecondClip\(/u);
  assert.match(client, /fetch\("\/api\/timeline\/motion\/trim"/u);
  assert.match(client, /clip\.frameCount !== 72 \|\| clip\.fps !== 24/u);
  assert.match(client, /new TimelineMotionObservationError/u);
  assert.match(client, /mediaRef: verifiedClipAssetUrl/u);
  assert.match(client, /outputAssetUrl: verifiedClipAssetUrl/u);
  assert.match(client, /providerDurationSeconds: result\.durationSeconds \?\? running\.providerDurationSeconds/u);
  assert.match(engine, /"ffmpeg"/u);
  assert.match(engine, /"ffprobe"/u);
});

test("#2830 physical 3s MP4: real local FFmpeg encodes a 4-second fixture into 72 frames when tools are present", async t => {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8", timeout: 12_000, windowsHide: true });
  const ffprobe = spawnSync("ffprobe", ["-version"], { encoding: "utf8", timeout: 12_000, windowsHide: true });
  if (ffmpeg.status !== 0 || ffprobe.status !== 0) return t.skip("FFmpeg/FFprobe not installed on this test host; simulated-tool tests still run.");
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-72f-real-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "four-second-source.mp4");
  const generated = spawnSync("ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=black:s=320x180:r=24",
    "-t", "4", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", source,
  ], { encoding: "utf8", timeout: 45_000, windowsHide: true });
  if (generated.status !== 0) return t.skip("Test host FFmpeg has no libx264 fixture encoder: " + (generated.stderr ?? "").slice(-160));
  const input = await readFile(source);
  const clip = await renderTimelineThreeSecondClip({
    sourceAssetUrl: "/api/local-ai/assets/four-second-source.mp4", directory: root,
  });
  assert.equal(clip.frameCount, 72);
  assert.equal(clip.fps, 24);
  assert.ok(clip.durationSeconds >= 2.90 && clip.durationSeconds <= 3.10);
  assert.deepEqual(await readFile(source), input, "physical renderer retains the input provider MP4 byte-for-byte");
  assert.ok((await readFile(path.join(root, clip.outputAssetUrl.split("/").at(-1)))).length > 12,
    "the encoded output is a real, readable saved file");
});
