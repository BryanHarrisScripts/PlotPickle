import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const { plotPickleCurriculum: lessons } = loadLocalModule(
  resolve(root, "adapters/curriculum/current-catalog.ts"),
);
const ledger = JSON.parse(readFileSync(resolve(root, "docs/learn/lesson-integration-2094.json"), "utf8"));
const text = (lesson) => lesson.sections.flatMap((section) => [
  section.heading, ...section.paragraphs, ...(section.points ?? []),
]).join(" ");

test("#2094 audit follows actual presentation order and attached provenance", () => {
  assert.equal(lessons.length, 96);
  const sources = lessons.flatMap((lesson) => lesson.sources);
  assert.equal(sources.length, 95);
  assert.equal(new Set(sources.map((source) => source.id)).size, 95);
  assert.equal(ledger.reviewedThrough, 10);
  assert.equal(ledger.nextPresentationOrder, 11);
  assert.deepEqual(Object.keys(ledger.lessons), Array.from({ length: 10 }, (_, i) => String(i + 1)));
  const actions = new Set(["ALREADY_CLEAR", "INTEGRATE", "BETTER_ELSEWHERE", "HISTORICAL_ONLY", "REJECT", "DO_NOT_FREEZE"]);
  for (const [index, lesson] of lessons.slice(0, 10).entries()) {
    const record = ledger.lessons[String(index + 1)];
    assert.equal(record.presentationOrder, index + 1);
    assert.equal(record.lessonId, lesson.id);
    assert.equal(record.title, lesson.title);
    assert.equal(record.topic, lesson.topic);
    assert.deepEqual(record.sourceIds, lesson.sources.map((source) => source.id));
    assert.equal(typeof record.learnerSufficientBefore, "boolean");
    assert.equal(record.learnerSufficientAfter, true);
    assert.ok(record.decisions.length > 0);
    for (const decision of record.decisions) {
      assert.ok(actions.has(decision.action));
      assert.ok(decision.concept && decision.evidence);
    }
  }
});

test("#2094 retained gaps reach normal lesson sections without source records", () => {
  const expected = new Map([
    [1, ["Subtext is", "Foreshadowing plants", "A motif is", "a symbol carries", "sealed file"]],
    [3, ["super-objective", "object of desire", "A character arc", "Point of view", "A subplot", "Thematic agreement"]],
    [5, ["A tagline is", "Every secret has a witness"]],
    [7, ["four Mini-Blocks", "96 smaller planning units", "not automatically 96 scenes"]],
    [8, ["An inciting incident", "A midpoint", "The climax is", "Resolution shows", "A plot twist", "A transition"]],
    [9, ["Rewrite a short exchange twice", "Rapid dialogue", "voice-over", "exploratory monologue", "Prepare a serious turn"]],
    [10, ["episode engine", "season arc", "Marketing explains", "Distribution explains", "Rehearse a short version"]],
  ]);
  for (const [order, concepts] of expected) {
    const body = text({ ...lessons[order - 1], sources: [] });
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>|# The Art of Crafting Loglines/);
  }
});

test("#2094 keeps phased source retirement and shared presentation authority", () => {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  for (const path of ["app/skin-v1/learn-journey-preview.tsx", "app/skin-v1/learn-explore.tsx"]) {
    assert.match(read(path), /canonical bundled source/);
    assert.match(read(path), /<pre>\{source.content\}<\/pre>/);
  }
  assert.match(read("app/api/learn/explore/route.ts"), /plotPickleCurriculum.*map/);
  assert.match(read("app/page.tsx"), /curriculum=\{plotPickleCurriculum\}/);
  assert.equal(lessons[10].title, "Build the Story Experience");
});

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("#2094 audit fingerprints match reviewed teaching, sources and order", () => {
  assert.equal(hash(lessons.map(({ id, topic, number }) => ({ id, topic, number }))), ledger.presentationOrderSha256);
  const sources = lessons.flatMap((lesson) => lesson.sources).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(hash(sources), ledger.sourceContentSha256);
  for (const lesson of lessons.slice(0, 10)) {
    const record = ledger.lessons[String(lesson.number)];
    const { sources: attached, ...teaching } = lesson;
    assert.equal(hash(teaching), record.lessonContentSha256, `${lesson.title}: teaching changed since individual review`);
    assert.deepEqual(Object.fromEntries(attached.map((source) => [source.id, hash(source)])), record.sourceHashes);
  }
});
