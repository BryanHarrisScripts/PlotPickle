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
  assert.doesNotMatch(workspace, /I understand this module/);
  assert.doesNotMatch(workspace, /setLessonUnderstood/);
  assert.match(css, /\.lessonCompleteMark \{[^}]*text-decoration: none/s);
  assert.doesNotMatch(css, /\.understood/);
  assert.doesNotMatch(css, /line-through/);
});

test("LEARN Creative Room uses parchment frames instead of thin right-panel borders", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--parchment-edge/);
  assert.match(css, /--parchment-gold/);
  assert.match(css, /\.room \{[^}]*border-left: 0/s);
  assert.match(css, /\.curriculum \{[^}]*border-right: 0/s);
  assert.match(css, /\.room \{[^}]*box-shadow: none/s);
  assert.match(css, /border-image-source: url\("\/assets\/learn\/curriculum-scroll-frame\.png"\)/);
  assert.match(css, /url\("\/assets\/learn\/dark-parchment-paper\.png"\)/);
  assert.match(css, /\.composer \{[^}]*border-top: 0/s);
});

test("Creative Room starts fresh without a visible reset control", async () => {
  const workspace = await readFile(workspacePath, "utf8");

  assert.doesNotMatch(workspace, /THREAD_PREFIX/);
  assert.doesNotMatch(workspace, /loadMessages/);
  assert.doesNotMatch(workspace, /startFreshConversation/);
  assert.doesNotMatch(workspace, /Start fresh/);
  assert.match(workspace, /composerField/);
  assert.match(workspace, /aria-label="Ask the Guide"/);
});
