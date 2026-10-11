import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";

const SOURCE_PREFIX = "/api/local-ai/assets/";
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const TARGET_FRAMES = 72;
const TARGET_FPS = 24;
// FFmpeg codec-help output can exceed 3K; preserve its encoder-identifying header.
const MAX_TOOL_OUTPUT = 16_384;

// The API never receives a disk path, a command, or command-line arguments.
// This validator only permits PlotPickle's already-saved local provider video.
export function sourceVideoFileName(assetUrl) {
  if (typeof assetUrl !== "string" || !assetUrl.startsWith(SOURCE_PREFIX)) {
    throw new Error("Only a saved local PlotPickle provider video may be rendered.");
  }
  const name = assetUrl.slice(SOURCE_PREFIX.length);
  if (name.length > 190 || !/^[a-z0-9][a-z0-9._-]*\.(?:mp4|webm)$/iu.test(name)) {
    throw new Error("The saved provider video URL is not a safe local asset.");
  }
  return name;
}

export function ffmpegThreeSecondArgs(sourcePath, outputPath) {
  return [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourcePath, "-map", "0:v:0", "-an",
    "-vf", "fps=24,trim=end_frame=72,setpts=PTS-STARTPTS",
    "-frames:v", String(TARGET_FRAMES), "-c:v", "libx264", "-preset", "veryfast",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
  ];
}

export function verifyThreeSecondProbe(probe) {
  const stream = Array.isArray(probe?.streams) ? probe.streams[0] : null;
  const duration = Number(probe?.format?.duration);
  if (!stream || Number(stream.nb_read_frames) !== TARGET_FRAMES
    || stream.avg_frame_rate !== "24/1"
    || !Number.isFinite(duration) || duration < 2.90 || duration > 3.10) {
    throw new Error("The local motion clip could not be verified as exactly 72 frames at 24 fps (~3 seconds).");
  }
  return { durationSeconds: duration, frameCount: TARGET_FRAMES, fps: TARGET_FPS };
}

export function runVideoTool(executable, args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("The local three-second motion render timed out; the original provider video is retained."));
    }, Math.max(1000, Math.min(120_000, timeoutMs)));
    child.stdout?.on("data", chunk => { output = (output + String(chunk)).slice(-MAX_TOOL_OUTPUT); });
    child.stderr?.on("data", chunk => { output = (output + String(chunk)).slice(-MAX_TOOL_OUTPUT); });
    child.on("error", error => finish(new Error(`Local ${executable} is unavailable: ${error.message}`)));
    child.on("close", code => finish(code === 0 ? null
      : new Error(`Local ${executable} could not prepare a verified video clip: ${output.slice(-600)}`)));
  });
}

/** Check local 3-second clip tooling before a Human confirms a potentially charged video job. */
export async function timelineMotionTrimReadiness({ runTool = runVideoTool } = {}) {
  try {
    const [encoder, probe] = await Promise.all([
      runTool("ffmpeg", ["-hide_banner", "-h", "encoder=libx264"], 12_000),
      runTool("ffprobe", ["-version"], 12_000),
    ]);
    if (!/Encoder libx264/iu.test(encoder) || !/ffprobe version/iu.test(probe)) {
      return { ready: false, message: "Local FFmpeg must support libx264, and FFprobe must be installed, before generating a paid Timeline Shot." };
    }
    return { ready: true, message: "Local FFmpeg/FFprobe 72-frame output is ready." };
  } catch (error) {
    return {
      ready: false,
      message: `Local 3-second MP4 tooling is unavailable: ${error && typeof error === "object" && "message" in error ? String(error.message) : "FFmpeg or FFprobe could not run."} No provider request was submitted.`,
    };
  }
}

async function validMediaFile(filePath, limit = MAX_VIDEO_BYTES) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 12 || info.size > limit) {
    throw new Error("Saved video is missing, not a regular file, or exceeds the bounded video size.");
  }
  const file = await open(filePath, "r");
  try {
    const bytes = Buffer.alloc(12);
    await file.read(bytes, 0, 12, 0);
    const mp4 = bytes.subarray(4, 8).toString("ascii") === "ftyp";
    const webm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!mp4 && !webm) throw new Error("Saved provider video does not have a recognized MP4/WebM container header.");
  } finally { await file.close(); }
  return info;
}

async function probeClip(filePath, runTool) {
  const stdout = await runTool("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-count_frames",
    "-show_entries", "stream=nb_read_frames,avg_frame_rate:format=duration",
    "-of", "json", filePath,
  ], 30_000);
  return verifyThreeSecondProbe(JSON.parse(stdout));
}

/** Physically render an existing provider asset; never generate or charge for a new provider job.
 * Files stay within PlotPickle's persistent assets root. Source video is never modified.
 */
export async function renderTimelineThreeSecondClip({ sourceAssetUrl, directory }, { runTool = runVideoTool } = {}) {
  const name = sourceVideoFileName(sourceAssetUrl);
  const root = path.resolve(directory);
  const source = path.join(root, name);
  const rootReal = await realpath(root);
  const sourceReal = await realpath(source);
  if (path.dirname(sourceReal) !== rootReal) throw new Error("Video source resolved outside the approved local assets directory.");
  const inputStat = await validMediaFile(sourceReal);
  const key = createHash("sha256").update(name).update(":").update(String(inputStat.size))
    .update(":").update(String(inputStat.mtimeMs)).update(":72-24").digest("hex").slice(0, 24);
  const outputName = `timeline-72f-${key}.mp4`;
  const output = path.join(root, outputName);
  const response = (verified) => ({
    outputAssetUrl: SOURCE_PREFIX + outputName,
    sourceAssetUrl,
    frameCount: verified.frameCount,
    fps: verified.fps,
    durationSeconds: verified.durationSeconds,
  });
  const cached = await Promise.allSettled([validMediaFile(output).then(() => probeClip(output, runTool))]);
  if (cached[0].status === "fulfilled") return response(cached[0].value);
  // Failed validation is explicit evidence that a prior file must not be reused.
  // Removing it prevents a corrupt or partial clip from being presented as ready.
  await rm(output, { force: true });
  await mkdir(root, { recursive: true });
  const temporary = path.join(root, `timeline-72f-${key}-${randomUUID()}.tmp.mp4`);
  try {
    await runTool("ffmpeg", ffmpegThreeSecondArgs(sourceReal, temporary), 120_000);
    await validMediaFile(temporary);
    const verified = await probeClip(temporary, runTool);
    await rename(temporary, output);
    return response(verified);
  } finally {
    await rm(temporary, { force: true });
  }
}
