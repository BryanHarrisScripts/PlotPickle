import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspacePath = "modules/learn/ui/learn-workspace.tsx";
const cssPath = "modules/learn/ui/learn-workspace.module.css";

test("LEARN curriculum sections collapse, expand and number lessons locally", async () => {
  const workspace = await readFile(workspacePath, "utf8");
  const foundations = JSON.parse(await readFile("learn/foundations.json", "utf8"));

  assert.equal(foundations.lessons.length, 4);
  assert.match(workspace, /collapsedTopics/);
  assert.match(workspace, /toggleTopic/);
  assert.match(workspace, /aria-expanded=\{!collapsed\}/);
  assert.match(workspace, /topicChevron/);
  assert.match(workspace, /group\.lessons\.map\(\(lesson, lessonIndex\)/);
  assert.match(workspace, /String\(lessonIndex \+ 1\)\.padStart\(2, "0"\)/);
  assert.doesNotMatch(workspace, /String\(lesson\.number\)\.padStart\(2, "0"\)/);
});

test("LEARN keeps completion marks in the list and removes crossed-out lesson styling", async () => {
  const workspace = await readFile(workspacePath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(workspace, /lessonCompleteMark/);
  assert.match(workspace, /aria-label=\{completed\.has\(lesson\.id\) \? "Completed" : "Not completed"\}/);
  assert.match(css, /\.lessonCompleteMark \{[^}]*text-decoration: none/s);
  assert.doesNotMatch(css, /line-through/);
});

test("LEARN Creative Room uses parchment frames instead of thin right-panel borders", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--parchment-edge/);
  assert.match(css, /--parchment-gold/);
  assert.match(css, /\.room \{[^}]*border-left: 0/s);
  assert.match(css, /\.room \{[^}]*inset 5px 0 rgba\(125, 95, 51, 0\.34\)/s);
  assert.match(css, /\.writerMessage,\s*\.guideMessage \{[^}]*border: 2px double rgba\(200, 148, 70, 0\.42\)/s);
  assert.match(css, /\.composer \{[^}]*border-top: 2px double rgba\(200, 148, 70, 0\.55\)/s);
});
