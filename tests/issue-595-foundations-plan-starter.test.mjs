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
  "Storyboard",
  "Previs",
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
  const source = readFileSync(absolute, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: absolute,
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(absolute, module);
  const localRequire = (request) => request.startsWith(".")
    ? loadLocalModule(resolveLocalModule(absolute, request))
    : require(request);
  new Function("require", "module", "exports", "__filename", "__dirname", output)(
    localRequire,
    module,
    module.exports,
    absolute,
    dirname(absolute),
  );
  return module.exports;
}

const { buildFoundationPlanLessons } = loadLocalModule(resolve(root, "core/contracts/foundation-plan.ts"));
const { loadCurriculum } = loadLocalModule(resolve(root, "data/curriculum/load-curriculum.ts"));

test("PLAN derives the same eleven lessons and output prompts directly from LEARN", () => {
  const curriculum = loadCurriculum();
  const lessons = buildFoundationPlanLessons(curriculum);
  assert.equal(lessons.length, 11);
  assert.deepEqual(
    lessons.map((lesson) => lesson.id),
    curriculum.filter((lesson) => lesson.topic === "foundations").map((lesson) => lesson.id),
  );
  for (const lesson of lessons) {
    const source = curriculum.find((candidate) => candidate.id === lesson.id);
    assert.ok(source);
    assert.equal(lesson.title, source.title);
    assert.equal(lesson.overview, source.overview);
    assert.deepEqual(lesson.fields.map((field) => field.prompt), source.outputs);
  }
});

test("manual answers, AI proposals and the saved brief have explicit project transitions", () => {
  const projectSource = readFileSync(resolve(root, "core/project/apply-command.ts"), "utf8");
  assert.match(projectSource, /case "foundations\.answer\.update"/);
  assert.match(projectSource, /case "foundations\.proposal\.store"/);
  assert.match(projectSource, /case "foundations\.proposal\.accept"/);
  assert.match(projectSource, /case "foundations\.proposal\.dismiss"/);
  assert.match(projectSource, /case "foundations\.brief\.save"/);
});

test("the PLAN screen keeps manual work primary and uses opt-in local Mastra proposals", async () => {
  const [workspace, drafter] = await Promise.all([
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);
  assertWorkflowNavigation(workspace);
  assert.match(workspace, /Make the story decisions/);
  assert.match(workspace, /OPTIONAL · LOCAL ONLY/);
  assert.match(workspace, /Choose exactly which story decisions you want help with/);
  assert.match(workspace, /draftFoundationLesson/);
  assert.match(drafter, /\/api\/writing-assistant\/chat/);
  assert.match(drafter, /agentId: "foundations-planner"/);
});
