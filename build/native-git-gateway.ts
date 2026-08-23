import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const execute = promisify(execFile);
const API = "/api/local-projects/git";
const MAX_BODY = 1024 * 1024;
const GIT_TIMEOUT = 30_000;

function home() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}
function projectsRoot() { return path.join(home(), "projects-v2"); }
function safeKey(value: unknown) {
  const source = typeof value === "string" ? value : "untitled-story";
  const stem = source.replace(/\.ppf$/i, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return stem || "untitled-story";
}
function safeBranch(value: unknown, prefix = "story") {
  const source = typeof value === "string" ? value : "";
  const clean = source.toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").replace(/\.{2,}/g, "-").replace(/^[-/.]+|[-/.]+$/g, "").slice(0, 120);
  if (!clean || clean.includes("@{") || clean.endsWith(".lock")) return `${prefix}/${Date.now()}`;
  return clean;
}
function isLoopback(value?: string) { return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1"; }
function isLocal(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch { return false; }
}
function send(response: ServerResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}
async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The Git request is too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
}
async function git(folder: string, args: string[], allowFailure = false) {
  try {
    const result = await execute("git", args, { cwd: folder, timeout: GIT_TIMEOUT, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), ok: true };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    if (allowFailure) return { stdout: String(failure.stdout ?? "").trim(), stderr: String(failure.stderr ?? failure.message).trim(), ok: false };
    throw new Error(String(failure.stderr ?? failure.message).trim() || "Git operation failed.");
  }
}
async function ensureRepository(folder: string) {
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const probe = await git(folder, ["rev-parse", "--is-inside-work-tree"], true);
  if (!probe.ok || probe.stdout !== "true") {
    await git(folder, ["init", "-b", "main"]);
    await git(folder, ["config", "user.name", "PlotPickle Writer"]);
    await git(folder, ["config", "user.email", "local@plotpickle.invalid"]);
  }
}
async function currentBranch(folder: string) {
  const result = await git(folder, ["branch", "--show-current"], true);
  return result.stdout || "main";
}
async function status(folder: string) {
  await ensureRepository(folder);
  const [branch, porcelain, remote, upstream] = await Promise.all([
    currentBranch(folder),
    git(folder, ["status", "--porcelain=v1"], true),
    git(folder, ["remote", "get-url", "origin"], true),
    git(folder, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], true),
  ]);
  const changes = porcelain.stdout ? porcelain.stdout.split("\n").map((line) => ({ status: line.slice(0, 2), path: line.slice(3) })) : [];
  const conflicts = changes.filter((change) => /U|AA|DD/.test(change.status));
  return { initialized: true, branch, clean: changes.length === 0, changes, conflicts, remote: remote.ok ? remote.stdout : "", upstream: upstream.ok ? upstream.stdout : "" };
}
async function history(folder: string) {
  await ensureRepository(folder);
  const result = await git(folder, ["log", "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s", "-n", "100"], true);
  if (!result.ok || !result.stdout) return [];
  return result.stdout.split("\n").map((line) => {
    const [sha, shortSha, author, date, subject] = line.split("\u001f");
    return { sha, shortSha, author, date, subject };
  });
}
async function branches(folder: string) {
  await ensureRepository(folder);
  const result = await git(folder, ["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)%x1f%(objectname:short)%x1f%(committerdate:iso-strict)%x1f%(subject)", "refs/heads"], true);
  const active = await currentBranch(folder);
  return result.stdout ? result.stdout.split("\n").map((line) => {
    const [name, sha, updatedAt, subject] = line.split("\u001f");
    return { name, sha, updatedAt, subject, active: name === active, proposal: name.startsWith("proposal/") };
  }) : [];
}
async function saveRevision(folder: string, message: unknown) {
  await ensureRepository(folder);
  const summary = typeof message === "string" && message.trim() ? message.trim().slice(0, 240) : `PlotPickle revision ${new Date().toISOString()}`;
  await git(folder, ["add", "--all"]);
  const staged = await git(folder, ["diff", "--cached", "--quiet"], true);
  if (staged.ok) return { created: false, message: "No project changes need a revision." };
  await git(folder, ["commit", "-m", summary]);
  const commit = await git(folder, ["rev-parse", "HEAD"]);
  return { created: true, sha: commit.stdout, message: summary };
}

export function nativeGitGateway(): Plugin {
  return {
    name: "plotpickle-native-git-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const raw = request.url;
        if (!raw) { next(); return; }
        const url = new URL(raw, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocal(request)) { send(response, 403, { ok: false, message: "Native Git accepts requests only from this local PlotPickle server." }); return; }
        void (async () => {
          const input = request.method === "POST" ? await body(request) : {};
          const key = safeKey(input.projectKey ?? url.searchParams.get("project"));
          const folder = path.join(projectsRoot(), key);
          if (request.method === "GET" && url.pathname === `${API}/status`) { send(response, 200, { ok: true, ...(await status(folder)) }); return; }
          if (request.method === "GET" && url.pathname === `${API}/history`) { send(response, 200, { ok: true, revisions: await history(folder) }); return; }
          if (request.method === "GET" && url.pathname === `${API}/branches`) { send(response, 200, { ok: true, branches: await branches(folder) }); return; }
          if (request.method === "GET" && url.pathname === `${API}/conflicts`) { const state = await status(folder); send(response, 200, { ok: true, conflicts: state.conflicts }); return; }
          if (request.method === "POST" && url.pathname === `${API}/revision`) { send(response, 200, { ok: true, ...(await saveRevision(folder, input.message)) }); return; }
          if (request.method === "POST" && url.pathname === `${API}/branch`) {
            await ensureRepository(folder);
            const name = safeBranch(input.name);
            await git(folder, ["switch", "-c", name]);
            send(response, 200, { ok: true, branch: name }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/proposal`) {
            await ensureRepository(folder);
            const name = safeBranch(input.name, "proposal").startsWith("proposal/") ? safeBranch(input.name, "proposal") : `proposal/${safeBranch(input.name, "story")}`;
            await git(folder, ["switch", "-c", name]);
            send(response, 200, { ok: true, branch: name, proposal: true }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/switch`) {
            await ensureRepository(folder);
            const name = safeBranch(input.name);
            await git(folder, ["switch", name]);
            send(response, 200, { ok: true, branch: name }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/remote`) {
            await ensureRepository(folder);
            const remoteUrl = typeof input.url === "string" ? input.url.trim() : "";
            if (!/^(https:\/\/|ssh:\/\/|git@)[^\s]+$/.test(remoteUrl)) throw new Error("Enter a valid HTTPS or SSH Git remote URL.");
            const existing = await git(folder, ["remote", "get-url", "origin"], true);
            await git(folder, existing.ok ? ["remote", "set-url", "origin", remoteUrl] : ["remote", "add", "origin", remoteUrl]);
            send(response, 200, { ok: true, remote: remoteUrl }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/pull`) {
            await ensureRepository(folder);
            const branch = await currentBranch(folder);
            const result = await git(folder, ["pull", "--ff-only", "origin", branch]);
            send(response, 200, { ok: true, branch, output: result.stdout }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/publish`) {
            await ensureRepository(folder);
            const branch = await currentBranch(folder);
            const result = await git(folder, ["push", "--set-upstream", "origin", branch]);
            send(response, 200, { ok: true, branch, output: result.stdout || result.stderr }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/resolve`) {
            await ensureRepository(folder);
            const file = typeof input.path === "string" ? input.path.replace(/\\/g, "/") : "";
            if (!file || file.startsWith("/") || file.includes("../")) throw new Error("Select a valid project-relative conflict file.");
            const resolution = input.resolution === "theirs" ? "--theirs" : input.resolution === "ours" ? "--ours" : "";
            if (resolution) await git(folder, ["checkout", resolution, "--", file]);
            await git(folder, ["add", "--", file]);
            send(response, 200, { ok: true, path: file, resolution: resolution || "manual" }); return;
          }
          send(response, 404, { ok: false, message: "Native Git operation not found." });
        })().catch((error) => send(response, 400, { ok: false, message: error instanceof Error ? error.message : "Native Git operation failed." }));
      });
    },
  };
}
