import { normalizePlotPickleProject, type PlotPickleProject } from "./project";

export const BUILD_RECOVERY_STORAGE_PREFIX = "plotpickle.build-recovery.v1:";

export type BuildRecoverySnapshot = {
  version: 1;
  reason: "block-move" | "mini-block-move" | "undo" | "redo";
  savedAt: string;
  project: PlotPickleProject;
};

export function captureArrangementRecovery(
  project: PlotPickleProject,
  reason: BuildRecoverySnapshot["reason"],
) {
  if (typeof window === "undefined") return false;
  try {
    const snapshot: BuildRecoverySnapshot = {
      version: 1,
      reason,
      savedAt: new Date().toISOString(),
      project,
    };
    window.localStorage.setItem(`${BUILD_RECOVERY_STORAGE_PREFIX}${project.id}`, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadArrangementRecovery(projectId: string): BuildRecoverySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${BUILD_RECOVERY_STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<BuildRecoverySnapshot>;
    if (candidate.version !== 1 || !candidate.project || candidate.project.id !== projectId) return null;
    const project = normalizePlotPickleProject(candidate.project);
    if (!project) return null;
    return {
      version: 1,
      reason: candidate.reason || "mini-block-move",
      savedAt: candidate.savedAt || "",
      project,
    };
  } catch {
    return null;
  }
}
