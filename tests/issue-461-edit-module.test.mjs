import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#461 exposes Edit as a real primary Studio module after Write", async () => {
  const [direction, shell, route] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/application-shell-header.tsx"),
    source("app/edit/page.tsx"),
  ]);

  const writeIndex = direction.indexOf('label: "Write"');
  const editIndex = direction.indexOf('label: "Edit"');
  const graphicNovelIndex = direction.indexOf('label: "Graphic Novel"');
  assert.ok(writeIndex >= 0 && editIndex > writeIndex && graphicNovelIndex > editIndex);
  assert.match(direction, /id: "edit", label: "Edit"/);
  assert.match(shell, /id === "edit"/);
  assert.match(shell, /window\.location\.assign\("\/edit"\)/);
  assert.match(route, /<EditWorkspace \/>/);
});

test("#461 Edit reads and writes the same canonical local project and screenplay elements", async () => {
  const edit = await source("app/edit-workspace.tsx");
  const page = await source("app/page.tsx");

  assert.match(edit, /const STORAGE_KEY = "plotpickle\.project\.v1"/);
  assert.match(page, /const STORAGE_KEY = "plotpickle\.project\.v1"/);
  assert.match(edit, /normalizePlotPickleProject\(JSON\.parse\(stored\)\)/);
  assert.match(edit, /project\.screenplay\.draftElements\.filter/);
  assert.match(edit, /reconcileProductionDraft\(project\.screenplay, nextElements\)/);
  assert.match(edit, /element\.id === id/);
  assert.match(edit, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(stamped\)\)/);
  assert.match(edit, /same canonical screenplay used by Write/i);
  assert.match(edit, /Edit never creates a shadow draft/i);
});

test("#461 Edit preserves Block, mini-block and owning-scene identity", async () => {
  const edit = await source("app/edit-workspace.tsx");

  assert.match(edit, /requestedNumber\("block", 1, 1, 24\)/);
  assert.match(edit, /requestedNumber\("mini", 1, 1, 4\)/);
  assert.match(edit, /buildGlobalSceneIndex\(project\.blocks\)/);
  assert.match(edit, /entry\.blockNumber === blockNumber && entry\.miniBlockNumbers\.includes\(miniBlockNumber\)/);
  assert.match(edit, /element\.blockNumber === blockNumber/);
  assert.match(edit, /element\.miniBlockNumber === miniBlockNumber/);
  assert.match(edit, /`\/\?workspace=write&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}`/);
});

test("#461 Write hands its current canonical story position to Edit", async () => {
  const handoff = await source("app/write-edit-handoff.tsx");

  assert.match(handoff, /workspace"\) !== "write"/);
  assert.match(handoff, /nav\[aria-label="Screenplay blocks"\]/);
  assert.match(handoff, /miniNavigator/);
  assert.match(handoff, /`\/edit\?block=\$\{moment!\.block\}&mini=\$\{moment!\.mini\}`/);
  assert.match(handoff, /Review in Edit/);
  assert.match(handoff, /setTimeout\(\(\) => window\.location\.assign\(href\), 420\)/);
  assert.doesNotMatch(handoff, /setProject|fetch\(|provider|apiKey/i);
});

test("#461 Edit exposes the five approved deterministic review lenses without provider plumbing", async () => {
  const edit = await source("app/edit-workspace.tsx");

  for (const label of ["Scene", "Dialogue", "Action", "Pacing", "Continuity"]) assert.ok(edit.includes(`label: "${label}"`), `Missing Edit lens: ${label}`);
  assert.match(edit, /Edit diagnoses and proposes; the writer decides whether any wording becomes canon/);
  assert.doesNotMatch(edit, /\/api\/local-ai|fetch\(|Ollama|ComfyUI|MiniMax|checkpoint|endpoint|apiKey/i);
});

test("#461 Edit manual changes preserve human control and the read-only example boundary", async () => {
  const edit = await source("app/edit-workspace.tsx");

  assert.match(edit, /isAfterglowExampleProject\(project\)/);
  assert.match(edit, /Afterglow is a read-only example/);
  assert.match(edit, /readOnly=\{readOnly \|\| element\.locked\}/);
  assert.match(edit, /onChange=\{\(event\) => updateElement\(element\.id, event\.target\.value\)\}/);
  assert.match(edit, /Locked in the production draft/);
});

test("#461 explicit proposal decisions never silently replace canon", async () => {
  const [edit, decisions] = await Promise.all([
    source("app/edit-workspace.tsx"),
    source("app/edit-decision-panel.tsx"),
  ]);

  for (const action of ["Accept change", "Rewrite myself", "Ignore", "Compare"]) assert.ok(decisions.includes(action), `Missing Edit decision: ${action}`);
  assert.match(decisions, /Nothing changes until Accept change is pressed/);
  assert.match(decisions, /setIgnored\(true\)/);
  assert.match(decisions, /aria-pressed=\{compare\}/);
  assert.match(edit, /createRevisionSnapshot\(/);
  assert.match(edit, /Before Edit acceptance/);
  assert.match(edit, /reconcileProductionDraft\(baseline\.screenplay, nextElements\)/);
  assert.match(edit, /data-edit-element-id=\{element\.id\}/);
  assert.match(edit, /target\?\.focus\(\)/);
  assert.match(edit, /disabled=\{readOnly \|\| Boolean\(reviewElement\?\.locked\)\}/);
});

test("#461 Edit visually follows the matte-black teal-orange Studio system", async () => {
  const [styles, decisions] = await Promise.all([
    source("app/edit-workspace.module.css"),
    source("app/edit-decision-panel.css"),
  ]);

  assert.match(styles, /#090909/i);
  assert.match(styles, /#22bfae/i);
  assert.match(styles, /Georgia/);
  assert.match(styles, /grid-template-columns:210px minmax\(560px,1fr\) 310px/);
  assert.match(styles, /activeLens/);
  assert.match(styles, /scriptPanel/);
  assert.match(styles, /reviewPanel/);
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.match(decisions, /#22bfae/i);
  assert.match(decisions, /edit-decision-compare/);
});

test("#461 mounts the Write to Edit handoff and decision styling without replacing Writer state", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /import WriteEditHandoff/);
  assert.match(layout, /<WriteEditHandoff \/>/);
  assert.match(layout, /write-edit-handoff\.css/);
  assert.match(layout, /edit-decision-panel\.css/);
});
