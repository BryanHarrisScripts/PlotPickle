import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("..", import.meta.url));
const moduleCache = new Map();
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const workflowOrder = [
  "Dashboard",
  "Learn",
  "Plan",
  "Build",
  "Sketch",
  "Visualize",
  "Write",
  "Edit",
  "Feedback",
  "Refine",
  "Reports",
];

function assertWorkflowNavigation(source) {
  const start = source.indexOf("const WORKFLOW_STAGES = [");
  const end = source.indexOf("] as const;", start);
  assert.ok(start >= 0 && end > start, "workflow stage definition should exist");
  const stages = source.slice(start, end);
  let previous = -1;
  for (const label of workflowOrder) {
    const index = stages.indexOf(`label: "${label}"`);
    assert.ok(index > previous, `${label} should follow the requested workflow order`);
    previous = index;
  }
  assert.equal((stages.match(/selectable: true/g) ?? []).length, 2);
  assert.match(stages, /id: "learn"[^\n]+selectable: true/);
  assert.match(stages, /id: "plan"[^\n]+selectable: true/);
  assert.equal((stages.match(/gapAfter: true/g) ?? []).length, 2);
  assert.match(stages, /id: "dashboard"[^\n]+gapAfter: true/);
  assert.match(stages, /id: "graphic-novel"[^\n]+gapAfter: true/);
  assert.match(source, /style=\{\{ marginRight: stage\.gapAfter \? 44 : undefined \}\}/);
  assert.match(source, /<ol style=\{\{ minWidth: 920 \}\}>/);
}

function resolveLocalModule(parentPath, request) {
  const requested = resolve(dirname(parentPath), request);
  for (const candidate of [requested, `${requested}.ts`, `${requested}.json`]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not resolve ${request} from ${parentPath}`);
}

function loadLocalModule(path) {
  const absolute = resolve(path);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  if (extname(absolute) === ".json") return JSON.parse(readFileSync(absolute, "utf8"));
  const module = { exports: {} };
  moduleCache.set(absolute, module);
  const output = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolute,
  }).outputText;
  const localRequire = (request) => request.startsWith(".")
    ? loadLocalModule(resolveLocalModule(absolute, request))
    : require(request);
  new Function("exports", "module", "require", "__filename", "__dirname", output)(
    module.exports,
    module,
    localRequire,
    absolute,
    dirname(absolute),
  );
  return module.exports;
}

test("PLAN derives the same eleven lessons and output prompts directly from LEARN", () => {
  const { FOUNDATION_SEQUENCE } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-course-material.ts"),
  );
  const { buildDeepFoundationCurriculum } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-deep-learning.ts"),
  );
  const { buildFoundationPlanLessons } = loadLocalModule(
    resolve(root, "core/contracts/foundation-plan.ts"),
  );
  const archived = JSON.parse(readFileSync(resolve(root, "learn/foundations.json"), "utf8"));
  const curriculum = buildDeepFoundationCurriculum(archived.lessons);
  const plan = buildFoundationPlanLessons(curriculum);

  assert.equal(plan.length, 11);
  assert.deepEqual(plan.map((lesson) => lesson.title), [...FOUNDATION_SEQUENCE]);
  assert.deepEqual(plan.map((lesson) => lesson.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const lesson of plan) {
    const sourceLesson = curriculum.find((candidate) => candidate.id === lesson.id);
    const application = sourceLesson.sections.find((section) => section.heading === "Apply this to your story");
    assert.ok(application?.points?.length >= 3, `${lesson.title} must retain its LEARN outputs`);
    assert.deepEqual(lesson.fields.map((field) => field.prompt), application.points);
  }
});

test("manual answers, AI proposals and the saved brief have explicit project transitions", () => {
  const { createEmptyProject, normalizeFoundationProject } = loadLocalModule(
    resolve(root, "core/project/project.ts"),
  );
  const { applyStoryCommand } = loadLocalModule(
    resolve(root, "core/project/apply-command.ts"),
  );
  const started = createEmptyProject({ id: "story-1", now: "2026-08-13T12:00:00.000Z" });
  const manual = applyStoryCommand(started, {
    type: "foundations.answer.update",
    lessonId: "pitch",
    fieldId: "output-1",
    value: "The writer's own answer.",
    occurredAt: "2026-08-13T12:01:00.000Z",
  });
  const proposed = applyStoryCommand(manual, {
    type: "foundations.proposal.store",
    lessonId: "pitch",
    proposal: {
      values: { "output-1": "A separate local proposal.", "output-2": "A second proposal." },
      model: "local-test-model",
      generatedAt: "2026-08-13T12:02:00.000Z",
    },
    occurredAt: "2026-08-13T12:02:00.000Z",
  });
  assert.equal(proposed.foundations.lessons.pitch.answers["output-1"], "The writer's own answer.");
  assert.equal(proposed.foundations.lessons.pitch.proposal.values["output-1"], "A separate local proposal.");

  const accepted = applyStoryCommand(proposed, {
    type: "foundations.proposal.accept",
    lessonId: "pitch",
    occurredAt: "2026-08-13T12:03:00.000Z",
  });
  assert.equal(accepted.foundations.lessons.pitch.answers["output-1"], "A separate local proposal.");
  assert.equal(accepted.foundations.lessons.pitch.answers["output-2"], "A second proposal.");
  assert.equal(accepted.foundations.lessons.pitch.proposalAcceptedAt, "2026-08-13T12:03:00.000Z");

  const saved = applyStoryCommand(accepted, {
    type: "foundations.brief.save",
    content: "# Saved Foundations Brief",
    occurredAt: "2026-08-13T12:04:00.000Z",
  });
  assert.equal(saved.foundations.brief.content, "# Saved Foundations Brief");
  assert.equal(saved.foundations.brief.savedAt, "2026-08-13T12:04:00.000Z");

  const recovered = normalizeFoundationProject({
    id: "legacy-story",
    foundations: { storyPromise: "Legacy writer material that must survive." },
  });
  assert.equal(recovered.foundations.lessons.pitch.answers["output-1"], "Legacy writer material that must survive.");
});

test("the PLAN screen keeps manual work primary and uses opt-in local Mastra proposals", async () => {
  const [page, learn, plan, contract, drafter, runtime, planStyles] = await Promise.all([
    read("app/page.tsx"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
    read("core/contracts/foundation-plan.ts"),
    read("modules/plan/foundations-plan-drafter.ts"),
    read("build/mastra-agent-runtime.ts"),
    read("modules/plan/ui/foundations-plan-workspace.module.css"),
  ]);

  assert.match(page, /FoundationsPlanWorkspace/);
  assert.match(page, /normalizeFoundationProject/);
  assert.match(page, /onOpenFoundationsPlan=\{openFoundationsPlan\}/);
  assert.match(learn, /aria-label="Apply what you have learned in Foundations"/);
  assert.match(learn, /type="button"/);
  assert.match(learn, /onOpenFoundationsPlan/);
  assertWorkflowNavigation(learn);
  assertWorkflowNavigation(plan);
  assert.match(learn, /disabled=\{unavailable\}/);
  assert.match(learn, /stageId === "plan" && onOpenFoundationsPlan/);
  assert.match(plan, /disabled=\{!stage\.selectable\}/);
  assert.match(plan, /stageId === "learn"\) openLearn\(activeLesson\.id\)/);
  assert.match(contract, /buildFoundationPlanLessons/);
  assert.match(contract, /heading\.trim\(\)\.toLowerCase\(\) === "apply this to your story"/);
  assert.doesNotMatch(contract, /The Anatomy of a Screenplay|Loglines That Carry the Movie/);
  assert.doesNotMatch(plan, /The Anatomy of a Screenplay|Loglines That Carry the Movie/);
  assert.match(plan, /Local AI is optional and is never required/);
  assert.match(plan, /proposal stays separate from your fields/);
  assert.match(plan, /Accept proposal into my fields/);
  assert.match(plan, /Dismiss proposal/);
  assert.match(plan, /Build from saved answers/);
  assert.match(plan, /Save Foundations Brief/);
  assert.match(plan, /function acceptedFoundationContext/);
  assert.match(plan, /lessons\.filter\(\(lesson\) => lesson\.id !== activeLessonId\)/);
  assert.doesNotMatch(plan, /lessons\.slice\(0, activeIndex\)/);
  assert.match(plan, /priorStoryContext: acceptedFoundationContext\(lessons, activeLesson\.id, project\)/);
  assert.match(drafter, /agentId: "foundations-planner"/);
  assert.match(drafter, /provider: "local"/);
  assert.match(drafter, /modelRole: "quality"/);
  assert.match(drafter, /models\?\.quality/);
  assert.match(drafter, /Your fields were not changed/);
  assert.doesNotMatch(drafter, /provider: "ollama"/);
  assert.match(drafter, /class FoundationProposalQualityError extends Error/);
  assert.match(drafter, /REPAIR THE PLAN PROPOSAL/);
  assert.match(drafter, /Never copy or lightly paraphrase the field question as the answer/);
  assert.match(drafter, /Provisional —/);
  assert.match(drafter, /recoverFieldsIndividually/);
  assert.match(drafter, /recover each field as a smaller task/);
  assert.ok((drafter.match(/requestFoundationProposal\(/g) ?? []).length >= 3);
  assert.match(runtime, /"foundations-planner"/);
  assert.match(runtime, /Never invent a story fact/);
  assert.match(plan, /plotpickle-ouroboros-v2-128\.png/);
  assert.match(planStyles, /\.workspaceBrandMark/);
});
