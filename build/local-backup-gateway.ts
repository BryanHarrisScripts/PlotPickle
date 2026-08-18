import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { parsePortableProjectFile, serializePortableProjectFile, type PortablePlotPickleFile } from "../lib/project-package";
import { persistentHome } from "./local-credentials";

const API = "/api/local-backups";
const FORMAT = "plotpickle-local-backup" as const;
const FORMAT_VERSION = 1 as const;
const AUTOMATIC_MAX_COUNT = 10;
const AUTOMATIC_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const MAX_ASSET_BYTES = 350 * 1024 * 1024;
const MAX_BODY_BYTES = 64 * 1024;

const DEFAULT_EXCLUSIONS = [
  "provider API keys and encrypted local credentials",
  "BUZZ credentials",
  "Studio private signing key and identity recovery material",
  "local machine or OS user identifiers",
  "model caches and downloaded model weights",
  "temporary graph or Responsibility Run scratch data",
  "hidden reasoning, scratchpads and private prompts not explicitly owned by the project",
  "Verification Inbox history (separately exportable operational evidence)",
] as const;

type BackupKind = "automatic" | "manual";

type BackupAsset = {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  base64: string;
};

type PlotPickleBackup = {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  createdAt: string;
  applicationState: {
    projectFileName: string;
    projectFile: PortablePlotPickleFile;
    projectSha256: string;
    assets: BackupAsset[];
    includedRecords: string[];
    excludedRecords: string[];
  };
  integrity: {
    algorithm: "sha256";
    payloadSha256: string;
  };
};

type BackupEntry = {
  fileName: string;
  kind: BackupKind;
  bytes: number;
  createdAt: string;
};

function backupRoot() { return path.join(persistentHome(), "backup-packages"); }
function backupDirectory(kind: BackupKind) { return path.join(backupRoot(), kind); }
function projectsDirectory() { return path.join(persistentHome(), "projects"); }
function assetsDirectory() { return path.join(persistentHome(), "assets"); }
function restoreStagingDirectory() { return path.join(persistentHome(), "restore-staging"); }
function restorePreimageDirectory() { return path.join(persistentHome(), "backups", "restore-preimages"); }

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function stablePayload(bundle: Omit<PlotPickleBackup, "integrity">) {
  return JSON.stringify({
    format: bundle.format,
    formatVersion: bundle.formatVersion,
    createdAt: bundle.createdAt,
    applicationState: bundle.applicationState,
  });
}

function safeProjectFileName(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  if (!/^[a-z0-9][a-z0-9._-]{0,119}\.ppf$/i.test(source)) throw new Error("Choose a safe local .ppf project file.");
  return source;
}

function safeBackupFileName(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  if (!/^[a-z0-9][a-z0-9._-]{0,179}\.ppbackup\.json$/i.test(source)) throw new Error("Choose a safe PlotPickle backup package file.");
  return source;
}

function safeAssetRelativePath(value: unknown) {
  const source = typeof value === "string" ? value.replaceAll("\\", "/").trim() : "";
  if (!source.startsWith("assets/") || source.length > 260) throw new Error(`Backup contains an invalid project asset path: ${source || "(empty)"}.`);
  const relative = source.slice("assets/".length);
  const parts = relative.split("/");
  if (!relative || parts.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f]/.test(part))) {
    throw new Error(`Backup contains an invalid project asset path: ${source}.`);
  }
  return { portable: `assets/${parts.join("/")}`, relative: parts.join(path.sep) };
}

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host || "";
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_BODY_BYTES) throw new Error("The backup request is too large.");
    chunks.push(part);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid backup request.");
  return value as Record<string, unknown>;
}

async function atomicWrite(filePath: string, content: string | Buffer) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
}

function backupName(projectFileName: string) {
  const stem = projectFileName.replace(/\.ppf$/i, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stem}-${timestamp}.ppbackup.json`;
}

async function readProject(projectFileName: string) {
  const source = await readFile(path.join(projectsDirectory(), projectFileName), "utf8");
  const parsed = parsePortableProjectFile(source);
  if (!parsed.integrityValid) throw new Error("The source .ppf integrity check failed. Recover a valid project revision before backing it up.");
  return parsed.file;
}

async function collectAssets(projectFile: PortablePlotPickleFile) {
  const assets: BackupAsset[] = [];
  const missing: string[] = [];
  for (const entry of projectFile.assets) {
    const assetPath = safeAssetRelativePath(entry.path);
    const filePath = path.join(assetsDirectory(), assetPath.relative);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not-file");
      if (info.size > MAX_ASSET_BYTES) throw new Error(`Project asset ${assetPath.portable} exceeds the supported backup asset size.`);
      const bytes = await readFile(filePath);
      const digest = sha256(bytes);
      if (entry.sha256 && /^[a-f0-9]{64}$/i.test(entry.sha256) && entry.sha256.toLowerCase() !== digest) {
        throw new Error(`Project asset ${assetPath.portable} does not match its recorded checksum.`);
      }
      assets.push({
        path: assetPath.portable,
        mediaType: entry.mediaType || "application/octet-stream",
        bytes: bytes.length,
        sha256: digest,
        base64: bytes.toString("base64"),
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes("checksum") || error.message.includes("supported backup asset size"))) throw error;
      missing.push(assetPath.portable);
    }
  }
  if (missing.length) throw new Error(`Backup cannot complete because ${missing.length} referenced project asset(s) are missing: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}.`);
  return assets;
}

async function createBackup(projectFileName: string, kind: BackupKind) {
  const projectFile = await readProject(projectFileName);
  const projectSource = serializePortableProjectFile(projectFile);
  const assets = await collectAssets(projectFile);
  const payload: Omit<PlotPickleBackup, "integrity"> = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    applicationState: {
      projectFileName,
      projectFile,
      projectSha256: sha256(projectSource),
      assets,
      includedRecords: [
        "PPF canonical project state and embedded revision/provenance data",
        "project metadata required to reopen the story",
        "project-relative creative asset manifest and referenced asset bytes",
        "project-owned memory/provenance stored inside the PPF",
      ],
      excludedRecords: [...DEFAULT_EXCLUSIONS],
    },
  };
  const bundle: PlotPickleBackup = {
    ...payload,
    integrity: { algorithm: "sha256", payloadSha256: sha256(stablePayload(payload)) },
  };
  const serialized = `${JSON.stringify(bundle, null, 2)}\n`;
  const bytes = Buffer.byteLength(serialized);
  if (bytes > MAX_PACKAGE_BYTES) throw new Error("This project backup exceeds the local backup package size limit. Remove unused project assets or export them separately.");
  const fileName = backupName(projectFileName);
  await atomicWrite(path.join(backupDirectory(kind), fileName), serialized);
  if (kind === "automatic") await pruneAutomaticBackups();
  return { fileName, kind, bytes, createdAt: bundle.createdAt, assetCount: assets.length, projectSha256: bundle.applicationState.projectSha256 };
}

async function entriesFor(kind: BackupKind): Promise<BackupEntry[]> {
  const directory = backupDirectory(kind);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const entries = await readdir(directory, { withFileTypes: true });
  const records = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ppbackup.json")).map(async (entry) => {
    const info = await stat(path.join(directory, entry.name));
    return { fileName: entry.name, kind, bytes: info.size, createdAt: info.mtime.toISOString() } satisfies BackupEntry;
  }));
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function pruneAutomaticBackups() {
  const entries = await entriesFor("automatic");
  let keptBytes = 0;
  const remove: BackupEntry[] = [];
  entries.forEach((entry, index) => {
    const overCount = index >= AUTOMATIC_MAX_COUNT;
    const overBudget = keptBytes + entry.bytes > AUTOMATIC_MAX_BYTES;
    if (overCount || overBudget) remove.push(entry);
    else keptBytes += entry.bytes;
  });
  await Promise.all(remove.map((entry) => rm(path.join(backupDirectory("automatic"), entry.fileName), { force: true })));
  return { removed: remove.length, keptBytes };
}

function validateBackupShape(value: unknown): PlotPickleBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Backup package is not a JSON object.");
  const bundle = value as Partial<PlotPickleBackup>;
  if (bundle.format !== FORMAT || bundle.formatVersion !== FORMAT_VERSION) throw new Error("This is not a supported PlotPickle local backup package.");
  if (!bundle.applicationState || !bundle.integrity || bundle.integrity.algorithm !== "sha256") throw new Error("Backup package is missing required integrity metadata.");
  const payload: Omit<PlotPickleBackup, "integrity"> = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    createdAt: String(bundle.createdAt || ""),
    applicationState: bundle.applicationState,
  };
  const expected = sha256(stablePayload(payload));
  if (bundle.integrity.payloadSha256 !== expected) throw new Error("Backup package integrity check failed. No local project data was changed.");
  return bundle as PlotPickleBackup;
}

async function readBackup(kind: BackupKind, fileName: string) {
  const filePath = path.join(backupDirectory(kind), safeBackupFileName(fileName));
  const info = await stat(filePath);
  if (!info.isFile() || info.size > MAX_PACKAGE_BYTES) throw new Error("Backup package is unavailable or exceeds the supported size limit.");
  return validateBackupShape(JSON.parse(await readFile(filePath, "utf8")) as unknown);
}

async function validateRestore(bundle: PlotPickleBackup) {
  const projectFileName = safeProjectFileName(bundle.applicationState.projectFileName);
  const projectSource = serializePortableProjectFile(bundle.applicationState.projectFile);
  const parsed = parsePortableProjectFile(projectSource);
  if (!parsed.integrityValid) throw new Error("The backup contains a project whose PPF integrity check failed. No local project data was changed.");
  if (sha256(projectSource) !== bundle.applicationState.projectSha256) throw new Error("The backup project checksum does not match. No local project data was changed.");
  const byPath = new Map<string, { path: string; relative: string; bytes: Buffer; sha256: string }>();
  for (const asset of bundle.applicationState.assets) {
    const safe = safeAssetRelativePath(asset.path);
    const bytes = Buffer.from(asset.base64, "base64");
    if (!bytes.length || bytes.length !== asset.bytes || bytes.length > MAX_ASSET_BYTES) throw new Error(`Backup asset ${safe.portable} has an invalid byte count. No local project data was changed.`);
    const digest = sha256(bytes);
    if (digest !== asset.sha256) throw new Error(`Backup asset ${safe.portable} failed its checksum. No local project data was changed.`);
    byPath.set(safe.portable, { ...safe, bytes, sha256: digest });
  }
  const missing = parsed.file.assets.map((entry) => safeAssetRelativePath(entry.path).portable).filter((assetPath) => !byPath.has(assetPath));
  if (missing.length) throw new Error(`Backup is incomplete; ${missing.length} referenced asset(s) are missing: ${missing.slice(0, 8).join(", ")}. No local project data was changed.`);

  for (const asset of byPath.values()) {
    const destination = path.join(assetsDirectory(), asset.relative);
    try {
      const existing = await readFile(destination);
      if (sha256(existing) !== asset.sha256) throw new Error(`Restore would overwrite a different local asset at ${asset.path}. No local project data was changed.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return { projectFileName, projectSource, assets: [...byPath.values()] };
}

async function restoreBackup(kind: BackupKind, fileName: string) {
  const bundle = await readBackup(kind, fileName);
  const validated = await validateRestore(bundle);
  const staging = path.join(restoreStagingDirectory(), randomUUID());
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    const stagedProject = path.join(staging, validated.projectFileName);
    await atomicWrite(stagedProject, validated.projectSource);
    for (const asset of validated.assets) await atomicWrite(path.join(staging, asset.relative), asset.bytes);

    // Verify the staged copy before any active project path is touched.
    const stagedParsed = parsePortableProjectFile(await readFile(stagedProject, "utf8"));
    if (!stagedParsed.integrityValid) throw new Error("Staged project verification failed. No active project data was changed.");
    for (const asset of validated.assets) {
      const stagedBytes = await readFile(path.join(staging, asset.relative));
      if (sha256(stagedBytes) !== asset.sha256) throw new Error(`Staged asset verification failed for ${asset.path}. No active project data was changed.`);
    }

    // Assets are additive. Existing differing assets were rejected during validation.
    for (const asset of validated.assets) {
      const destination = path.join(assetsDirectory(), asset.relative);
      try { await stat(destination); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
        await copyFile(path.join(staging, asset.relative), destination);
      }
    }

    // Preserve a pre-restore PPF before the single canonical project replacement.
    const destinationProject = path.join(projectsDirectory(), validated.projectFileName);
    try {
      await stat(destinationProject);
      await mkdir(restorePreimageDirectory(), { recursive: true, mode: 0o700 });
      const preimage = `${validated.projectFileName.replace(/\.ppf$/i, "")}-${new Date().toISOString().replace(/[:.]/g, "-")}.ppf`;
      await copyFile(destinationProject, path.join(restorePreimageDirectory(), preimage));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await atomicWrite(destinationProject, validated.projectSource);
    return {
      restored: true,
      projectFileName: validated.projectFileName,
      assetsRestored: validated.assets.length,
      restoredAt: new Date().toISOString(),
      sourceBackup: fileName,
      originalFilesystemPathRequired: false,
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function status() {
  const [automatic, manual] = await Promise.all([entriesFor("automatic"), entriesFor("manual")]);
  const automaticBytes = automatic.reduce((sum, entry) => sum + entry.bytes, 0);
  const manualBytes = manual.reduce((sum, entry) => sum + entry.bytes, 0);
  const latest = [...automatic, ...manual].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
  return {
    automatic: { count: automatic.length, bytes: automaticBytes, maxCount: AUTOMATIC_MAX_COUNT, maxBytes: AUTOMATIC_MAX_BYTES },
    manual: { count: manual.length, bytes: manualBytes, retention: "kept-until-user-deletes" },
    approximateBytes: automaticBytes + manualBytes,
    lastSuccessfulBackupAt: latest?.createdAt || "",
    lastSuccessfulBackupFile: latest?.fileName || "",
    ordinaryBackupContainsSecrets: false,
    studioIdentityRecovery: "separate-explicit-encrypted-flow-not-in-ordinary-backup",
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, { ok: true, ...(await status()) });
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/library`) {
    const [automatic, manual] = await Promise.all([entriesFor("automatic"), entriesFor("manual")]);
    sendJson(response, 200, { ok: true, backups: [...manual, ...automatic].sort((left, right) => right.createdAt.localeCompare(left.createdAt)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/create`) {
    const body = await readBody(request);
    const kind: BackupKind = body.kind === "automatic" ? "automatic" : "manual";
    const projectFileName = safeProjectFileName(body.projectFileName);
    sendJson(response, 200, { ok: true, ...(await createBackup(projectFileName, kind)), status: await status() });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/restore`) {
    const body = await readBody(request);
    const kind: BackupKind = body.kind === "automatic" ? "automatic" : "manual";
    const fileName = safeBackupFileName(body.fileName);
    sendJson(response, 200, { ok: true, ...(await restoreBackup(kind, fileName)) });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/manual`) {
    const body = await readBody(request);
    const fileName = safeBackupFileName(body.fileName);
    await rm(path.join(backupDirectory("manual"), fileName), { force: true });
    sendJson(response, 200, { ok: true, deleted: fileName, status: await status() });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Local backup operation not found." });
}

export function localBackupGateway(): Plugin {
  return {
    name: "plotpickle-local-backup-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const raw = request.url;
        if (!raw) { next(); return; }
        const url = new URL(raw, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Backup and restore are available only inside this local PlotPickle Studio." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          const message = error instanceof Error ? error.message : "The local backup operation failed.";
          sendJson(response, 400, { ok: false, message: message.replace(/(?:sk|gh|nsec)[A-Za-z0-9_-]{8,}/gi, "[redacted]") });
        });
      });
    },
  };
}
