import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { normalizePlotPickleProject } from "../lib/project";
import {
  createCompleteLocalBackup,
  inspectCompleteLocalBackup,
  previewCompleteLocalBackupRestore,
  type LocalBackupEvidenceRecord,
} from "../lib/local-backup";
import {
  DEFAULT_RETENTION_POLICY,
  planRetention,
  retentionStorageSummary,
  type RetentionKind,
  type RetentionRecord,
} from "../lib/retention-policy";
import { persistentHome } from "./local-credentials";

const API = "/api/local-backups";
const MAX_BODY = 40 * 1024 * 1024;
const MAX_BACKUP_BYTES = 250 * 1024 * 1024;
const SAFE_FILE = /^[a-z0-9][a-z0-9._:-]{1,220}$/i;
const SAFE_BACKUP = /^[a-z0-9][a-z0-9._:-]{1,210}\.ppbackup$/i;

function archiveRoot() { return path.join(persistentHome(), "backup-archives"); }
function runRoot() { return path.join(persistentHome(), "responsibility-runs"); }
function verificationRoot() { return path.join(persistentHome(), "verification-inbox", "records"); }
function logRoot() { return path.join(persistentHome(), "full-verification"); }
function pinFile() { return path.join(persistentHome(), "retention-pins.json"); }

function isLocalRequest(request: IncomingMessage) {
  const address = request.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
  const host = request.headers.host || "";
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch { return false; }
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
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The local backup request is too large.");
    chunks.push(bytes);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid local backup request.");
  return value as Record<string, unknown>;
}

async function atomicWrite(filePath: string, data: Buffer | string) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, filePath);
  try { await chmod(filePath, 0o600); } catch { /* Windows uses account ACLs. */ }
}

function safeBackupName(value: unknown) {
  const name = typeof value === "string" ? value : "";
  if (!SAFE_BACKUP.test(name)) throw new Error("Choose a valid PlotPickle backup file.");
  return name;
}

function safeRecordId(value: unknown) {
  const id = typeof value === "string" ? value : "";
  if (!SAFE_FILE.test(id)) throw new Error("Choose a valid retention record.");
  return id;
}

function retentionKey(kind: RetentionKind, id: string) { return `${kind}:${id}`; }

async function readPins() {
  try {
    const value: unknown = JSON.parse(await readFile(pinFile(), "utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const pins = (value as { pins?: unknown }).pins;
      return new Set(Array.isArray(pins) ? pins.filter((item): item is string => typeof item === "string" && item.length < 320) : []);
    }
  } catch { /* no pins yet */ }
  return new Set<string>();
}

async function savePins(pins: Set<string>) {
  await atomicWrite(pinFile(), `${JSON.stringify({ version: 1, pins: [...pins].sort() }, null, 2)}\n`);
}

async function safeFiles(root: string, filter: (name: string) => boolean) {
  try {
    return (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isFile() && filter(entry.name)).map((entry) => entry.name);
  } catch { return []; }
}

async function retentionRecords() {
  const pins = await readPins();
  const definitions: Array<{ kind: RetentionKind; root: string; files: string[] }> = [
    { kind: "responsibility-run", root: runRoot(), files: await safeFiles(runRoot(), (name) => /^[A-Za-z0-9._:-]+\.json$/.test(name)) },
    { kind: "verification", root: verificationRoot(), files: await safeFiles(verificationRoot(), (name) => /^verification-[A-Za-z0-9._-]+\.json$/.test(name)) },
    { kind: "trace-log", root: logRoot(), files: await safeFiles(logRoot(), (name) => /^plotpickle-full-check-[A-Za-z0-9._-]+\.log$/.test(name)) },
    { kind: "backup", root: archiveRoot(), files: await safeFiles(archiveRoot(), (name) => SAFE_BACKUP.test(name)) },
  ];
  const records: RetentionRecord[] = [];
  for (const definition of definitions) {
    for (const file of definition.files) {
      const info = await stat(path.join(definition.root, file));
      records.push({
        id: file,
        kind: definition.kind,
        createdAt: info.mtime.toISOString(),
        bytes: info.size,
        pinned: pins.has(retentionKey(definition.kind, file)),
        exported: false,
      });
    }
  }
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function rootForKind(kind: RetentionKind) {
  if (kind === "responsibility-run") return runRoot();
  if (kind === "verification") return verificationRoot();
  if (kind === "trace-log") return logRoot();
  return archiveRoot();
}

async function evidenceRecords(input: { includeRuns: boolean; includeVerification: boolean; reports: unknown }) {
  const evidence: LocalBackupEvidenceRecord[] = [];
  if (input.includeRuns) {
    const names = (await safeFiles(runRoot(), (name) => /^[A-Za-z0-9._:-]+\.json$/.test(name))).slice(-50);
    for (const name of names) {
      try { evidence.push({ id: name.replace(/\.json$/i, ""), kind: "responsibility-run", value: JSON.parse(await readFile(path.join(runRoot(), name), "utf8")) }); } catch { /* skip invalid evidence */ }
    }
  }
  if (input.includeVerification) {
    const names = (await safeFiles(verificationRoot(), (name) => /^verification-[A-Za-z0-9._-]+\.json$/.test(name))).slice(-50);
    for (const name of names) {
      try { evidence.push({ id: name.replace(/\.json$/i, ""), kind: "verification", value: JSON.parse(await readFile(path.join(verificationRoot(), name), "utf8")) }); } catch { /* skip invalid evidence */ }
    }
  }
  if (Array.isArray(input.reports)) {
    for (const item of input.reports.slice(0, 20)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.replace(/[^a-z0-9._:-]/gi, "-").slice(0, 180) : "report";
      evidence.push({ id, kind: "report", value: record.value });
    }
  }
  return evidence;
}

async function createBackup(input: Record<string, unknown>) {
  const project = normalizePlotPickleProject(input.project);
  if (!project) throw new Error("The active project could not be normalized before backup.");
  const includeRuns = input.includeRuns === true;
  const includeVerification = input.includeVerification === true;
  const includeReports = Array.isArray(input.reports) && input.reports.length > 0;
  const evidence = await evidenceRecords({ includeRuns, includeVerification, reports: input.reports });
  const archive = createCompleteLocalBackup(project, {
    sourceAppVersion: "1.0.0-rc.3",
    includeRuns,
    includeVerification,
    includeReports,
    evidence,
  });
  if (archive.buffer.length > MAX_BACKUP_BYTES) throw new Error("The complete backup exceeds the 250 MB local archive limit. Export large media separately and retry.");
  await atomicWrite(path.join(archiveRoot(), archive.fileName), archive.buffer);
  return { fileName: archive.fileName, bytes: archive.buffer.length, evidenceCount: evidence.length };
}

async function backupList() {
  await mkdir(archiveRoot(), { recursive: true, mode: 0o700 });
  const names = await safeFiles(archiveRoot(), (name) => SAFE_BACKUP.test(name));
  const items = await Promise.all(names.map(async (name) => {
    const file = path.join(archiveRoot(), name);
    const info = await stat(file);
    try {
      const inspected = inspectCompleteLocalBackup(await readFile(file));
      return {
        fileName: name,
        bytes: info.size,
        createdAt: info.mtime.toISOString(),
        valid: inspected.valid,
        projectId: inspected.manifest?.projectId || "",
        title: inspected.manifest?.projectTitle || "",
        projectRevision: inspected.manifest?.projectRevision || 0,
        includes: inspected.manifest?.includes || [],
      };
    } catch {
      return { fileName: name, bytes: info.size, createdAt: info.mtime.toISOString(), valid: false, projectId: "", title: "", projectRevision: 0, includes: [] };
    }
  }));
  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function previewBackup(fileName: string) {
  const buffer = await readFile(path.join(archiveRoot(), safeBackupName(fileName)));
  const preview = previewCompleteLocalBackupRestore(buffer);
  return {
    fileName,
    projectId: preview.projectId,
    title: preview.projectTitle,
    projectRevision: preview.projectRevision,
    createdAt: preview.createdAt,
    sourceAppVersion: preview.sourceAppVersion,
    includedKinds: preview.includedKinds,
    evidenceCount: preview.evidence.length,
    requiresExplicitApply: true,
    overwritePerformed: false,
    warning: "Restoring will replace the active browser project only after explicit confirmation. Create a fresh backup of current work first if needed.",
  };
}

async function restoreBackup(fileName: string, confirmed: boolean) {
  if (!confirmed) throw new Error("Restore confirmation is required. Preview the backup first, then confirm replacement of the active browser project.");
  const buffer = await readFile(path.join(archiveRoot(), safeBackupName(fileName)));
  const restored = previewCompleteLocalBackupRestore(buffer);
  return {
    project: restored.project,
    projectId: restored.projectId,
    title: restored.projectTitle,
    projectRevision: restored.projectRevision,
    restoredFrom: fileName,
    explicitConfirmationReceived: true,
  };
}

async function pruneEvidence() {
  const records = await retentionRecords();
  const decisions = planRetention(records, DEFAULT_RETENTION_POLICY);
  const deletions = decisions.filter((record) => record.action === "delete");
  for (const record of deletions) await rm(path.join(rootForKind(record.kind), record.id), { force: true });
  return { deleted: deletions.map((record) => ({ id: record.id, kind: record.kind, reason: record.reason })), summary: retentionStorageSummary(await retentionRecords(), DEFAULT_RETENTION_POLICY) };
}

async function deleteRetentionRecord(kind: RetentionKind, id: string, confirmed: boolean) {
  if (!confirmed) throw new Error("Explicit delete confirmation is required.");
  const safeId = safeRecordId(id);
  const allowed = (await retentionRecords()).some((record) => record.kind === kind && record.id === safeId);
  if (!allowed) throw new Error("Retention record was not found in an approved evidence directory.");
  await rm(path.join(rootForKind(kind), safeId), { force: true });
  const pins = await readPins();
  pins.delete(retentionKey(kind, safeId));
  await savePins(pins);
  return { deleted: safeId, kind };
}

function validRetentionKind(value: unknown): RetentionKind {
  if (value === "responsibility-run" || value === "verification" || value === "trace-log" || value === "backup") return value;
  throw new Error("Choose a supported retention record type.");
}

async function pinRecord(kind: RetentionKind, id: string, pinned: boolean) {
  const safeId = safeRecordId(id);
  const allowed = (await retentionRecords()).some((record) => record.kind === kind && record.id === safeId);
  if (!allowed) throw new Error("Retention record was not found in an approved evidence directory.");
  const pins = await readPins();
  const key = retentionKey(kind, safeId);
  if (pinned) pins.add(key); else pins.delete(key);
  await savePins(pins);
  return { id: safeId, kind, pinned };
}

async function exportDiagnostics() {
  const records = await retentionRecords();
  const summary = retentionStorageSummary(records, DEFAULT_RETENTION_POLICY);
  return {
    format: "plotpickle-local-diagnostics",
    version: 1,
    generatedAt: new Date().toISOString(),
    storage: summary,
    records: records.map(({ id, kind, createdAt, bytes, pinned }) => ({ id, kind, createdAt, bytes, pinned })),
    privacy: "Diagnostics include local file metadata only. Project content, prompts, credentials, provider secrets, signing keys and BUZZ private data are excluded.",
  };
}

export function localBackupGateway(): Plugin {
  return {
    name: "plotpickle-local-backup-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
        if (url.pathname !== API) { next(); return; }
        if (!isLocalRequest(request)) { sendJson(response, 403, { ok: false, message: "Backups and retention are available only inside this local PlotPickle Studio." }); return; }
        void (async () => {
          if (request.method === "GET") {
            const action = url.searchParams.get("action") || "list";
            if (action === "list") { sendJson(response, 200, { ok: true, backups: await backupList() }); return; }
            if (action === "storage") {
              const records = await retentionRecords();
              sendJson(response, 200, { ok: true, policy: DEFAULT_RETENTION_POLICY, summary: retentionStorageSummary(records), records });
              return;
            }
            if (action === "diagnostics") { sendJson(response, 200, { ok: true, diagnostics: await exportDiagnostics() }); return; }
            if (action === "export") {
              const fileName = safeBackupName(url.searchParams.get("file"));
              const data = await readFile(path.join(archiveRoot(), fileName));
              response.statusCode = 200;
              response.setHeader("Content-Type", "application/vnd.plotpickle.backup+json");
              response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
              response.setHeader("Cache-Control", "no-store");
              response.setHeader("X-Content-Type-Options", "nosniff");
              response.end(data);
              return;
            }
            sendJson(response, 400, { ok: false, message: "Choose list, storage, diagnostics or export." });
            return;
          }
          if (request.method !== "POST") { sendJson(response, 405, { ok: false, message: "Use GET or POST for local backup controls." }); return; }
          const input = await readBody(request);
          const action = String(input.action || "");
          if (action === "create") { sendJson(response, 200, { ok: true, backup: await createBackup(input) }); return; }
          if (action === "preview-restore") { sendJson(response, 200, { ok: true, preview: await previewBackup(String(input.fileName || "")) }); return; }
          if (action === "restore") { sendJson(response, 200, { ok: true, restore: await restoreBackup(String(input.fileName || ""), input.confirm === true) }); return; }
          if (action === "prune") { sendJson(response, 200, { ok: true, ...(await pruneEvidence()) }); return; }
          if (action === "pin") { sendJson(response, 200, { ok: true, ...(await pinRecord(validRetentionKind(input.kind), String(input.id || ""), input.pinned === true)) }); return; }
          if (action === "delete") { sendJson(response, 200, { ok: true, ...(await deleteRetentionRecord(validRetentionKind(input.kind), String(input.id || ""), input.confirm === true)) }); return; }
          sendJson(response, 400, { ok: false, message: "Choose create, preview-restore, restore, prune, pin or delete." });
        })().catch((error) => sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "Local backup operation failed." }));
      });
    },
  };
}
