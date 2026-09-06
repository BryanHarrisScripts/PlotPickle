import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "vite";
import {
  archiveProfileProject,
  initializeProfileProjectLibrary,
  listProfileArchivedProjectSummaries,
  listProfileProjectSummaries,
  restoreProfileProject,
} from "../core/storage/project-library-core.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const screenplay = `Title: Imported Evidence Test

INT. LIGHTHOUSE - NIGHT
MARA watches the storm consume the harbour.
MARA
The signal is wrong.

EXT. CLIFF ROAD - NIGHT
Mara runs toward the transmitter as the lights fail.

INT. TRANSMITTER ROOM - CONTINUOUS
JON blocks the door.
JON
Choose what you save.

Mara turns the brass key and the room goes dark.
`;

async function withModules(run) {
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
  });
  try {
    const [converter, bridge, map] = await Promise.all([
      server.ssrLoadModule("/lib/projects/screenplay/screenplay-to-ppf.ts"),
      server.ssrLoadModule("/modules/library/import/rich-ppf-to-library-project.ts"),
      server.ssrLoadModule("/modules/build/progressive-story-map.ts"),
    ]);
    await run({
      convert: converter.convertScreenplayTextToPpf,
      bridge: bridge.richPpfToLibraryProject,
      deriveMap: map.deriveProgressiveStoryMap,
    });
  } finally {
    await server.close();
  }
}

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  key(index) { return [...this.#values.keys()][index] ?? null; }
}

function archiveHarness() {
  let serial = 0;
  const storage = new MemoryStorage();
  const now = () => "2026-08-24T14:00:00.000Z";
  return {
    storage,
    profileId: "profile-test-1338",
    now,
    idFactory: () => `story-${++serial}`,
    createProject: ({ id, now: createdAt, title }) => ({ id, title, createdAt, updatedAt: createdAt }),
    normalizeProject: (value) => structuredClone(value),
    describeProject: () => ({ progress: 0, frontier: "Foundations", thumbnail: "" }),
  };
}

test("issue #1338 imported screenplay PPF becomes modular evidence without completing lessons", async () => {
  await withModules(async ({ convert, bridge, deriveMap }) => {
    const converted = convert({ fileName: "observed.fountain", sourceText: screenplay, importedAt: "2026-08-24T13:00:00.000Z" });
    const richProject = JSON.parse(converted.serializedPpf).project;
    const project = bridge(richProject, "2026-08-24T13:05:00.000Z");

    assert.equal(project.title, "Imported Evidence Test");
    assert.deepEqual(project.learning.completedLessonIds, []);
    assert.ok(Object.values(project.foundations.lessons).some((lesson) => lesson.proposal));
    assert.ok(Object.values(project.foundations.lessons).every((lesson) => Object.keys(lesson.answers).length === 0));
    assert.equal(project.sourceEvidence.screenplay.analysisStatus, "suggested");
    assert.equal(project.sourceEvidence.screenplay.sourceFileName, "observed.fountain");
    assert.ok(project.sourceEvidence.screenplay.passages.length > 0);

    const map = deriveMap(project);
    assert.equal(map.blocks.length, 24);
    assert.equal(map.blocks.flatMap((block) => block.miniBlocks).length, 96);
    assert.ok(map.observedPassageCount > 0);
    assert.ok(map.blocks.some((block) => block.state === "emerging"));
    assert.ok(map.blocks.some((block) => block.observedPassageCount > 0));
    assert.ok(map.blocks.every((block) => block.miniBlocks.length === 4));
  });
});

test("issue #1338 distinguishes observed source from suggested structural placement", async () => {
  await withModules(async ({ convert, bridge, deriveMap }) => {
    const converted = convert({ fileName: "review.fountain", sourceText: screenplay, importedAt: "2026-08-24T13:00:00.000Z" });
    const project = bridge(JSON.parse(converted.serializedPpf).project, "2026-08-24T13:05:00.000Z");
    const suggested = deriveMap(project);
    const sourceBlock = suggested.blocks.find((block) => block.observedPassageCount > 0);
    assert.ok(sourceBlock);
    assert.equal(sourceBlock.state, "emerging");
    assert.match(sourceBlock.mappingNote, /passages are present.*placement.*suggested/i);

    const reviewed = deriveMap({
      ...project,
      sourceEvidence: {
        screenplay: { ...project.sourceEvidence.screenplay, analysisStatus: "reviewed" },
      },
    });
    assert.ok(reviewed.blocks.some((block) => block.state === "observed"));
  });
});

test("issue #1338 archiving the last story leaves zero active projects and restore returns the same id", () => {
  const input = archiveHarness();
  const initialized = initializeProfileProjectLibrary(input);
  const originalId = initialized.activeProject.id;

  const archived = archiveProfileProject({ ...input, projectId: originalId });
  assert.equal(archived.activeProject, null);
  assert.equal(archived.registry.activeProjectId, null);
  assert.equal(listProfileProjectSummaries(input).length, 0);
  assert.equal(listProfileArchivedProjectSummaries(input).length, 1);
  assert.equal(listProfileArchivedProjectSummaries(input)[0].id, originalId);

  const reloaded = initializeProfileProjectLibrary(input);
  assert.equal(reloaded.activeProject, null, "initializer must not create a replacement Untitled Story while all real stories are archived");

  const restored = restoreProfileProject({ ...input, projectId: originalId });
  assert.equal(restored.activeProject.id, originalId);
  assert.equal(restored.registry.activeProjectId, originalId);
  assert.equal(listProfileArchivedProjectSummaries(input).length, 0);
});

test("issue #1338 Library and Settings reuse one Archive component and Library exposes a real New Story action", async () => {
  const [library, settings, archive, css] = await Promise.all([
    source("modules/library/ui/library-workspace.tsx"),
    source("app/sage-settings-workspace.tsx"),
    source("modules/library/ui/archive-stories-panel.tsx"),
    source("modules/library/ui/library-workspace.module.css"),
  ]);
  assert.match(library, /<ArchiveStoriesPanel \/>/);
  assert.match(settings, /<ArchiveStoriesPanel \/>/);
  assert.match(settings, /id="settings-archive"/);
  assert.match(archive, /Restore to Library/);
  assert.match(library, /createLibraryUserProject/);
  assert.match(library, /data-library-new-story-card="ready"/);
  assert.match(library, /Create New Story/);
  assert.match(library, />New Story<\/button>/);
  assert.match(library, /window\.location\.assign\("\/\?workspace=learn"\)/);
  assert.doesNotMatch(library, /Coming Soon|Coming soon|data-library-ghost-card="coming-soon"/);
  assert.match(library, /Import \.PPF/);
  assert.match(library, /\/api\/library\/import\/ppf/);
  assert.match(css, /\.cardMenu/);
  assert.match(css, /\.ghostCard/);
  assert.match(css, /\.storyTools/);
});
