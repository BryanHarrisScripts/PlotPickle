import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("LEARN keeps its detailed eleven-lesson curriculum while the matched PLAN path is routed separately", async () => {
  const [catalog, deep, material, page] = await Promise.all([
    read("adapters/curriculum/current-catalog.ts"),
    read("adapters/curriculum/foundation-deep-learning.ts"),
    read("adapters/curriculum/foundation-course-material.ts"),
    read("app/page.tsx"),
  ]);

  assert.match(catalog, /buildDeepFoundationCurriculum/);
  assert.match(catalog, /lesson\.number !== index \+ 1/);
  assert.match(deep, /FOUNDATION_LESSON_MATERIAL/);
  assert.match(deep, /Apply this to your story/);
  assert.match(deep, /storyOutputs/);
  assert.doesNotMatch(deep, /\.\.\.lesson\.sections/);
  assert.match(material, /A screenplay is a connected story system/);
  assert.match(material, /A development logline must carry the middle/);
  assert.match(material, /Turn theme into a question with credible answers/);
  assert.match(material, /Worked example: Mara's Foundations Brief/);
  assert.match(material, /ending-proof test/);
  assert.doesNotMatch(deep, /\bPLAN\b|planOutput/);
  assert.match(page, /FoundationsPlanWorkspace/);
  assert.match(page, /workspace.*=== "plan"/s);
});

test("Foundations follows a beginner-first sequence with explicit transitions and practice", async () => {
  const [material, workspace] = await Promise.all([
    read("adapters/curriculum/foundation-course-material.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  const sequence = [
    "The Anatomy of a Screenplay",
    "The Screenwriting Essentials Roadmap",
    "Story Essentials: Theme, Plot, Character and Stakes",
    "The Pitch",
    "Loglines That Carry the Movie",
    "Crafting and Testing Loglines",
    "Why PlotPickle Works in Layers",
    "Screenplay Essentials: Structure, Dialogue and Visuals",
    "Pacing and Tone: Storytelling Dynamics",
    "Pitch Components and Project Positioning",
    "Build the Story Experience",
  ];
  let priorIndex = -1;
  for (const title of sequence) {
    const index = material.indexOf(`  "${title}",`, priorIndex + 1);
    assert.ok(index > priorIndex, `${title} should follow the previous beginner lesson`);
    priorIndex = index;
  }

  assert.match(material, /Welcome to Foundations/);
  assert.match(material, /provisional baseline/);
  assert.match(material, /Lessons 5 and 6/);
  assert.match(material, /Use the 24-Block grid as a working resolution, not a timing law/);
  assert.match(material, /Use the outputs from Lessons 1–10/);
  assert.match(workspace, /Practice: apply this lesson/);
  assert.match(workspace, /activeLesson\.exercise/);
  assert.match(workspace, /activeLesson\.apply/);
});
