import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type {
  PlotPickleMediaEngine,
  PlotPickleMediaEngineCapability,
  PlotPickleMediaEngineEvidence,
  PlotPickleMediaEngineRunOptions,
  PlotPickleMiniBlockMediaRequest,
} from "./media-engine-contract";

const ENGINE_ID = "fframes-local";
const ENGINE_VERSION = "fframes-1.1.0/plotpickle-bridge-0.1.0";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_CAPTURE_CHARS = 16_384;

type SpawnResult = { code: number | null; stdout: string; stderr: string; cancelled: boolean; timedOut: boolean };

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

function bridgeManifest(request: PlotPickleMiniBlockMediaRequest, names: ReadonlyMap<number, string>) {
  return {
    requestId: request.requestId,
    projectId: request.projectId,
    blockNumber: request.blockNumber,
    miniBlockNumber: request.miniBlockNumber,
    frames: request.frames.map((frame) => ({
      position: frame.position,
      fileName: names.get(frame.position),
      durationMs: frame.durationMs,
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
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
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
    const cargo = await runBounded(process.platform === "win32" ? "cargo.exe" : "cargo", ["--version"], this.repositoryRoot, { timeoutMs: 5_000 });
    const ready = bridgePresent && cargo.code === 0;
    return {
      engineId: ENGINE_ID, engineVersion: ENGINE_VERSION,
      state: ready ? "ready" : "unavailable",
      reason: ready ? "Pinned local FFrames bridge and Cargo are available." : "Optional local FFrames bridge is unavailable; PlotPickle remains usable.",
      localOnly: true, automaticInstall: false, cloudFallback: false,
      supports: { miniBlockFrames: true, frameInspection: false, contactSheet: false, videoRender: true, audioInspection: false },
    };
  }

  async renderMiniBlock(request: PlotPickleMiniBlockMediaRequest, options: PlotPickleMediaEngineRunOptions = {}): Promise<PlotPickleMediaEngineEvidence> {
    const startedAt = new Date().toISOString();
    const capability = await this.capabilities();
    if (capability.state !== "ready") {
      return this.evidence(request, startedAt, "unavailable", [], [], "FFrames is optional and unavailable.", options);
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
      const manifest = resolve(this.repositoryRoot, "tools", "fframes-bridge", "Cargo.toml");
      const result = await runBounded(process.platform === "win32" ? "cargo.exe" : "cargo", ["run", "--quiet", "--release", "--manifest-path", manifest, "--", "render"], root, options);
      const diagnostics = [result.stdout, result.stderr].map((text) => redact(text, root)).filter(Boolean);
      const state = result.cancelled ? "cancelled" : result.code === 0 ? "succeeded" : "failed";
      const reason = result.timedOut ? "FFrames render exceeded its bounded timeout." : result.cancelled ? "FFrames render was cancelled." : result.code === 0 ? "FFrames render completed." : "FFrames render failed.";
      return this.evidence(request, startedAt, state, sourceAssets, diagnostics, reason, options, root);
    } catch (error) {
      return this.evidence(request, startedAt, options.signal?.aborted ? "cancelled" : "failed", sourceAssets, [redact(error instanceof Error ? error.message : String(error), root)], "FFrames render did not complete.", options, root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private async evidence(request: PlotPickleMiniBlockMediaRequest, startedAt: string, state: PlotPickleMediaEngineEvidence["state"], sourceAssets: PlotPickleMediaEngineEvidence["sourceAssets"], diagnostics: readonly string[], reason: string, options: PlotPickleMediaEngineRunOptions, workspace = ""): Promise<PlotPickleMediaEngineEvidence> {
    const artifacts = { contactSheetPath: "", frameDirectory: "", videoPath: "" };
    const evidence = { schemaVersion: 1 as const, requestId: request.requestId, engineId: ENGINE_ID, engineVersion: ENGINE_VERSION, state, startedAt, completedAt: new Date().toISOString(), sourceAssets, artifacts, inspection: null, timeline: { fps: request.fps, width: request.width, height: request.height, frameCount: request.frames.length }, diagnostics, reason };
    if (options.evidenceDirectory) {
      await mkdir(options.evidenceDirectory, { recursive: true });
      await writeFile(join(options.evidenceDirectory, `${basename(request.requestId)}.fframes-evidence.json`), JSON.stringify(evidence, null, 2), "utf8");
    }
    return evidence;
  }
}
