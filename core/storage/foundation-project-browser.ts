import { FOUNDATION_PROJECT_STORAGE_KEY } from "../contracts/foundation-plan";
import {
  createEmptyProject,
  normalizeFoundationProject,
  type PPFProject,
} from "../project/project";

function newProjectId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadFoundationProject(): PPFProject {
  try {
    const saved = localStorage.getItem(FOUNDATION_PROJECT_STORAGE_KEY);
    if (saved) return normalizeFoundationProject(JSON.parse(saved));
  } catch {
    // Keep browser recovery local and non-destructive. A clean in-memory
    // project replaces only an unreadable cache when it is explicitly saved.
  }
  return createEmptyProject({
    id: newProjectId(),
    now: new Date().toISOString(),
  });
}

export function saveFoundationProject(project: PPFProject) {
  localStorage.setItem(FOUNDATION_PROJECT_STORAGE_KEY, JSON.stringify(project));
}
