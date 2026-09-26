import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEmptyProject } from "../core/project/project.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import {
  hydrateProfileProjectLibrary,
  initializeProfileProjectLibrary,
  readProfileProjectSnapshot,
} from "../core/storage/project-library-core.mjs";
import { restoreLocalStoryboardResources } from "../modules/library/local-resource-recovery.ts";

const NOW = "2026-09-26T12:00:00.000Z";
const ASSET_URL = "/api/local-ai/assets/storyboard-afterglow-working-1-1-11-1760000000000-1760000001000.webp";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

function emptyProject(id) {
  return normalizeLibraryProject(createEmptyProject({ id, now: NOW, title: "Afterglow" }));
}

function sourceProject(reviewState = "accepted", accepted = true, assetUrl = ASSET_URL) {
  const base = emptyProject("afterglow-working");
  const artifact = {
    id: "storyboard-frame-locked-11",
    assetUrl,
    prompt: "Original Storyboard prompt",
    createdAt: NOW,
    provider: "local",
    model: "qwen-image",
    frameNumber: 11,
    narrativeIntention: "Storyboard position 11",
    sourceDecisionKeys: [
      "storyboard-target:block:block-01",
      "storyboard-anchor:block:block-01:mini-1",
      "storyboard-position:11",
    ],
    workflow: "storyboard-frame-webp-v2",
    reviewState,
    parentArtifactId: null,
  };
  return normalizeLibraryProject({
    ...base,
    build: {
      ...base.build,
      foundations: {
        visualArtifacts: [artifact],
        acceptedVisualArtifactIds: accepted ? [artifact.id] : [],
      },
    },
  });
}

const resource = {
  kind: "storyboard-frame",
  fileName: "storyboard-afterglow-working-1-1-11-1760000000000-1760000001000.webp",
  assetUrl: ASSET_URL,
  contentHash: "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  modifiedAt: NOW,
  originProjectId: "afterglow-working",
  blockNumber: 1,
  miniBlockNumber: 1,
  position: 11,
};

test("#2466 restores a proven prior Storyboard Keep/Lock through the canonical accept command", () => {
  const target = emptyProject("fresh-afterglow-copy");
  const result = restoreLocalStoryboardResources(target, [resource], [sourceProject()]);

  assert.equal(result.attachedCount, 1);
  assert.equal(result.restoredLockedCount, 1);
  const restored = result.project.build.foundations.visualArtifacts.find((artifact) => artifact.assetUrl === ASSET_URL);
  assert.ok(restored);
  assert.match(restored.id, /^local-recovery-/u);
  assert.equal(restored.reviewState, "accepted");
  assert.ok(result.project.build.foundations.acceptedVisualArtifactIds.includes(restored.id));
  assert.ok(restored.sourceDecisionKeys.includes("recovery-approved-artifact:storyboard-frame-locked-11"));
  assert.ok(restored.sourceDecisionKeys.includes("recovery-approval-source:saved-library"));
});

test("#2466 never invents a lock when saved approval evidence is missing, draft, rejected or mismatched", () => {
  const cases = [
    [],
    [sourceProject("draft", false)],
    [sourceProject("rejected", false)],
    [sourceProject("accepted", true, "/api/local-ai/assets/different.webp")],
  ];

  for (const sources of cases) {
    const result = restoreLocalStoryboardResources(emptyProject("fresh-afterglow-copy"), [resource], sources);
    const restored = result.project.build.foundations.visualArtifacts.find((artifact) => artifact.assetUrl === ASSET_URL);
    assert.ok(restored);
    assert.equal(restored.reviewState, "draft");
    assert.equal(result.restoredLockedCount, 0);
    assert.equal(result.project.build.foundations.acceptedVisualArtifactIds.includes(restored.id), false);
  }
});

test("#2466 can promote an already-restored draft when its exact saved lock evidence later becomes available", () => {
  const first = restoreLocalStoryboardResources(emptyProject("fresh-afterglow-copy"), [resource], []);
  const draft = first.project.build.foundations.visualArtifacts.find((artifact) => artifact.assetUrl === ASSET_URL);
  assert.ok(draft);
  assert.equal(draft.reviewState, "draft");

  const second = restoreLocalStoryboardResources(first.project, [resource], [sourceProject()]);
  assert.equal(second.attachedCount, 0);
  assert.equal(second.skippedCount, 1);
  assert.equal(second.restoredLockedCount, 1);
  const promoted = second.project.build.foundations.visualArtifacts.find((artifact) => artifact.id === draft.id);
  assert.equal(promoted?.reviewState, "accepted");
  assert.ok(second.project.build.foundations.acceptedVisualArtifactIds.includes(draft.id));
});

test("#2466 reads a saved source-project snapshot without switching the active Library story", () => {
  const storage = new MemoryStorage();
  const source = sourceProject();
  const target = emptyProject("fresh-afterglow-copy");
  const input = {
    storage,
    profileId: "profile-bryan",
    normalizeProject: normalizeLibraryProject,
    createProject: ({ id, now, title }) => normalizeLibraryProject(createEmptyProject({ id, now, title })),
    describeProject: () => ({ progress: 0, frontier: "Storyboard", thumbnail: "" }),
    now: () => NOW,
    idFactory: () => "generated-project",
  };

  hydrateProfileProjectLibrary({
    ...input,
    activeProjectId: target.id,
    projects: [{ project: source }, { project: target }],
  });

  const snapshot = readProfileProjectSnapshot({ ...input, projectId: source.id });
  assert.equal(snapshot?.id, source.id);
  assert.equal(snapshot?.build.foundations.visualArtifacts[0]?.reviewState, "accepted");
  assert.equal(initializeProfileProjectLibrary(input).activeProject?.id, target.id);
});

test("#2466 Library recovery supplies saved origin-project snapshots and reports restored locks", async () => {
  const [workspace, browser] = await Promise.all([
    readFile(new URL("../modules/library/ui/library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../core/storage/project-library-browser.ts", import.meta.url), "utf8"),
  ]);

  assert.match(browser, /export function loadLibraryProjectSnapshot\(projectId: string\)/u);
  assert.match(browser, /readProfileProjectSnapshot/u);
  assert.match(workspace, /storyboardSourceProjects/u);
  assert.match(workspace, /loadLibraryProjectSnapshot\(projectId\)/u);
  assert.match(workspace, /restoreLocalStoryboardResources\(current, storyboardResources, storyboardSourceProjects\)/u);
  assert.match(workspace, /restoredLockedCount/u);
});
