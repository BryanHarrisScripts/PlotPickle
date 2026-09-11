import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export const SEQUENCE_EVIDENCE_MEDIA_PROBE_VERSION = "1.0.0";
const MAX_STDOUT_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

function text(value, maximum = 1000) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, maximum) : "";
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function executable(name, explicit) {
  const candidate = text(explicit, 1000);
  if (candidate) return candidate;
  if (name === "ffprobe") return text(process.env.PLOTPICKLE_FFPROBE_PATH, 1000) || (process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  return text(process.env.PLOTPICKLE_FFMPEG_PATH, 1000) || (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

function run(command, args, options = {}) {
  const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS, 120_000));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let settled = false;
    let timer;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`Sequence Evidence media probe exceeded ${Math.round(timeoutMs / 1000)} seconds.`)));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      const data = Buffer.from(chunk);
      stdoutBytes += data.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill();
        finish(() => reject(new Error("Sequence Evidence media probe exceeded its bounded output size.")));
        return;
      }
      stdout.push(data);
    });
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (code) => finish(() => {
      const out = Buffer.concat(stdout);
      const diagnostics = Buffer.concat(stderr).toString("utf8").trim();
      if (code === 0) resolve({ stdout: out, stderr: diagnostics });
      else reject(new Error(diagnostics || `${path.basename(command)} exited with code ${code}.`));
    }));
  });
}

async function commandAvailable(command, flag = "-version") {
  try {
    await run(command, [flag], { timeoutMs: 5000 });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    return false;
  }
}

export async function sequenceEvidenceMediaCapabilities(options = {}) {
  const ffprobe = executable("ffprobe", options.ffprobePath);
  const ffmpeg = executable("ffmpeg", options.ffmpegPath);
  const [probeReady, frameReady] = await Promise.all([
    commandAvailable(ffprobe),
    commandAvailable(ffmpeg),
  ]);
  return Object.freeze({
    analyzerId: "plotpickle-local-media-probe",
    analyzerVersion: SEQUENCE_EVIDENCE_MEDIA_PROBE_VERSION,
    metadata: probeReady ? "available" : "unavailable",
    boundaryFrames: frameReady ? "available" : "unavailable",
    motion: frameReady ? "available" : "unavailable",
    ffprobe: probeReady ? ffprobe : "",
    ffmpeg: frameReady ? ffmpeg : "",
    automaticInstall: false,
    cloudFallback: false,
  });
}

function parseFrameRate(value) {
  const source = text(value, 80);
  if (!source) return null;
  if (source.includes("/")) {
    const [left, right] = source.split("/", 2).map(Number);
    return Number.isFinite(left) && Number.isFinite(right) && right > 0 ? left / right : null;
  }
  const parsed = Number(source);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function sequenceEvidenceBoundaryFrameTimes(durationSeconds) {
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const inset = Math.min(0.2, Math.max(0.04, duration * 0.08));
  const start = Math.min(inset, Math.max(0, duration / 3));
  const end = Math.max(start, duration - inset);
  return Object.freeze({ startSecond: Number(start.toFixed(4)), endSecond: Number(end.toFixed(4)) });
}

async function contentHash(filePath) {
  const bytes = await readFile(filePath);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function metadata(filePath, ffprobe) {
  const result = await run(ffprobe, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const payload = JSON.parse(result.stdout.toString("utf8") || "{}");
  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const video = streams.find((stream) => stream?.codec_type === "video") || {};
  const duration = Number(video.duration ?? payload?.format?.duration);
  return {
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
    width: Number.isInteger(Number(video.width)) && Number(video.width) > 0 ? Number(video.width) : null,
    height: Number.isInteger(Number(video.height)) && Number(video.height) > 0 ? Number(video.height) : null,
    frameRate: parseFrameRate(video.avg_frame_rate || video.r_frame_rate),
    codec: text(video.codec_name, 120),
    container: text(payload?.format?.format_name, 120),
  };
}

async function grayscaleSample(filePath, second, ffmpeg) {
  const result = await run(ffmpeg, [
    "-v", "error",
    "-ss", second.toFixed(4),
    "-i", filePath,
    "-frames:v", "1",
    "-vf", "scale=64:36,format=gray",
    "-f", "rawvideo",
    "pipe:1",
  ]);
  if (result.stdout.length !== 64 * 36) throw new Error("Sequence Evidence could not obtain the bounded grayscale motion sample.");
  return result.stdout;
}

export function sequenceEvidenceNormalizedFrameDifference(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length || left.length === 0) return null;
  let total = 0;
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index]);
  return Number((total / (left.length * 255)).toFixed(6));
}

async function extractFrame(filePath, second, outputPath, ffmpeg) {
  await run(ffmpeg, [
    "-v", "error",
    "-ss", second.toFixed(4),
    "-i", filePath,
    "-frames:v", "1",
    "-vf", "scale='min(480,iw)':-2",
    "-q:v", "4",
    "-y",
    outputPath,
  ]);
  if (!(await exists(outputPath))) throw new Error("Sequence Evidence frame extraction produced no evidence file.");
}

export async function probeSequenceEvidenceMedia(input) {
  const filePath = path.resolve(text(input?.filePath, 3000));
  const sourceMediaRef = text(input?.sourceMediaRef, 1000) || filePath;
  const analyzer = { id: "plotpickle-local-media-probe", version: SEQUENCE_EVIDENCE_MEDIA_PROBE_VERSION };
  if (!filePath || !(await exists(filePath))) {
    return Object.freeze({
      sourceMediaRef,
      sourceMediaHash: "",
      sourceExists: false,
      durationSeconds: null,
      width: null,
      height: null,
      frameRate: null,
      codec: "",
      container: "",
      measuredMotion: null,
      aFrameRef: "",
      bFrameRef: "",
      measurementState: "unavailable",
      analyzer,
      measuredAt: new Date().toISOString(),
      reason: "Local media file is unavailable.",
    });
  }

  const capabilities = await sequenceEvidenceMediaCapabilities(input);
  if (capabilities.metadata !== "available") {
    return Object.freeze({
      sourceMediaRef,
      sourceMediaHash: await contentHash(filePath),
      sourceExists: true,
      durationSeconds: null,
      width: null,
      height: null,
      frameRate: null,
      codec: "",
      container: "",
      measuredMotion: null,
      aFrameRef: "",
      bFrameRef: "",
      measurementState: "unavailable",
      analyzer,
      measuredAt: new Date().toISOString(),
      reason: "ffprobe is unavailable. PlotPickle did not install it or fall back to cloud analysis.",
    });
  }

  const media = await metadata(filePath, capabilities.ffprobe);
  const times = sequenceEvidenceBoundaryFrameTimes(media.durationSeconds);
  let measuredMotion = null;
  let aFrameRef = "";
  let bFrameRef = "";
  let frameReason = "";
  if (times && capabilities.motion === "available") {
    const [left, right] = await Promise.all([
      grayscaleSample(filePath, times.startSecond, capabilities.ffmpeg),
      grayscaleSample(filePath, times.endSecond, capabilities.ffmpeg),
    ]);
    measuredMotion = sequenceEvidenceNormalizedFrameDifference(left, right);
  }
  if (times && capabilities.boundaryFrames === "available" && input?.evidenceDirectory) {
    const evidenceDirectory = path.resolve(text(input.evidenceDirectory, 3000));
    await mkdir(evidenceDirectory, { recursive: true });
    const base = text(input.evidenceId, 180).replace(/[^a-z0-9._-]+/gi, "-") || "sequence-evidence";
    const aPath = path.join(evidenceDirectory, `${base}-A.jpg`);
    const bPath = path.join(evidenceDirectory, `${base}-B.jpg`);
    await extractFrame(filePath, times.startSecond, aPath, capabilities.ffmpeg);
    await extractFrame(filePath, times.endSecond, bPath, capabilities.ffmpeg);
    aFrameRef = aPath;
    bFrameRef = bPath;
  } else if (capabilities.boundaryFrames !== "available") {
    frameReason = "ffmpeg is unavailable; A/B frames and measured motion are unavailable without silent installation or cloud fallback.";
  } else if (!input?.evidenceDirectory) {
    frameReason = "No evidence directory was supplied, so Sequence Evidence did not create A/B files.";
  }

  const measurementState = capabilities.boundaryFrames !== "available"
    ? "unavailable"
    : input?.evidenceDirectory
      ? "measured"
      : "skipped";

  return Object.freeze({
    sourceMediaRef,
    sourceMediaHash: await contentHash(filePath),
    sourceExists: true,
    mediaType: text(input?.mediaType, 120),
    ...media,
    measuredMotion,
    aFrameRef,
    bFrameRef,
    measurementState,
    analyzer,
    measuredAt: new Date().toISOString(),
    reason: frameReason,
  });
}
