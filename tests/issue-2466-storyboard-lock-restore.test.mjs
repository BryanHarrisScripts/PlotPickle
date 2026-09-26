import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hydrateProfileProjectLibrary,
  initializeProfileProjectLibrary,
  readProfileProjectSnapshot,
} from "../core/storage/project-library-core.mjs";

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

function project(id, reviewState = "draft", accepted = false) {
  const artifact = {
    id: "storyboard-frame-11",
    assetUrl: ASSET_URL,
    workflow: "storyboard-frame-webp-v2",
    frameNumber: 11,
    reviewState,
    sourceDecisionKeys: [
      "storyboard-target:block:block-01",
      "storyboard-anchor:block:block-01:mini-1",
      "storyboard-position:11",
    ],
  };
  return {
    id,
    title: "Afterglow",
    revision: accepted ? 12 : 1,
    createdAt: NOW,
    updatedAt: NOW,
    build: {
      foundations: {
        visualArtifacts: [artifact],
        acceptedVisualArtifactIds: accepted ? [artifact.id] : [],
      },
      world: {
        visualArtifacts: [],
        acceptedVisualArtifactIds: [],
      },
    },
  };
}

function harness(storage) {
  return {
    storage,
    profileId: "profile-bryan",
    normalizeProject: (value) => structuredClone(value),
    createProject: ({ id, now, title }) => ({
      id,
      title: title || "Untitled Story",
      revision: 0,
      createdAt: now,
      updatedAt: now,
      build: {
        foundations: { visualArtifacts: [], acceptedVisualArtifactIds: [] },
        world: { visualArtifacts: [], acceptedVisualArtifactIds: [] },
      },
    }),
    describeProject: () => ({ progress: 0, frontier: "Storyboard", thumbnail: "" }),
    now: () => NOW,
    idFactory: () => "generated-project",
  };
}

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2466 reads saved source-project approval metadata without switching the active Library story", () => {
  const storage = new MemoryStorage();
  const input = harness(storage);
  const source = project("afterglow-working", "accepted", true);
  const target = project("fresh-afterglow-copy");

  hydrateProfileProjectLibrary({
    ...input,
    activeProjectId: target.id,
    projects: [{ project: source }, { project: target }],
  });

  const snapshot = readProfileProjectSnapshot({ ...input, projectId: source.id });
  assert.equal(snapshot?.id, source.id);
  assert.equal(snapshot?.build.foundations.visualArtifacts[0]?.assetUrl, ASSET_URL);
  assert.equal(snapshot?.build.foundations.visualArtifacts[0]?.reviewState, "accepted");
  assert.deepEqual(snapshot?.build.foundations.acceptedVisualArtifactIds, ["storyboard-frame-11"]);
  assert.equal(initializeProfileProjectLibrary(input).activeProject?.id, target.id);
});

test("#2466 requires exact saved Storyboard approval evidence before restoring a lock", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");

  assert.match(source, /const directOrigin = sourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).id === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).originProjectId/u);
  assert.match(source, /provenanceMatches = directOrigin/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).assetUrl === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).assetUrl/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).workflow === "storyboard-frame-webp-v2"/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).frameNumber === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).position/u);
  assert.match(source, /candidatecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).reviewState !== "rejected"/u);
  assert.match(source, /candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(artifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).sourceDecisionKeys candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)?candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)? candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)[candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)]candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).includescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(anchorKeycandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(source, /candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)|candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)|candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)/u);
});

test("#2466 keeps recovery draft-first and uses canonical acceptance only when prior approval is proven", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");

  assert.match(source, /reviewState: "draft"/u);
  assert.match(source, /const priorApproval = priorAcceptedStoryboardArtifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(resource, sourceProjectscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(source, /if candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(priorApprovalcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)) candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\){[candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)scandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)S]*?type: "foundationscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).visualcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).accept",[candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)scandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)S]*?artifactId: id/u);
  assert.match(source, /recovery-approved-artifact:candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)$candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\){priorApprovalcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).artifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).idcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)}/u);
  assert.match(source, /recovery-approval-source:saved-library/u);
  assert.match(source, /restoredLockedCount candidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)+= 1/u);
});

test("#2466 can canonically promote an already-restored non-rejected draft when exact proof later exists", async () => {
  const source = await read("modules/library/local-resource-recovery.ts");
  const duplicateBranch = source.slice(
    source.indexOf("if (existingArtifact)"),
    source.indexOf("const blockRef =", source.indexOf("if (existingArtifact)")),
  );

  assert.match(duplicateBranch, /priorApproval/u);
  assert.match(duplicateBranch, /existingArtifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).workflow === "storyboard-frame-webp-v2"/u);
  assert.match(duplicateBranch, /existingArtifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).frameNumber === resourcecandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).position/u);
  assert.match(duplicateBranch, /existingArtifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).reviewState !== "rejected"/u);
  assert.match(duplicateBranch, /type: "foundationscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).visualcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).accept"/u);
  assert.match(duplicateBranch, /artifactId: existingArtifactcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\).id/u);
});

test("#2466 Library recovery supplies saved origin-project snapshots and explains proven lock restoration", async () => {
  const [workspace, browser] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("core/storage/project-library-browser.ts"),
  ]);

  assert.match(browser, /export function loadLibraryProjectSnapshotcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(projectId: stringcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(browser, /readProfileProjectSnapshot/u);
  assert.match(workspace, /storyboardSourceProjects/u);
  assert.match(workspace, /loadLibraryProjectSnapshotcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(projectIdcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(workspace, /restoreLocalStoryboardResourcescandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)(current, storyboardResources, storyboardSourceProjectscandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\))/u);
  assert.match(workspace, /restoredLockedCount/u);
  assert.match(workspace, /does not overwrite project defaults, invent approvals, promote story canon/u);
  assert.match(workspace, /restores as Locked only when exact saved Library metadata proves its prior Human Keepcandidate\.reviewState === "accepted" \|\| acceptedIds\.has\(candidate\.id\)/Lock/u);
});
