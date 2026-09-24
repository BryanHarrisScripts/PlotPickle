import { PPF_FOUNDATION_VERSION } from "../../core/project/project";
import { normalizeLibraryProject, type LibraryPPFProject } from "../../core/storage/library-project";

export function libraryBackupFileName(title: string) {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "untitled-story";
  return `${stem}.ppf.json`;
}

export function serializeLibraryBackup(project: LibraryPPFProject) {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseLibraryBackup(text: string): LibraryPPFProject {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This is not a PlotPickle Library backup.");
  const source = value as Record<string, unknown>;
  if (source.format !== PPF_FOUNDATION_VERSION || typeof source.id !== "string" || !source.id.trim()
    || typeof source.title !== "string" || !source.title.trim()
    || !source.structure || typeof source.structure !== "object" || Array.isArray(source.structure)
    || !source.foundations || typeof source.foundations !== "object" || Array.isArray(source.foundations)
    || !source.world || typeof source.world !== "object" || Array.isArray(source.world)
    || !source.build || typeof source.build !== "object" || Array.isArray(source.build)) {
    throw new Error("This is not a supported PlotPickle Library .ppf.json backup.");
  }
  return normalizeLibraryProject(value);
}
