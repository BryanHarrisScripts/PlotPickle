import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { BUZZ_STORY_ROOMS, type BuzzStoryRoomId } from "../lib/buzz-story-room";
import {
  persistentHome,
  readCredentialJson,
  removeCredentialFile,
  writeCredentialJson,
} from "./local-credentials";

const API = "/api/local-buzz";
const MAX_BODY = 1024 * 1024;
const MAX_COMMAND_OUTPUT = 8 * 1024 * 1024;
const CONNECTION_FILE = "buzz-connection.json";
const MANAGED_SECRETS_FILE = "buzz-managed-secrets.json";
const BUNDLE_DIRECTORY = path.resolve(process.cwd(), "runtime", "buzz");
const MANAGED_ROOT = path.join(persistentHome(), "buzz", "runtime");
const BACKUP_ROOT = path.join(persistentHome(), "buzz", "backups");
const RUNTIME_ENV_FILE = path.join(MANAGED_ROOT, ".env.runtime");
const MANAGED_RELAY_URL = "http://127.0.0.1:3000";
const MANAGED_VOLUMES = [
  ["plotpickle-buzz-postgres", "postgres.tgz"],
  ["plotpickle-buzz-redis", "redis.tgz"],
  ["plotpickle-buzz-minio", "minio.tgz"],
  ["plotpickle-buzz-git", "git.tgz"],
] as const;

type BuzzConnectionMode = "existing-relay" | "managed";
type BuzzConnection = {
  version: 1;
  mode: BuzzConnectionMode;
  relayUrl: string;
  community: string;
  identityLabel: string;
  cliPath: string;
  privateKey: string;
  verifiedAt: string;
};

type ManagedSecrets = {
  version: 1;
  relayImage: string;
  httpPort: number;
  relayPrivateKey: string;
  gitHookSecret: string;
  postgresPassword: string;
  redisPassword: string;
  s3AccessKey: string;
  s3SecretKey: string;
  createdAt: string;
};

type RuntimeFile = { path: string; sha256: string; bytes: number };
type RuntimeManifest = {
  schemaVersion: 1;
  sourceRepository: string;
  sourceTag: string;
  sourceRevision: string;
  deploymentKind: "docker-compose";
  relayImage: string;
  localOnly: true;
  validationGate: string;
  files: RuntimeFile[];
  licenseFiles: string[];
};

type CommandResult = { stdout: string; stderr: string; code: number };
type BuzzChannel = { id: string; name: string; description: string; raw: unknown };
type BuzzMessage = { id: string; content: string; author: string; createdAt: string; raw: unknown };

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The Buzz request is too large.");
    chunks.push(bytes);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Buzz request is invalid.");
  return value as Record<string, unknown>;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The Buzz operation failed.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 700);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeRelayUrl(value: unknown) {
  const source = text(value);
  if (!source) throw new Error("Enter a Buzz relay address.");
  const withProtocol = /^[a-z]+:\/\//i.test(source) ? source : `https://${source}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) throw new Error("Buzz relay addresses must use HTTP, HTTPS, WS or WSS.");
  if (url.username || url.password) throw new Error("Do not put credentials in the Buzz relay address.");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function relayHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  return url.toString().replace(/\/$/, "");
}

function validConnection(value: unknown): value is BuzzConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BuzzConnection>;
  return item.version === 1
    && (item.mode === "existing-relay" || item.mode === "managed")
    && typeof item.relayUrl === "string"
    && typeof item.community === "string"
    && typeof item.identityLabel === "string"
    && typeof item.cliPath === "string"
    && typeof item.privateKey === "string"
    && typeof item.verifiedAt === "string";
}

function publicConnection(connection: BuzzConnection | null) {
  return connection ? {
    configured: true,
    mode: connection.mode,
    relayUrl: connection.relayUrl,
    community: connection.community,
    identityLabel: connection.identityLabel,
    cliPath: connection.cliPath,
    identityConfigured: Boolean(connection.privateKey),
    verifiedAt: connection.verifiedAt,
  } : {
    configured: false,
    mode: "existing-relay",
    relayUrl: "",
    community: "",
    identityLabel: "",
    cliPath: "",
    identityConfigured: false,
    verifiedAt: "",
  };
}

async function readConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

function command(
  executable: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string; timeoutMs?: number; allowFailure?: boolean } = {},
) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout;
    const finish = (error?: Error, result?: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result as CommandResult);
    };
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${path.basename(executable)} did not finish within the allowed time.`));
    }, options.timeoutMs ?? 30_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_COMMAND_OUTPUT) target.push(chunk);
      else {
        child.kill("SIGKILL");
        finish(new Error(`${path.basename(executable)} returned too much output.`));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => finish(new Error(`${path.basename(executable)} is not installed or could not start.`)));
    child.once("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
        code: code ?? 1,
      };
      if (result.code !== 0 && !options.allowFailure) {
        finish(new Error(result.stderr || result.stdout || `${path.basename(executable)} exited with code ${result.code}.`));
      } else finish(undefined, result);
    });
    child.stdin.on("error", () => { /* Process failure is reported through close/error. */ });
    child.stdin.end(options.input ?? "", "utf8");
  });
}

function parseJson(source: string, label: string): unknown {
  try { return JSON.parse(source || "null"); }
  catch { throw new Error(`${label} returned invalid JSON.`); }
}

function buzzExecutable(connection: BuzzConnection | null) {
  return connection?.cliPath.trim() || (process.platform === "win32" ? "buzz.exe" : "buzz");
}

async function cliStatus(connection: BuzzConnection | null) {
  const executable = buzzExecutable(connection);
  try {
    const result = await command(executable, ["--version"], { timeoutMs: 8_000 });
    return { available: true, executable, version: result.stdout || result.stderr || "Available", error: "" };
  } catch (error) {
    return { available: false, executable, version: "", error: safeError(error) };
  }
}

async function runBuzz(connection: BuzzConnection, args: string[], options: { write?: boolean; input?: string } = {}) {
  if (options.write && !connection.privateKey) throw new Error("Add an existing Buzz private identity key before creating rooms or sending messages.");
  const result = await command(buzzExecutable(connection), args, {
    env: {
      BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
      ...(connection.privateKey ? { BUZZ_PRIVATE_KEY: connection.privateKey } : {}),
    },
    input: options.input,
    timeoutMs: 45_000,
  });
  return parseJson(result.stdout, "Buzz CLI");
}

function nestedArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["channels", "messages", "items", "data", "results"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function firstString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function channelsFrom(value: unknown): BuzzChannel[] {
  return nestedArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["id", "channel_id", "channelId", "uuid"]);
    const name = firstString(item, ["name", "title", "slug"]);
    if (!id || !name) return [];
    return [{ id, name, description: firstString(item, ["description", "purpose", "topic"]), raw: entry }];
  });
}

function messagesFrom(value: unknown): BuzzMessage[] {
  return nestedArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["id", "event_id", "eventId"]);
    const content = firstString(item, ["content", "body", "text"]);
    if (!id && !content) return [];
    const created = item.created_at ?? item.createdAt ?? item.timestamp;
    const createdAt = typeof created === "number" ? new Date(created * 1000).toISOString() : text(created);
    return [{
      id: id || randomUUID(),
      content,
      author: firstString(item, ["author_name", "author", "display_name", "pubkey"]),
      createdAt,
      raw: entry,
    }];
  });
}

function safeRoomName(value: unknown) {
  const room = text(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,71}$/.test(room)) throw new Error("The Buzz room name is invalid.");
  return room;
}

function validRoomId(value: unknown): BuzzStoryRoomId {
  const id = text(value) as BuzzStoryRoomId;
  if (!BUZZ_STORY_ROOMS.some((room) => room.id === id)) throw new Error("Choose a valid PlotPickle Story Room.");
  return id;
}

async function probeRelay(relayUrl: string) {
  const startedAt = Date.now();
  const httpUrl = relayHttpUrl(relayUrl);
  const candidates = [`${httpUrl}/_liveness`, httpUrl];
  let detail = "";
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.8", "User-Agent": "PlotPickle-Buzz-Health" },
      });
      if (response.status < 500) {
        return { reachable: true, checkedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt, detail: `${response.status} from ${candidate}` };
      }
      detail = `${response.status} from ${candidate}`;
    } catch (error) { detail = safeError(error); }
  }
  return { reachable: false, checkedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt, detail: detail || "No response." };
}

function sha256(source: Buffer | string) {
  return createHash("sha256").update(source).digest("hex");
}

async function loadManifest(directory = BUNDLE_DIRECTORY): Promise<RuntimeManifest> {
  const source = await readFile(path.join(directory, "manifest.json"), "utf8");
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== "object") throw new Error("The managed Buzz manifest is invalid.");
  const manifest = value as Partial<RuntimeManifest>;
  if (manifest.schemaVersion !== 1
    || manifest.sourceRepository !== "https://github.com/block/buzz"
    || manifest.deploymentKind !== "docker-compose"
    || manifest.localOnly !== true
    || typeof manifest.relayImage !== "string"
    || !manifest.relayImage.startsWith("ghcr.io/block/buzz:")
    || !Array.isArray(manifest.files)
    || !Array.isArray(manifest.licenseFiles)
    || !manifest.licenseFiles.length) {
    throw new Error("The managed Buzz manifest does not satisfy the PlotPickle trust boundary.");
  }
  for (const item of manifest.files) {
    if (!item || typeof item.path !== "string" || !/^[A-Za-z0-9._-]+$/.test(item.path)
      || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)
      || !Number.isInteger(item.bytes) || item.bytes < 1) throw new Error("The managed Buzz manifest contains an invalid file record.");
  }
  for (const license of manifest.licenseFiles) {
    if (typeof license !== "string" || !manifest.files.some((item) => item.path === license)) throw new Error("The managed Buzz licence record is incomplete.");
  }
  return manifest as RuntimeManifest;
}

async function verifyBundle(directory = BUNDLE_DIRECTORY) {
  const manifest = await loadManifest(directory);
  const results = await Promise.all(manifest.files.map(async (item) => {
    const file = await readFile(path.join(directory, item.path));
    return { path: item.path, ok: file.byteLength === item.bytes && sha256(file) === item.sha256 };
  }));
  const invalid = results.filter((item) => !item.ok).map((item) => item.path);
  if (invalid.length) throw new Error(`The managed Buzz bundle failed checksum verification: ${invalid.join(", ")}.`);
  return { manifest, manifestSha256: sha256(await readFile(path.join(directory, "manifest.json"))), files: results };
}

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function randomPassword(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

async function readManagedSecrets() {
  const value = await readCredentialJson<unknown>(MANAGED_SECRETS_FILE);
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ManagedSecrets>;
  return item.version === 1
    && typeof item.relayImage === "string"
    && typeof item.httpPort === "number"
    && typeof item.relayPrivateKey === "string"
    && typeof item.gitHookSecret === "string"
    && typeof item.postgresPassword === "string"
    && typeof item.redisPassword === "string"
    && typeof item.s3AccessKey === "string"
    && typeof item.s3SecretKey === "string"
    && typeof item.createdAt === "string" ? item as ManagedSecrets : null;
}

async function createManagedSecrets(manifest: RuntimeManifest) {
  const secrets: ManagedSecrets = {
    version: 1,
    relayImage: manifest.relayImage,
    httpPort: 3000,
    relayPrivateKey: randomHex(),
    gitHookSecret: randomHex(),
    postgresPassword: randomPassword(),
    redisPassword: randomPassword(),
    s3AccessKey: `plotpickle-${randomBytes(9).toString("hex")}`,
    s3SecretKey: randomPassword(32),
    createdAt: new Date().toISOString(),
  };
  await writeCredentialJson(MANAGED_SECRETS_FILE, secrets);
  return secrets;
}

function managedEnvironment(secrets: ManagedSecrets) {
  return [
    `BUZZ_IMAGE=${secrets.relayImage}`,
    `BUZZ_HTTP_PORT=${secrets.httpPort}`,
    `RELAY_URL=ws://127.0.0.1:${secrets.httpPort}`,
    `BUZZ_MEDIA_BASE_URL=http://127.0.0.1:${secrets.httpPort}/media`,
    `BUZZ_MEDIA_SERVER_DOMAIN=127.0.0.1:${secrets.httpPort}`,
    `BUZZ_CORS_ORIGINS=http://127.0.0.1:${secrets.httpPort},http://localhost:${secrets.httpPort}`,
    `BUZZ_RELAY_PRIVATE_KEY=${secrets.relayPrivateKey}`,
    `BUZZ_GIT_HOOK_HMAC_SECRET=${secrets.gitHookSecret}`,
    "POSTGRES_DB=buzz",
    "POSTGRES_USER=buzz",
    `POSTGRES_PASSWORD=${secrets.postgresPassword}`,
    `REDIS_PASSWORD=${secrets.redisPassword}`,
    `BUZZ_S3_ACCESS_KEY=${secrets.s3AccessKey}`,
    `BUZZ_S3_SECRET_KEY=${secrets.s3SecretKey}`,
    "BUZZ_S3_BUCKET=buzz-media",
    "",
  ].join("\n");
}

async function withManagedEnvironment<T>(operation: (composeArgs: string[], secrets: ManagedSecrets) => Promise<T>) {
  const secrets = await readManagedSecrets();
  if (!secrets) throw new Error("Install managed Buzz before using its lifecycle controls.");
  await mkdir(MANAGED_ROOT, { recursive: true, mode: 0o700 });
  await writeFile(RUNTIME_ENV_FILE, managedEnvironment(secrets), { encoding: "utf8", mode: 0o600 });
  try {
    const composeArgs = ["compose", "--env-file", RUNTIME_ENV_FILE, "-f", path.join(MANAGED_ROOT, "compose.yml")];
    return await operation(composeArgs, secrets);
  } finally {
    await rm(RUNTIME_ENV_FILE, { force: true });
  }
}

async function dockerStatus() {
  try {
    const [engine, compose] = await Promise.all([
      command("docker", ["info", "--format", "{{.ServerVersion}}"], { timeoutMs: 12_000 }),
      command("docker", ["compose", "version", "--short"], { timeoutMs: 12_000 }),
    ]);
    return { available: true, engine: engine.stdout, compose: compose.stdout, error: "" };
  } catch (error) {
    return { available: false, engine: "", compose: "", error: safeError(error) };
  }
}

async function installedState() {
  try {
    await verifyBundle(MANAGED_ROOT);
    return true;
  } catch { return false; }
}

async function managedRunning() {
  if (!await installedState() || !await readManagedSecrets()) return false;
  try {
    return await withManagedEnvironment(async (composeArgs) => {
      const result = await command("docker", [...composeArgs, "ps", "--status", "running", "--services"], { timeoutMs: 15_000, allowFailure: true });
      return result.stdout.split(/\r?\n/).includes("relay");
    });
  } catch { return false; }
}

async function backupInventory() {
  try {
    const entries = await readdir(BACKUP_ROOT, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function runtimeStatus() {
  const bundle = await verifyBundle().then((value) => ({ available: true, ...value, error: "" })).catch((error) => ({ available: false, manifest: null, manifestSha256: "", files: [], error: safeError(error) }));
  const docker = await dockerStatus();
  const installed = await installedState();
  const secrets = await readManagedSecrets();
  const running = docker.available && installed && Boolean(secrets) ? await managedRunning() : false;
  const health = running ? await probeRelay(MANAGED_RELAY_URL) : { reachable: false, checkedAt: "", latencyMs: 0, detail: "Managed relay is stopped." };
  const backups = await backupInventory();
  return {
    bundle: {
      available: bundle.available,
      manifestSha256: bundle.manifestSha256,
      sourceTag: bundle.manifest?.sourceTag || "",
      sourceRevision: bundle.manifest?.sourceRevision || "",
      relayImage: bundle.manifest?.relayImage || "",
      validationGate: bundle.manifest?.validationGate || "",
      error: bundle.error,
    },
    docker,
    installed,
    configured: Boolean(secrets),
    running,
    reachable: health.reachable,
    relayUrl: MANAGED_RELAY_URL,
    installRoot: installed ? MANAGED_ROOT : "",
    backupRoot: BACKUP_ROOT,
    backups,
    lifecycle: !bundle.available ? "unavailable" : !docker.available ? "prerequisite-required" : !installed ? "available" : running && health.reachable ? "running" : running ? "degraded" : "stopped",
    message: !bundle.available
      ? bundle.error
      : !docker.available
        ? "Docker Desktop or Docker Engine with Compose v2 is required for managed Buzz."
        : !installed
          ? "The verified Compose bundle is ready to install. No image, container, port or data has been created."
          : running && health.reachable
            ? "Managed Buzz is running on this computer and passed its relay health check."
            : running
              ? "The Buzz containers are running, but the relay health check is degraded."
              : "Managed Buzz is installed and stopped.",
  };
}

async function installManagedRuntime() {
  const docker = await dockerStatus();
  if (!docker.available) throw new Error("Install and start Docker Desktop or Docker Engine with Compose v2 first.");
  const verified = await verifyBundle();
  await mkdir(MANAGED_ROOT, { recursive: true, mode: 0o700 });
  for (const item of verified.manifest.files) {
    await copyFile(path.join(BUNDLE_DIRECTORY, item.path), path.join(MANAGED_ROOT, item.path));
  }
  await copyFile(path.join(BUNDLE_DIRECTORY, "manifest.json"), path.join(MANAGED_ROOT, "manifest.json"));
  await verifyBundle(MANAGED_ROOT);
  if (!await readManagedSecrets()) await createManagedSecrets(verified.manifest);
  return runtimeStatus();
}

async function composeAction(args: string[], timeoutMs = 5 * 60_000) {
  if (!await installedState()) throw new Error("Install managed Buzz before using this action.");
  return withManagedEnvironment(async (composeArgs) => command("docker", [...composeArgs, ...args], { timeoutMs }));
}

async function startManagedRuntime() {
  await composeAction(["up", "-d", "--wait"], 8 * 60_000);
  const status = await runtimeStatus();
  if (!status.reachable) throw new Error("Buzz started, but its relay did not pass the local health check.");
  const existing = await readConnection();
  await writeCredentialJson(CONNECTION_FILE, {
    version: 1,
    mode: "managed",
    relayUrl: MANAGED_RELAY_URL,
    community: existing?.community || "PlotPickle local Story Room",
    identityLabel: existing?.identityLabel || "PlotPickle owner",
    cliPath: existing?.cliPath || "",
    privateKey: existing?.privateKey || "",
    verifiedAt: new Date().toISOString(),
  } satisfies BuzzConnection);
  return status;
}

async function stopManagedRuntime() {
  await composeAction(["stop"], 3 * 60_000);
  return runtimeStatus();
}

async function restartManagedRuntime() {
  await composeAction(["restart"], 5 * 60_000);
  const status = await runtimeStatus();
  if (!status.reachable) throw new Error("Buzz restarted, but its relay did not pass the local health check.");
  return status;
}

async function repairManagedRuntime() {
  await composeAction(["down", "--remove-orphans"], 4 * 60_000);
  await composeAction(["up", "-d", "--wait", "--force-recreate"], 8 * 60_000);
  const status = await runtimeStatus();
  if (!status.reachable) throw new Error("Buzz was recreated, but its relay did not pass the local health check.");
  return status;
}

async function updateManagedRuntime() {
  const verified = await verifyBundle();
  await mkdir(MANAGED_ROOT, { recursive: true, mode: 0o700 });
  for (const item of verified.manifest.files) await copyFile(path.join(BUNDLE_DIRECTORY, item.path), path.join(MANAGED_ROOT, item.path));
  await copyFile(path.join(BUNDLE_DIRECTORY, "manifest.json"), path.join(MANAGED_ROOT, "manifest.json"));
  await verifyBundle(MANAGED_ROOT);
  await composeAction(["pull"], 10 * 60_000);
  await composeAction(["up", "-d", "--wait"], 8 * 60_000);
  return runtimeStatus();
}

async function backupManagedRuntime() {
  if (!await installedState()) throw new Error("Install managed Buzz before creating a backup.");
  const wasRunning = await managedRunning();
  if (wasRunning) await composeAction(["stop"], 3 * 60_000);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(BACKUP_ROOT, stamp);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    for (const [volume, archive] of MANAGED_VOLUMES) {
      await command("docker", [
        "run", "--rm", "-v", `${volume}:/source:ro`, "-v", `${directory}:/backup`,
        "alpine:3.20", "sh", "-ec", `cd /source && tar -czf /backup/${archive} .`,
      ], { timeoutMs: 10 * 60_000 });
    }
    const verified = await verifyBundle(MANAGED_ROOT);
    await writeFile(path.join(directory, "backup.json"), `${JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      sourceTag: verified.manifest.sourceTag,
      sourceRevision: verified.manifest.sourceRevision,
      relayImage: verified.manifest.relayImage,
      volumes: MANAGED_VOLUMES.map(([volume, archive]) => ({ volume, archive })),
    }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  } finally {
    if (wasRunning) await composeAction(["up", "-d", "--wait"], 8 * 60_000);
  }
  return { ok: true, backup: stamp, path: directory, status: await runtimeStatus() };
}

function safeBackupName(value: unknown) {
  const name = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T[0-9-]+Z$/.test(name)) throw new Error("Choose a valid managed Buzz backup.");
  return name;
}

async function restoreManagedRuntime(nameValue: unknown) {
  const name = safeBackupName(nameValue);
  const directory = path.join(BACKUP_ROOT, name);
  await stat(path.join(directory, "backup.json"));
  await composeAction(["down", "--remove-orphans"], 4 * 60_000);
  for (const [volume, archive] of MANAGED_VOLUMES) {
    await stat(path.join(directory, archive));
    await command("docker", [
      "run", "--rm", "-v", `${volume}:/target`, "-v", `${directory}:/backup`,
      "alpine:3.20", "sh", "-ec",
      `find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar -xzf /backup/${archive} -C /target`,
    ], { timeoutMs: 10 * 60_000 });
  }
  await composeAction(["up", "-d", "--wait"], 8 * 60_000);
  const status = await runtimeStatus();
  if (!status.reachable) throw new Error("The backup was restored, but Buzz did not pass its relay health check.");
  return status;
}

async function removeManagedRuntime(removeBackups: boolean) {
  if (await installedState() && await readManagedSecrets()) {
    await composeAction(["down", "--volumes", "--remove-orphans"], 8 * 60_000).catch(() => undefined);
  }
  await rm(MANAGED_ROOT, { recursive: true, force: true });
  await removeCredentialFile(MANAGED_SECRETS_FILE);
  if (removeBackups) await rm(BACKUP_ROOT, { recursive: true, force: true });
  const connection = await readConnection();
  if (connection?.mode === "managed") await removeCredentialFile(CONNECTION_FILE);
  return runtimeStatus();
}

async function aggregateStatus() {
  const [connection, managed] = await Promise.all([readConnection(), runtimeStatus()]);
  const relay = connection ? await probeRelay(connection.relayUrl) : { reachable: false, checkedAt: "", latencyMs: 0, detail: "Buzz is optional and not configured." };
  const cli = await cliStatus(connection);
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    connection: publicConnection(connection),
    relay,
    cli,
    managed,
    storyRooms: BUZZ_STORY_ROOMS,
    authority: {
      discussion: "Buzz stores discussion and signed source events.",
      proposal: "PlotPickle stores reviewable proposals with the source room and message reference.",
      canon: "Only a human-approved proposal changes the PPF creative record.",
    },
  };
}

async function saveConnection(body: Record<string, unknown>) {
  const existing = await readConnection();
  const mode: BuzzConnectionMode = body.mode === "managed" ? "managed" : "existing-relay";
  const relayUrl = mode === "managed" ? MANAGED_RELAY_URL : normalizeRelayUrl(body.relayUrl);
  const privateKeyInput = text(body.privateKey);
  if (privateKeyInput && !/^(nsec1[a-z0-9]+|[a-f0-9]{64})$/i.test(privateKeyInput)) throw new Error("The Buzz private identity key must be an nsec or 64-character hexadecimal key.");
  const connection: BuzzConnection = {
    version: 1,
    mode,
    relayUrl,
    community: text(body.community).slice(0, 120),
    identityLabel: text(body.identityLabel).slice(0, 120),
    cliPath: text(body.cliPath).slice(0, 500),
    privateKey: privateKeyInput || existing?.privateKey || "",
    verifiedAt: existing?.relayUrl === relayUrl ? existing.verifiedAt : "",
  };
  await writeCredentialJson(CONNECTION_FILE, connection);
  return publicConnection(connection);
}

async function testConnection() {
  const connection = await readConnection();
  if (!connection) throw new Error("Save a Buzz connection before testing it.");
  const relay = await probeRelay(connection.relayUrl);
  const cli = await cliStatus(connection);
  const verified = relay.reachable;
  if (verified) {
    connection.verifiedAt = new Date().toISOString();
    await writeCredentialJson(CONNECTION_FILE, connection);
  }
  return { ok: verified, connection: publicConnection(connection), relay, cli, message: verified ? "Buzz relay reached successfully." : `Buzz relay could not be reached. ${relay.detail}` };
}

async function listRooms(projectPrefix: string) {
  const connection = await readConnection();
  if (!connection) throw new Error("Connect Buzz before loading Story Rooms.");
  const raw = await runBuzz(connection, ["channels", "list"]);
  return channelsFrom(raw).filter((channel) => !projectPrefix || channel.name.startsWith(projectPrefix));
}

async function ensureRooms(body: Record<string, unknown>) {
  const connection = await readConnection();
  if (!connection) throw new Error("Connect Buzz before creating Story Rooms.");
  const prefix = safeRoomName(body.projectPrefix);
  const requested = Array.isArray(body.rooms) ? body.rooms : [];
  const rooms = requested.length ? requested.map((value) => {
    if (!value || typeof value !== "object") throw new Error("A Story Room definition is invalid.");
    const item = value as Record<string, unknown>;
    return { id: validRoomId(item.id), name: safeRoomName(item.name), description: text(item.description).slice(0, 300) };
  }) : BUZZ_STORY_ROOMS.map((room) => ({ id: room.id, name: `${prefix}-${room.suffix}`.slice(0, 72), description: room.description }));
  const existing = channelsFrom(await runBuzz(connection, ["channels", "list"]));
  const result: Array<{ roomId: BuzzStoryRoomId; channel: BuzzChannel; created: boolean }> = [];
  for (const room of rooms) {
    let channel = existing.find((item) => item.name === room.name);
    let created = false;
    if (!channel) {
      const raw = await runBuzz(connection, ["channels", "create", "--name", room.name, "--type", "stream", "--visibility", "private"], { write: true });
      const createdChannels = channelsFrom(Array.isArray(raw) ? raw : [raw]);
      const rawRecord = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      channel = createdChannels[0] ?? { id: firstString(rawRecord, ["id", "channel_id", "channelId"]), name: room.name, description: room.description, raw };
      if (!channel.id) throw new Error(`Buzz created ${room.name} but did not return its channel identifier.`);
      created = true;
      existing.push(channel);
    }
    result.push({ roomId: room.id, channel, created });
  }
  return result;
}

async function listMessages(channelValue: unknown, limitValue: unknown) {
  const connection = await readConnection();
  if (!connection) throw new Error("Connect Buzz before loading messages.");
  const channel = text(channelValue);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(channel)) throw new Error("Choose a valid Buzz channel.");
  const limit = Math.min(100, Math.max(1, integer(limitValue, 40)));
  return messagesFrom(await runBuzz(connection, ["messages", "get", "--channel", channel, "--limit", String(limit)]));
}

async function sendMessage(body: Record<string, unknown>) {
  const connection = await readConnection();
  if (!connection) throw new Error("Connect Buzz before sending a message.");
  const channel = text(body.channel);
  const content = text(body.content);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(channel)) throw new Error("Choose a valid Buzz channel.");
  if (!content || content.length > 20_000) throw new Error("Buzz messages must contain between 1 and 20,000 characters.");
  return runBuzz(connection, ["messages", "send", "--channel", channel, "--content", content], { write: true });
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, await aggregateStatus());
    return;
  }
  if (request.method === "PUT" && url.pathname === `${API}/connection`) {
    sendJson(response, 200, { ok: true, connection: await saveConnection(await readBody(request)), message: "Buzz connection details were encrypted for the current computer user." });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/connection`) {
    await removeCredentialFile(CONNECTION_FILE);
    sendJson(response, 200, { ok: true, message: "The Buzz connection and encrypted identity were removed. PlotPickle projects were kept." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/test`) {
    const result = await testConnection();
    sendJson(response, result.ok ? 200 : 503, result);
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/rooms`) {
    sendJson(response, 200, { ok: true, rooms: await listRooms(text(url.searchParams.get("projectPrefix"))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/rooms/ensure`) {
    sendJson(response, 200, { ok: true, rooms: await ensureRooms(await readBody(request)) });
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/messages`) {
    sendJson(response, 200, { ok: true, messages: await listMessages(url.searchParams.get("channel"), url.searchParams.get("limit")) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/messages`) {
    sendJson(response, 200, { ok: true, result: await sendMessage(await readBody(request)), message: "The signed message was sent to Buzz." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/install`) {
    sendJson(response, 200, { ok: true, managed: await installManagedRuntime(), message: "The verified managed Buzz bundle was installed. No container starts until Start is selected." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/start`) {
    sendJson(response, 200, { ok: true, managed: await startManagedRuntime(), message: "Managed Buzz started and passed its local health check." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/stop`) {
    sendJson(response, 200, { ok: true, managed: await stopManagedRuntime(), message: "Managed Buzz stopped." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/restart`) {
    sendJson(response, 200, { ok: true, managed: await restartManagedRuntime(), message: "Managed Buzz restarted and passed its local health check." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/repair`) {
    sendJson(response, 200, { ok: true, managed: await repairManagedRuntime(), message: "Managed Buzz containers were recreated and passed the local health check." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/update`) {
    sendJson(response, 200, { ok: true, managed: await updateManagedRuntime(), message: "Managed Buzz was refreshed from the pinned verified manifest." });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/backup`) {
    sendJson(response, 200, await backupManagedRuntime());
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/managed/restore`) {
    const body = await readBody(request);
    sendJson(response, 200, { ok: true, managed: await restoreManagedRuntime(body.backup), message: "Managed Buzz was restored and passed its local health check." });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/managed`) {
    const body = await readBody(request);
    sendJson(response, 200, { ok: true, managed: await removeManagedRuntime(body.removeBackups === true), message: "Managed Buzz containers, volumes, runtime files and service secrets were removed." });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Buzz operation not found." });
}

export function buzzGateway(): Plugin {
  return {
    name: "plotpickle-buzz-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Buzz controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}
