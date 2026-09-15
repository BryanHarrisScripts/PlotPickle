import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const moduleUrls = new Map();

// Load the actual dependency-free curriculum projection on CI's Node 22.13.
// Resolve its relative TS/JSON imports without installing the application stack.
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
  section.heading, ...section.paragraphs, ...(section.points ?? []),
]).join(" ");

test("#2094 audit follows actual presentation order and attached provenance", () => {
  assert.equal(lessons.length, 96);
  const sources = lessons.flatMap((lesson) => lesson.sources);
  assert.equal(sources.length, 95);
  assert.equal(new Set(sources.map((source) => source.id)).size, 95);
  assert.equal(ledger.phase, 2);
  assert.equal(ledger.reviewedThrough, 20);
  assert.equal(ledger.nextPresentationOrder, 21);
  assert.deepEqual(Object.keys(ledger.lessons), Array.from({ length: 20 }, (_, i) => String(i + 1)));
  const actions = new Set(["ALREADY_CLEAR", "INTEGRATE", "BETTER_ELSEWHERE", "HISTORICAL_ONLY", "REJECT", "DO_NOT_FREEZE"]);
  for (const [index, lesson] of lessons.slice(0, 20).entries()) {
    const order = index + 1;
    const record = ledger.lessons[String(order)];
    assert.equal(record.presentationOrder, order);
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

test("#2094 retained Phase 1 gaps reach normal lesson sections without source records", () => {
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

test("#2094 Phase 2 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [11, ["The complete Foundations Brief", "Run the contradiction audit", "Use the ending as proof"]],
    [12, ["Genre is a promise", "Tropes are tools", "Audit the genre experience"]],
    [13, ["Build the blueprint", "Make the world causal", "Reveal without lectures"]],
    [14, ["Purpose and scope", "Canonical, proposed and unknown", "Use it during writing"]],
    [15, ["Identify evidence and risks", "Invented lore", "Changing canon to solve a contradiction"]],
    [16, ["Authenticity questions should be routed to people and sources", "Build a checklist", "Claiming cultural authority"]],
    [17, ["The dramatic core", "Specificity and voice", "Relationships and arc"]],
    [18, ["The protagonist reacts more than chooses", "Ask me focused questions", "Replacing writer intent with a stock arc"]],
    [19, ["Start with the active strategy", "Make strengths double-edged", "Use backstory only when it acts"]],
    [20, ["Build the evidence chain", "Raise the cost, not only the volume", "Compare plan with draft"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, ledger.phaseBaselineCommit);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
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
  assert.equal(lessons[19].title, "Prove Character Through Choice");
  assert.equal(lessons[20].title, "Map the Inner Journey Without Forcing It");
});

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("#2094 audit fingerprints match reviewed teaching, sources and order", () => {
  assert.equal(hash(lessons.map(({ id, topic, number }) => ({ id, topic, number }))), ledger.presentationOrderSha256);
  const sources = lessons.flatMap((lesson) => lesson.sources).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(hash(sources), ledger.sourceContentSha256);
  for (const [index, lesson] of lessons.slice(0, 20).entries()) {
    const order = index + 1;
    const record = ledger.lessons[String(order)];
    if (record.lessonContentSha256) {
      const { sources: attached, ...teaching } = lesson;
      assert.equal(hash(teaching), record.lessonContentSha256, `${lesson.title}: teaching changed since individual review`);
      assert.deepEqual(Object.fromEntries(attached.map((source) => [source.id, hash(source)])), record.sourceHashes);
    } else {
      assert.equal(record.reviewedAtCommit, ledger.phaseBaselineCommit, `${lesson.title}: missing Phase 2 baseline evidence`);
      assert.equal(record.learnerSufficientBefore, true, `${lesson.title}: untracked teaching gap needs a fingerprinted edit`);
      assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `${lesson.title}: integration decision requires a content fingerprint`);
    }
  }
});
