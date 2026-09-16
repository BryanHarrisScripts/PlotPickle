import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const moduleUrls = new Map();
const phaseBaselines = [
  [20, "d288609ec844977c7178bf7ef46324f59fb5e90e"],
  [30, "cf59920491891e9c367c542cd0209d3f5f89bf6b"],
  [40, "628b01e05d8568048b9fe176a1ab50aa9848ddc3"],
  [50, "ad6fae93f5895087d9179dbbf352ba5d5f0fe5b4"],
  [60, "72c6c537f29d2ea6ad6f404296600ea3bd3ee26e"],
  [70, "d12e18a279ee56032d8c7939232c1ddc4ccb9180"],
  [80, "495ca1b8f0633f267460e007eeb18a9eb931a8ac"],
  [90, "dd3867465e3e745b675ed0d8d5f73a82910969c8"],
];

async function moduleUrl(path) {
  const absolute = resolve(path);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = extname(absolute) === ".json"
    ? `export default ${readFileSync(absolute, "utf8")};`
    : stripTypeScriptTypes(readFileSync(absolute, "utf8"));
  if (extname(absolute) !== ".json") {
    for (const match of [...source.matchAll(/from\s*["'](\.[^"']+)["']/gu)]) {
      const requested = resolve(dirname(absolute), match[1]);
      const target = [requested, `${requested}.ts`, `${requested}.json`, resolve(requested, "index.ts")]
        .find((candidate) => existsSync(candidate) && /\.(ts|json)$/u.test(candidate));
      assert.ok(target, `Missing curriculum import ${match[1]}`);
      source = source.replace(match[0], `from "${await moduleUrl(target)}"`);
    }
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  moduleUrls.set(absolute, url);
  return url;
}

const loadLocalModule = async (path) => import(await moduleUrl(path));
const { plotPickleCurriculum: lessons } = await loadLocalModule(
  resolve(root, "adapters/curriculum/current-catalog.ts"),
);
const ledger = JSON.parse(readFileSync(resolve(root, "docs/learn/lesson-integration-2094.json"), "utf8"));
const text = (lesson) => lesson.sections.flatMap((section) => [
  section.heading,
  ...section.paragraphs,
  ...(section.points ?? []),
]).join(" ");
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("#2094 audit follows actual presentation order and reviewed source routing", () => {
  assert.equal(lessons.length, 96);
  const sources = lessons.flatMap((lesson) => lesson.sources);
  assert.equal(sources.length, 95);
  assert.equal(new Set(sources.map((source) => source.id)).size, 95);
  assert.equal(ledger.phase, 9);
  assert.equal(ledger.phaseBaselineCommit, "dd3867465e3e745b675ed0d8d5f73a82910969c8");
  assert.equal(ledger.reviewedThrough, 90);
  assert.equal(ledger.nextPresentationOrder, 91);
  assert.deepEqual(Object.keys(ledger.lessons), Array.from({ length: 90 }, (_, i) => String(i + 1)));

  const actions = new Set(["ALREADY_CLEAR", "INTEGRATE", "BETTER_ELSEWHERE", "HISTORICAL_ONLY", "REJECT", "DO_NOT_FREEZE"]);
  const differentGenres = "24-blocks-dialogue-24-blocks-different-genres-md";
  for (const [index, lesson] of lessons.slice(0, 90).entries()) {
    const order = index + 1;
    const record = ledger.lessons[String(order)];
    assert.equal(record.presentationOrder, order);
    assert.equal(record.lessonId, lesson.id);
    assert.equal(record.title, lesson.title);
    assert.equal(record.topic, lesson.topic);
    const attachedSourceIds = lesson.sources.map((source) => source.id);
    if (order === 67) {
      assert.deepEqual(record.sourceIds, [differentGenres]);
      assert.deepEqual(attachedSourceIds, []);
    } else if (order === 69) {
      assert.deepEqual(record.sourceIds, [
        "24-blocks-dialogue-24-blocks-dialogue-pitfalls-md",
        "24-blocks-dialogue-24-blocks-refining-dialogue-md",
      ]);
      assert.deepEqual(attachedSourceIds, [
        "24-blocks-dialogue-24-blocks-dialogue-pitfalls-md",
        differentGenres,
        "24-blocks-dialogue-24-blocks-refining-dialogue-md",
      ]);
    } else {
      assert.deepEqual(record.sourceIds, attachedSourceIds);
    }
    assert.equal(typeof record.learnerSufficientBefore, "boolean");
    assert.equal(record.learnerSufficientAfter, true);
    assert.ok(record.decisions.length > 0);
    for (const decision of record.decisions) {
      assert.ok(actions.has(decision.action));
      assert.ok(decision.concept && decision.evidence);
    }
  }
});

test("#2094 Phase 9 integrates Film Industry roles and keeps Lessons 82–90 self-contained", () => {
  const expected = new Map([
    [81, ["What the major organizations actually do", "Writers Guild of America", "Producers Guild of America", "professional societies"]],
    [82, ["Ownership and licences answer different questions", "Choose access, publication and reuse separately"]],
    [83, ["Know what conversation you are having", "A query is a truthful doorway", "Representation is a working relationship"]],
    [84, ["Begin with the creative relationship", "Name the canonical project", "Choose only what the project needs"]],
    [85, ["Define roles and decision ownership", "Propose rather than overwrite"]],
    [86, ["Choose by purpose, not familiarity", "Plan for round trips"]],
    [87, ["The operating agreement"]],
    [88, ["creative authority", "technical permission"]],
    [89, ["acceptance criteria"]],
    [90, ["approved", "stale"]],
  ]);

  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.reviewedAtCommit ?? ledger.phaseBaselineCommit, "dd3867465e3e745b675ed0d8d5f73a82910969c8");
    if (order === 81) {
      assert.equal(record.learnerSufficientBefore, false);
      assert.ok(record.decisions.some((decision) => decision.action === "INTEGRATE"));
    } else {
      assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
      assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    }
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 preserves prior reviewed teaching fingerprints and phase baselines", () => {
  assert.equal(hash(lessons.map(({ id, topic, number }) => ({ id, topic, number }))), ledger.presentationOrderSha256);
  const sources = lessons.flatMap((lesson) => lesson.sources).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(hash(sources), ledger.sourceContentSha256);

  for (const [index, lesson] of lessons.slice(0, 90).entries()) {
    const order = index + 1;
    const record = ledger.lessons[String(order)];
    if (record.lessonContentSha256) {
      const { sources: attached, ...teaching } = lesson;
      assert.equal(hash(teaching), record.lessonContentSha256, `${lesson.title}: teaching changed since individual review`);
      assert.deepEqual(Object.fromEntries(attached.map((source) => [source.id, hash(source)])), record.sourceHashes);
      continue;
    }
    if (order === 81) continue;
    const [, expectedReviewCommit] = phaseBaselines.find(([through]) => order <= through);
    assert.equal(record.reviewedAtCommit, expectedReviewCommit, `${lesson.title}: missing phase baseline evidence`);
    assert.equal(record.learnerSufficientBefore, true, `${lesson.title}: untracked teaching gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"));
  }
});

test("#2094 keeps source-viewer retirement deferred through Phase 9", () => {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  for (const path of ["app/skin-v1/learn-journey-preview.tsx", "app/skin-v1/learn-explore.tsx"]) {
    assert.match(read(path), /canonical bundled source/);
    assert.match(read(path), /<pre>\{source.content\}<\/pre>/);
  }
  assert.equal(lessons[80].title, "The Film Industry");
  assert.equal(lessons[89].title, "Start From the Approved Story");
  assert.equal(lessons[90].title, "Submit a Reviewable Proposal");
});
