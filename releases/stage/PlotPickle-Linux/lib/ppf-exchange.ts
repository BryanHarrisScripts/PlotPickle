import { createHash } from "node:crypto";
import { createProjectFolder, parseProjectFolder, type ProjectFolderFiles } from "./project-folder";
import type { PlotPickleProject } from "./project";

export const PPF_EXCHANGE_FORMAT = "plotpickle-exchange" as const;
export const PPF_EXCHANGE_VERSION = 1 as const;
export type PackageKind = "complete-project" | "screenplay" | "dialogue" | "character" | "production-breakdown" | "structural-analysis" | "reference-only" | "template";
export type ExchangeScope = "project" | "story" | "world" | "characters" | "voiceprints" | "screenplay" | "blocks" | "storyboard" | "production" | "research" | "canon" | "reports" | "review" | "collaboration" | "dependencies";

export type ExchangeManifest = {
  format: typeof PPF_EXCHANGE_FORMAT;
  packageVersion: typeof PPF_EXCHANGE_VERSION;
  packageKind: PackageKind;
  projectId: string;
  projectName: string;
  projectFormatVersion: string;
  createdAt: string;
  createdWith: string;
  scopes: ExchangeScope[];
  rightsConfirmed: boolean;
  gitIncluded: false;
  files: Array<{ path: string; sha256: string; bytes: number }>;
};

const scopePrefixes: Record<ExchangeScope, string[]> = {
  project: ["manifest.json", "project/"], story: ["story/"], world: ["world/"], characters: ["characters/"], voiceprints: ["voiceprints/"], screenplay: ["screenplay/"], blocks: ["24-blocks/", "96-blocks/"], storyboard: ["storyboard/"], production: ["production/"], research: ["research/"], canon: ["canon/"], reports: ["reports/"], review: ["review/"], collaboration: ["collaboration/"], dependencies: ["dependencies/"],
};

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function sha256(buffer: Buffer) { return createHash("sha256").update(buffer).digest("hex"); }
function encode(value: unknown, path: string) { return Buffer.from(typeof value === "string" && !path.endsWith(".json") ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function selected(path: string, scopes: ExchangeScope[]) { return scopes.some((scope) => scopePrefixes[scope].some((prefix) => path === prefix || path.startsWith(prefix))); }
function safePath(path: string) { return path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes(".."); }

export function createStoreZip(entries: Record<string, Buffer>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    if (!safePath(name)) throw new Error(`Unsafe package path: ${name}`);
    const filename = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function readStoreZip(buffer: Buffer) {
  const files: Record<string, Buffer> = {};
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    if (method !== 0) throw new Error("This .ppf uses unsupported ZIP compression. Re-export it from PlotPickle.");
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if (!safePath(name)) throw new Error("The .ppf contains an unsafe path.");
    const dataStart = nameStart + nameLength + extraLength;
    files[name] = buffer.subarray(dataStart, dataStart + size);
    offset = dataStart + size;
  }
  return files;
}

export function packageProject(project: PlotPickleProject, options: { kind?: PackageKind; scopes?: ExchangeScope[]; rightsConfirmed?: boolean; createdAt?: string; applicationVersion?: string } = {}) {
  const kind = options.kind ?? "complete-project";
  const scopes = options.scopes ?? Object.keys(scopePrefixes) as ExchangeScope[];
  const { files, manifest } = createProjectFolder(project, options.applicationVersion);
  const entries: Record<string, Buffer> = {};
  for (const [path, value] of Object.entries(files)) if (selected(path, scopes)) entries[path] = encode(value, path);
  const exchange: ExchangeManifest = {
    format: PPF_EXCHANGE_FORMAT, packageVersion: PPF_EXCHANGE_VERSION, packageKind: kind, projectId: project.id, projectName: project.metadata.title,
    projectFormatVersion: manifest.formatVersion, createdAt: options.createdAt ?? new Date().toISOString(), createdWith: manifest.createdWith,
    scopes, rightsConfirmed: options.rightsConfirmed === true, gitIncluded: false,
    files: Object.entries(entries).map(([path, data]) => ({ path, sha256: sha256(data), bytes: data.length })),
  };
  entries["package.json"] = Buffer.from(`${JSON.stringify(exchange, null, 2)}\n`);
  return { buffer: createStoreZip(entries), manifest: exchange };
}

export function inspectPackage(buffer: Buffer) {
  const entries = readStoreZip(buffer);
  const packageEntry = entries["package.json"];
  if (!packageEntry) throw new Error("The .ppf package is missing package.json.");
  const manifest = JSON.parse(packageEntry.toString("utf8")) as ExchangeManifest;
  if (manifest.format !== PPF_EXCHANGE_FORMAT || manifest.packageVersion !== PPF_EXCHANGE_VERSION) throw new Error("Unsupported .ppf exchange version.");
  const errors: string[] = [];
  for (const file of manifest.files) {
    const data = entries[file.path];
    if (!data) errors.push(`Missing ${file.path}`);
    else if (data.length !== file.bytes || sha256(data) !== file.sha256) errors.push(`Checksum failed for ${file.path}`);
  }
  return { manifest, entries, valid: errors.length === 0, errors };
}

export function projectFromPackage(buffer: Buffer) {
  const inspected = inspectPackage(buffer);
  if (!inspected.valid) throw new Error(inspected.errors.join("; "));
  const files: ProjectFolderFiles = {};
  for (const [path, data] of Object.entries(inspected.entries)) {
    if (path === "package.json") continue;
    files[path] = path.endsWith(".json") ? JSON.parse(data.toString("utf8")) : data.toString("utf8");
  }
  if (!files["manifest.json"]) throw new Error("This selective package cannot be opened as a complete project. Import it into an existing project instead.");
  return { project: parseProjectFolder(files), manifest: inspected.manifest, files };
}
