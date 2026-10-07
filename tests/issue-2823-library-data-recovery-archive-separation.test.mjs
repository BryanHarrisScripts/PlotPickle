import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeProjectSourceEvidence } from "../core/contracts/imported-screenplay-evidence/index.ts";
import { createEmptyProject } from "../core/project/project.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import {
  archiveProfileProject,
  hydrateProfileProjectLibrary,
  readProfileProjectSnapshot,
  restoreProfileProject,
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

function harness(storage, clock) {
  return {
    storage,
    profileId: "profile-bryan",
    normalizeProject: normalizeLibraryProject,
    createProject: ({ id, now, title }) => normalizeLibraryProject(createEmptyProject({ id, now, title })),
    describeProject: () => ({ progress: 0, frontier: "Storyboard", thumbnail: "" }),
    now: () => clock.value,
    idFactory: () => "generated-project",
  };
}

test("#2823 normal Afterglow resume is a manifest, not interactive local recovery", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, />Open Example with Your Changes<\/button>/u);
  assert.match(source, /Resume Saved Afterglow/u);
  assert.match(source, /state you last saved on/u);
  assert.match(source, /function expectedLocalAssetUrls/u);
  assert.match(source, /function resumeInventoryResources/u);
  assert.match(source, /expected\.has\(resource\.assetUrl\)/u);
  assert.match(source, /will be ignored/u);
  assert.match(source, /Settings → Data Recovery/u);

  assert.doesNotMatch(source, />Select All<\/button>/u);
  assert.doesNotMatch(source, /requires your explicit selection/u);
  assert.doesNotMatch(source, /selectedRecoveryOrigins/u);
  assert.doesNotMatch(source, /<legend>Changes found locally<\/legend>/u);
});

test("#2823 safe unload creates a durable profile recovery point before detaching the story", async () => {
  const [library, browser, route] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("core/storage/profile-private-browser.ts"),
    read("app/api/auth/profile-private/route.ts"),
  ]);

  const checkpoint = library.indexOf('createProfileRecoveryPoint(durableSnapshot, "unload")');
  const detach = library.indexOf("unloadActiveLibraryProject()");
  assert.ok(checkpoint >= 0 && detach > checkpoint);

  assert.match(browser, /PROFILE_RECOVERY_LIMIT = 20/u);
  assert.match(browser, /createProfileRecoveryPoint/u);
  assert.match(browser, /save-recovery-points/u);
  assert.match(route, /library-recovery-points/u);
  assert.match(route, /input\.action === "save-recovery-points"/u);
});

test("#2823 Settings Data Recovery previews dated profile points and preserves current state before restore", async () => {
  const source = await read("app/skin-v1/settings-review-system-panel.tsx");

  assert.match(source, /Profile Library recovery points/u);
  assert.match(source, /displayDate\(point\.createdAt\)/u);
  assert.match(source, /Preview/u);
  assert.match(source, /Previewing has not changed the active Library story/u);
  assert.match(source, /createProfileRecoveryPoint\(current, "pre-restore"\)/u);
  assert.match(source, /window\.confirm/u);
  assert.match(source, />Restore entire story<\/button>/u);
  assert.match(source, /Archive is reversible shelving, not a recovery point/u);
  assert.match(source, />Restore to Library<\/button>/u);
});

test("#2823 resume provenance survives normalization", () => {
  const recovery = normalizeProjectSourceEvidence({
    resumeProvenance: {
      kind: "recovery",
      sourceAt: "2026-10-05T21:18:00.000Z",
      restoredAt: "2026-10-07T12:30:00.000Z",
    },
  });
  assert.deepEqual(recovery.resumeProvenance, {
    kind: "recovery",
    sourceAt: "2026-10-05T21:18:00.000Z",
    restoredAt: "2026-10-07T12:30:00.000Z",
  });

  const invalid = normalizeProjectSourceEvidence({
    resumeProvenance: { kind: "history", sourceAt: "x", restoredAt: "y" },
  });
  assert.equal(invalid.resumeProvenance, null);
});

test("#2823 restoring Archive records archive provenance without turning Archive into a recovery point", () => {
  const storage = new MemoryStorage();
  const clock = { value: "2026-10-07T10:00:00.000Z" };
  const input = harness(storage, clock);
  const project = normalizeLibraryProject(createEmptyProject({
    id: "afterglow-working",
    now: clock.value,
    title: "Afterglow: Reflections of Sentience",
  }));

  hydrateProfileProjectLibrary({
    ...input,
    activeProjectId: project.id,
    projects: [{ project }],
  });

  archiveProfileProject({ ...input, projectId: project.id });
  const archivedAt = clock.value;
  clock.value = "2026-10-07T12:00:00.000Z";
  restoreProfileProject({ ...input, projectId: project.id });

  const restored = readProfileProjectSnapshot({ ...input, projectId: project.id });
  assert.ok(restored);
  assert.deepEqual(restored.sourceEvidence.resumeProvenance, {
    kind: "archive",
    sourceAt: archivedAt,
    restoredAt: clock.value,
  });
});
