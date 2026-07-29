import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const legacySources = [
  "General - The Pitch",
  "General - Tropes and Genres",
  "General - Screenplays to Improv",
  "General - The Writing Process",
  "General - Concept to Draft",
  "General - World Building",
  "General - Story Bible - Character",
  "General - Story Bible",
  "General - The Vomit Draft",
  "Script Formatting",
  "General - Popular Books",
  "Screenplay Challenges Guide",
  "General - The Film Industry",
  "General - AI Framework Ideas",
];

const moduleIds = [
  "pitch",
  "genres",
  "structures",
  "writing-process",
  "concept-to-draft",
  "world-building",
  "character-bible",
  "story-bible",
  "pickle-draft",
  "formatting",
  "books-scripts",
  "challenges",
  "industry",
  "responsible-ai",
];

test("all fourteen General sources map to the existing fourteen modules", async () => {
  const core = await source("app/learning-core-curriculum.ts");
  for (const legacy of legacySources) assert.ok(core.includes(`legacy: "${legacy}"`), `Missing General source: ${legacy}`);
  for (const moduleId of moduleIds) assert.ok(core.includes(`moduleId: "${moduleId}"`), `Missing module mapping: ${moduleId}`);
  assert.match(core, /import \{ learningModules, type LearningModule \} from "\.\/learning-library"/);
  assert.doesNotMatch(core, /export const learningModules/);
  assert.equal((core.match(/legacy: "/g) ?? []).length, 14);
  assert.equal((core.match(/sourceTitle: "/g) ?? []).length, 14);
});

test("the existing modules form a five-stage advisory curriculum", async () => {
  const core = await source("app/learning-core-curriculum.ts");
  for (const stage of ["Find the Story", "Build the Story World", "Write the Movie", "Learn and Diagnose", "Prepare and Work Responsibly"]) {
    assert.ok(core.includes(`title: "${stage}"`), `Missing core stage: ${stage}`);
  }
  assert.equal((core.match(/number: [1-5],\r?\n    title:/g) ?? []).length, 5);
  assert.match(core, /recommendedBefore: string\[\]/);
  assert.match(core, /usefulAfter: string\[\]/);
  assert.match(core, /No prerequisite/);
  assert.doesNotMatch(core.toLowerCase(), /locked prerequisite/);
});

test("six editable writer routes cover idea through collaboration", async () => {
  const core = await source("app/learning-core-curriculum.ts");
  const page = await source("app/core-curriculum/page.tsx");
  for (const route of [
    "I have an idea",
    "I am starting a new screenplay",
    "I already have a screenplay",
    "I am stuck on one area",
    "I am revising a complete draft",
    "I am preparing to collaborate or share",
  ]) assert.ok(core.includes(`label: "${route}"`), `Missing route: ${route}`);
  assert.equal((core.match(/id: "(?:idea|new-screenplay|imported-screenplay|focused-problem|full-revision|collaboration-sharing)"/g) ?? []).length, 6);
  assert.match(page, /ROUTE_STORAGE_PREFIX = "plotpickle-core-route:"/);
  assert.match(page, /route is advisory/i);
  assert.match(page, /does not lock workspaces/i);
});

test("focused-problem routing covers ten specialist areas", async () => {
  const page = await source("app/core-curriculum/page.tsx");
  for (const area of ["Character", "Dialogue", "Scene", "Structure", "Pacing", "Theme", "World", "Collaboration", "Formatting", "AI"]) {
    assert.ok(page.includes(`label: "${area}"`), `Missing focus area: ${area}`);
  }
  assert.match(page, /Open \{focusArea\.label\} workspace/);
});

test("every core module has Understand, See it, Try it, Apply it, Check it and Go deeper data", async () => {
  const core = await source("app/learning-core-curriculum.ts");
  assert.equal((core.match(/understand: "/g) ?? []).length, 14);
  assert.equal((core.match(/seeIt: "/g) ?? []).length, 14);
  assert.equal((core.match(/tryIt: "/g) ?? []).length, 14);
  assert.equal((core.match(/applyLabel: "/g) ?? []).length, 14);
  assert.equal((core.match(/checkLabel: "/g) ?? []).length, 14);
  assert.equal((core.match(/deeperLabel: "/g) ?? []).length, 14);
  for (const destination of ["The 24 Blocks Method", "AI-Assisted Revision", "Collaboration, Formats and Ownership", "Characters in Motion", "Working Together", "Dialogue in Motion", "Story Craft Essentials"]) {
    assert.ok(core.includes(destination), `Missing deeper collection relationship: ${destination}`);
  }
});

test("recommendations explain why now using active-project evidence", async () => {
  const core = await source("app/learning-core-curriculum.ts");
  for (const field of [
    "project.development.pitch.audiencePromise",
    "project.story.logline",
    "project.metadata.genre",
    "project.blocks.filter",
    "project.world.rules",
    "project.characters",
    "project.storyThreads",
    "project.screenplay.draftElements",
    "project.rights.projectOwner",
    "project.review.pitchPackage.logline",
    "project.rights.aiProvenance",
  ]) assert.ok(core.includes(field), `Missing recommendation evidence: ${field}`);
  for (const phrase of ["why this lesson now", "reason", "evidence", "question"]) assert.ok(`${core}\n${await source("app/core-curriculum/page.tsx")}`.toLowerCase().includes(phrase));
  assert.match(core, /recommendations should be questions and invitations|Would .* remove uncertainty|What .*\?/i);
});

test("progress separates generic reading from project-specific evidence", async () => {
  const page = await source("app/core-curriculum/page.tsx");
  for (const marker of [
    "plotpickle-core-reading.v1",
    "PLOTPICKLE_CORE_LEARNING_RECORD",
    "exerciseAttempted",
    "appliedToProject",
    "revisit",
    "Mark Read",
    "Save exercise attempted",
    "Mark Applied to project",
    "Mark Revisit",
    "Private project learning evidence",
  ]) assert.ok(page.includes(marker), `Missing progress boundary: ${marker}`);
  assert.match(page, /travel with the `\.ppf` project/);
  assert.match(page, /not shared unless the writer intentionally shares/i);
});

test("Vomit Draft remains searchable while Pickle Draft is displayed", async () => {
  const core = await source("app/learning-core-curriculum.ts");
  const library = await source("app/learning-library.ts");
  assert.match(core, /"Vomit Draft"/);
  assert.match(core, /Displays Pickle Draft/);
  assert.match(library, /title: "The Pickle Draft"/);
  assert.doesNotMatch(library, /title: "The Vomit Draft"/);
});

test("legacy framing corrections remain explicit", async () => {
  const core = (await source("app/learning-core-curriculum.ts")).toLowerCase();
  for (const phrase of [
    "complete ending",
    "genre is an audience agreement",
    "iterative rather than mandatory",
    "every screenplay",
    "biography warehousing",
    "not automatically a sales bible",
    "still requires intention",
    "become stale",
    "authoritative current sources",
    "not necessarily model training",
  ]) assert.ok(core.includes(phrase), `Missing corrected framing: ${phrase}`);
});

test("Complete Learning Library remains prominent beside Core Curriculum", async () => {
  const page = await source("app/core-curriculum/page.tsx");
  const studio = await source("app/learning-studio.tsx");
  assert.ok((page.match(/Complete Learning Library/g) ?? []).length >= 3);
  assert.match(page, /All modules and specialized collections remain immediately available/);
  assert.match(studio, /Start with the PlotPickle Core Curriculum/);
  assert.match(studio, /Complete Learning Library/);
  assert.match(studio, /core-curriculum/);
});

test("Read and Learn searches legacy aliases and supports direct deep links", async () => {
  const studio = await source("app/learning-studio.tsx");
  for (const marker of ["coreGuideFor", "sourceAliases", "requestedView", "requestedModule", "URLSearchParams", "applyHref", "checkHref", "deeperHref"]) {
    assert.ok(studio.includes(marker), `Missing Read & Learn router integration: ${marker}`);
  }
  assert.match(studio, /window\.location\.assign\(coreGuide\.applyHref\)/);
});

test("schema 1.7 remains frozen and records use existing review threads", async () => {
  const page = await source("app/core-curriculum/page.tsx");
  const project = await source("lib/project.ts");
  assert.match(project, /schemaVersion: "1\.7\.0"/);
  assert.match(page, /type ReviewThread/);
  assert.match(page, /anchor: \{ kind: "project"/);
  assert.match(page, /review: \{ \.\.\.project\.review, threads:/);
});
