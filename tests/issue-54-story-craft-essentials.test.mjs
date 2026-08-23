import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const legacySources = [
  "Storytelling Dynamics",
  "Thematic Components",
  "Essential Aspects 1",
  "Scene Writing",
  "Symbolic Techniques",
  "Beyond Sluglines",
  "Essential Aspects 2",
];

const lessonTitles = [
  "Build the Story Experience",
  "Control Pacing Through Change",
  "Design Tone Without Monotony",
  "Make Theme a Dramatic Argument",
  "Write Scenes That Change Conditions",
  "Turn Inner Meaning Into Screen Evidence",
  "Build Motifs, Symbols and Echoes",
  "Use Advanced Screenplay Forms Clearly",
  "Run the Essential Craft Audit",
];

test("seven legacy Essentials sources map into nine connected PlotPickled lessons", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  for (const title of legacySources) assert.ok(learning.includes(`source: "${title}"`), `Missing source map: ${title}`);
  for (const title of lessonTitles) assert.ok(learning.includes(`title: "${title}"`), `Missing lesson: ${title}`);
  assert.match(learning, /essentialsLegacySourceMap/);
  assert.equal((learning.match(/lesson\(\{/g) ?? []).length, 9);
  assert.equal((learning.match(/collection: "Story Craft Essentials"/g) ?? []).length, 1);
});

test("learning path follows why to evidence to diagnosis to revision", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  for (const phrase of [
    "why → how → evidence → diagnose → revise",
    "audience promise",
    "meaningful change",
    "tone as the story's attitude",
    "contested question",
    "changed value or relationship state",
    "visible, audible or performable evidence",
    "literal introduction",
    "what Fountain/FDX/PDF preserves",
    "evidence and questions",
  ]) assert.ok(learning.toLowerCase().includes(phrase.toLowerCase()), `Missing connected craft principle: ${phrase}`);
});

test("Story Experience, Theme Argument, Pacing and Motif product records are complete", async () => {
  const workspace = await source("app/story-craft-essentials/page.tsx");
  for (const feature of [
    "Story Experience Card",
    "Pacing and Tone Map",
    "Theme Argument Map",
    "Motif and Echo Ledger",
    "Screen Evidence Translator",
    "Essential Craft Audit",
    "PLOTPICKLE_STORY_CRAFT_RECORD",
  ]) assert.ok(workspace.includes(feature), `Missing product feature: ${feature}`);
  for (const field of [
    "Whose experience anchors the story?",
    "Audience promise",
    "Intended emotional movement",
    "Dominant genre",
    "Tonal promise",
    "Central question",
    "Alternative answer",
    "Signature image, sound or movement",
    "Ending after-effect",
    "Climax proof, refusal, compromise or tragic failure",
    "Continuity requirements",
  ]) assert.ok(workspace.includes(field), `Missing card/map field: ${field}`);
});

test("pacing and tone reject speed stereotypes and constant intensity", async () => {
  const combined = `${await source("app/learning-story-craft-essentials.ts")}\n${await source("app/story-craft-essentials/page.tsx")}`;
  for (const phrase of [
    "rate and pattern of meaningful change",
    "quiet scene may move quickly",
    "action sequence may feel slow",
    "not a genre speed rule",
    "constant intensity",
    "Humour can exist inside darkness",
    "seriousness inside comedy",
  ]) assert.ok(combined.includes(phrase), `Missing pacing/tone correction: ${phrase}`);
});

test("theme remains a contested argument rather than a repeated moral", async () => {
  const combined = `${await source("app/learning-story-craft-essentials.ts")}\n${await source("app/story-craft-essentials/page.tsx")}`;
  for (const phrase of [
    "contested question",
    "credible competing answer",
    "more than one answer plausible",
    "A scene does not need to state or visibly repeat the theme",
    "preachy and predictable",
    "Theme is a tested human question",
  ]) assert.ok(combined.includes(phrase), `Missing theme correction: ${phrase}`);
});

test("Scene Pulse overlay explains terms, evidence, experiments and controlling fields", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  const workspace = await source("app/story-craft-essentials/page.tsx");
  for (const term of ["Pressure Lock", "Cut Line", "Pivot", "Value flip", "Handoff"]) {
    assert.ok(learning.includes(`term: "${term}"`), `Missing Scene Pulse term: ${term}`);
    assert.ok(workspace.includes(`item.term === "${term}"`) || workspace.includes(term), `Missing active overlay: ${term}`);
  }
  for (const property of ["meaning:", "why:", "evidence:", "experiment:", "field:"]) assert.ok(learning.includes(property), `Missing overlay property: ${property}`);
  assert.match(workspace, /diagnoseScenePulse/);
  assert.match(workspace, /Revision experiment/);
});

test("screen evidence modernizes inner thought and visual writing", async () => {
  const combined = `${await source("app/learning-story-craft-essentials.ts")}\n${await source("app/story-craft-essentials/page.tsx")}`;
  for (const phrase of [
    "ordinary action lines cannot simply enter a character's mind",
    "Selected evidence directs attention",
    "does not inventory every object",
    "Action or refusal",
    "Objective or altered tactic",
    "Object, spatial distance or blocking",
    "Sound or silence",
    "Dialogue or subtext",
    "Repeated behaviour with variation",
    "Why narration creates otherwise unavailable meaning",
  ]) assert.ok(combined.includes(phrase), `Missing screen-evidence principle: ${phrase}`);
});

test("motifs and symbols depend on context, repetition and change", async () => {
  const combined = `${await source("app/learning-story-craft-essentials.ts")}\n${await source("app/story-craft-essentials/page.tsx")}`;
  for (const phrase of [
    "Symbols do not have fixed universal meanings",
    "culture, context, repetition and change",
    "Literal introduction",
    "Repetitions",
    "Meaning shifts",
    "Payoff, reversal or deliberately unresolved ending",
    "visual, dialogue, sound or music appearances",
  ]) assert.ok(combined.toLowerCase().includes(phrase.toLowerCase()), `Missing motif correction: ${phrase}`);
});

test("advanced formatting toolbox includes purpose, form, export, misuse and drafting layer", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  const workspace = await source("app/story-craft-essentials/page.tsx");
  for (const technique of [
    "Secondary heading / mini-slug",
    "Montage",
    "Series of shots",
    "Intercutting",
    "Phone or remote conversation",
    "V.O. and O.S.",
    "Dual dialogue / overlap",
    "Insert / on-screen text / selected shot",
    "Transition",
    "Section, synopsis and note",
    "Omission / boneyard",
  ]) assert.ok(learning.includes(`label: "${technique}"`), `Missing advanced format: ${technique}`);
  for (const property of ["purpose:", "form:", "preserves:", "misuse:", "layer:"]) assert.ok(learning.includes(property), `Missing formatting property: ${property}`);
  assert.match(workspace, /Editable Fountain-style preview/);
  assert.match(workspace, /nothing has been inserted into the screenplay/i);
  assert.match(workspace, /copy.*manual/i);
});

test("essential technique library covers audience effect, evidence, failure and workspace", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  for (const lens of [
    "Anticipation",
    "Suspense",
    "Surprise",
    "Dramatic irony",
    "Contrast",
    "Repetition with variation",
    "Compression and expansion",
    "Reveal and reversal",
    "Setup, payoff and reflection",
    "Visual and sonic rhyme",
    "Status change",
    "Withholding and release",
    "Spectacle and intimacy",
    "Parallel and juxtaposition",
  ]) assert.ok(learning.includes(`label: "${lens}"`), `Missing technique lens: ${lens}`);
  for (const property of ["effect:", "evidence:", "failure:", "workspace:"]) assert.ok(learning.includes(property), `Missing technique property: ${property}`);
  assert.match(learning, /Production scale substitutes for dramatic impact/);
});

test("Essential Craft Audit is ordered, evidence-based and approval-safe", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  const workspace = await source("app/story-craft-essentials/page.tsx");
  const lab = await source("app/specialist-labs.tsx");
  assert.equal((learning.match(/^  "/gm) ?? []).length >= 14, true);
  for (const step of ["Story promise and audience experience", "Causality and structure", "Scene purpose, pivot and handoff", "Formatting and readability", "Revision priorities"]) assert.ok(learning.includes(`"${step}"`), `Missing audit step: ${step}`);
  for (const boundary of [
    "does not calculate a universal screenplay score",
    "does not create an objectively perfect final draft",
    "output remains non-canonical until explicit approval",
    "No story or screenplay text changes automatically",
  ]) assert.ok(`${learning}\n${workspace}`.toLowerCase().includes(boundary.toLowerCase()), `Missing audit boundary: ${boundary}`);
  assert.match(lab, /Nothing changes until you approve this suggestion/);
});

test("Read and Learn exposes Story Craft Essentials and contextual recommendations", async () => {
  const studio = await source("app/learning-studio.tsx");
  for (const integration of [
    "storyCraftLessons",
    "storyCraftSearchText",
    "Story Craft Essentials",
    "story-craft",
    "essentials-experience",
    "essentials-pacing",
    "essentials-tone",
    "essentials-theme",
    "essentials-scene",
    "essentials-screen-evidence",
    "essentials-motif",
    "essentials-formatting",
    "essentials-audit",
    "/story-craft-essentials",
  ]) assert.ok(studio.includes(integration), `Missing learning integration: ${integration}`);
});

test("every Story Craft Essentials lesson has example, mistakes, exercise and direct workspace section", async () => {
  const learning = await source("app/learning-story-craft-essentials.ts");
  assert.equal((learning.match(/example: \{/g) ?? []).length, 9);
  assert.equal((learning.match(/mistakes: \[/g) ?? []).length, 9);
  assert.equal((learning.match(/exercise: "/g) ?? []).length, 9);
  assert.equal((learning.match(/workspaceSection:/g) ?? []).length, 9);
});
