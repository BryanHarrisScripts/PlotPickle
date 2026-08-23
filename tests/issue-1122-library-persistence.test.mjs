import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LEGACY_ACTIVE_PROJECT_KEY,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  createProfileWorkingCopy,
  initializeProfileProjectLibrary,
  listProfileProjectSummaries,
  projectLibraryMigrationKey,
  projectLibraryProjectKey,
  projectLibraryRegistryKey,
  saveProfileActiveProject,
  switchProfileActiveProject,
} from "../core/storage/project-library-core.mjs";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
  keys() { return [...this.#values.keys()]; }
}

const FIXED_NOW = "2026-08-20T15:45:00.000Z";

function normalizeProject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.incompatible === true) {
    throw new Error("incompatible project");
  }
  return {
    id: typeof value.id === "string" && value.id ? value.id : "recovered-project",
    title: typeof value.title === "string" && value.title ? value.title : "Untitled Story",
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : FIXED_NOW,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : FIXED_NOW,
    learning: value.learning && typeof value.learning === "object" ? structuredClone(value.learning) : { completedLessonIds: [] },
    foundations: value.foundations && typeof value.foundations === "object" ? structuredClone(value.foundations) : { lessons: {} },
    world: value.world && typeof value.world === "object" ? structuredClone(value.world) : { lessons: {} },
    build: value.build && typeof value.build === "object" ? structuredClone(value.build) : { foundations: {}, world: {} },
    creativeRoom: value.creativeRoom && typeof value.creativeRoom === "object" ? structuredClone(value.creativeRoom) : { threadId: null },
  };
}

function createProject({ id, now, title }) {
  return normalizeProject({ id, title, revision: 0, createdAt: now, updatedAt: now });
}

function describeProject(project) {
  return {
    progress: project.learning.completedLessonIds?.length ? 25 : 0,
    frontier: project.world.lessons && Object.keys(project.world.lessons).length ? "World" : "Foundations",
    thumbnail: "",
  };
}

function harness(storage, profileId, ids = []) {
  let fallback = 0;
  return {
    storage,
    profileId,
    normalizeProject,
    createProject,
    describeProject,
    now: () => FIXED_NOW,
    idFactory: () => ids.shift() || `generated-${++fallback}`,
  };
}

test("#1122 migrates the legacy active PPF into a verified profile-owned Library and restores it after restart", () => {
  const storage = new MemoryStorage();
  const legacy = createProject({ id: "legacy-story", now: FIXED_NOW, title: "Legacy Story" });
  storage.setItem(LEGACY_ACTIVE_PROJECT_KEY, JSON.stringify(legacy));

  const first = initializeProfileProjectLibrary(harness(storage, "profile-bryan"));
  assert.equal(first.migrated, true);
  assert.equal(first.activeProject.id, "legacy-story");
  assert.equal(storage.getItem(LEGACY_ACTIVE_PROJECT_KEY), null, "legacy authority retires only after the profile copy verifies");
  assert.equal(JSON.parse(storage.getItem(projectLibraryMigrationKey("profile-bryan"))).verified, true);
  assert.equal(JSON.parse(storage.getItem(projectLibraryRegistryKey("profile-bryan"))).activeProjectId, "legacy-story");

  const restarted = initializeProfileProjectLibrary(harness(storage, "profile-bryan"));
  assert.equal(restarted.migrated, false);
  assert.equal(restarted.activeProject.title, "Legacy Story");
});

test("#1122 saves the current story before cloning examples or switching among more than four My Stories", () => {
  const storage = new MemoryStorage();
  const input = harness(storage, "profile-bryan", ["story-one", "working-example", "story-three", "story-four", "story-five"]);
  const initial = initializeProfileProjectLibrary(input);
  saveProfileActiveProject({ ...input, project: { ...initial.activeProject, title: "Bryan Original", updatedAt: FIXED_NOW } });

  const immutableExample = createProject({ id: "packaged-example", now: FIXED_NOW, title: "Afterglow" });
  const sourceBefore = structuredClone(immutableExample);
  const working = createProfileWorkingCopy({
    ...input,
    sourceProject: immutableExample,
    sourceKind: "example",
    sourceId: "afterglow",
    title: "Afterglow",
    genre: "Science Fiction",
    format: "Screenplay",
  });
  assert.equal(working.activeProject.id, "working-example");
  assert.deepEqual(immutableExample, sourceBefore, "the immutable packaged example must not be mutated");

  for (const [id, title] of [["story-three", "Third"], ["story-four", "Fourth"], ["story-five", "Fifth"]]) {
    saveProfileActiveProject({ ...input, project: createProject({ id, now: FIXED_NOW, title }) });
  }
  const stories = listProfileProjectSummaries(input);
  assert.equal(stories.length, 5);
  assert.ok(stories.some((item) => item.sourceKind === "example" && item.sourceId === "afterglow"));

  const switched = switchProfileActiveProject({ ...input, projectId: "story-one" });
  assert.equal(switched.activeProject.title, "Bryan Original");
  const savedFifth = JSON.parse(storage.getItem(projectLibraryProjectKey("profile-bryan", "story-five")));
  assert.equal(savedFifth.project.title, "Fifth", "the current project snapshot remains saved before switching");
});

test("#1122 keeps My Stories registries and project snapshots isolated by opaque Human profile id", () => {
  const storage = new MemoryStorage();
  const bryan = harness(storage, "profile-bryan", ["bryan-story"]);
  const jane = harness(storage, "profile-jane", ["jane-story"]);
  saveProfileActiveProject({ ...bryan, project: { ...initializeProfileProjectLibrary(bryan).activeProject, title: "Bryan Private Story" } });
  saveProfileActiveProject({ ...jane, project: { ...initializeProfileProjectLibrary(jane).activeProject, title: "Jane Private Story" } });

  assert.deepEqual(listProfileProjectSummaries(bryan).map((item) => item.title), ["Bryan Private Story"]);
  assert.deepEqual(listProfileProjectSummaries(jane).map((item) => item.title), ["Jane Private Story"]);
  assert.notEqual(projectLibraryRegistryKey("profile-bryan"), projectLibraryRegistryKey("profile-jane"));
  assert.equal(storage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY), null, "the pure profile store never invents browser authentication state");
});

test("#1122 quarantines a corrupt active snapshot and recovers another verified story without destroying evidence", () => {
  const storage = new MemoryStorage();
  const input = harness(storage, "profile-bryan", ["story-one"]);
  const initial = initializeProfileProjectLibrary(input);
  saveProfileActiveProject({ ...input, project: { ...initial.activeProject, title: "Last Good Story" } });
  saveProfileActiveProject({ ...input, project: createProject({ id: "broken-story", now: FIXED_NOW, title: "Broken Story" }) });
  storage.setItem(projectLibraryProjectKey("profile-bryan", "broken-story"), "{not-json");

  const recovered = initializeProfileProjectLibrary(input);
  assert.equal(recovered.activeProject.title, "Last Good Story");
  assert.ok(storage.keys().some((key) => key.includes("broken-story.quarantine")), "corrupt source remains recoverable");
});

test("#1122 mounts one canonical Library route, accessible filters, safe-switch copy, and the required navigation placement", async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const [shell, route, workspace, catalog, browserStore, coreStore, avery] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/library/page.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/project-library-catalog.ts"),
    read("core/storage/project-library-browser.ts"),
    read("core/storage/project-library-core.mjs"),
    read("modules/library/ui/avery-session-history/index.tsx"),
  ]);

  const dashboard = shell.indexOf('id: "dashboard"');
  const library = shell.indexOf('id: "library"');
  const community = shell.indexOf('id: "community"');
  const learn = shell.indexOf('id: "learn"');
  const wyrmwood = shell.indexOf('id: "wyrmwood"');
  assert.ok(dashboard < library && library < community && community < learn && learn < wyrmwood);
  assert.match(shell, /label: "Library", detail: "Examples & Stories", selectable: true/);
  assert.match(route, /activeWorkspace="library"/);
  assert.match(workspace, /Featured Examples/);
  assert.match(workspace, /Genre Presets/);
  assert.match(workspace, /My Stories/);
  assert.match(workspace, /Load & Explore/);
  assert.match(workspace, /Your current work will be saved as a local story before PlotPickle switches projects/);
  assert.match(workspace, /role="dialog"/);
  assert.match(workspace, /aria-modal="true"/);
  assert.match(workspace, /Avery’s read-only Writer-in-Residence sessions/);
  assert.match(catalog, /createEmptyProject/);
  assert.match(catalog, /normalizeFoundationProject/);
  assert.match(catalog, /library-featured-example-v1/);
  assert.match(catalog, /acceptedVisualArtifactIds/);
  assert.doesNotMatch(catalog, /storyboardState|screenplayState|fakeField/);
  assert.match(browserStore, /profileId/);
  for (const source of [workspace, catalog, browserStore, coreStore]) {
    assert.doesNotMatch(source, /BUZZ_STORY_ROOMS|\/rooms\/ensure|channels["', ]+create|local-buzz/i,
      "Library load and switch paths must remain local-only and must never provision BUZZ channels");
  }
  assert.doesNotMatch(avery, /PROJECT_LIBRARY|My Stories|projectLibrary/);
});