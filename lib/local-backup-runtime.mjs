import { createHash } from "node:crypto";

export const LOCAL_BACKUP_FORMAT = "plotpickle-local-backup";
export const LOCAL_BACKUP_VERSION = 1;

const SAFE_PATH = /^[a-z0-9][a-z0-9._/-]{0,239}$/i;
const SECRET_KEY = /(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|credential|token|nsec)/i;
const SECRET_VALUE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bnsec1[a-z0-9]+|\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\bsk-[A-Za-z0-9_-]{12,})/i;
const HIDDEN_REASONING_KEY = /(?:chain[_ -]?of[_ -]?thought|hidden[_ -]?reasoning|scratchpad|internal[_ -]?reasoning)/i;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function cleanText(value, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function safePath(value) {
  const path = cleanText(value, 240);
  if (!SAFE_PATH.test(path) || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Unsafe backup entry path: ${path || "(empty)"}`);
  }
  return path;
}

export function sanitizeBackupJson(value, depth = 0) {
  if (depth > 8) return "[truncated]";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "[redacted]" : value.slice(0, 32_000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 512).map((item) => sanitizeBackupJson(item, depth + 1));
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !HIDDEN_REASONING_KEY.test(key))
    .slice(0, 512)
    .map(([key, child]) => [key, SECRET_KEY.test(key) ? "[redacted]" : sanitizeBackupJson(child, depth + 1)]));
}

function normalizedEntry(path, value) {
  const name = safePath(path);
  const buffer = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(String(value), "utf8");
  return {
    path: name,
    bytes: buffer.length,
    sha256: sha256(buffer),
    data: buffer.toString("base64"),
  };
}

function manifestHash(manifest, entries) {
  const source = JSON.stringify({
    ...manifest,
    archiveSha256: "",
    files: entries.map(({ path, bytes, sha256: hash }) => ({ path, bytes, sha256: hash })),
  });
  return sha256(Buffer.from(source, "utf8"));
}

export function createLocalBackupArchive(input) {
  const entries = Object.entries(input.entries || {}).map(([path, value]) => normalizedEntry(path, value));
  if (!entries.some((entry) => entry.path === "project.ppf")) throw new Error("A complete PlotPickle backup requires project.ppf.");
  const createdAt = input.createdAt || new Date().toISOString();
  const manifest = {
    format: LOCAL_BACKUP_FORMAT,
    formatVersion: LOCAL_BACKUP_VERSION,
    backupId: cleanText(input.backupId || `backup-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`, 160),
    projectId: cleanText(input.projectId, 180),
    projectTitle: cleanText(input.projectTitle, 240),
    projectRevision: Math.max(1, Math.floor(Number(input.projectRevision) || 1)),
    createdAt,
    sourceAppVersion: cleanText(input.sourceAppVersion || "unknown", 120),
    includes: [...new Set((input.includes || []).map((item) => cleanText(item, 120)).filter(Boolean))],
    exclusions: [...new Set((input.exclusions || []).map((item) => cleanText(item, 200)).filter(Boolean))],
    files: entries.map(({ path, bytes, sha256: hash }) => ({ path, bytes, sha256: hash })),
    archiveSha256: "",
  };
  if (!manifest.projectId) throw new Error("Backup project ID is required.");
  manifest.archiveSha256 = manifestHash(manifest, entries);
  return Buffer.from(`${JSON.stringify({ manifest, entries }, null, 2)}\n`, "utf8");
}

export function inspectLocalBackupArchive(buffer) {
  let parsed;
  try { parsed = JSON.parse(Buffer.from(buffer).toString("utf8")); } catch { throw new Error("The PlotPickle backup is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The PlotPickle backup envelope is invalid.");
  const manifest = parsed.manifest;
  if (!manifest || manifest.format !== LOCAL_BACKUP_FORMAT) throw new Error("This is not a PlotPickle local backup.");
  if (manifest.formatVersion !== LOCAL_BACKUP_VERSION) throw new Error(`Unsupported PlotPickle backup version ${manifest.formatVersion}.`);
  if (!Array.isArray(parsed.entries) || !Array.isArray(manifest.files)) throw new Error("The PlotPickle backup file table is missing.");
  const entries = {};
  const errors = [];
  for (const record of parsed.entries) {
    try {
      const path = safePath(record.path);
      const data = Buffer.from(String(record.data || ""), "base64");
      const listed = manifest.files.find((file) => file.path === path);
      if (!listed) { errors.push(`Manifest is missing ${path}.`); continue; }
      if (listed.bytes !== data.length || listed.sha256 !== sha256(data)) { errors.push(`Checksum failed for ${path}.`); continue; }
      entries[path] = data;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid backup entry.");
    }
  }
  for (const file of manifest.files) if (!Object.hasOwn(entries, file.path)) errors.push(`Backup is missing ${file.path}.`);
  if (manifest.archiveSha256 !== manifestHash(manifest, parsed.entries)) errors.push("Backup manifest checksum failed.");
  if (!entries["project.ppf"]) errors.push("Backup is missing project.ppf.");
  return { valid: errors.length === 0, errors: [...new Set(errors)], manifest, entries };
}

export function restoreLocalBackupArchive(buffer) {
  const inspected = inspectLocalBackupArchive(buffer);
  if (!inspected.valid) throw new Error(inspected.errors.join("; "));
  return {
    manifest: inspected.manifest,
    entries: inspected.entries,
    requiresExplicitApply: true,
    overwritePerformed: false,
  };
}
