import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("..", import.meta.url));
const moduleCache = new Map();

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
  const source = readFileSync(absolute, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolute,
  }).outputText;
  const localRequire = (request) => (
    request.startsWith(".")
      ? loadLocalModule(resolveLocalModule(absolute, request))
      : require(request)
  );
  new Function("exports", "module", "require", "__filename", "__dirname", output)(
    module.exports,
    module,
    localRequire,
    absolute,
    dirname(absolute),
  );
  return module.exports;
}

function words(value) {
  return value.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) ?? [];
}

test("all eleven curated Foundations lessons have substantial explanatory depth", () => {
  const { FOUNDATION_SEQUENCE, FOUNDATION_LESSON_MATERIAL } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-course-material.ts"),
  );

  assert.equal(FOUNDATION_SEQUENCE.length, 11);
  for (const title of FOUNDATION_SEQUENCE) {
    const material = FOUNDATION_LESSON_MATERIAL[title];
    assert.ok(material, `${title} is missing curated material`);
    const teachingText = material.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.points ?? []),
    ]).join(" ");
    const paragraphCount = material.sections.reduce((total, section) => total + section.paragraphs.length, 0);

    assert.ok(material.sections.length >= 6, `${title} needs at least six meaningful teaching sections`);
    assert.ok(paragraphCount >= 10, `${title} needs explanatory prose rather than a bullet taxonomy`);
    assert.ok(words(teachingText).length >= 700, `${title} needs at least 700 substantive teaching words`);
    assert.ok(material.definitions.length >= 4, `${title} needs curated beginner definitions`);
    assert.ok(material.storyOutputs.length >= 3, `${title} needs explicit carry-forward outputs`);
    assert.match(material.sections[0].heading, /Welcome|^Why /);
  }
});

test("the beginner sequence distinguishes adjacent jobs and finishes with synthesis", () => {
  const { FOUNDATION_LESSON_MATERIAL: material } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-course-material.ts"),
  );
  const body = (title) => JSON.stringify(material[title]);

  assert.match(body("The Anatomy of a Screenplay"), /Welcome to Foundations/);
  assert.match(body("The Screenwriting Essentials Roadmap"), /symptom/i);
  assert.match(body("The Screenwriting Essentials Roadmap"), /root cause/i);
  assert.match(body("The Pitch"), /provisional baseline/);
  assert.match(body("The Pitch"), /Lessons 5 and 6/);
  assert.match(body("Loglines That Carry the Movie"), /primary development logline/i);
  assert.match(body("Crafting and Testing Loglines"), /purpose variants|several truthful versions/i);
  assert.match(body("Why PlotPickle Works in Layers"), /not a timing law/);
  assert.match(body("Screenplay Essentials: Structure, Dialogue and Visuals"), /Worked scene: the archive offer/);
  assert.match(body("Pacing and Tone: Storytelling Dynamics"), /Distinguish local mood/);
  assert.match(body("Pitch Components and Project Positioning"), /two different listeners/);
  assert.match(body("Build the Story Experience"), /complete Foundations Brief/);
  assert.match(body("Build the Story Experience"), /contradiction audit/i);
  assert.match(body("Build the Story Experience"), /ending as proof/i);
  assert.match(body("Build the Story Experience"), /Lessons 1–10/);

  const adaptedCourse = Object.values(material).map((lesson) => JSON.stringify(lesson)).join("\n");
  for (const legacyFragment of [
    "Source lesson",
    "Prompt 1",
    "Prompt 2",
    "perfect logline",
    "Man vs Himself",
    "blueprint for a cinematic masterpiece",
  ]) {
    assert.ok(!adaptedCourse.includes(legacyFragment), `Adapted teaching should not contain legacy fragment: ${legacyFragment}`);
  }
});

test("moved material has an audited destination while every original remains attached once", () => {
  const { FOUNDATION_SOURCE_COVERAGE } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-content-coverage.ts"),
  );
  const { FOUNDATION_SEQUENCE } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-course-material.ts"),
  );
  const { buildDeepFoundationCurriculum } = loadLocalModule(
    resolve(root, "adapters/curriculum/foundation-deep-learning.ts"),
  );
  const foundations = JSON.parse(readFileSync(resolve(root, "learn/foundations.json"), "utf8"));
  const lessons = buildDeepFoundationCurriculum(foundations.lessons);

  assert.equal(Object.keys(FOUNDATION_SOURCE_COVERAGE).length, 7);
  assert.deepEqual(lessons.map((lesson) => lesson.title), [...FOUNDATION_SEQUENCE]);
  assert.deepEqual(lessons.map((lesson) => lesson.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(lessons.every((lesson) => lesson.definitions.length >= 4));
  assert.ok(lessons.every((lesson) => lesson.exercise.trim().length > 0));

  const attached = lessons.flatMap((lesson) => lesson.sources.map((source) => ({ lesson, source })));
  assert.equal(attached.length, 7);
  assert.equal(new Set(attached.map(({ source }) => source.id)).size, 7);
  for (const [sourceId, coverage] of Object.entries(FOUNDATION_SOURCE_COVERAGE)) {
    const record = attached.find(({ source }) => source.id === sourceId);
    assert.ok(record, `${sourceId} is not attached to a presented lesson`);
    assert.equal(record.lesson.title, coverage.archiveLesson);
    assert.ok(coverage.taughtIn.length > 0);
    assert.ok(coverage.taughtIn.every(({ lesson, concepts }) => (
      FOUNDATION_SEQUENCE.includes(lesson) && concepts.length > 0
    )));
  }

  const { plotPickleCurriculum } = loadLocalModule(
    resolve(root, "adapters/curriculum/current-catalog.ts"),
  );
  assert.equal(plotPickleCurriculum.length, 88);
  assert.equal(plotPickleCurriculum.flatMap((lesson) => lesson.sources).length, 95);
  assert.equal(new Set(plotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id))).size, 95);
});
