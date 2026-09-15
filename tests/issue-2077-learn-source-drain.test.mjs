import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const sorted = (values) => [...values].sort();

const EXPECTED_TOPIC_COUNTS = {
  structure: 11,
  dialogue: 13,
  "visual-storytelling": 3,
};

const EXPECTED_SOURCE_IDS = [
  "24-blocks-24-blocks-readme-md",
  "24-blocks-general-general-screenplays-to-improv-md",
  "24-blocks-24-blocks-24-blocks-a-new-spin-md",
  "24-blocks-24-blocks-24-blocks-structure-guide-md",
  "24-blocks-24-blocks-24-blocks-reflection-md",
  "24-blocks-24-blocks-24-blocks-structures-role-md",
  "24-blocks-24-blocks-24-blocks-story-beats-md",
  "24-blocks-24-blocks-24-blocks-principle-of-three-md",
  "24-blocks-24-blocks-24-blocks-dramatic-question-md",
  "24-blocks-24-blocks-24-blocks-structure-diversity-md",
  "24-blocks-24-blocks-24-blocks-dynamic-scenes-md",
  "24-blocks-ai-prompts-24-blocks-dialogue-md",
  "24-blocks-dialogue-readme-md",
  "24-blocks-dialogue-24-blocks-realistic-dialogue-md",
  "24-blocks-dialogue-24-blocks-distinctive-voices-md",
  "24-blocks-dialogue-24-blocks-reveal-character-md",
  "24-blocks-dialogue-24-blocks-subtext-md",
  "24-blocks-dialogue-24-blocks-conflict-md",
  "24-blocks-dialogue-24-blocks-art-of-silence-md",
  "24-blocks-dialogue-24-blocks-balancing-action-md",
  "24-blocks-dialogue-24-blocks-tags-and-beats-md",
  "24-blocks-dialogue-24-blocks-dialogue-pitfalls-md",
  "24-blocks-dialogue-24-blocks-different-genres-md",
  "24-blocks-dialogue-24-blocks-refining-dialogue-md",
  "24-blocks-moodboard-readme-md",
  "bryanharrisscripts-github-io-video-retalking-md",
  "bryanharrisscripts-github-io-lost-and-found-md",
];

const ALLOWED_DISPOSITIONS = new Set([
  "INTEGRATED_HERE",
  "INTEGRATED_ELSEWHERE",
  "ALREADY_COVERED",
  "HISTORICAL_REFERENCE_ONLY",
  "REJECTED_OUTDATED",
]);

test("#2077 audits exactly the 27 attached Structure, Dialogue and Visual Storytelling sources", async () => {
  const [manifest, ledger, ...documents] = await Promise.all([
    json("learn/enrichment/integrated-source-manifest.json"),
    json("docs/learn/source-drain-2077.json"),
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
  assert.deepEqual(sorted(ledger.sources.map((source) => source.sourceId)), sorted(EXPECTED_SOURCE_IDS));
  assert.equal(ledger.attachmentCount, 27);
  assert.equal(ledger.uniqueSourceCount, 27);

  for (const sourceId of EXPECTED_SOURCE_IDS) {
    assert.ok(manifest.integratedSourceIds.includes(sourceId), `#2077 source ${sourceId} must be marked integrated after audit`);
  }
  assert.ok(manifest.auditedIssues.includes(2076), "The #2076 audit marker must remain cumulative");
  assert.ok(manifest.auditedIssues.includes(2077), "The #2077 audit marker must be present");
  assert.equal(new Set(manifest.integratedSourceIds).size, manifest.integratedSourceIds.length, "Integrated source IDs must stay unique");
});

test("#2077 assigns every meaningful source concept one explicit disposition and preserves handoffs", async () => {
  const ledger = await json("docs/learn/source-drain-2077.json");

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
  assert.ok(handoffs.some((destination) => destination.includes("dialogue:")), "Expected Structure-to-Dialogue handoff inside #2077");
  assert.ok(handoffs.some((destination) => destination.includes("visual-storytelling:")), "Expected Dialogue-to-Visual Storytelling handoff inside #2077");
  assert.ok(handoffs.some((destination) => destination.includes("#2078")), "Expected process/revision handoff to #2078");
});

test("current lessons own the audited teaching instead of raw source documents", async () => {
  const [structure, dialogue, visual, renderer] = await Promise.all([
    json("learn/structure.json"),
    json("learn/dialogue.json"),
    json("learn/visual-storytelling.json"),
    read("modules/learn/ui/curriculum-material.tsx"),
  ]);

  const structureIds = new Set(structure.lessons.map((lesson) => lesson.id));
  for (const lessonId of [
    "structures",
    "24b-new-spin",
    "24b-structure-guide",
    "24b-structures-role",
    "24b-story-beats",
    "24b-principle-three",
    "24b-dramatic-question",
    "24b-structure-diversity",
    "24b-reflection",
    "24b-dynamic-scenes",
  ]) assert.ok(structureIds.has(lessonId), `Missing current Structure teaching home ${lessonId}`);

  const dialogueIds = new Set(dialogue.lessons.map((lesson) => lesson.id));
  for (const lessonId of [
    "dialogue-action",
    "dialogue-voiceprint",
    "dialogue-subtext",
    "dialogue-conflict",
    "dialogue-speech-silence-action",
    "dialogue-exposition-genre",
    "dialogue-exchange-turn",
    "dialogue-revision",
  ]) assert.ok(dialogueIds.has(lessonId), `Missing current Dialogue teaching home ${lessonId}`);

  const visualIds = new Set(visual.lessons.map((lesson) => lesson.id));
  assert.ok(visualIds.has("early-visual-development"));
  assert.ok(visualIds.has("essentials-screen-evidence"));

  assert.match(renderer, /INTEGRATED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(renderer, /return null/);
});

test("#2077 keeps legacy scaffolding and obsolete prescriptions out of current learner authority", async () => {
  const ledger = await json("docs/learn/source-drain-2077.json");
  const byId = new Map(ledger.sources.map((source) => [source.sourceId, source]));

  for (const sourceId of ["24-blocks-24-blocks-readme-md", "24-blocks-dialogue-readme-md", "24-blocks-moodboard-readme-md"]) {
    assert.ok(
      byId.get(sourceId)?.decisions.some((decision) => decision.disposition === "HISTORICAL_REFERENCE_ONLY"),
      `${sourceId} must classify repository/gallery scaffolding as historical-only`,
    );
  }

  for (const sourceId of [
    "24-blocks-24-blocks-readme-md",
    "24-blocks-24-blocks-24-blocks-structure-guide-md",
    "24-blocks-24-blocks-24-blocks-story-beats-md",
    "bryanharrisscripts-github-io-video-retalking-md",
  ]) {
    assert.ok(
      byId.get(sourceId)?.decisions.some((decision) => decision.disposition === "REJECTED_OUTDATED"),
      `${sourceId} must retain an explicit outdated/prescriptive correction boundary`,
    );
  }
});
