import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type {
  PlotPickleMediaEngine,
  PlotPickleMediaEngineCapability,
  PlotPickleMediaEngineEvidence,
  PlotPickleMediaEngineRunOptions,
  PlotPickleMiniBlockMediaRequest,
  PlotPickleTimelineRangeMediaRequest,
} from "./media-engine-contract";

const ENGINE_ID = "fframes-local";
const ENGINE_VERSION = "fframes-1.2.0/plotpickle-bridge-0.1.0";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_CAPTURE_CHARS = 16_384;

type SpawnResult = { code: number | null; stdout: string; stderr: string; cancelled: boolean; timedOut: boolean };

export async function retainFFramesVideo(workspace: string, directory: string, requestId: string) {
  const source = join(workspace, "render.mp4");
  const size = (await stat(source)).size;
  if (size < 12 || size > 150 * 1024 * 1024) throw new Error("FFrames did not produce a bounded video artifact.");
  const bytes = await readFile(source);
  if (bytes.subarray(4, 8).toString("ascii") !== "ftyp") throw new Error("FFrames output is not an MP4 container.");
  await mkdir(directory, { recursive: true });
  const key = createHash("sha256").update(requestId).digest("hex").slice(0, 24);
  const videoPath = join(directory, `fframes-${key}.mp4`);
  await copyFile(source, videoPath);
  return videoPath;
}

function redact(text: string, workspace: string) {
  return text.replaceAll(workspace, "<workspace>").replace(/[\r\n]+/gu, " ").trim().slice(0, MAX_CAPTURE_CHARS);
}

async function exists(path: string) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function safeAssetName(position: number, sourcePath: string) {
  const extension = extname(sourcePath).toLowerCase();
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  if (!allowed.has(extension)) throw new Error(`Unsupported Storyboard image type: ${extension || "(none)"}.`);
  return `storyboard-${String(position).padStart(2, "0")}${extension}`;
}

type FFramesSequenceRequest = PlotPickleMiniBlockMediaRequest | PlotPickleTimelineRangeMediaRequest;

function bridgeManifest(request: FFramesSequenceRequest, names: ReadonlyMap<number, string>) {
  return {
    requestId: request.requestId,
    projectId: request.projectId,
    blockNumber: request.blockNumber,
    miniBlockNumber: request.miniBlockNumber,
    frames: request.frames.map((frame) => ({
      position: frame.position,
      fileName: names.get(frame.position),
      durationMs: frame.durationMs,
      caption: frame.caption ?? "",
      narration: frame.narration ?? "",
    })),
  };
}

async function runBounded(command: string, args: readonly string[], cwd: string, options: PlotPickleMediaEngineRunOptions): Promise<SpawnResult> {
  const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 10 * 60_000));
  return await new Promise((resolveRun) => {
    const child = spawn(command, [...args], { cwd, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", settled = false, timedOut = false, cancelled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolveRun({ code, stdout: stdout.slice(-MAX_CAPTURE_CHARS), stderr: stderr.slice(-MAX_CAPTURE_CHARS), cancelled, timedOut });
    };
    const terminate = () => { if (!child.killed) child.kill("SIGTERM"); };
    const abort = () => { cancelled = true; terminate(); };
    const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    child.stdout?.on("data", (chunk) => { stdout = (stdout + String(chunk)).slice(-MAX_CAPTURE_CHARS); });
    child.stderr?.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-MAX_CAPTURE_CHARS); });
    child.on("error", (error) => { stderr += ` ${error.message}`; finish(null); });
    child.on("close", finish);
    if (options.signal?.aborted) abort();
  });
}

export class FFramesLocalMediaEngine implements PlotPickleMediaEngine {
  readonly id = ENGINE_ID;
  private readonly repositoryRoot: string;
  constructor(repositoryRoot = process.cwd()) { this.repositoryRoot = repositoryRoot; }

  async capabilities(): Promise<PlotPickleMediaEngineCapability> {
    const manifest = resolve(this.repositoryRoot, "tools", "fframes-bridge", "Cargo.toml");
    const bridgePresent = await exists(manifest);
    const ready = bridgePresent && await exists(this.bridgeExecutable());
    return {
      engineId: ENGINE_ID, engineVersion: ENGINE_VERSION,
      state: ready ? "ready" : "unavailable",
      reason: ready ? "Prepared local FFrames bridge is available; no build or installation runs at startup." : "Optional local FFrames bridge is not built; PlotPickle remains usable.",
      localOnly: true, automaticInstall: false, cloudFallback: false,
      supports: { miniBlockFrames: true, frameInspection: false, contactSheet: false, videoRender: true, audioInspection: false },
    };
  }

  private bridgeExecutable() {
    return resolve(this.repositoryRoot, "tools", "fframes-bridge", "target", "release", process.platform === "win32" ? "plotpickle-fframes-bridge.exe" : "plotpickle-fframes-bridge");
  }

  renderMiniBlock(request: PlotPickleMiniBlockMediaRequest, options: PlotPickleMediaEngineRunOptions = {}): Promise<PlotPickleMediaEngineEvidence> {
    if (request.frames.length > 25) {
      throw new RangeError("Mini-Block FFrames rendering cannot exceed 25 Storyboard positions.");
    }
    return this.renderSequence(request, options);
  }

  async renderTimelineRange(request: PlotPickleTimelineRangeMediaRequest, options: PlotPickleMediaEngineRunOptions = {}): Promise<PlotPickleMediaEngineEvidence> {
    return this.renderSequence(request, { ...options, timeoutMs: options.timeoutMs ?? 10 * 60_000 });
  }

  private async renderSequence(request: FFramesSequenceRequest, options: PlotPickleMediaEngineRunOptions): Promise<PlotPickleMediaEngineEvidence> {
    const startedAt = new Date().toISOString();
    const capability = await this.capabilities();
    if (capability.state !== "ready") {
      return this.evidence(request, startedAt, "unavailable", [], [], "FFrames is optional and unavailable.", options);
    }
    if (!options.evidenceDirectory) {
      return this.evidence(request, startedAt, "failed", [], [], "A persistent artifact directory is required before rendering.", options);
    }

    const root = await mkdtemp(join(tmpdir(), "plotpickle-fframes-"));
    const assets = join(root, "assets");
    const names = new Map<number, string>();
    const sourceAssets = [];
    try {
      await mkdir(assets, { recursive: true });
      for (const frame of request.frames) {
        const source = resolve(frame.localFilePath);
        if (!(await exists(source))) throw new Error(`Locked Storyboard asset is missing for position ${frame.position}.`);
        const name = safeAssetName(frame.position, source);
        names.set(frame.position, name);
        await copyFile(source, join(assets, name));
        sourceAssets.push({ position: frame.position, assetId: frame.assetId, assetUrl: frame.assetUrl, sha256: await sha256(source), durationMs: frame.durationMs, sourceRefs: frame.sourceRefs });
      }
      await writeFile(join(root, "plotpickle-request.json"), JSON.stringify(bridgeManifest(request, names), null, 2), "utf8");
      const result = await runBounded(this.bridgeExecutable(), ["render", "--output", "render.mp4"], root, options);
      const diagnostics = [result.stdout, result.stderr].map((text) => redact(text, root)).filter(Boolean);
      const state = result.cancelled ? "cancelled" : result.timedOut ? "failed" : result.code === 0 ? "succeeded" : "failed";
      const reason = result.timedOut ? "FFrames render exceeded its bounded timeout." : result.cancelled ? "FFrames render was cancelled." : result.code === 0 ? "FFrames render completed." : "FFrames render failed.";
      const videoPath = state === "succeeded" ? await retainFFramesVideo(root, options.evidenceDirectory, request.requestId) : "";
      return this.evidence(request, startedAt, state, sourceAssets, diagnostics, reason, options, videoPath);
    } catch (error) {
      return this.evidence(request, startedAt, options.signal?.aborted ? "cancelled" : "failed", sourceAssets, [redact(error instanceof Error ? error.message : String(error), root)], "FFrames render did not complete.", options);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private async evidence(request: FFramesSequenceRequest, startedAt: string, state: PlotPickleMediaEngineEvidence["state"], sourceAssets: PlotPickleMediaEngineEvidence["sourceAssets"], diagnostics: readonly string[], reason: string, options: PlotPickleMediaEngineRunOptions, videoPath = ""): Promise<PlotPickleMediaEngineEvidence> {
    const artifacts = { contactSheetPath: "", frameDirectory: "", videoPath };
    const evidence = { schemaVersion: 1 as const, requestId: request.requestId, engineId: ENGINE_ID, engineVersion: ENGINE_VERSION, state, startedAt, completedAt: new Date().toISOString(), sourceAssets, artifacts, inspection: null, timeline: { fps: request.fps, width: request.width, height: request.height, frameCount: request.frames.length }, diagnostics, reason };
    if (options.evidenceDirectory) {
      await mkdir(options.evidenceDirectory, { recursive: true });
      const key = createHash("sha256").update(request.requestId).digest("hex").slice(0, 24);
      await writeFile(join(options.evidenceDirectory, `${key}.fframes-evidence.json`), JSON.stringify(evidence, null, 2), "utf8");
    }
    return evidence;
  }
}
