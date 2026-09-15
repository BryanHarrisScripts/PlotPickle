import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const sorted = (values) => [...values].sort();

const EXPECTED_TOPIC_COUNTS = {
  drafting: 8,
  revision: 5,
  industry: 2,
  "responsible-ai": 8,
  collaboration: 18,
};

const EXPECTED_SOURCE_IDS = [
  "24-blocks-general-general-the-writing-process-md",
  "24-blocks-general-general-concept-to-draft-md",
  "24-blocks-general-general-the-vomit-draft-md",
  "24-blocks-general-script-formatting-md",
  "24-blocks-general-general-popular-books-md",
  "24-blocks-general-screenplay-challenges-guide-md",
  "24-blocks-essentials-scene-writing-md",
  "24-blocks-essentials-beyond-sluglines-md",
  "24-blocks-ai-prompts-24-blocks-individual-critical-md",
  "24-blocks-ai-prompts-24-blocks-individual-fine-tuning-md",
  "24-blocks-ai-prompts-24-blocks-individual-intermediate-md",
  "24-blocks-ai-prompts-24-blocks-critique-and-pacing-md",
  "24-blocks-ai-prompts-24-blocks-redundancy-and-streamlining-md",
  "24-blocks-general-general-the-film-industry-md",
  "24-blocks-ai-prompts-24-blocks-copywriting-and-marketing-md",
  "24-blocks-24-blocks-24-blocks-blocks-with-ai-md",
  "24-blocks-ai-prompts-24-blocks-chatgpt-tips-md",
  "24-blocks-ai-prompts-24-blocks-principle-of-three-md",
  "24-blocks-ai-prompts-24-blocks-suggested-additions-md",
  "24-blocks-ai-prompts-readme-md",
  "24-blocks-general-general-ai-framework-ideas-md",
  "24-blocks-experiment-learnings-md",
  "24-blocks-ai-prompts-24-blocks-structure-and-characters-md",
  "24-blocks-blog-github-for-screenwriters-md",
  "24-blocks-blog-open-sourcing-your-screenplay-md",
  "24-blocks-blog-readme-md",
  "24-blocks-collaborators-readme-md",
  "24-blocks-opensource-1-million-voices-md",
  "24-blocks-opensource-centralvsdecentral-md",
  "24-blocks-readme-md",
  "24-blocks-blog-github-collaborative-writing-md",
  "24-blocks-opensource-open-source-collaboration-md",
  "bryanharrisscripts-github-io-ai-teams-collaboration-md",
  "24-blocks-blog-github-mastering-markdown-md",
  "24-blocks-blog-github-merging-final-draft-and-text-md",
  "afterglow-contributing-md",
  "24-blocks-blog-llms-twitter-github-and-ai-md",
  "24-blocks-blog-open-sourcing-licensing-and-protection-md",
  "24-blocks-blog-llms-and-ai-navigation-md",
  "afterglow-readme-md-instructional-sections",
  "bryanharrisscripts-github-io-readme-md",
];

const ALLOWED_DISPOSITIONS = new Set([
  "INTEGRATED_HERE",
  "INTEGRATED_ELSEWHERE",
  "ALREADY_COVERED",
  "HISTORICAL_REFERENCE_ONLY",
  "REJECTED_OUTDATED",
]);

test("#2078 audits exactly the 41 Drafting, Revision, Industry, Responsible AI and Collaboration sources", async () => {
  const [manifest, ledger, ...documents] = await Promise.all([
    json("learn/enrichment/integrated-source-manifest.json"),
    json("docs/learn/source-drain-2078.json"),
    ...Object.keys(EXPECTED_TOPIC_COUNTS).map((topic) => json(`learn/${topic}.json`)),
  ]);

  const attachedByTopic = Object.fromEntries(documents.map((document) => [
    document.topic.id,
    document.lessons.flatMap((lesson) => lesson.sources ?? []).map((source) => source.id),
  ]));
  const attachedSourceIds = Object.values(attachedByTopic).flat();

  assert.deepEqual(
    Object.fromEntries(Object.entries(attachedByTopic).map(([topic, ids]) => [topic, ids.length])),
    EXPECTED_TOPIC_COUNTS,
  );
  assert.equal(attachedSourceIds.length, 41);
  assert.equal(new Set(attachedSourceIds).size, 41);
  assert.deepEqual(sorted(attachedSourceIds), sorted(EXPECTED_SOURCE_IDS));
  assert.deepEqual(sorted(ledger.sources.map((source) => source.sourceId)), sorted(EXPECTED_SOURCE_IDS));
  assert.equal(ledger.attachmentCount, 41);
  assert.equal(ledger.uniqueSourceCount, 41);

  for (const sourceId of EXPECTED_SOURCE_IDS) {
    assert.ok(manifest.integratedSourceIds.includes(sourceId), `#2078 source ${sourceId} must be marked integrated after audit`);
  }
  assert.deepEqual(manifest.auditedIssues, [2076, 2077, 2078]);
  assert.equal(manifest.sourceRecordCount, 95);
  assert.equal(manifest.integratedSourceIds.length, 95, "All 95 bundled source records should be audited after phase 3");
  assert.equal(new Set(manifest.integratedSourceIds).size, 95, "Integrated source IDs must remain unique");
});

test("#2078 assigns every source concept one valid disposition and consumes cross-phase handoffs", async () => {
  const ledger = await json("docs/learn/source-drain-2078.json");

  for (const source of ledger.sources) {
    assert.ok(source.path, `${source.sourceId} is missing provenance path`);
    assert.ok(source.decisions.length > 0, `${source.sourceId} has no disposition decisions`);
    for (const decision of source.decisions) {
      assert.ok(decision.concept, `${source.sourceId} has a decision without a concept`);
      assert.ok(ALLOWED_DISPOSITIONS.has(decision.disposition), `${source.sourceId} has invalid disposition ${decision.disposition}`);
      if (decision.disposition === "INTEGRATED_ELSEWHERE" || decision.disposition === "ALREADY_COVERED") {
        assert.ok(decision.destination, `${source.sourceId} ${decision.disposition} decision is missing its destination`);
      }
    }
  }

  const handoffs = ledger.sources.flatMap((source) => source.decisions)
    .filter((decision) => decision.disposition === "INTEGRATED_ELSEWHERE")
    .map((decision) => decision.destination);
  assert.ok(handoffs.some((destination) => destination.includes("#2076")), "Expected Character handoff to remain with #2076 teaching");
  assert.ok(handoffs.some((destination) => destination.includes("#2077")), "Expected Structure/Dialogue handoffs to remain with #2077 teaching");
  assert.ok(handoffs.some((destination) => destination.includes("revision:")), "Expected Drafting/Industry concepts to hand off to Revision where appropriate");
  assert.ok(handoffs.some((destination) => destination.includes("responsible-ai:")), "Expected collaboration/AI concepts to hand off to Responsible AI where appropriate");
});

test("current lessons remain the learner-facing homes for phase 3 teaching", async () => {
  const [drafting, revision, industry, responsibleAi, collaboration, renderer] = await Promise.all([
    json("learn/drafting.json"),
    json("learn/revision.json"),
    json("learn/industry.json"),
    json("learn/responsible-ai.json"),
    json("learn/collaboration.json"),
    read("modules/learn/ui/curriculum-material.tsx"),
  ]);

  const ids = (document) => new Set(document.lessons.map((lesson) => lesson.id));
  for (const lessonId of ["writing-process", "concept-to-draft", "pickle-draft", "formatting", "books-scripts", "challenges", "essentials-scene", "essentials-formatting"]) {
    assert.ok(ids(drafting).has(lessonId), `Missing Drafting teaching home ${lessonId}`);
  }
  for (const lessonId of ["ai-revision-diagnose-only", "ai-revision-structure-causality", "ai-revision-scene-purpose-turn", "ai-revision-conflict-stakes-escalation", "ai-revision-pacing-repetition", "ai-revision-formatting-readability", "ai-revision-pitch-audience-language"]) {
    assert.ok(ids(revision).has(lessonId), `Missing Revision teaching home ${lessonId}`);
  }
  for (const lessonId of ["industry", "collaboration-ownership-sharing"]) assert.ok(ids(industry).has(lessonId));
  for (const lessonId of ["responsible-ai", "24b-ai", "collaboration-ai-github-publishing"]) assert.ok(ids(responsibleAi).has(lessonId));
  for (const lessonId of ["collaboration-choose-workflow", "collaboration-source-of-truth", "collaboration-formats-that-travel", "working-together-model", "working-together-authority", "working-together-brief", "working-together-canon", "working-together-proposal", "working-together-disagreements", "working-together-rights", "working-together-scale"]) {
    assert.ok(ids(collaboration).has(lessonId), `Missing Collaboration teaching home ${lessonId}`);
  }

  assert.match(renderer, /INTEGRATED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(renderer, /return null/);
});

test("#2078 keeps stale product instructions, live industry claims and rights overclaims out of learner authority", async () => {
  const ledger = await json("docs/learn/source-drain-2078.json");
  const byId = new Map(ledger.sources.map((source) => [source.sourceId, source]));
  const has = (sourceId, disposition) => byId.get(sourceId)?.decisions.some((decision) => decision.disposition === disposition);

  for (const sourceId of [
    "24-blocks-ai-prompts-readme-md",
    "24-blocks-experiment-learnings-md",
    "24-blocks-blog-readme-md",
    "bryanharrisscripts-github-io-readme-md",
  ]) {
    assert.ok(has(sourceId, "HISTORICAL_REFERENCE_ONLY"), `${sourceId} must keep repository/prompt scaffolding historical-only`);
  }

  for (const sourceId of [
    "24-blocks-general-general-the-film-industry-md",
    "24-blocks-ai-prompts-24-blocks-chatgpt-tips-md",
    "24-blocks-blog-github-for-screenwriters-md",
    "24-blocks-blog-open-sourcing-your-screenplay-md",
    "24-blocks-blog-open-sourcing-licensing-and-protection-md",
  ]) {
    assert.ok(has(sourceId, "REJECTED_OUTDATED"), `${sourceId} must retain an explicit outdated/live-claim correction boundary`);
  }
});
