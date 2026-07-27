import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("issue #122 consolidates Table Read inside Feedback instead of creating another engine", async () => {
  const [feedback, dialogue] = await Promise.all([
    source("app/feedback-workspace.tsx"),
    source("app/dialogue-in-motion/page.tsx"),
  ]);
  assert.match(feedback, /<TableReadPanel/);
  assert.match(feedback, /section === "table-read"/);
  assert.match(dialogue, /Continue rehearsal in Feedback/);
  assert.match(dialogue, /does not maintain a second Table Read engine/);
  assert.doesNotMatch(dialogue, /type TableReadObservation|saveTableReadObservation/);
});

test("issue #122 keeps every playable item linked to stable screenplay and scene targets", async () => {
  const model = await source("lib/table-read.ts");
  for (const contract of [
    "TableReadItem",
    "ScreenplayDraftElement",
    "screenplayElementId: element.id",
    "sceneId",
    "targetForElement",
    "itemsForTableReadScope",
    '"scene" | "sequence" | "screenplay"',
  ]) assert.ok(model.includes(contract), `Missing stable Table Read contract: ${contract}`);
  assert.doesNotMatch(model, /tableReadDatabase|localStorage|sessionStorage|indexedDB/);
});

test("issue #122 uses local browser speech with voice assignment navigation and timing", async () => {
  const panel = await source("app/table-read-panel.tsx");
  for (const contract of [
    "speechSynthesis",
    "SpeechSynthesisUtterance",
    "Browser voices work locally",
    "External voice providers remain optional and cannot alter canon",
    "Previous scene",
    "Previous line",
    "Pause",
    "Resume",
    "Next line",
    "Next scene",
    "Estimated",
    "Actual session",
  ]) assert.ok(panel.includes(contract), `Missing playback capability: ${contract}`);
});

test("issue #122 reuses character data for voices and creates actor sides plus pronunciation rules", async () => {
  const [model, panel] = await Promise.all([source("lib/table-read.ts"), source("app/table-read-panel.tsx")]);
  for (const contract of ["voiceAssignments", "narratorVoiceURI", "actorSides", "cue", "applyTableReadPronunciations"]) {
    assert.ok(model.includes(contract), `Missing voice or actor-side contract: ${contract}`);
  }
  for (const phrase of ["Voice assignment and pronunciation", "Narrator", "Written phrase", "Speak as", "Actor sides", "Copy actor sides"]) {
    assert.ok(panel.includes(phrase), `Missing voice or sides interaction: ${phrase}`);
  }
});

test("issue #122 records line-level rehearsal notes as canonical unified Feedback", async () => {
  const model = await source("lib/table-read.ts");
  assert.match(model, /recordTableReadNote/);
  assert.match(model, /createFeedback\(updated/);
  assert.match(model, /source: "table-read"/);
  assert.match(model, /category: "performance"/);
  assert.match(model, /target,/);
  const panel = await source("app/table-read-panel.tsx");
  assert.match(panel, /Save as Feedback/);
  assert.match(panel, /current\.target/);
});

test("issue #122 stores session history summaries and reports in canonical review threads", async () => {
  const model = await source("lib/table-read.ts");
  for (const contract of [
    "TableReadSession",
    "tableReadSessions",
    "project.review.threads",
    "completedElementIds",
    "notes",
    "summary",
    "actualDurationSeconds",
    "finishTableReadSession",
    "tableReadSessionReport",
  ]) assert.ok(model.includes(contract), `Missing session or report contract: ${contract}`);
  assert.doesNotMatch(model, /apiKey|accessToken|refreshToken|clientSecret|audioBlob|recordingData/);
});

test("issue #122 is registered in the repository test suite", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-122-table-read\.test\.mjs/);
  assert.equal(packageJson.scripts["test:table-read"], "node --test tests/issue-122-table-read.test.mjs");
});
