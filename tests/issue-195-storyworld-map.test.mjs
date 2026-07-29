import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const [mapSource, panelSource, wallSource, buildSource, pitchSource, projectSource, documentation] = await Promise.all([
  readFile(new URL("../lib/storyworld-map.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/storyworld-map-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/mini-block-wall.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/build-workspace.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/pitch-review.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/project.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/ISSUE-195-STORYWORLD-MAP.md", import.meta.url), "utf8"),
]);

test("Issue 195 converts the existing Whole Film wall instead of adding a workspace or story model", () => {
  assert.match(buildSource, /<MiniBlockWall/);
  assert.match(wallSource, /Construction wall/);
  assert.match(wallSource, /Storyworld Map/);
  assert.match(wallSource, /Accessible table/);
  assert.match(wallSource, /StoryworldMapPanel/);
  assert.doesNotMatch(projectSource, /storyworldMap:\s*{/);
  assert.match(mapSource, /buildStoryDependencies\(project\)/);
  assert.match(documentation, /same Build workspace/i);
  assert.match(documentation, /never becomes a second canonical story graph/i);
});

test("Storyworld Map exposes semantic zoom, evidence overlays, shared layout and accessible output", () => {
  for (const marker of [
    '"movie"',
    '"act"',
    '"sequence"',
    '"block"',
    '"scene"',
    '"mini-block"',
    '"production-shot"',
    "Show why this connects",
    "Relationship overlays",
    "Save shared layout",
    "<table",
    "Export SVG",
    "Export HTML",
    "Local map viewport controls",
  ]) assert.match(`${mapSource}\n${panelSource}\n${wallSource}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(mapSource, /STORYWORLD_MAP_LAYOUT_EXTENSION/);
  assert.match(mapSource, /sourceNodeIds/);
  assert.match(pitchSource, /buildStoryworldMapSvg/);
  assert.match(wallSource, /draggable=\{state\.display === "wall"\}/);
});

test("the derived map is deterministic and its optional layout survives PPF round-trip", () => {
  const program = String.raw`
    import { createBlankProject } from "./lib/project.ts";
    import { createShotFromFrame } from "./lib/preproduction.ts";
    import {
      buildStoryworldMapHtml,
      buildStoryworldMapSvg,
      createStoryworldMapItems,
      createStoryworldMapModel,
      readStoryworldMapSharedLayout,
      saveStoryworldMapSharedLayout,
      storyworldConnectionsForItem,
    } from "./lib/storyworld-map.ts";
    import { createPortableProjectFile, parsePortableProjectFile, serializePortableProjectFile } from "./lib/project-package.ts";
    import { buildPitchPackageHtml } from "./lib/pitch-review.ts";

    let project = createBlankProject();
    project.metadata.title = "Afterglow Map Contract";
    const first = project.blocks[0].scenes[0].miniBlocks[0];
    const second = project.blocks[0].scenes[0].miniBlocks[1];
    const last = project.blocks.at(-1).scenes[0].miniBlocks.at(-1);
    first.purpose = "Open on the impossible image";
    first.turn = "The world answers back";
    first.setup = "memory key";
    second.objective = "Follow the answer";
    last.payoff = "memory key";
    project.blocks[0].visuals[0].src = "/api/local-ai/assets/afterglow-map.webp";
    project.blocks[0].visuals[0].continuity = "Ava keeps the same silver coat.";
    project = createShotFromFrame(project, 1, project.blocks[0].scenes[0].id, project.blocks[0].visuals[0].id);

    const firstModel = createStoryworldMapModel(project);
    const secondModel = createStoryworldMapModel(project);
    const counts = Object.fromEntries(["movie", "act", "sequence", "block", "scene", "mini-block", "production-shot"].map((granularity) => [
      granularity,
      createStoryworldMapItems(project, firstModel, granularity).length,
    ]));
    const miniItems = createStoryworldMapItems(project, firstModel, "mini-block");
    const firstItem = miniItems[0];
    const firstEvidence = storyworldConnectionsForItem(firstModel, firstItem, ["causality", "setup-payoff"]);

    project = saveStoryworldMapSharedLayout(project, {
      mode: "map",
      granularity: "production-shot",
      overlays: ["visual-continuity", "render-readiness", "warnings"],
      emphasizedNodeIds: [project.production.shots[0].id],
    });
    const portable = createPortableProjectFile(project, "test", [], "2026-07-29T00:00:00.000Z");
    const roundTrip = parsePortableProjectFile(serializePortableProjectFile(portable)).project;
    const shared = readStoryworldMapSharedLayout(roundTrip);
    const svg = buildStoryworldMapSvg(roundTrip);
    const html = buildStoryworldMapHtml(roundTrip);
    const pitch = buildPitchPackageHtml(roundTrip);

    process.stdout.write(JSON.stringify({
      deterministic: JSON.stringify(firstModel.connections) === JSON.stringify(secondModel.connections),
      cards: firstModel.cards.length,
      counts,
      evidence: firstEvidence.length,
      explicitSetupPayoff: firstModel.connections.some((connection) => connection.overlay === "setup-payoff" && connection.source === "explicit"),
      hookMarker: firstModel.markers.some((marker) => marker.overlay === "hooks-turns"),
      visualMarker: firstModel.markers.some((marker) => marker.overlay === "visual-continuity"),
      renderMarker: firstModel.markers.some((marker) => marker.overlay === "render-readiness"),
      shared,
      svgIdentity: svg.includes(first.id) && svg.includes("Storyworld Map"),
      htmlTable: html.includes("Accessible Storyworld Map index") && html.includes("<table>"),
      pitchMap: pitch.includes("Storyworld Map") && pitch.includes("<svg"),
    }));
  `;

  const result = JSON.parse(execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", program],
    { cwd: root, encoding: "utf8" },
  ));

  assert.equal(result.deterministic, true);
  assert.equal(result.cards, 96);
  assert.deepEqual(result.counts, {
    movie: 1,
    act: 4,
    sequence: 12,
    block: 24,
    scene: 48,
    "mini-block": 96,
    "production-shot": 1,
  });
  assert.ok(result.evidence > 0);
  assert.equal(result.explicitSetupPayoff, true);
  assert.equal(result.hookMarker, true);
  assert.equal(result.visualMarker, true);
  assert.equal(result.renderMarker, true);
  assert.equal(result.shared.mode, "map");
  assert.equal(result.shared.granularity, "production-shot");
  assert.deepEqual(result.shared.overlays, ["visual-continuity", "render-readiness", "warnings"]);
  assert.equal(result.svgIdentity, true);
  assert.equal(result.htmlTable, true);
  assert.equal(result.pitchMap, true);
});

test("Issue 195 keeps viewport state local and adds only an optional versioned PPF extension", async () => {
  assert.match(mapSource, /STORYWORLD_MAP_LAYOUT_VERSION = 1/);
  assert.match(mapSource, /emphasizedNodeIds/);
  assert.doesNotMatch(mapSource, /pan:\s*{/);
  assert.doesNotMatch(mapSource, /zoom:/);
  assert.match(wallSource, /wallStateByProject/);

  for (const path of [
    "../schema/plotpickle-project.schema.json",
    "../schema/plotpickle-project-v1.7.schema.json",
  ]) {
    const schema = JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
    assert.equal(schema.properties.extensions.type, "object");
    assert.equal(schema.properties.extensions.additionalProperties, true);
    assert.ok(!schema.required.includes("extensions"));
  }
});
