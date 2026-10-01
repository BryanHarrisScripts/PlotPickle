import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PROJECT_LIBRARY_SESSION_HANDOFF_MAX_AGE_MS,
  consumeProjectLibrarySessionHandoff,
  stageProjectLibrarySessionHandoff,
} from "../core/storage/project-library-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

test("#2621 explicit Library handoff is profile-bound, fresh and one-shot", () => {
  const storage = new MemoryStorage();
  stageProjectLibrarySessionHandoff({
    storage,
    profileId: "profile_bryan",
    projectId: "afterglow-working-copy",
    nowMs: 1_000,
  });

  assert.equal(consumeProjectLibrarySessionHandoff({
    storage,
    profileId: "profile_bryan",
    nowMs: 1_000 + PROJECT_LIBRARY_SESSION_HANDOFF_MAX_AGE_MS,
  }), "afterglow-working-copy");

  assert.equal(consumeProjectLibrarySessionHandoff({
    storage,
    profileId: "profile_bryan",
    nowMs: 1_001,
  }), null, "the handoff must be consumed exactly once");
});

test("#2621 stale or wrong-profile handoffs cannot defeat Blank-at-launch isolation", () => {
  const storage = new MemoryStorage();
  stageProjectLibrarySessionHandoff({
    storage,
    profileId: "profile_bryan",
    projectId: "afterglow-working-copy",
    nowMs: 10_000,
  });

  assert.equal(consumeProjectLibrarySessionHandoff({
    storage,
    profileId: "profile_jane",
    nowMs: 10_001,
  }), null);

  assert.equal(consumeProjectLibrarySessionHandoff({
    storage,
    profileId: "profile_bryan",
    nowMs: 10_000 + PROJECT_LIBRARY_SESSION_HANDOFF_MAX_AGE_MS + 1,
  }), null);
});

test("#2621 profile hydration restores only the explicit project that durable hydration confirms active", async () => {
  const profile = await read("core/storage/profile-private-browser.ts");
  const consume = profile.indexOf("consumeSessionActiveProjectHandoff(profileId)");
  const clear = profile.indexOf("window.sessionStorage.clear()");
  const hydrate = profile.indexOf("hydrateProfileProjectLibrary({ activeProjectId, projects })");
  const condition = profile.indexOf("restored.registry.activeProjectId === explicitSessionProjectId");
  const resume = profile.indexOf("resumeSessionActiveProject(explicitSessionProjectId)");

  assert.ok(consume >= 0 && consume < clear);
  assert.ok(clear < hydrate);
  assert.ok(hydrate < condition && condition < resume);
  assert.doesNotMatch(profile, /resumeSessionActiveProject\(activeProjectId\)/u);
});

test("#2621 Blank Library return does not require or invent a project handoff", async () => {
  const browser = await read("core/storage/project-library-browser.ts");
  assert.match(browser, /export function stageSessionActiveProjectHandoff\(\)[\s\S]*if \(!projectId\) return null/u);
  assert.doesNotMatch(browser, /An explicit Library handoff requires a current-session story/u);
});

test("#2621 explicit Library opens stage the handoff only after durable persistence completes", async () => {
  const [workspace, avery] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/avery-session-history/index.tsx"),
  ]);

  assert.match(workspace, /await persistActiveProfileProject\(\);\s*await flushProfilePrivateWrites\(\);\s*if \(returnToMatrixDashboardFromLibrary\(\)\) return;[\s\S]*stageSessionActiveProjectHandoff\(\);\s*window\.location\.assign\("\/\?workspace=dashboard"\)/u);
  assert.match(workspace, /window\.location\.pathname !== "\/skin-v1"[\s\S]*plotpickle:return-dashboard/u);
  assert.match(workspace, /async function loadPackagedExample[\s\S]*if \(mode === "defaults"\)[\s\S]*createAfterglowPackagedCurrentReference[\s\S]*await openActiveProject\(\)/u);
  assert.match(avery, /await persistActiveProfileProject\(\);[\s\S]*window\.location\.pathname === "\/skin-v1"[\s\S]*plotpickle:return-dashboard[\s\S]*else \{[\s\S]*stageSessionActiveProjectHandoff\(\);[\s\S]*window\.location\.assign\("\/\?workspace=dashboard"\)/u);
});

test("#2621 canonical packaged Afterglow already contains the data World Map and Previs must reveal once active", async () => {
  const snapshot = await readJson("data/afterglow-packaged-current/snapshot.json");
  const project = snapshot.project;
  assert.equal(snapshot.status, "promoted");
  assert.equal(project.structure.blocks.length, 24);
  assert.ok(Object.keys(project.foundations.lessons).length > 0);
  assert.ok(project.foundations.brief.content.length > 1000);

  const characterVisuals = project.worldMap.characterVisuals;
  assert.deepEqual(characterVisuals.map((item) => item.characterId).sort(), ["amy", "isobel", "ren"]);
  assert.equal(characterVisuals.reduce((sum, item) => sum + item.references.length, 0), 23);

  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const locked = project.build.foundations.visualArtifacts.filter((artifact) =>
    artifact.workflow === "storyboard-frame-webp-v2"
    && artifact.reviewState === "accepted"
    && accepted.has(artifact.id)
    && artifact.sourceDecisionKeys.includes("storyboard-anchor:block:block-01:mini-1")
  );
  assert.equal(locked.length, 24);
  assert.ok(locked.every((artifact) => artifact.assetUrl.startsWith("/assets/library/examples/afterglow/current/")));
});

test("#2621 Your Changes remains an honest local-overlay action", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");
  assert.match(workspace, /disabled=\{disabled \|\| !canRestoreChanges\}/u);
  assert.match(workspace, /if \(!afterglowLocalState\)[\s\S]*No local Afterglow changes are available yet/u);
});
