import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { deriveLazyFramesAnimatic, lazyFramesSlug } from "../lib/lazy-frames-core.mjs";

const API_ROOT = "/api/render/lazy-frames";
const LAZY_FRAMES_VERSION = "0.6.3";
const PREVIEW_PORT = 4287;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const INSTALL_LOG = "install.log";
const RENDER_LOG = "render.log";

type ProcessState = "idle" | "running" | "success" | "failed";
type LazyState = { install: ProcessState; render: ProcessState; message: string };
const runtimeState: LazyState = { install: "idle", render: "idle", message: "" };

function toolHome() {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle", "tools", "lazy-frames");
  return path.join(os.homedir(), ".plotpickle", "tools", "lazy-frames");
}

function workRoot() {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle", "renders", "lazy-frames");
  return path.join(os.homedir(), ".plotpickle", "renders", "lazy-frames");
}

function cliPath() {
  return path.join(toolHome(), "node_modules", "lazy-frames", "packages", "cli", "dist", "index.js");
}

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  const hostUrl = URL.canParse(`http://${host}`) ? new URL(`http://${host}`) : null;
  if (!hostUrl || !["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
  const origin = request.headers.origin;
  return !origin || (URL.canParse(origin) && new URL(origin).host === hostUrl.host);
}

function respond(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  }).end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.length;
    if (total > MAX_BODY_BYTES) throw new Error("Lazy Frames request exceeds PlotPickle's bounded local request size.");
    chunks.push(value);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Lazy Frames request must be a JSON object.");
  return value as Record<string, unknown>;
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function resolveNpmCli() {
  const candidates = [
    process.env.npm_execpath || "",
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.cjs"),
  ].filter((candidate) => candidate.endsWith(".js") || candidate.endsWith(".cjs"));
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error("PlotPickle could not locate npm's local JavaScript CLI without opening a command shell. Install Node.js/npm or install Lazy Frames manually, then retry.");
}

function workspace(projectId: unknown) {
  return path.join(workRoot(), lazyFramesSlug(projectId || "plotpickle-project"));
}

function hashText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function writeBackgroundLog(filePath: string, data: string | Buffer) {
  void writeFile(filePath, data).catch((error) => {
    console.error(`[lazy-frames] Could not write ${filePath}:`, error);
  });
}

async function runLazy(args: string[], cwd: string, timeoutMs = 120_000) {
  if (!(await exists(cliPath()))) throw new Error("Lazy Frames is not installed in PlotPickle's reviewed local tool home.");
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath(), ...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    let timer: NodeJS.Timeout;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`Lazy Frames ${args[0] || "command"} exceeded ${Math.round(timeoutMs / 1000)} seconds.`)));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (code) => {
      const output = Buffer.concat(stdout).toString("utf8");
      const diagnostics = Buffer.concat(stderr).toString("utf8");
      finish(() => {
        if (code === 0) resolve({ stdout: output, stderr: diagnostics });
        else reject(new Error(diagnostics.trim() || output.trim() || `Lazy Frames exited with code ${code}.`));
      });
    });
  });
}

async function statusSnapshot() {
  const installed = await exists(cliPath());
  let doctor: unknown = null;
  let doctorMessage = "Install Lazy Frames to inspect Chrome, ffmpeg and local narration readiness.";
  if (installed) {
    try {
      const result = await runLazy(["doctor", "--json"], toolHome(), 20_000);
      doctor = JSON.parse(result.stdout || "null");
      doctorMessage = "Lazy Frames is installed. Doctor completed locally.";
    } catch (error) {
      doctorMessage = error instanceof Error ? error.message : "Lazy Frames doctor could not complete.";
    }
  }
  return {
    ok: true,
    version: LAZY_FRAMES_VERSION,
    installed,
    installState: runtimeState.install,
    renderState: runtimeState.render,
    message: runtimeState.message || doctorMessage,
    doctor,
    preview: { port: PREVIEW_PORT, url: `http://127.0.0.1:${PREVIEW_PORT}` },
    boundaries: {
      ppfCanonical: true,
      derivedOnly: true,
      automaticPluginInstall: false,
      automaticCloudFallback: false,
      renderRequiresExplicitApproval: true,
    },
  };
}

async function installLazyFrames() {
  if (runtimeState.install === "running") return;
  const home = toolHome();
  const npmCli = await resolveNpmCli();
  await mkdir(home, { recursive: true });
  await writeFile(path.join(home, "package.json"), JSON.stringify({ private: true, name: "plotpickle-lazy-frames-tool", version: "1.0.0" }, null, 2), "utf8");
  runtimeState.install = "running";
  runtimeState.message = `Installing reviewed lazy-frames@${LAZY_FRAMES_VERSION} locally...`;
  const logPath = path.join(home, INSTALL_LOG);
  const child = spawn(process.execPath, [
    npmCli,
    "install",
    "--prefix", home,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--save-exact",
    `lazy-frames@${LAZY_FRAMES_VERSION}`,
  ], {
    cwd: home,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logChunks: Buffer[] = [];
  let spawnFailed = false;
  child.stdout.on("data", (chunk) => logChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => logChunks.push(Buffer.from(chunk)));
  child.once("error", (error) => {
    spawnFailed = true;
    runtimeState.install = "failed";
    runtimeState.message = `Lazy Frames install failed: ${error.message}`;
    writeBackgroundLog(logPath, `${runtimeState.message}\n`);
  });
  child.once("close", (code) => {
    writeBackgroundLog(logPath, Buffer.concat(logChunks));
    if (spawnFailed) return;
    runtimeState.install = code === 0 ? "success" : "failed";
    runtimeState.message = code === 0
      ? `Lazy Frames ${LAZY_FRAMES_VERSION} installed in PlotPickle's local tool home.`
      : `Lazy Frames install exited with code ${code}. See ${logPath}.`;
  });
}

async function prepareProject(body: Record<string, unknown>) {
  const project = body.project;
  if (!project || typeof project !== "object" || Array.isArray(project)) throw new Error("PlotPickle project state is required to prepare an animatic.");
  const derived = deriveLazyFramesAnimatic(project);
  if (!derived.spec.scenes.length) throw new Error("Approve at least one Build sequence before preparing a Lazy Frames animatic.");
  const root = workspace((project as { id?: string }).id);
  await mkdir(path.join(root, "out"), { recursive: true });
  await writeFile(path.join(root, "spec.json"), JSON.stringify(derived.spec, null, 2), "utf8");
  await writeFile(path.join(root, "plotpickle-provenance.json"), JSON.stringify(derived.provenance, null, 2), "utf8");
  await writeFile(path.join(root, "plotpickle-check.json"), JSON.stringify({ ok: false, reason: "spec prepared; validation required" }, null, 2), "utf8");
  return {
    ok: true,
    projectId: (project as { id?: string }).id || "",
    sceneCount: derived.spec.scenes.length,
    workspace: root,
    message: "Derived animatic prepared. PPF/canon was not changed. Validate it before preview or render.",
  };
}

async function validateProject(body: Record<string, unknown>) {
  const root = workspace(body.projectId);
  const specPath = path.join(root, "spec.json");
  if (!(await exists(specPath))) throw new Error("Prepare the Lazy Frames animatic before validating it.");
  await runLazy(["snapshot", root, "--update"], root, 120_000);
  const checked = await runLazy(["check", root, "--json"], root, 120_000);
  const specSource = await readFile(specPath, "utf8");
  const marker = { ok: true, checkedAt: new Date().toISOString(), specSha256: hashText(specSource) };
  await writeFile(path.join(root, "plotpickle-check.json"), JSON.stringify(marker, null, 2), "utf8");
  return { ok: true, projectId: body.projectId || "", check: checked.stdout ? JSON.parse(checked.stdout) : null, message: "Lazy Frames snapshot and determinism checks passed." };
}

async function launchPreview(body: Record<string, unknown>) {
  const root = workspace(body.projectId);
  const markerPath = path.join(root, "plotpickle-check.json");
  if (!(await exists(markerPath))) throw new Error("Validate the animatic before previewing it.");
  const marker = JSON.parse(await readFile(markerPath, "utf8")) as { ok?: boolean; specSha256?: string; previewedAt?: string };
  const specSource = await readFile(path.join(root, "spec.json"), "utf8");
  if (!marker.ok || marker.specSha256 !== hashText(specSource)) throw new Error("The animatic changed after validation. Run Validate again before previewing it.");
  if (!(await exists(cliPath()))) throw new Error("Lazy Frames is no longer installed. Reinstall it before previewing the animatic.");
  const child = spawn(process.execPath, [cliPath(), "preview", root, "-p", String(PREVIEW_PORT)], {
    cwd: root,
    shell: false,
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  });
  await new Promise<void>((resolve, reject) => {
    const initialError = (error: Error) => reject(error);
    child.once("error", initialError);
    child.once("spawn", () => {
      child.off("error", initialError);
      resolve();
    });
  });
  child.on("error", (error) => {
    runtimeState.message = `Lazy Frames preview stopped: ${error.message}`;
  });
  child.unref();
  marker.previewedAt = new Date().toISOString();
  await writeFile(markerPath, JSON.stringify(marker, null, 2), "utf8");
  return { ok: true, url: `http://127.0.0.1:${PREVIEW_PORT}`, message: "Local Lazy Frames preview started. Review it before choosing Render MP4." };
}

async function launchRender(body: Record<string, unknown>) {
  if (body.approved !== true) throw new Error("Explicit approval is required before rendering the MP4.");
  if (runtimeState.render === "running") throw new Error("A Lazy Frames render is already running.");
  const root = workspace(body.projectId);
  const marker = JSON.parse(await readFile(path.join(root, "plotpickle-check.json"), "utf8")) as { ok?: boolean; specSha256?: string; previewedAt?: string };
  const specSource = await readFile(path.join(root, "spec.json"), "utf8");
  if (!marker.ok || marker.specSha256 !== hashText(specSource)) throw new Error("The current animatic has not passed validation. Run Validate again before rendering.");
  if (!marker.previewedAt) throw new Error("Open and review the validated local preview before rendering the MP4.");
  runtimeState.render = "running";
  runtimeState.message = "Lazy Frames is rendering the approved animatic in the background.";
  const logPath = path.join(root, RENDER_LOG);
  const output: Buffer[] = [];
  const child = spawn(process.execPath, [cliPath(), "render", root, "--json"], {
    cwd: root,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let spawnFailed = false;
  child.stdout.on("data", (chunk) => output.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => output.push(Buffer.from(chunk)));
  child.once("error", (error) => {
    spawnFailed = true;
    runtimeState.render = "failed";
    runtimeState.message = `Lazy Frames render failed: ${error.message}`;
    writeBackgroundLog(logPath, `${runtimeState.message}\n`);
  });
  child.once("close", (code) => {
    writeBackgroundLog(logPath, Buffer.concat(output));
    if (spawnFailed) return;
    runtimeState.render = code === 0 ? "success" : "failed";
    runtimeState.message = code === 0
      ? `Animatic rendered to ${path.join(root, "out", "plotpickle-animatic.mp4")}.`
      : `Lazy Frames render exited with code ${code}. See ${logPath}.`;
  });
  return { ok: true, state: "running", output: path.join(root, "out", "plotpickle-animatic.mp4"), message: runtimeState.message };
}

export function registerLazyFramesGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (!pathname.startsWith(API_ROOT)) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      respond(response, 403, { ok: false, message: "Lazy Frames controls are local-only until hosted PlotPickle authorization is implemented." });
      return;
    }

    void (async () => {
      if (pathname === `${API_ROOT}/status` && request.method === "GET") {
        respond(response, 200, await statusSnapshot());
        return;
      }
      if (request.method !== "POST") {
        respond(response, 405, { ok: false, message: "Method not allowed." });
        return;
      }
      const body = await readBody(request);
      if (pathname === `${API_ROOT}/install`) {
        if (body.approved !== true) throw new Error("Explicit approval is required before PlotPickle downloads the reviewed Lazy Frames package.");
        await installLazyFrames();
        respond(response, 202, { ok: true, state: runtimeState.install, version: LAZY_FRAMES_VERSION, message: runtimeState.message });
        return;
      }
      if (pathname === `${API_ROOT}/prepare`) {
        respond(response, 200, await prepareProject(body));
        return;
      }
      if (pathname === `${API_ROOT}/check`) {
        respond(response, 200, await validateProject(body));
        return;
      }
      if (pathname === `${API_ROOT}/preview`) {
        respond(response, 200, await launchPreview(body));
        return;
      }
      if (pathname === `${API_ROOT}/render`) {
        respond(response, 202, await launchRender(body));
        return;
      }
      respond(response, 404, { ok: false, message: "Unknown Lazy Frames action." });
    })().catch((error) => {
      respond(response, 400, { ok: false, message: error instanceof Error ? error.message : "Lazy Frames action failed." });
    });
  });
}
