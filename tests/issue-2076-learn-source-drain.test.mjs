import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const sorted = (values) => [...values].sort();

const EXPECTED_TOPIC_COUNTS = {
  foundations: 7,
  theme: 2,
  world: 4,
  character: 14,
};

const EXPECTED_SOURCE_IDS = [
  "24-blocks-general-general-the-pitch-md",
  "24-blocks-general-readme-md",
  "24-blocks-loglines-loglines-md",
  "24-blocks-essentials-essential-aspects-1-md",
  "24-blocks-essentials-essential-aspects-2-md",
  "24-blocks-essentials-readme-md",
  "24-blocks-essentials-storytelling-dynamics-md",
  "24-blocks-essentials-thematic-components-md",
  "24-blocks-essentials-symbolic-techniques-md",
  "24-blocks-general-general-tropes-and-genres-md",
  "24-blocks-general-general-world-building-md",
  "24-blocks-general-general-story-bible-character-md",
  "24-blocks-general-general-story-bible-md",
  "24-blocks-character-24-blocks-character-archetypes-md",
  "24-blocks-character-24-blocks-development-md",
  "24-blocks-character-24-blocks-man-vs-himself-md",
  "24-blocks-character-readme-md",
  "24-blocks-character-24-blocks-compelling-characters-md",
  "24-blocks-character-24-blocks-questions-act-1-md",
  "24-blocks-character-24-blocks-questions-act-2-md",
  "24-blocks-character-24-blocks-questions-act-3-md",
  "24-blocks-character-24-blocks-questions-act-4-md",
  "24-blocks-character-24-blocks-character-guide-md",
  "24-blocks-character-24-blocks-dialectical-triad-md",
  "24-blocks-character-24-blocks-heart-of-conflict-md",
  "24-blocks-character-24-blocks-inner-journey-4-acts-md",
  "24-blocks-character-24-blocks-inner-journey-md",
];

const ALLOWED_DISPOSITIONS = new Set([
  "INTEGRATED_HERE",
  "INTEGRATED_ELSEWHERE",
  "ALREADY_COVERED",
  "HISTORICAL_REFERENCE_ONLY",
  "REJECTED_OUTDATED",
]);

test("#2076 audits exactly the 27 attached source records in its four topic groups", async () => {
  const [manifest, ledger, ...documents] = await Promise.all([
    json("learn/enrichment/integrated-source-manifest.json"),
    json("docs/learn/source-drain-2076.json"),
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
  assert.equal(attachedSourceIds.length, 27);
  assert.equal(new Set(attachedSourceIds).size, 27);
  assert.deepEqual(sorted(attachedSourceIds), sorted(EXPECTED_SOURCE_IDS));
  assert.deepEqual(sorted(manifest.integratedSourceIds), sorted(EXPECTED_SOURCE_IDS));
  assert.deepEqual(sorted(ledger.sources.map((source) => source.sourceId)), sorted(EXPECTED_SOURCE_IDS));
  assert.equal(ledger.attachmentCount, 27);
  assert.equal(ledger.uniqueSourceCount, 27);
});

test("#2076 gives every audited source concept an explicit disposition", async () => {
  const ledger = await json("docs/learn/source-drain-2076.json");

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
  assert.ok(handoffs.some((destination) => destination.includes("#2077")), "Expected explicit handoffs to source-drain issue #2077");
  assert.ok(handoffs.some((destination) => destination.includes("#2078")), "Expected explicit handoffs to source-drain issue #2078");
});

test("audited source records stay in curriculum data but no longer render as a second lesson block", async () => {
  const [renderer, manifest] = await Promise.all([
    read("modules/learn/ui/curriculum-material.tsx"),
    json("learn/enrichment/integrated-source-manifest.json"),
  ]);

  assert.equal(manifest.presentationLessonCount, 96);
  assert.equal(manifest.sourceRecordCount, 95);
  assert.match(renderer, /integrated-source-manifest\.json/);
  assert.match(renderer, /INTEGRATED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(renderer, /return null/);
  assert.match(renderer, /INTEGRATED_SOURCE_IDS\.has\(target\.sourceId\)/);

  const catalog = await read("adapters/curriculum/current-catalog-integrated.ts");
  assert.match(catalog, /standalonePlotPickleCurriculum\.length !== 96/);
  assert.match(catalog, /standaloneSourceIds\.length !== 95/);
});

test("known repository scaffolding is classified rather than promoted into learner teaching", async () => {
  const ledger = await json("docs/learn/source-drain-2076.json");
  const byId = new Map(ledger.sources.map((source) => [source.sourceId, source]));

  for (const sourceId of ["24-blocks-general-readme-md", "24-blocks-essentials-readme-md", "24-blocks-character-readme-md"]) {
    const source = byId.get(sourceId);
    assert.ok(source, `Missing ${sourceId}`);
    assert.ok(
      source.decisions.some((decision) => decision.disposition === "HISTORICAL_REFERENCE_ONLY"),
      `${sourceId} must classify repository navigation as historical-only`,
    );
  }

  assert.ok(
    byId.get("24-blocks-essentials-essential-aspects-2-md").decisions.some((decision) => decision.disposition === "REJECTED_OUTDATED"),
    "Essential Aspects 2 must retain its outdated-claim correction boundary",
  );
});
