import { createHash } from "node:crypto";
import {
  createPortableProjectFile,
  portableProjectFileName,
  serializePortableProjectFile,
} from "./project-package";
import {
  createProjectFolder,
  parseProjectFolder,
  PROJECT_FOLDER_FORMAT,
  PROJECT_FOLDER_VERSION,
  type ProjectFolderFiles,
} from "./project-folder";
import type { PlotPickleProject } from "./project";

export const DEFAULT_GITHUB_PROJECT_ROOT = "project" as const;
export const GITHUB_SYNC_INVENTORY_VERSION = 1 as const;

export type ProjectSyncFile = {
  path: string;
  content: string;
  sha256: string;
  bytes: number;
  kind: "json" | "text";
};

export type ProjectSyncInventory = {
  version: typeof GITHUB_SYNC_INVENTORY_VERSION;
  projectRoot: string;
  generatedAt: string;
  files: ProjectSyncFile[];
  manifestSha256: string;
};

export type ProjectSyncDiff = {
  create: ProjectSyncFile[];
  update: ProjectSyncFile[];
  delete: ProjectSyncFile[];
  unchanged: ProjectSyncFile[];
  changedCount: number;
};

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, sortedValue(child)]));
}

export function deterministicJson(value: unknown) {
  return `${JSON.stringify(sortedValue(value), null, 2)}\n`;
}

export function deterministicText(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n");
  return normalized && !normalized.endsWith("\n") ? `${normalized}\n` : normalized;
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeProjectRoot(value: string | undefined) {
  const candidate = (value || DEFAULT_GITHUB_PROJECT_ROOT).trim().replace(/^\/+|\/+$/g, "");
  const parts = candidate.split("/");
  if (!candidate || candidate.length > 200 || parts.some((part) => !part || part === "." || part === ".." || /[\\\u0000-\u001f]/.test(part))) {
    throw new Error("The canonical project root must be a safe repository folder path.");
  }
  return candidate;
}

function syncFile(filePath: string, value: unknown): ProjectSyncFile {
  const kind = typeof value === "string" ? "text" as const : "json" as const;
  const content = kind === "text" ? deterministicText(value as string) : deterministicJson(value);
  return {
    path: filePath,
    content,
    sha256: sha256Text(content),
    bytes: Buffer.byteLength(content, "utf8"),
    kind,
  };
}

export function createProjectSyncInventory(
  project: PlotPickleProject,
  projectRoot = DEFAULT_GITHUB_PROJECT_ROOT,
  generatedAt = new Date().toISOString(),
): ProjectSyncInventory {
  const root = safeProjectRoot(projectRoot);
  const folder = createProjectFolder(project);
  const files = Object.entries(folder.files)
    .map(([relativePath, value]) => syncFile(`${root}/${relativePath}`, value))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifestPath = `${root}/manifest.json`;
  const manifest = files.find((file) => file.path === manifestPath);
  if (!manifest) throw new Error("The canonical PlotPickle project folder is missing its manifest.");
  return {
    version: GITHUB_SYNC_INVENTORY_VERSION,
    projectRoot: root,
    generatedAt,
    files,
    manifestSha256: manifest.sha256,
  };
}

export function inventoryFromContents(
  contents: Record<string, string>,
  projectRoot = DEFAULT_GITHUB_PROJECT_ROOT,
  generatedAt = new Date().toISOString(),
): ProjectSyncInventory {
  const root = safeProjectRoot(projectRoot);
  const prefix = `${root}/`;
  const files = Object.entries(contents)
    .filter(([filePath]) => filePath.startsWith(prefix))
    .map(([filePath, content]) => syncFile(filePath, content))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = files.find((file) => file.path === `${root}/manifest.json`);
  return {
    version: GITHUB_SYNC_INVENTORY_VERSION,
    projectRoot: root,
    generatedAt,
    files,
    manifestSha256: manifest?.sha256 || "",
  };
}

export function diffProjectSyncInventories(local: ProjectSyncInventory, remote: ProjectSyncInventory): ProjectSyncDiff {
  if (safeProjectRoot(local.projectRoot) !== safeProjectRoot(remote.projectRoot)) {
    throw new Error("Local and remote inventories use different canonical project roots.");
  }
  const localByPath = new Map(local.files.map((file) => [file.path, file]));
  const remoteByPath = new Map(remote.files.map((file) => [file.path, file]));
  const create: ProjectSyncFile[] = [];
  const update: ProjectSyncFile[] = [];
  const remove: ProjectSyncFile[] = [];
  const unchanged: ProjectSyncFile[] = [];

  for (const file of local.files) {
    const existing = remoteByPath.get(file.path);
    if (!existing) create.push(file);
    else if (existing.sha256 !== file.sha256) update.push(file);
    else unchanged.push(file);
  }
  for (const file of remote.files) {
    if (!localByPath.has(file.path)) remove.push(file);
  }
  return {
    create,
    update,
    delete: remove,
    unchanged,
    changedCount: create.length + update.length + remove.length,
  };
}

export function parseProjectSyncContents(contents: Record<string, string>, projectRoot = DEFAULT_GITHUB_PROJECT_ROOT) {
  const root = safeProjectRoot(projectRoot);
  const prefix = `${root}/`;
  const files: ProjectFolderFiles = {};
  for (const [filePath, content] of Object.entries(contents)) {
    if (!filePath.startsWith(prefix)) continue;
    const relativePath = filePath.slice(prefix.length);
    if (!relativePath || relativePath.split("/").some((part) => !part || part === "." || part === "..")) continue;
    files[relativePath] = relativePath.endsWith(".json") ? JSON.parse(content) : deterministicText(content);
  }
  const manifest = files["manifest.json"] as Record<string, unknown> | undefined;
  if (!manifest || manifest.format !== PROJECT_FOLDER_FORMAT) {
    throw new Error("The approved repository does not contain a canonical PlotPickle project folder.");
  }
  if (manifest.formatVersion !== PROJECT_FOLDER_VERSION) {
    throw new Error(`The approved project folder uses format ${String(manifest.formatVersion || "unknown")}. Upgrade or migrate it before synchronization.`);
  }
  return parseProjectFolder(files);
}

export function safeManagedDeletionPath(filePath: string, projectRoot = DEFAULT_GITHUB_PROJECT_ROOT) {
  const root = safeProjectRoot(projectRoot);
  return filePath.startsWith(`${root}/`)
    && !filePath.slice(root.length + 1).split("/").some((part) => !part || part === "." || part === "..");
}

function releaseStem(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "plotpickle-story";
}

export function createPortableReleaseSnapshot(project: PlotPickleProject, timestamp = new Date().toISOString()) {
  const stamp = timestamp.replace(/[-:.TZ]/g, "").slice(0, 14);
  const portable = createPortableProjectFile(project);
  const content = serializePortableProjectFile(portable);
  return {
    path: `exports/releases/${releaseStem(project.metadata.title)}-${stamp}.ppf`,
    fileName: portableProjectFileName(project),
    content,
    sha256: sha256Text(content),
    bytes: Buffer.byteLength(content, "utf8"),
  };
}
