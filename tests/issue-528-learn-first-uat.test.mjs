import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #528 locks the reviewed Learn-first matte-black teal-orange wireframe", async () => {
  const [layout, css, renderedCss, router, wireframe] = await Promise.all([
    source("app/layout.tsx"),
    source("app/learn-first-phase-528.css"),
    source("app/learn-first-phase-528-rendered.css"),
    source("app/learn-entry-router.tsx"),
    source("docs/wireframes/issue-528-learn-first.md"),
  ]);

  assert.match(layout, /import "\.\/learn-first-phase-528\.css";/);
  assert.match(layout, /import "\.\/learn-first-phase-528-rendered\.css";/);
  assert.ok(layout.indexOf("learning-studio-phase-b-compat.css") < layout.indexOf("learn-first-phase-528.css"), "Issue #528 treatment must load after legacy Learn compatibility CSS");
  assert.ok(layout.indexOf("feedback-studio.css") < layout.indexOf("learn-first-phase-528-rendered.css"), "Rendered Learn correction must load last");
  for (const contract of ["#070706", "#22bfae", "#ffad73", "#0f776e", "Courier New", "LEARN / STORY CRAFT"]) {
    assert.ok(`${css}\n${renderedCss}`.includes(contract), `Learn-first styling is missing: ${contract}`);
  }
  assert.match(renderedCss, /data-plotpickle-learn-screen/);
  assert.match(renderedCss, /data-plotpickle-core-learn/);
  assert.match(renderedCss, /nav\[aria-label="Learning Studio views"\]/);
  assert.match(router, /plotpickleLearnScreen/);
  assert.match(router, /plotpickleCoreLearn/);
  assert.doesNotMatch(renderedCss, /#2f7d7a|#286f73|#3c8385|purple|#7c3aed/i);
  for (const phrase of ["matte black", "muted teal-orange", "81 modules", "Current story position", "Core Curriculum", "UAT acceptance path"]) {
    assert.match(wireframe, new RegExp(phrase, "i"));
  }
});

test("issue #528 keeps Learn inside the same PlotPickle story and repairs legacy read-learn returns", async () => {
  const [learn, router] = await Promise.all([
    source("app/learning-studio.tsx"),
    source("app/learn-entry-router.tsx"),
  ]);

  for (const behavior of [
    "plotpickle-learning-progress:${project.id}",
    "plotpickle-workflow-choice:${project.id}",
    "Current story position",
    "Complete Learning Library",
    "Core Curriculum",
    "Mark module complete",
    "Apply it to Block",
  ]) assert.ok(learn.includes(behavior), `Learn engine contract is missing: ${behavior}`);

  assert.match(router, /a\[href\^="\/read-learn"\]/);
  assert.match(router, /workspace", "learn"/);
  assert.match(router, /view", "library"/);
  assert.match(router, /source\.searchParams\.forEach/);
});

test("issue #528 expands Creative Writer UAT through project learning and Core evidence", async () => {
  const uat = await source("scripts/run-creative-writer-uat.mjs");
  for (const stage of [
    "Learn Entry",
    "Learning Route",
    "Learn Module",
    "Learning Progress Persistence",
    "Apply Lesson to Story",
    "Core Curriculum",
    "Core Learning Evidence",
    "Return to Learn",
  ]) assert.ok(uat.includes(stage), `Creative Writer UAT is missing Learn stage: ${stage}`);

  for (const storageContract of [
    "plotpickle-learning-progress:",
    "plotpickle-workflow-choice:",
    "plotpickle-core-route:",
    "plotpickle-core-reading.v1",
    "PLOTPICKLE_CORE_LEARNING_RECORD",
  ]) assert.ok(uat.includes(storageContract), `Creative Writer UAT is missing persistence evidence: ${storageContract}`);

  assert.match(uat, /Scope: creative \+ Learn/);
  assert.match(uat, /Cloud AI required: no/);
  assert.match(uat, /no external writes/);
  assert.match(uat, /learnState\.completed\.includes\("pitch"\)/);
  assert.match(uat, /learnState\.coreEvidenceCount >= 1/);
});

test("issue #528 rendered evidence captures Learn library and Core Curriculum", async () => {
  const registry = JSON.parse(await source("config/visual-capture-registry.json"));
  const byId = new Map(registry.screens.map((screen) => [screen.id, screen.path]));
  assert.equal(byId.get("learn"), "/?workspace=learn");
  assert.equal(byId.get("learn-library"), "/?workspace=learn&view=library&module=pitch");
  assert.equal(byId.get("learn-core"), "/core-curriculum");
});
