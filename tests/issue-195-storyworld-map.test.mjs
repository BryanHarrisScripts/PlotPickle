import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Issue 195 upgrades the existing Whole Film wall instead of adding another engine", async () => {
  const [wall, build, map, docs] = await Promise.all([
    source("../app/mini-block-wall.tsx"),
    source("../app/build-workspace.tsx"),
    source("../lib/storyworld-map.ts"),
    source("../docs/ISSUE-195-STORYWORLD-MAP.md"),
  ]);
  assert.match(wall, /Construction wall/);
  assert.match(wall, /Storyworld Map/);
  assert.match(wall, /Map table/);
  assert.match(build, /view === "mini-blocks"/);
  assert.match(build, /<MiniBlockWall/);
  assert.doesNotMatch(build, /storyworld-map.*VIEW_OPTIONS|id: "storyworld"/i);
  assert.match(map, /createMiniBlockWallModel\(project\)/);
  assert.match(map, /buildStoryDependencies\(project\)/);
  assert.match(docs, /does not add a workspace, navigation item, structure editor or persistent graph/i);
});

test("the map exposes semantic zoom, evidence overlays and canonical navigation", async () => {
  const [wall, model] = await Promise.all([
    source("../app/mini-block-wall.tsx"),
    source("../lib/storyworld-map.ts"),
  ]);
  for (const phrase of [
    "Semantic zoom",
    "Causality and escalation",
    "Hooks and turns",
    "Characters and arcs",
    "Threads and dramatic question",
    "Setup and payoff",
    "Location and order",
    "Visual continuity",
    "Render readiness",
    "Logic, rights and provenance warnings",
    "Show why this connects",
    "sourceNodeIds",
  ]) assert.ok(wall.includes(phrase) || model.includes(phrase), `Missing map contract: ${phrase}`);
  for (const level of ["movie", "act", "sequence", "block", "scene", "mini-block", "production-shot"]) {
    assert.match(wall, new RegExp(`"${level}"`));
  }
  assert.match(wall, /openConnectedMiniBlock/);
  assert.match(wall, /revealCard\(card\)/);
  assert.match(wall, /onOpenBlock\(selected\.block\.number\)/);
});

test("map exploration cannot silently change canonical story order", async () => {
  const [wall, map, order] = await Promise.all([
    source("../app/mini-block-wall.tsx"),
    source("../lib/storyworld-map.ts"),
    source("../lib/mini-block-wall-order.ts"),
  ]);
  assert.match(wall, /draggable=\{state\.display === "wall"\}/);
  assert.match(wall, /Storyworld Map exploration does not change canonical story order/);
  assert.match(wall, /moveCanonicalMiniBlock/);
  assert.match(order, /id: miniBlock\.id/);
  assert.doesNotMatch(map, /moveCanonicalMiniBlock|applyCanonicalMiniBlockOrder|onProjectChange/);
});

test("shared layout round-trips while personal viewport state remains local", async () => {
  const [project, map, wall, schema] = await Promise.all([
    source("../lib/project.ts"),
    source("../lib/storyworld-map.ts"),
    source("../app/mini-block-wall.tsx"),
    source("../schema/plotpickle-project.schema.json"),
  ]);
  assert.match(project, /extensions\?: Record<string, unknown>/);
  assert.match(project, /extensions: candidate\.extensions/);
  assert.match(map, /plotpickle\.storyworld-map-layout/);
  assert.match(map, /saveStoryworldMapSharedLayout/);
  assert.match(map, /readStoryworldMapSharedLayout/);
  assert.match(wall, /Save shared map layout/);
  assert.match(wall, /Personal pan and zoom stayed on this device/);
  assert.doesNotMatch(map, /pan:|zoom:|search:/);
  const parsed = JSON.parse(schema);
  assert.equal(parsed.properties.extensions.additionalProperties, true);
  assert.ok(!parsed.required.includes("extensions"));
});

test("the Storyworld Map model and exports execute against a complete 96-position project", () => {
  const program = String.raw`
    import { createBlankProject, normalizePlotPickleProject } from "./lib/project.ts";
    import {
      buildStoryworldMapHtml,
      buildStoryworldMapSvg,
      createStoryworldMapModel,
      readStoryworldMapSharedLayout,
      saveStoryworldMapSharedLayout,
      storyworldConnectionsFor,
    } from "./lib/storyworld-map.ts";

    let project = createBlankProject();
    const first = project.blocks[0].scenes[0].miniBlocks[0];
    const second = project.blocks[0].scenes[0].miniBlocks[1];
    first.label = "Promise";
    first.purpose = "Open the central dramatic question";
    first.setup = "sealed archive";
    second.label = "Consequence";
    second.turn = "The archive answers back";
    second.payoff = "sealed archive";
    const characterId = "character-protagonist";
    project.characters.push({
      id: characterId, name: "Mara", role: "Protagonist", pronouns: "", description: "", want: "", need: "", ghost: "",
      flaw: "", belief: "", truth: "", externalGoal: "", internalGoal: "", stakes: "", arcSummary: "", status: "",
      relationships: [], voiceprint: { worldview: "", rhythm: "", vocabulary: "", metaphor: "", statusStrategy: "", persuasion: "", silence: "", researchNotes: "", updatedAt: "" },
      visualIdentity: { appearance: "", wardrobe: "", silhouette: "", palette: "", referenceImage: "", referenceImageAlt: "", promptAnchor: "", continuityNotes: "", approved: false, approvedAt: "", updatedAt: "" },
      arcMatrix: { checkpoints: [] },
    });
    first.characterId = characterId;
    second.characterId = characterId;
    project = saveStoryworldMapSharedLayout(project, {
      mode: "map",
      granularity: "production-shot",
      overlays: ["causality", "characters", "setup-payoff", "warnings"],
      emphasizedNodeIds: [first.id],
    });
    project = normalizePlotPickleProject(JSON.parse(JSON.stringify(project)));
    if (!project) throw new Error("Project round-trip failed.");
    const model = createStoryworldMapModel(project);
    const selected = storyworldConnectionsFor(model, first.id, ["causality", "characters", "setup-payoff"]);
    const svg = buildStoryworldMapSvg(project, model);
    const html = buildStoryworldMapHtml(project, model);
    process.stdout.write(JSON.stringify({
      cards: model.cards.length,
      selectedConnections: selected.length,
      setupPayoff: model.connections.some((item) => item.overlay === "setup-payoff" && item.source === "explicit"),
      causality: model.connections.some((item) => item.overlay === "causality"),
      sharedLayout: readStoryworldMapSharedLayout(project),
      svgStructured: svg.includes("<svg") && svg.includes(first.id) && svg.includes("<title"),
      htmlAccessible: html.includes("Accessible Storyworld Map index") && html.includes("<table"),
    }));
  `;
  const result = JSON.parse(execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", program],
    { cwd: root, encoding: "utf8" },
  ));
  assert.equal(result.cards, 96);
  assert.ok(result.selectedConnections >= 2);
  assert.equal(result.setupPayoff, true);
  assert.equal(result.causality, true);
  assert.equal(result.sharedLayout.mode, "map");
  assert.equal(result.sharedLayout.granularity, "production-shot");
  assert.equal(result.svgStructured, true);
  assert.equal(result.htmlAccessible, true);
});

test("the map includes a complete accessible table, structured export and responsive safeguards", async () => {
  const [wall, map, css, docs] = await Promise.all([
    source("../app/mini-block-wall.tsx"),
    source("../lib/storyworld-map.ts"),
    source("../app/storyworld-map.module.css"),
    source("../docs/ISSUE-195-STORYWORLD-MAP.md"),
  ]);
  assert.match(wall, /Storyworld Map table alternative/);
  assert.match(wall, /Export structured SVG/);
  assert.match(wall, /Export self-contained HTML/);
  assert.match(map, /role="img"/);
  assert.match(map, /aria-labelledby="title description"/);
  assert.match(map, /Accessible Storyworld Map index/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow: auto/);
  assert.match(docs, /content visibility boundary continues to virtualize/i);
});

test("Issue 195 test is registered", async () => {
  const packageJson = JSON.parse(await source("../package.json"));
  assert.match(packageJson.scripts.test, /issue-195-storyworld-map\.test\.mjs/);
  assert.equal(packageJson.scripts["test:storyworld-map"], "node --test tests/issue-195-storyworld-map.test.mjs");
});
