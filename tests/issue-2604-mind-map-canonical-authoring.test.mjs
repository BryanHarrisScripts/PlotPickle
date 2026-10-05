import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const TOPICS = [
  ["foundations", "foundations"],
  ["world", "world"],
  ["character", "character"],
  ["theme", "theme"],
  ["structure", "structure"],
  ["previs", "visual-storytelling"],
  ["drafting", "drafting"],
  ["dialogue", "dialogue"],
  ["revision", "revision"],
  ["responsible-ai", "responsible-ai"],
  ["industry", "industry"],
  ["collaboration", "collaboration"],
];

test("#2604 derives canonical Mind Map fields from the complete twelve-topic Learn spine", async () => {
  const [model, spine] = await Promise.all([
    read("modules/learn/model/story-development-fields.ts"),
    read("modules/learn/model/story-learning-context.ts"),
  ]);

  assert.match(model, /LEARN_TOPIC_SPINE\.flatMap/u);
  assert.match(model, /lesson\.topic === topic\.learnTopicId/u);
  assert.match(model, /curriculumApplicationPrompts\(lesson\)/u);
  assert.match(model, /const fieldId = `output-\$\{index \+ 1\}`/u);
  assert.match(model, /storyDevelopmentCanonicalId\(topic\.id, lesson\.id, fieldId\)/u);
  assert.match(model, /actionLabel: "Ask Agent"/u);

  for (const [id, learnTopicId] of TOPICS) {
    assert.match(spine, new RegExp(`id: "${id}", label: "[^"]+", learnTopicId: "${learnTopicId}"`, "u"));
    const source = await readJson(`learn/${learnTopicId}.json`);
    assert.ok(source.lessons.length > 0, `${id} must retain at least one Learn lesson`);
  }
});

test("#2604 adds one project-level storyDevelopment store instead of a Mind Map-only value store", async () => {
  const [contract, library, browser] = await Promise.all([
    read("core/storage/library-project.ts"),
    read("core/storage/library-project.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);

  assert.match(contract, /export type StoryDevelopmentState/u);
  assert.match(contract, /readonly fields: Readonly<Record<string, StoryDevelopmentFieldState>>/u);
  assert.match(contract, /value: ""/u);
  assert.match(contract, /proposal: ""/u);
  assert.match(contract, /acceptedSource: null/u);
  assert.match(library, /readonly storyDevelopment: StoryDevelopmentState/u);
  assert.match(library, /createEmptyStoryDevelopmentState\(\)/u);
  assert.match(library, /normalizeStoryDevelopmentState\(source\.storyDevelopment\)/u);
  assert.match(browser, /normalizeStoryDevelopmentState\(incoming\.storyDevelopment\)/u);
  assert.match(browser, /initialized\.activeProject\.storyDevelopment/u);
  assert.doesNotMatch(contract, /readonly mindMap(?:Field)?Values?:/iu);
});

test("#2604 canonical adapter keeps Foundations and World in their existing truth stores", async () => {
  const adapter = await read("core/project/story-development.ts");

  assert.match(adapter, /field\.topicId === "foundations"[\s\S]*project\.foundations\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\]/u);
  assert.match(adapter, /field\.topicId === "world"[\s\S]*project\.world\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\]/u);
  assert.match(adapter, /createEmptyFoundationLessonAnswers\(\)/u);
  assert.match(adapter, /createEmptyWorldLessonAnswers\(\)/u);
  assert.match(adapter, /answers: \{ \.\.\.lesson\.answers, \[input\.field\.fieldId\]: value \}/u);
  assert.match(adapter, /storyDevelopment: metadata/u);
  assert.match(adapter, /acceptedSource: input\.source/u);
});

test("#2604 Mind Map directly edits canonical fields and removes the generic proposal workflow", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(surface, /const selectedTopicFields = canonicalFields\.filter\(\(field\) => field\.topicId === selectedTopic\)/u);
  assert.match(surface, /const selectedCanonicalFields = storyDevelopmentFieldsForAct\(selectedTopicFields, selectedAct\)/u);
  assert.match(surface, /data-canonical-field-id=\{field\.canonicalId\}/u);
  assert.match(surface, /value=\{fieldDrafts\[storageId\] \?\? persisted\.value\}/u);
  assert.match(surface, /writeStoryDevelopmentFieldValue/u);
  assert.match(surface, />Save Changes<\/button>/u);
  assert.match(surface, /selectedField\.actionLabel/u);
  assert.match(surface, />Use Suggestion<\/button>/u);
  assert.doesNotMatch(surface, /Develop Agent Proposals|Developing Agent Proposals|Generate Selected|Build Topic/u);
});

test("#2604 field-specific agent proposals stay proposals until the Human uses them", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const adapter = await read("core/project/story-development.ts");

  assert.match(surface, /MIND_MAP_CANONICAL_FIELD_PROPOSAL/u);
  assert.match(surface, /Create one proposal for \$\{field\.canonicalId\}/u);
  assert.match(surface, /Do not claim the proposal is accepted canon/u);
  assert.match(surface, /if \(hasActiveLibraryProject\(\)\) \{[\s\S]*writeStoryDevelopmentFieldProposal/u);
  assert.match(surface, /proposalDrafts\[storageId\] \?\? persisted\.proposal/u);
  assert.match(surface, /AGENT SUGGESTION · editable before use/u);
  assert.match(surface, /acceptStoryDevelopmentFieldProposal/u);
  assert.match(adapter, /source: "agent-proposal"/u);
  assert.match(adapter, /proposal: ""/u);
});

test("#2604 Blank stays empty while Afterglow Foundations populate the same canonical controls", async () => {
  const [library, adapter, snapshot] = await Promise.all([
    read("core/storage/library-project.ts"),
    read("core/project/story-development.ts"),
    readJson("data/afterglow-packaged-current/snapshot.json"),
  ]);

  assert.match(library, /createEmptyStoryDevelopmentState\(\)/u);
  assert.match(adapter, /project\.foundations\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\] \?\? ""/u);

  const project = snapshot.project;
  const values = Object.values(project.foundations.lessons)
    .flatMap((lesson) => Object.values(lesson.answers ?? {}))
    .filter((value) => typeof value === "string" && value.trim());
  assert.ok(values.length > 0);
  assert.match(values.join("\n"), /Afterglow|grieving AI creator|coastal journey/iu);
});

test("#2604 persistence path covers direct Human values and accepted agent proposals", async () => {
  const [surface, adapter, library] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/project/story-development.ts"),
    read("core/storage/library-project.ts"),
  ]);

  assert.match(surface, /persistCanonicalProject\(next\)/u);
  assert.match(surface, /saveDetachedLibraryProjectAs\(next, \{ title, format: "Feature" \}\)/u);
  assert.match(surface, /saveActiveLibraryProject\(next\)/u);
  assert.match(adapter, /revision: input\.project\.revision \+ 1/u);
  assert.match(adapter, /updatedAt: occurredAt/u);
  assert.match(library, /normalizeStoryDevelopmentState/u);
});

test("#2772 Mind Map agent proposals and accepted values use durable Library project storage", async () => {
  const [surface, browser] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/storage/project-library-browser.ts"),
  ]);

  for (const topic of ["foundations", "world", "character", "theme", "structure"]) {
    assert.ok(TOPICS.some(([id]) => id === topic), `missing durable Mind Map topic ${topic}`);
  }

  assert.match(surface, /saveActiveLibraryProject\(writeStoryDevelopmentFieldProposal\(\{/u);
  assert.match(surface, /acceptStoryDevelopmentFieldProposal\(\{ project: withProposal, field, act: selectedAct \}\)/u);
  assert.match(surface, /const saved = persistCanonicalProject\(next\)/u);
  assert.match(browser, /normalizeStoryDevelopmentState\(incoming\.storyDevelopment\)/u);
  assert.match(browser, /libraryCore\.saveProfileActiveProject/u);
});
