import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const markerPath = "modules/build/decisions/visual-story-decision-markers.ts";
const uiPath = "modules/build/ui/progressive-story-map.tsx";

test("#1420 maps only explicit Story Decision Block refs onto canonical visible targets", async () => {
  const marker = await source(markerPath);

  assert.match(marker, /\^ppf:build:block:\(\\d\{1,2\}\)/);
  assert.match(marker, /\^block-\(\\d\{1,2\}\)/);
  assert.match(marker, /number >= 1 && number <= 24/);
  assert.match(marker, /`block-\$\{String\(number\)\.padStart\(2, "0"\)\}`/);
  assert.match(marker, /new Set\(decision\.targetRefs\.map\(canonicalBlockId\)\.filter\(Boolean\)\)/);
  assert.doesNotMatch(marker, /screenplay|character|location|storyBeat|localStorage|saveFoundationProject|applyStoryCommand/);
});

test("#1420 preserves Story Decision lifecycle truth on the visual map", async () => {
  const marker = await source(markerPath);

  assert.match(marker, /HIDDEN_STATUSES = new Set\(\["superseded", "withdrawn"\]\)/);
  assert.match(marker, /decision\.status === "stale" \|\| decision\.baseRevision !== String\(currentRevision\)/);
  assert.match(marker, /needsWorkbench: decision\.status === "answered"/);
  assert.match(marker, /Story Decisions remain non-canon review records/);
});

test("#1420 exposes Decision markers on the same BUILD Block without creating another decision store", async () => {
  const [marker, ui] = await Promise.all([source(markerPath), source(uiPath)]);

  assert.match(ui, /authenticatedProfileFetch\(`\/api\/story-decisions\?projectId=\$\{encodeURIComponent\(project\.id\)\}`/);
  assert.match(ui, /deriveVisualStoryDecisionMarkers\(body\.decisions \?\? \[\], project\.revision\)/);
  assert.match(ui, /data-story-decision-count=\{blockDecisionCount\}/);
  assert.match(ui, /data-story-decision-target=\{selected\.id\}/);
  assert.match(ui, /NEEDS HUMAN/);
  assert.match(ui, /WORKBENCH/);
  assert.match(ui, /STALE/);
  assert.match(ui, /These markers are read-only review records\. They do not change PPF canon/);
  assert.match(ui, /\/story-workbench\?decisionId=/);
  assert.match(ui, /href: "\/story-decisions"/);
  assert.doesNotMatch(`${marker}\n${ui}`, /plotpickle\.project\.v1|decisionMarkers.*localStorage|\/api\/story-decisions[\s\S]{0,120}method:\s*"POST"/);
});

test("#1420 treats Story Decision marker loading as advisory rather than blocking BUILD", async () => {
  const ui = await source(uiPath);

  assert.match(ui, /setDecisionMarkers\(\[\]\)/);
  assert.match(ui, /Story Decision markers are temporarily unavailable/);
  assert.match(ui, /No active Story Decision targets this Block/);
  assert.match(ui, /answered choices still require Story Workbench validation/);
});
