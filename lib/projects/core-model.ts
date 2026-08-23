import { cloneProject, normalizePlotPickleProject, type PlotPickleProject, type RevisionSnapshot, type StoryThread } from "./project";
import { projectContentFingerprint } from "./persistence/project-fingerprints";

let fallbackIdCounter = 0;

function id(prefix: string) {
  const cryptoApi = globalThis.crypto;
  const uuid = cryptoApi?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(4);
    cryptoApi.getRandomValues(words);
    return `${prefix}-${Array.from(words, (word) => word.toString(36)).join("-")}`;
  }
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

const contentHash = projectContentFingerprint;

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
