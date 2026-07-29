import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const model = read("app/beginner-experience.ts");
const welcome = read("app/welcome/page.tsx");
const start = read("app/start-here/page.tsx");
const examples = read("app/worked-examples/page.tsx");
const readiness = read("app/screenplay-readiness/page.tsx");
const middleware = read("middleware.ts");
const main = read("app/page.tsx");

test("welcome offers all six optional Simple Start entry routes", () => {
  for (const label of ["I have an idea", "Create a new screenplay", "Continue my screenplay", "Import an existing screenplay", "Explore Afterglow", "Learn how screenplays work"]) assert.match(welcome, new RegExp(label));
  assert.match(welcome, /A visual storyworld for seeing the movie before full production/);
  assert.match(welcome, /Afterglow: Reflections of Sentience/);
  assert.match(welcome, /FIVE_KEY_SELLING_POINTS\.map/);
  assert.match(welcome, /LEARNING_MODULE_COUNT/);
  assert.match(welcome, /Complete Learning Library/);
});

test("the root opens the updated splash while Welcome remains an optional guided route", () => {
  assert.match(middleware, /pathname !== "\/"/);
  assert.match(middleware, /optional Simple Start route/);
  assert.match(middleware, /return NextResponse\.next\(\)/);
  assert.doesNotMatch(middleware, /NextResponse\.redirect/);
  assert.match(main, /const \[showLanding, setShowLanding\] = useState\(true\)/);
  assert.match(welcome, /Simple Start · optional guided entry/);
  assert.doesNotMatch(welcome, /plotpickle-open-last/);
});

test("beginner journey has eight ordered stages and plain-language rules", () => {
  for (const title of ["Find the movie", "Build the people and world", "Shape the whole story", "Break it into playable moments", "Write the treatment", "Write the screenplay", "Revise and test", "Finish and share"]) assert.match(model, new RegExp(title));
  assert.match(start, /Complete Learning Library/);
  assert.match(start, /Guidance for this step/);
  assert.match(start, /Nothing here is a pass\/fail test/);
  for (const state of ["Not started", "Exploring", "Working draft", "Reviewed", "Approved for this draft", "Needs continuity check"]) assert.match(start, new RegExp(state));
  assert.match(start, /Skip for now/);
  assert.match(start, /Return this step to the journey/);
});

test("guided routes keep the same workspace", () => {
  assert.match(start, /workspaceHref/);
  assert.match(start, /workspace=1/);
  assert.match(readiness, /readinessHref/);
  assert.match(readiness, /tab=planner&section=coreModel/);
});

test("onboarding edits the canonical project rather than a separate schema", () => {
  assert.match(start, /plotpickle\.project\.v1/);
  assert.match(start, /normalizePlotPickleProject/);
  assert.doesNotMatch(start, /createBlankProject/);
  assert.match(welcome, /plotpickle\.project\.v1/);
});

test("minimum worked example set is present with before, after and reasoning", () => {
  const ids = ["idea-premise", "logline-clearer", "want-need", "ghost-backstory", "character-card", "relationship-pressure", "world-rule", "block-four-movements", "scene-playable", "mini-treatment", "treatment-to-action", "dialogue-conflict", "filmable-action", "setup-payoff", "continuity-correction", "visual-ingredients", "proposal-decision"];
  for (const id of ids) assert.match(model, new RegExp(`id: "${id}"`));
  assert.match(examples, /Before or incomplete/);
  assert.match(examples, /What is unclear/);
  assert.match(examples, /After or stronger/);
  assert.match(examples, /Why it works better/);
  assert.match(examples, /Use this reasoning in my project/);
});

test("readiness avoids one quality score and separates result types", () => {
  for (const kind of ["technical-problem", "craft-review", "optional-enhancement", "intentional-choice"]) assert.match(model, new RegExp(kind));
  for (const label of ["Ready for another writing pass", "Ready for trusted-reader feedback", "Ready for a table read", "Ready for pitch-package preparation", "Ready for screenplay export", "Ready for production planning"]) assert.match(model, new RegExp(label));
  assert.match(readiness, /Readiness is a stated next use, not a single quality score/);
  assert.match(readiness, /Open exact item/);
  assert.match(readiness, /Save a backup/);
});

test("readiness covers story, structure, characters, pages, continuity and rights", () => {
  for (const category of ["Story foundation", "Structure", "Characters", "Scenes and screenplay pages", "Continuity and revision", "Rights and export"]) assert.match(model, new RegExp(category));
  assert.match(model, /rights-review-needed/);
  assert.match(model, /revision snapshots/);
  assert.match(model, /complete-script document/);
});
