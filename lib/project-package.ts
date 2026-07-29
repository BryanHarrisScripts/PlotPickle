import { cloneProject, normalizePlotPickleProject, type PlotPickleProject } from "./project";
import {
  migrateLegacyAssetReferences,
  portableAssetManifestEntries,
  projectAssetSourceRisk,
  projectAssetSourceRisks,
} from "./project-assets";

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

function assertPortableAssetSources(project: PlotPickleProject) {
  const risks = projectAssetSourceRisks(project.assets);
  if (!risks.length) return;
  const kinds = [...new Set(risks.map((risk) => risk.type))].join(" and ");
  throw new Error(`Portable project assets contain ${kinds} sources. Relink them through project-relative assets before export or import.`);
}

function assertPortableManifestSources(assets: PortableAssetManifestEntry[]) {
  const kinds = new Set<"machine-path" | "credential">();
  for (const asset of assets) {
    const source = typeof asset.source === "string" ? asset.source : "";
    const path = typeof asset.path === "string" ? asset.path : "";
    const risk = projectAssetSourceRisk(source) || projectAssetSourceRisk(path);
    if (risk) kinds.add(risk);
  }
  if (!kinds.size) return;
  throw new Error(`Portable asset manifest contains ${[...kinds].join(" and ")} sources. Relink them through project-relative assets before export or import.`);
}

export function createPortableProjectFile(
  project: PlotPickleProject,
  applicationVersion = "1.0.0-rc.3",
  assets: PortableAssetManifestEntry[] = [],
  createdAt = new Date().toISOString(),
): PortablePlotPickleFile {
  const canonical = normalizePlotPickleProject(project)
    ?? migrateLegacyAssetReferences(cloneProject(project));
  assertPortableAssetSources(canonical);
  const assetManifest = assets.length ? assets : portableAssetManifestEntries(canonical);
  assertPortableManifestSources(assetManifest);
  return {
    format: PPF_FORMAT,
    formatVersion: PPF_FORMAT_VERSION,
    createdAt,
    applicationVersion,
    project: canonical,
    assets: assetManifest.map((asset) => ({ ...asset })),
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
  assertPortableAssetSources(normalized);
  const assetManifest = Array.isArray(candidate.assets)
    ? candidate.assets.filter((item): item is PortableAssetManifestEntry => Boolean(item && typeof item === "object"))
    : [];
  assertPortableManifestSources(assetManifest);
  const expectedHash = candidate.integrity?.projectHash;
  const sourceHash = candidate.project && typeof candidate.project === "object"
    ? portableProjectHash(candidate.project as PlotPickleProject)
    : "";
  const actualHash = portableProjectHash(normalized);
  const file: PortablePlotPickleFile = {
    format: PPF_FORMAT,
    formatVersion: PPF_FORMAT_VERSION,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    applicationVersion: typeof candidate.applicationVersion === "string" ? candidate.applicationVersion : "unknown",
    project: normalized,
    assets: assetManifest,
    integrity: { algorithm: "fnv1a-32", projectHash: actualHash },
  };
  return { file, project: normalized, integrityValid: expectedHash === actualHash || expectedHash === sourceHash };
}
