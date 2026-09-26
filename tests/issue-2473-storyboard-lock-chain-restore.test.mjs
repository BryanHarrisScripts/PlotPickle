import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  archiveProfileProject,
  hydrateProfileProjectLibrary,
  initializeProfileProjectLibrary,
  readProfileProjectSnapshot,
} from "../core/storage/project-library-core.mjs";

const NOW = "2026-09-26T13:00:00.000Z";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

function project(id) {
  return {
    id,
    title: "Afterglow",
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    build: {
      foundations: { visualArtifacts: [], acceptedVisualArtifactIds: [] },
      world: { visualArtifacts: [], acceptedVisualArtifactIds: [] },
    },
  };
}

function harness(storage) {
  return {
    storage,
    profileId: "profile-bryan",
    normalizeProject: (value) => structuredClone(value),
    createProject: ({ id, now, title }) => project(id || title || now),
    describeProject: () => ({ progress: 0, frontier: "Storyboard", thumbnail: "" }),
    now: () => NOW,
    idFactory: () => "generated-project",
  };
}

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2473 keeps archived saved Library snapshots readable without switching the active story", () => {
  const storage = new MemoryStorage();
  const input = harness(storage);
  const prior = project("prior-recovered-working-copy");
  const current = project("fresh-afterglow-working-copy");

  hydrateProfileProjectLibrary({
    ...input,
    activeProjectId: current.id,
    projects: [{ project: prior }, { project: current }],
  });
  archiveProfileProject({ ...input, projectId: prior.id });

  const snapshot = readProfileProjectSnapshot({ ...input, projectId: prior.id });
  assert.equal(snapshot?.id, prior.id);
  assert.equal(initializeProfileProjectLibrary(input).activeProject?.id, current.id);
});

test("#2473 accepts proof from direct origin or an exact recovered-working-copy provenance chain", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");

  assert.match(source, /sourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).id === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).originProjectId/u);
  assert.match(source, /recovery-origin-project:candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)$candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\){resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).originProjectIdcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)}/u);
  assert.match(source, /recovery-content-hash:candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)$candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\){resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).contentHashcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)}/u);
  assert.match(source, /directOrigin candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)|candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)| candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(decisionKeyscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).includescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(originKeycandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)) && decisionKeyscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).includescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(contentHashKeycandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).assetUrl === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).assetUrl/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).workflow === "storyboard-frame-webp-v2"/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).frameNumber === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).position/u);
  assert.match(source, /decisionKeyscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).includescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(anchorKeycandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).reviewState !== "rejected"/u);
  assert.match(source, /candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)|candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)|candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)/u);
});

test("#2473 records the saved approval project and artifact on a newly recovered locked frame", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");

  assert.match(source, /priorApprovalcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).artifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).id/u);
  assert.match(source, /priorApprovalcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).projectId/u);
  assert.match(source, /recovery-approved-artifact:candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)$candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\){priorApprovalcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).artifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).idcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)}/u);
  assert.match(source, /recovery-approved-project:candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)$candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\){priorApprovalcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).projectIdcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)}/u);
  assert.match(source, /recovery-approval-source:saved-library/u);
  assert.match(source, /type: "foundationscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).visualcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).accept"/u);
});

test("#2473 Library restore searches current-profile active, archived and direct-origin snapshots", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(workspace, /listLibraryProjectscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(workspace, /listArchivedLibraryProjectscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(workspace, /storyboardResourcescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).mapcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)) => resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).originProjectIdcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(workspace, /loadLibraryProjectSnapshotcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(projectIdcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(workspace, /restoreLocalStoryboardResourcescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(current, storyboardResources, storyboardSourceProjectscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
});

test("#2473 preserves draft-first recovery and adds no Previs approval bypass", async () => {
  const [recovery, previs] = await Promise.all([
    read("modules/library/local-resource-recovery.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(recovery, /reviewState: "draft"/u);
  assert.match(recovery, /recoveryArtifactIdcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(previs, /acceptedVisualIdscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).hascandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(artifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).idcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)) && artifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).reviewState === "accepted"/u);
  assert.doesNotMatch(previs, /recovery-approved-project|recovery-origin-project/u);
});
