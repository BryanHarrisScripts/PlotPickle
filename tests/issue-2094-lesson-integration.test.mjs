import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const moduleUrls = new Map();
const phase2Baseline = "d288609ec844977c7178bf7ef46324f59fb5e90e";
const phase3Baseline = "cf59920491891e9c367c542cd0209d3f5f89bf6b";
const phase4Baseline = "628b01e05d8568048b9fe176a1ab50aa9848ddc3";
const phase5Baseline = "ad6fae93f5895087d9179dbbf352ba5d5f0fe5b4";
const phase6Baseline = "72c6c537f29d2ea6ad6f404296600ea3bd3ee26e";
const phase7Baseline = "d12e18a279ee56032d8c7939232c1ddc4ccb9180";
const phase8Baseline = "495ca1b8f0633f267460e007eeb18a9eb931a8ac";
const phase9Baseline = "dd3867465e3e745b675ed0d8d5f73a82910969c8";

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

test("#2094 audit follows actual presentation order and reviewed source routing", () => {
  assert.equal(lessons.length, 96);
  const sources = lessons.flatMap((lesson) => lesson.sources);
  assert.equal(sources.length, 95);
  assert.equal(new Set(sources.map((source) => source.id)).size, 95);
  assert.equal(ledger.phase, 9);
  assert.equal(ledger.phaseBaselineCommit, phase9Baseline);
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
    assert.equal(record.reviewedAtCommit, phase2Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 3 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [21, ["Choose the shape, then test it", "Use flexible checkpoints", "Let the active story choose the questions"]],
    [22, ["Use a pressure spectrum", "Make internal conflict playable", "Connect pressure to consequence"]],
    [23, ["Start with incompatible objectives", "Use the dialectical lens carefully", "Let foils reveal strategy"]],
    [24, ["Write both perspectives", "Track the turning event", "Allow adaptation in both directions"]],
    [25, ["Voice begins before dialogue", "Change voice by relationship and pressure", "Research without certification claims"]],
    [26, ["Use functions, not identity boxes", "Audit cast economy", "Do not promise commercial outcomes"]],
    [27, ["Mood, tone and visual ingredients", "Repetition with variation", "Reference, project asset and generated asset"]],
    [28, ["When this pass helps", "Review the response before approval", "Recognize predictable AI failure modes"]],
    [29, ["Attitude, not one mood", "Tonal promise", "Controlled tonal turn"]],
    [30, ["The argument stays alive", "Contribution without repetition", "Competing answer"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, phase3Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 4 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [31, ["Pattern through context and change", "Meaning is not universal", "Foreshadowing is not merely hiding a clue"]],
    [32, ["Structure organizes change", "Alternative forms", "Choose and map"]],
    [33, ["Story reason first", "4 acts", "Flexible scene count"]],
    [34, ["A visible thinking surface", "Move a turn when the story earns it", "Combine Blocks when one movement carries both jobs"]],
    [35, ["Pressure produces decisions", "Objective", "Handoff"]],
    [36, ["The hierarchy", "Beat: moment-to-moment change.", "Navigate without flattening."]],
    [37, ["The original foundation", "PlotPickle’s expansion", "Pressure: escalate."]],
    [38, ["Nested curiosity", "Story: can the protagonist achieve the defining objective?", "Sequence question"]],
    [39, ["Different shapes, same need for movement", "Presentation order", "Convergence points"]],
    [40, ["Reflection is transformation", "Opening image", "Changed context"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, phase4Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 5 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [41, ["The dynamic scene chain", "Scene purpose", "Next pressure"]],
    [42, ["Change creates pace", "Compression", "Processing time"]],
    [43, ["Think in nested dramatic scales", "Build episode movement before choosing a format grid", "Track season movement as accumulated consequence"]],
    [44, ["Recurring story system", "Episode variety", "Working series reference"]],
    [45, ["Start with comic pressure", "Build setup, expectation, turn and payoff", "Use runners and callbacks as story tools"]],
    [46, ["Four different visual jobs", "Compare before approving", "History, naming and rights"]],
    [47, ["When this pass helps", "Set the operation and scope", "Recognize predictable AI failure modes"]],
    [48, ["Make the claim playable", "Selection is visual writing", "Voice-over or narration may be used"]],
    [49, ["Discovery and selection", "Plan, draft and finish", "Feedback and revision"]],
    [50, ["Concept and premise", "Expansion without drift", "Draft and revise"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, phase5Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 6 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [51, ["Permission to be incomplete", "A productive session", "[RESEARCH]"]],
    [52, ["A scene heading identifies interior or exterior", "Formatting supports scanning", "Tools and exports"]],
    [53, ["Read like a writer", "Compare page and screen", "legally available scripts"]],
    [54, ["Story and structure problems", "The writer's practical challenges", "Escalation means qualitative change"]],
    [55, ["Complete scene movement", "Pressure Lock", "Cut Line"]],
    [56, ["Technique follows purpose", "Secondary heading / mini-slug", "Montage: Compress a process or transformation"]],
    [57, ["Start with the condition, not the furniture", "Pressure creates tactics", "Turn the condition"]],
    [58, ["Format is a reading interface", "Spec draft and production document have different jobs", "Verify the rule that actually applies"]],
    [59, ["Find the adaptation promise", "Select, compress, expand and combine", "Externalize what the source can keep inside"]],
    [60, ["When this pass helps", "Set the operation and scope", "Review the response before approval"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, phase6Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 7 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [61, ["When this pass helps", "Set the operation and scope", "Recognize predictable AI failure modes"]],
    [62, ["The playable exchange", "Selected reality", "Possible spoken or silent action: pressure"]],
    [63, ["Voice is perception plus strategy", "Accent and dialect require care", "Consistency does not mean sameness"]],
    [64, ["The pressure system", "Public topic", "Protected fact"]],
    [65, ["Conflict can be polite", "Escalation should alter leverage", "available options"]],
    [66, ["The answer may be physical", "Screenplay form", "Dual dialogue indicates simultaneous speech"]],
    [67, ["Information under pressure", "Genre affects pressure", "Genre does not dictate one dialogue style"]],
    [68, ["Movement before polish", "entry question or tension", "patterns, not formulas"]],
    [69, ["Twelve focused passes", "Manual and optional AI workflows", "Synthetic voices must remain optional"]],
    [70, ["When this pass helps", "Identify evidence and risks", "Review the response before approval"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, phase7Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 8 teaching is sufficient without source-driven rewrites", () => {
  const expected = new Map([
    [71, ["When this pass helps", "Blocks feel episodic or interchangeable", "Confusing chronology with causality"]],
    [72, ["Build a checklist", "The scene starts too early or ends too late", "The scene can be removed without consequence"]],
    [73, ["Compare two approaches", "The middle plateaus", "Bigger explosions as default escalation"]],
    [74, ["Identify evidence and risks", "Readers report drag", "Arbitrary percentage cuts"]],
    [75, ["Build a checklist", "Formatting inconsistencies distract from the read", "Treating one house style as universal law"]],
    [76, ["Compare two approaches", "The screenplay direction is stable", "Generic hype"]],
    [77, ["Why → how → evidence → diagnose → revise", "Questions, not verdicts", "Revision priorities"]],
    [78, ["Define the job before the prompt", "Privacy, rights and provenance", "Bias, culture and human review"]],
    [79, ["Match the request to the level", "How PlotPickle applies this", "Generated", "Canonical"]],
    [80, ["Choose the tool after defining the task", "Bound context and preserve approval", "Collaboration is not publication"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
    assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
    assert.equal(record.reviewedAtCommit, phase8Baseline);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
});

test("#2094 Phase 9 integrates Film Industry roles and keeps Lessons 82–90 self-contained", () => {
  const expected = new Map([
    [81, ["What the major organizations actually do", "WGA East and WGA West", "PGA: a professional trade association", "AMPAS: a professional film academy", "BFI and BAFTA", "EFA and FERA"]],
    [82, ["Ownership and licences answer different questions", "Keep PlotPickle's rights layers separate", "Choose access, publication and reuse separately"]],
    [83, ["Begin with the creative relationship", "Name the canonical project", "Choose only what the project needs"]],
    [84, ["Define roles and decision ownership", "Propose rather than overwrite", "Git concepts in writer language"]],
    [85, ["Choose by purpose, not familiarity", "Use direct Final Draft interchange", "Plan for round trips"]],
    [86, ["The operating agreement", "Private feature team", "Open-source experiment"]],
    [87, ["Responsibility and enforcement", "Authority matrix", "Creative authority", "Technical permission"]],
    [88, ["Brief the work", "Template: Feedback only", "Template: Rewrite proposal"]],
    [89, ["Safe sequence", "stale base", "human reconsideration"]],
    [90, ["Proposal packet", "understandable inside PlotPickle", "before the owner opens GitHub"]],
  ]);
  for (const [order, concepts] of expected) {
    const lesson = lessons[order - 1];
    const record = ledger.lessons[String(order)];
    const body = text({ ...lesson, sources: [] });
    if (order === 81) {
      assert.equal(record.learnerSufficientBefore, false);
      assert.ok(record.decisions.some((decision) => decision.action === "INTEGRATE"));
    } else {
      assert.equal(record.learnerSufficientBefore, true, `Lesson ${order}: unexpected source-dependent gap`);
      assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `Lesson ${order}: unimplemented integration decision`);
      assert.equal(record.reviewedAtCommit, phase9Baseline);
    }
    assert.equal(record.learnerSufficientAfter, true);
    for (const concept of concepts) assert.ok(body.includes(concept), `Lesson ${order}: missing ${concept}`);
    assert.doesNotMatch(body, /<pre>|<details>/);
  }
  assert.match(text(lessons[80]), /not the labour-union equivalent/);
  assert.doesNotMatch(text(lessons[80]), /membership count|current membership|annual dues|minimum rate/i);
});

test("#2094 keeps phased source retirement and shared presentation authority", () => {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  for (const path of ["app/skin-v1/learn-journey-preview.tsx", "app/skin-v1/learn-explore.tsx"]) {
    assert.match(read(path), /canonical bundled source/);
    assert.match(read(path), /<pre>\{source.content\}<\/pre>/);
  }
  assert.match(read("app/api/learn/explore/route.ts"), /plotPickleCurriculum.*map/);
  assert.match(read("app/page.tsx"), /curriculum=\{plotPickleCurriculum\}/);
  assert.equal(lessons[50].title, "The Pickle Draft");
  assert.equal(lessons[58].title, "Adaptation: Source to Screen");
  assert.equal(lessons[59].title, "Dialogue and Voiceprint pass");
  assert.equal(lessons[60].title, "Subtext, status and silence pass");
  assert.equal(lessons[69].title, "Diagnose without rewriting");
  assert.equal(lessons[70].title, "Structure and causality audit");
  assert.equal(lessons[79].title, "AI, GitHub and Public Publishing as Optional Tools");
  assert.equal(lessons[80].title, "The Film Industry");
  assert.equal(lessons[89].title, "Submit a Reviewable Proposal");
  assert.equal(lessons[90].title, "Review the Change, Not the Person");
});

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("#2094 audit fingerprints match reviewed teaching, sources and order", () => {
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
    } else if (order === 81) {
      assert.equal(record.learnerSufficientBefore, false);
      assert.ok(record.decisions.some((decision) => decision.action === "INTEGRATE"));
      assert.equal(record.learnerSufficientAfter, true);
    } else {
      const expectedReviewCommit = order <= 20
        ? phase2Baseline
        : order <= 30
          ? phase3Baseline
          : order <= 40
            ? phase4Baseline
            : order <= 50
              ? phase5Baseline
              : order <= 60
                ? phase6Baseline
                : order <= 70
                  ? phase7Baseline
                  : order <= 80
                    ? phase8Baseline
                    : phase9Baseline;
      assert.equal(record.reviewedAtCommit, expectedReviewCommit, `${lesson.title}: missing phase baseline evidence`);
      assert.equal(record.learnerSufficientBefore, true, `${lesson.title}: untracked teaching gap needs a fingerprinted edit`);
      assert.ok(record.decisions.every((decision) => decision.action !== "INTEGRATE"), `${lesson.title}: integration decision requires a content fingerprint`);
    }
  }
});
