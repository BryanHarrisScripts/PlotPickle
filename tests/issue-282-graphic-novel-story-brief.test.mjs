import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function compileRuntime(path) {
  const text = await source(path);
  const compiled = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require(specifier) {
      if (specifier === "./project") return { cloneProject: (value) => JSON.parse(JSON.stringify(value)) };
      throw new Error(`Unexpected import: ${specifier}`);
    },
    Date,
    Math,
    Number,
    Set,
    Object,
  });
  return runtimeModule.exports;
}

const briefRuntime = () => compileRuntime("lib/graphic-novel-story-brief.ts");
const bubbleRuntime = () => compileRuntime("lib/graphic-novel-bubbles.ts");

function fixture() {
  return {
    id: "story-1",
    metadata: { tone: "haunted tenderness", updatedAt: "before" },
    story: { hook: "A grieving engineer hears a machine remember her.", logline: "", premise: "", theme: "Connection requires surrender." },
    world: {
      period: "near future",
      ordinaryWorld: "a sterile research city",
      newWorld: "a machine dreamscape",
      rules: "memories become shared spaces",
      technology: "tactile neural archives",
      visualLanguage: "graphite machinery interrupted by organic white space",
    },
    development: {
      pitch: { audiencePromise: "A mystery that becomes an intimate act of trust.", emotionalExperience: "unease opening into wonder", visualVision: "human warmth inside severe machines" },
      foundations: { transformation: "Ren accepts mutual dependence", endingProof: "she enters the shared memory voluntarily" },
      ghost: { centralWound: "abandonment", lie: "control prevents loss" },
      pickle: { storyPromise: "", escalationPattern: "each answer makes the machine more personal", signatureMove: "hands touching impossible interfaces" },
      dialogue: { recurringLanguage: "questions about ownership and memory" },
    },
    structure: { pacingProfile: "moderate", averageShotSeconds: 6 },
    production: { shots: [] },
    review: { pitchPackage: { tagline: "", visualStatement: "", updatedAt: "before" } },
    extensions: {},
  };
}

test("Phase 6 derives and stores a whole-story Graphic Novel brief without mutating canon", async () => {
  const runtime = await briefRuntime();
  const project = fixture();
  const original = JSON.stringify(project);
  const brief = runtime.deriveGraphicNovelStoryBrief(project);
  assert.match(brief.storyPromise, /intimate act of trust/);
  assert.match(brief.emotionalArc, /abandonment/);
  assert.match(brief.visualThesis, /human warmth/);
  assert.match(brief.continuityRules, /all 96 panels/);
  assert.match(runtime.graphicNovelStoryBriefPrompt(brief), /Whole-story emotional arc:/);
  const next = runtime.withGraphicNovelStoryBrief(project, { ...brief, recurringMotifs: "circular doors" });
  assert.equal(JSON.stringify(project), original);
  assert.equal(runtime.getGraphicNovelStoryBrief(next).recurringMotifs, "circular doors");
  assert.equal(next.extensions[runtime.GRAPHIC_NOVEL_STORY_BRIEF_EXTENSION].recurringMotifs, "circular doors");
  assert.equal(runtime.graphicNovelStoryBriefCompletion(brief).total, 11);
});

test("Phase 6 prompt engine combines story-level and panel-level emotional direction while keeping text outside images", async () => {
  const prompt = await source("lib/ai-pitch-deck-base.ts");
  for (const contract of [
    "graphicNovelStoryBriefPrompt(getGraphicNovelStoryBrief(project))",
    "Panel dramatic purpose:",
    "Emotional movement:",
    "Objective under pressure:",
    "Visible turn or revelation:",
    "Audience expectation shift:",
    "No written words, letters, captions, speech balloons",
  ]) assert.ok(prompt.includes(contract), `Missing enhanced prompt contract: ${contract}`);
  assert.match(prompt, /promptFor\(project, panelBase, block, scene, mini\)/);
});

test("Phase 6 UI saves the brief and refreshes all prompts while preserving completed artwork", async () => {
  const [editor, workspace, queue] = await Promise.all([
    source("app/graphic-novel-story-brief.tsx"),
    source("app/ai-pitch-deck-workspace.tsx"),
    source("app/use-graphic-novel-queue.ts"),
  ]);
  for (const label of ["Story promise", "Audience experience", "Emotional arc", "Visual thesis", "World atmosphere", "Camera language", "Lighting and contrast", "Panel rhythm", "Recurring motifs", "Continuity rules", "Avoid"]) {
    assert.ok(editor.includes(label), `Missing Story Brief field: ${label}`);
  }
  assert.match(editor, /Save brief and refresh 96 prompts/);
  assert.match(editor, /dialogue and captions remain separate editable text/);
  assert.match(workspace, /GraphicNovelStoryBriefEditor/);
  assert.match(queue, /withGraphicNovelStoryBrief/);
  assert.match(queue, /createGraphicNovelPlan\(active, deckRef\.current, true\)/);
  assert.match(queue, /Completed artwork and queue decisions were preserved/);
});

test("Phase 7 stores clamped per-balloon placement as a versioned PPF extension", async () => {
  const runtime = await bubbleRuntime();
  const project = fixture();
  const original = JSON.stringify(project);
  const panel = {
    id: "comic-pitch-01-1",
    dialogue: [
      { id: "dialogue-1", characterName: "Ren", text: "Are you still there?" },
      { id: "dialogue-2", characterName: "Machine", text: "I never left." },
    ],
  };
  const first = runtime.graphicNovelBubblePlacement(project, panel, "dialogue-1", 0);
  const second = runtime.graphicNovelBubblePlacement(project, panel, "dialogue-2", 1);
  assert.equal(first.tail, "left");
  assert.equal(second.tail, "right");
  const next = runtime.withGraphicNovelBubblePlacement(project, panel.id, "dialogue-1", {
    x: 200,
    y: -10,
    width: 90,
    style: "caption",
    tail: "none",
  });
  assert.equal(JSON.stringify(project), original);
  const saved = runtime.graphicNovelBubblePlacement(next, panel, "dialogue-1", 0);
  assert.equal(saved.width, 72);
  assert.equal(saved.x, 28);
  assert.equal(saved.y, 0);
  assert.equal(saved.style, "caption");
  assert.equal(saved.tail, "none");
  assert.equal(next.extensions[runtime.GRAPHIC_NOVEL_BUBBLE_LAYOUT_EXTENSION].version, 1);
  const reset = runtime.resetGraphicNovelPanelBubbleLayout(next, panel.id);
  assert.equal(runtime.getGraphicNovelBubbleLayout(reset).panels[panel.id], undefined);
});

test("Phase 7 provides full-screen keyboard reading and direct drag lettering controls", async () => {
  const [viewer, workspace, css] = await Promise.all([
    source("app/graphic-novel-viewer.tsx"),
    source("app/ai-pitch-deck-workspace.tsx"),
    source("app/graphic-novel-viewer.module.css"),
  ]);
  for (const contract of [
    "requestFullscreen",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "setPointerCapture",
    "Add balloon",
    "Hide this balloon without deleting its text",
    "Reset panel positions",
    "Full-screen Graphic Novel viewer and bubble editor",
  ]) assert.ok(viewer.includes(contract), `Missing Phase 7 viewer contract: ${contract}`);
  assert.match(viewer, /withGraphicNovelBubblePlacement/);
  assert.match(viewer, /updateComicPitchPanel/);
  assert.match(viewer, /role="dialog" aria-modal="true"/);
  assert.match(workspace, /GraphicNovelViewer/);
  assert.match(workspace, /saved Phase 7 placement carries into HTML and PDF output/);
  assert.match(css, /\.bubble\[data-style="thought"\]/);
  assert.match(css, /\.overlay:fullscreen/);
});

test("Phase 7 HTML and PDF export preserve balloon coordinates, style, tails and editable text", async () => {
  const exporter = await source("lib/ai-pitch-deck.ts");
  for (const contract of [
    "graphicNovelBubblePlacement",
    "applyGraphicNovelBubbleLayouts",
    "data-dialogue-id",
    "data-style",
    "data-tail",
    "GRAPHIC_NOVEL_BUBBLE_EXPORT_CSS",
    "position:absolute",
  ]) assert.ok(exporter.includes(contract), `Missing Phase 7 export contract: ${contract}`);
  assert.match(exporter, /placement\.hidden/);
  assert.match(exporter, /left:\$\{placement\.x\}%/);
  assert.match(exporter, /width:\$\{placement\.width\}%/);
});
