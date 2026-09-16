import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const moduleUrls = new Map();
async function moduleUrl(path) {
  const absolute = resolve(path);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = extname(absolute) === ".json" ? `export default ${readFileSync(absolute, "utf8")};` : stripTypeScriptTypes(readFileSync(absolute, "utf8"));
  if (extname(absolute) !== ".json") {
    for (const match of [...source.matchAll(/from\s*["'](\.[^"']+)["']/gu)]) {
      const requested = resolve(dirname(absolute), match[1]);
      const target = [requested, `${requested}.ts`, `${requested}.json`, resolve(requested, "index.ts")].find((candidate) => existsSync(candidate) && /\.(ts|json)$/u.test(candidate));
      assert.ok(target, `Missing curriculum import ${match[1]}`);
      source = source.replace(match[0], `from "${await moduleUrl(target)}"`);
    }
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  moduleUrls.set(absolute, url);
  return url;
}
const { plotPickleCurriculum: lessons } = await import(await moduleUrl(resolve(root, "adapters/curriculum/current-catalog.ts")));
const ledger = JSON.parse(readFileSync(resolve(root, "docs/learn/lesson-integration-2094.json"), "utf8"));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const lessonText = (lesson) => [lesson.title, lesson.overview, ...lesson.objectives, ...lesson.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]), ...lesson.definitions.flatMap((item) => [item.term, item.meaning]), lesson.example.title, lesson.example.text, ...lesson.checklist, ...lesson.mistakes, lesson.exercise, lesson.apply].join(" ");

test("#2094 final audit contains all 96 lessons and retains all 95 source records", () => {
  assert.equal(lessons.length, 96);
  const sources = lessons.flatMap((lesson) => lesson.sources);
  assert.equal(sources.length, 95);
  assert.equal(new Set(sources.map((source) => source.id)).size, 95);
  assert.equal(ledger.phase, 10);
  assert.equal(ledger.phaseBaselineCommit, "8d792d460fe8fdd57c440572018be02728bb4594");
  assert.equal(ledger.reviewedThrough, 96);
  assert.equal(ledger.nextPresentationOrder, null);
  assert.deepEqual(Object.keys(ledger.lessons), Array.from({ length: 96 }, (_, index) => String(index + 1)));
  assert.equal(hash(lessons.map(({ id, topic, number }) => ({ id, topic, number }))), ledger.presentationOrderSha256);
  assert.equal(ledger.presentationOrderSha256, "be54835767c5b9a034537adfb1e610e580fd5a965cb1b1e12136c3f99a99b633");
  assert.equal(hash([...sources].sort((a, b) => a.id.localeCompare(b.id))), ledger.sourceContentSha256);
  assert.equal(ledger.sourceContentSha256, "da0e4ea5146019a19d472787d78505faf74993f69e82c0460125143cadeb4343");

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const [index, lesson] of lessons.entries()) {
    const order = index + 1;
    const record = ledger.lessons[String(order)];
    assert.equal(record.presentationOrder, order);
    assert.equal(record.lessonId, lesson.id);
    assert.equal(record.topic, lesson.topic);
    assert.equal(record.title, lesson.title);
    assert.equal(record.learnerSufficientAfter, true);
    assert.ok(record.decisions.length > 0);
    const { sources: attached, ...teaching } = lesson;
    assert.equal(hash(teaching), record.lessonContentSha256, `Lesson ${order}: final teaching fingerprint drift`);
    for (const sourceId of record.sourceIds) {
      const source = sourceById.get(sourceId);
      assert.ok(source, `Lesson ${order}: missing retained source ${sourceId}`);
      assert.equal(hash(source), record.sourceHashes[sourceId], `Lesson ${order}: source fingerprint drift`);
    }
    if (order !== 67 && order !== 69) assert.deepEqual(record.sourceIds, attached.map((source) => source.id));
  }
});

test("#2094 final fidelity keeps restored terminology and practical depth learner-visible", () => {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const markers = new Map([
    ["characters-conflict", ["Man vs Machine", "Man vs Nature", "Traditional conflict taxonomy"]],
    ["characters-cast-system", ["Recognize traditional archetype vocabulary", "Give supporting and non-human characters full dramatic logic"]],
    ["24b-story-beats", ["The original 24-position Story Beats reference", "Dark Night of the Soul"]],
    ["dialogue-action", ["Practice selected naturalism", "Observation exercise"]],
    ["ai-revision-diagnose-only", ["Critical → Intermediate → Fine-Tuning", "Retain the questions; retire the obsolete prompt wrapper"]],
    ["collaboration-formats-that-travel", ["Keep the useful Markdown syntax visible", "Task lists (GFM)", "Tables (common/GFM extension)"]],
    ["professional-pitching-and-representation", ["legacy copywriting frameworks", "PAS — Problem, Agitation, Solution", "QUEST — Qualify, Understand, Educate, Stimulate, Tie it up"]],
  ]);
  for (const [id, expected] of markers) {
    const lesson = byId.get(id);
    assert.ok(lesson, `Missing final fidelity lesson ${id}`);
    const body = lessonText(lesson);
    for (const marker of expected) assert.ok(body.includes(marker), `${id}: missing ${marker}`);
  }
});

test("#2094 Phase 10 audits exact Lessons 91–96", () => {
  const expected = [
    [91, "working-together-proposal", "Submit a Reviewable Proposal"],
    [92, "working-together-review", "Review the Change, Not the Person"],
    [93, "working-together-disagreements", "Decide, Disagree and Record Canon"],
    [94, "working-together-rights", "Record Credit, Ownership and Permissions"],
    [95, "working-together-scale", "Protect Privacy and Scale the Review Queue"],
    [96, "writers-room-story-breaking", "Writers' Room: Story Breaking and Notes"],
  ];
  for (const [order, id, title] of expected) {
    assert.equal(lessons[order - 1].id, id);
    assert.equal(lessons[order - 1].title, title);
    const record = ledger.lessons[String(order)];
    assert.equal(record.learnerSufficientAfter, true);
    assert.ok(record.decisions.length > 0);
  }
  assert.deepEqual(ledger.lessons["95"].sourceIds, ["24-blocks-blog-llms-and-ai-navigation-md"]);
  assert.deepEqual(ledger.lessons["96"].sourceIds, []);
});

test("#2094 retires learner-visible bundled source viewers while preserving internal provenance", () => {
  for (const path of ["app/skin-v1/learn-journey-preview.tsx", "app/skin-v1/learn-explore.tsx"]) {
    const source = readFileSync(resolve(root, path), "utf8");
    assert.doesNotMatch(source, /canonical bundled source/u);
    assert.doesNotMatch(source, /<pre>\{source.content\}<\/pre>/u);
    assert.doesNotMatch(source, /(?:openLesson|openEntry.lesson).sources.map/u);
  }
  assert.match(ledger.sourceViewerRetirement, /Completed/u);
  assert.equal(lessons.flatMap((lesson) => lesson.sources).length, 95);
});
