import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #444 Phase B keeps Learn inside the Studio shell and preserves the learning engine", async () => {
  const [layout, css, learn, wireframe] = await Promise.all([
    source("app/layout.tsx"),
    source("app/learning-studio-phase-b.css"),
    source("app/learning-studio.tsx"),
    source("docs/wireframes/issue-444-phase-b-learn.md"),
  ]);

  assert.match(layout, /learning-studio-phase-b\.css/);
  for (const contract of [
    "#080808",
    "#cda758",
    "position: fixed",
    "learning-studio_viewTabs",
    "learning-studio_header",
    "learning-studio_moduleCard",
  ]) assert.ok(css.includes(contract), `Learn Studio styling is missing: ${contract}`);

  for (const behavior of [
    "plotpickle-learning-progress",
    "blockNumber",
    "miniBlockNumber",
    "courseModules",
    "onOpenScreenplay",
    "onOpenTreatment",
  ]) assert.ok(learn.includes(behavior), `Learn engine contract is missing: ${behavior}`);

  assert.match(wireframe, /24 Block \/ 96 mini-block architecture/);
  assert.match(wireframe, /real rendered desktop Learn capture/);
});
