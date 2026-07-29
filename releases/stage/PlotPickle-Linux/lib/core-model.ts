import { cloneProject, normalizePlotPickleProject, type PlotPickleProject, type RevisionSnapshot, type StoryThread } from "./project";

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(value: unknown) {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createStoryThread(project: PlotPickleProject): PlotPickleProject {
  const now = new Date().toISOString();
  const thread: StoryThread = {
    id: id("thread"), name: "New Story Thread", kind: "subplot", status: "planned", summary: "", question: "",
    characterIds: [], sceneIds: [], introducedBlockNumber: null, resolvedBlockNumber: null, milestones: [], notes: "", createdAt: now, updatedAt: now,
  };
  return { ...project, storyThreads: [...project.storyThreads, thread] };
}

export function synchronizeThreadSceneLinks(project: PlotPickleProject): PlotPickleProject {
  const validThreadIds = new Set(project.storyThreads.map((thread) => thread.id));
  const sceneToThreads = new Map<string, string[]>();
  for (const thread of project.storyThreads) {
    for (const sceneId of thread.sceneIds) sceneToThreads.set(sceneId, [...new Set([...(sceneToThreads.get(sceneId) ?? []), thread.id])]);
  }
  return {
    ...project,
    blocks: project.blocks.map((block) => ({
      ...block,
      scenes: block.scenes.map((scene) => ({ ...scene, threadIds: [...new Set([...(scene.threadIds ?? []).filter((threadId) => validThreadIds.has(threadId)), ...(sceneToThreads.get(scene.id) ?? [])])] })),
    })),
  };
}

export function createRevisionSnapshot(project: PlotPickleProject, label: string, notes = ""): PlotPickleProject {
  const payload = cloneProject({ ...project, revisions: [] }) as unknown as Record<string, unknown>;
  const snapshot: RevisionSnapshot = {
    id: id("revision"), label: label.trim() || `Revision ${project.revisions.length + 1}`, notes: notes.trim(),
    createdAt: new Date().toISOString(), schemaVersion: "1.7.0", contentHash: contentHash(payload), payload,
  };
  return { ...project, revisions: [...project.revisions, snapshot] };
}

export function restoreRevisionSnapshot(project: PlotPickleProject, snapshot: RevisionSnapshot): PlotPickleProject {
  const normalized = normalizePlotPickleProject({ ...snapshot.payload, revisions: project.revisions });
  return normalized ?? project;
}

export function compareRevisionSnapshots(left?: RevisionSnapshot, right?: RevisionSnapshot) {
  if (!left || !right) return "Select two revision snapshots to compare.";
  if (left.contentHash === right.contentHash) return "The selected snapshots contain the same canonical project content.";
  const leftPayload = left.payload as Record<string, unknown>;
  const rightPayload = right.payload as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(leftPayload), ...Object.keys(rightPayload)])].filter((key) => stableStringify(leftPayload[key]) !== stableStringify(rightPayload[key]));
  return `Changed project areas: ${changed.join(", ") || "content hash only"}.`;
}
