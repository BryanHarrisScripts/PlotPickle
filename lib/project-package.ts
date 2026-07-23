import { cloneProject, normalizePlotPickleProject, type PlotPickleProject } from "./project";

export const PPF_FORMAT = "plotpickle-project-file" as const;
export const PPF_FORMAT_VERSION = 1 as const;

export type PortableAssetManifestEntry = {
  id: string;
  path: string;
  mediaType: string;
  sha256: string;
  bytes: number;
  source: string;
};

export type PortablePlotPickleFile = {
  format: typeof PPF_FORMAT;
  formatVersion: typeof PPF_FORMAT_VERSION;
  createdAt: string;
  applicationVersion: string;
  project: PlotPickleProject;
  assets: PortableAssetManifestEntry[];
  integrity: {
    algorithm: "fnv1a-32";
    projectHash: string;
  };
};

export type PortableProjectReadResult = {
  file: PortablePlotPickleFile;
  project: PlotPickleProject;
  integrityValid: boolean;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function portableProjectHash(project: PlotPickleProject) {
  const source = stableStringify(project);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function portableProjectFileName(project: PlotPickleProject) {
  const stem = project.metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled-story";
  return `${stem}.ppf`;
}

export function createPortableProjectFile(
  project: PlotPickleProject,
  applicationVersion = "1.0.0-rc.2",
  assets: PortableAssetManifestEntry[] = [],
  createdAt = new Date().toISOString(),
): PortablePlotPickleFile {
  const canonical = cloneProject(project);
  return {
    format: PPF_FORMAT,
    formatVersion: PPF_FORMAT_VERSION,
    createdAt,
    applicationVersion,
    project: canonical,
    assets: assets.map((asset) => ({ ...asset })),
    integrity: {
      algorithm: "fnv1a-32",
      projectHash: portableProjectHash(canonical),
    },
  };
}

export function serializePortableProjectFile(file: PortablePlotPickleFile) {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parsePortableProjectFile(input: string | unknown): PortableProjectReadResult {
  const raw: unknown = typeof input === "string" ? JSON.parse(input) : input;
  if (!raw || typeof raw !== "object") throw new Error("The .ppf file is not a JSON object.");
  const candidate = raw as Partial<PortablePlotPickleFile>;
  if (candidate.format !== PPF_FORMAT || candidate.formatVersion !== PPF_FORMAT_VERSION) {
    throw new Error("This is not a supported PlotPickle Project File.");
  }
  const normalized = normalizePlotPickleProject(candidate.project);
  if (!normalized) throw new Error("The story inside this .ppf file could not be migrated to the current schema.");
  const expectedHash = candidate.integrity?.projectHash;
  const actualHash = portableProjectHash(normalized);
  const file: PortablePlotPickleFile = {
    format: PPF_FORMAT,
    formatVersion: PPF_FORMAT_VERSION,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    applicationVersion: typeof candidate.applicationVersion === "string" ? candidate.applicationVersion : "unknown",
    project: normalized,
    assets: Array.isArray(candidate.assets)
      ? candidate.assets.filter((item): item is PortableAssetManifestEntry => Boolean(item && typeof item === "object"))
      : [],
    integrity: { algorithm: "fnv1a-32", projectHash: actualHash },
  };
  return { file, project: normalized, integrityValid: expectedHash === actualHash };
}
