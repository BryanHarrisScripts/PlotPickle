import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  initializeProfileProjectLibrary,
  listProfileProjectSummaries,
  saveProfileActiveProject,
} from "../core/storage/project-library-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

const CREATED_AT = "2026-09-29T22:57:00.000Z";
const SAVED_AT = [
  "2026-09-29T22:58:00.000Z",
  "2026-09-29T22:59:00.000Z",
  "2026-09-29T23:00:00.000Z",
  "2026-09-29T23:01:00.000Z",
];

function normalizeProject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid project");
  return {
    id: typeof value.id === "string" && value.id ? value.id : "local-story",
    title: typeof value.title === "string" && value.title ? value.title : "Untitled Story",
    revision: Number.isInteger(value.revision) ? value.revision : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : CREATED_AT,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : CREATED_AT,
    activity: Array.isArray(value.activity) ? [...value.activity] : [],
  };
}

function createProject({ id, now, title }) {
  return normalizeProject({ id, title, revision: 0, createdAt: now, updatedAt: now, activity: [] });
}

function describeProject(project) {
  const activity = Array.isArray(project.activity) ? project.activity : [];
  return {
    progress: Math.min(100, activity.length * 25),
    frontier: activity.at(-1) || "Getting Started",
    thumbnail: "",
  };
}

function harness(storage) {
  return {
    storage,
    profileId: "profile-local-primary",
    normalizeProject,
    createProject,
    describeProject,
    now: () => CREATED_AT,
    idFactory: () => "first-local-story",
  };
}

test("#2584 first meaningful work reuses exactly one Human project across representative surfaces", () => {
  const storage = new MemoryStorage();
  const input = harness(storage);
  const initial = initializeProfileProjectLibrary(input);

  assert.equal(initial.activeProject.id, "first-local-story");
  let summaries = listProfileProjectSummaries(input);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].sourceId, null, "clean browsing placeholder must remain non-meaningful");

  let project = initial.activeProject;
  const activities = ["Mind Map", "World Map", "Write", "Storyboard"];
  activities.forEach((surface, index) => {
    project = {
      ...project,
      updatedAt: SAVED_AT[index],
      revision: project.revision + 1,
      activity: [...project.activity, surface],
    };
    const saved = saveProfileActiveProject({
      ...input,
      project,
      ...(index === 0 ? { sourceKind: "user", sourceId: "first-meaningful-save" } : {}),
    });
    project = saved.activeProject;

    summaries = listProfileProjectSummaries(input);
    assert.equal(summaries.length, 1, `${surface} save must not create a duplicate local story`);
    assert.equal(summaries[0].id, "first-local-story");
  });

  assert.equal(project.id, "first-local-story");
  assert.deepEqual(project.activity, activities);
  assert.equal(summaries[0].sourceKind, "user");
  assert.equal(summaries[0].sourceId, "first-meaningful-save");
  assert.equal(summaries[0].frontier, "Storyboard");
  assert.equal(summaries[0].progress, 100);
});

test("#2584 clean browsing stays hidden while meaningful surface writes share Project Library authority", async () => {
  const [browser, mindMap, worldMap, write, storyboard] = await Promise.all([
    read("core/storage/project-library-browser.ts"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("app/storyboard/page.tsx"),
  ]);

  assert.match(browser, /function isImplicitStartupPlaceholder/u);
  assert.match(browser, /listPersistableLibraryProjects\(\)[\s\S]*!isImplicitStartupPlaceholder/u);
  assert.match(browser, /firstMeaningfulSave[\s\S]*sourceId: "first-meaningful-save"/u);
  assert.match(browser, /markSessionActiveProject\(result\.activeProject\.id\)/u);

  assert.match(mindMap, /saveActiveLibraryProject/u);
  assert.match(worldMap, /saveActiveLibraryProject/u);
  assert.match(write, /loadActiveLibraryProject\(\)/u);
  assert.match(write, /saveActiveLibraryProject\(next\)/u);
  assert.match(storyboard, /loadFoundationProject\(\)/u);
  assert.match(storyboard, /data-canonical-project-id=\{project\.id\}/u);
});

test("#2584 Library Load gives a truthful plain-language summary of durable project state", async () => {
  const [workspace, styles] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);

  assert.match(workspace, /function savedStoryResumeDetails/u);
  assert.match(workspace, /project\.discovery\.cards\.length/u);
  assert.match(workspace, /project\.worldMap\.characterVisuals\.length/u);
  assert.match(workspace, /project\.writing\.entries\.length/u);
  assert.match(workspace, /mini\.stages\.plan\.content/u);
  assert.match(workspace, /mini\.stages\.storyboard/u);
  assert.match(workspace, /FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW/u);
  assert.match(workspace, /Meaningful saved work/u);
  assert.match(workspace, /Last working area/u);
  assert.match(workspace, /Nothing loads into the workspace until you choose it/u);

  assert.match(styles, /\.savedStoryStateSummary/u);
  assert.match(styles, /\.savedStoryActionSummary/u);
});
