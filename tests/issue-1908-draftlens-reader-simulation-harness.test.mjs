import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ts from "typescript";

const root = new URL("..", import.meta.url);
const sourceFile = (path) => readFile(new URL(path, root), "utf8");

async function harnessModule() {
  const [typescript, structureTypescript] = await Promise.all([
    sourceFile("core/project/reader-simulation-harness.ts"),
    sourceFile("core/project/story-structure-v2.ts"),
  ]);
  let compiled = ts.transpileModule(typescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const structureCompiled = ts.transpileModule(structureTypescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const structureUrl = `data:text/javascript;base64,${Buffer.from(structureCompiled).toString("base64")}`;
  compiled = compiled.replace(/from\s+["']\.\/story-structure-v2["']/u, `from "${structureUrl}"`);
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function runtime(overrides = {}) {
  return {
    aiAssisted: true,
    requestedProvider: "openai",
    requestedModel: "gpt-test",
    provider: "openai",
    model: "gpt-test",
    runtime: "test-runtime",
    ...overrides,
  };
}

function sourceSnapshot(fingerprint = "sha256:source-a") {
  return {
    projectId: "project-1908",
    sourceDraftFingerprint: fingerprint,
    blocks: Array.from({ length: 24 }, (_, index) => {
      const ordinal = index + 1;
      return {
        blockId: `block-${String(ordinal).padStart(2, "0")}`,
        blockOrdinal: ordinal,
        mapping: "scenes-passages",
        segments: [{
          id: `segment-${String(ordinal).padStart(2, "0")}-01`,
          text: `BLOCK_${ordinal}_TEXT`,
          pageRange: { start: index * 5 + 1, end: index * 5 + 5 },
        }],
      };
    }),
  };
}

function makeRun(harness, fingerprint = "sha256:source-a", overrides = {}) {
  return harness.createReaderSimulationRun({
    runId: overrides.runId ?? "run-1908-a",
    projectId: "project-1908",
    readerProfile: overrides.readerProfile ?? harness.DEFAULT_READER_PROFILES[1],
    sourceDraftFingerprint: fingerprint,
    runtime: overrides.runtime ?? runtime(),
    createdAt: "2026-09-11T20:00:00.000Z",
    skimEnabled: overrides.skimEnabled ?? false,
    mode: overrides.mode ?? "full",
    priorRunId: overrides.priorRunId ?? null,
  });
}

function blockInput(blockOrdinal, decision = "continue", overrides = {}) {
  return {
    emotionalResponse: `response block ${blockOrdinal}`,
    expectationIn: `expectation in ${blockOrdinal}`,
    expectationOut: `expectation out ${blockOrdinal}`,
    openQuestion: `question ${blockOrdinal}`,
    confusion: { kind: "none", note: "" },
    strongestMoment: { segmentId: `segment-${String(blockOrdinal).padStart(2, "0")}-01`, note: `moment ${blockOrdinal}` },
    characterPull: "protagonist",
    momentum: "holding",
    memorableDetail: `detail ${blockOrdinal}`,
    readingDecision: decision,
    ...(decision === "quit" ? { quitReason: `quit at block ${blockOrdinal}` } : {}),
    ...overrides,
  };
}

function finishOneBlock(harness, run, source, blockOrdinal, decision = "continue", overrides = {}) {
  const step = harness.releaseNextReaderSegment(run, source, `2026-09-11T20:${String(blockOrdinal).padStart(2, "0")}:01.000Z`);
  assert.equal(step.kind, "segment");
  run = harness.recordReaderSegmentObservation(step.run, source, {
    attention: overrides.attention ?? 1,
    immediateResponse: `reaction block ${blockOrdinal}`,
    memoryUpdate: `memory block ${blockOrdinal}`,
  }, `2026-09-11T20:${String(blockOrdinal).padStart(2, "0")}:02.000Z`);
  return harness.recordReaderBlockEvidence(run, source, blockInput(blockOrdinal, decision, overrides.blockEvidence), `2026-09-11T20:${String(blockOrdinal).padStart(2, "0")}:03.000Z`);
}

test("#1908 upgrades the existing Fresh Reader under DraftLens without registering a duplicate reader agent", async () => {
  const [rawConfig, procedure] = await Promise.all([
    sourceFile("config/resident-writer-specialists.json"),
    sourceFile(".agents/skills/writer-in-residence/references/specialists/reader-review.md"),
  ]);
  const config = JSON.parse(rawConfig);
  const readers = config.specialists.filter((item) => item.id === "reader-review");

  assert.equal(readers.length, 1);
  assert.equal(readers[0].displayName, "Fresh Reader Specialist");
  assert.match(readers[0].purpose, /DraftLens's Reader Simulation Harness/u);
  assert.equal(config.specialists.some((item) => ["first-reader", "beta-reader"].includes(item.id)), false);
  assert.match(procedure, /Reader Simulation Harness/u);
  assert.match(procedure, /DraftLens owns and orchestrates the harness/u);
  assert.match(procedure, /No-lookahead is a mechanism boundary/u);
  assert.match(procedure, /24 Story Blocks/u);
  assert.match(procedure, /does not grade the writer/u);
  assert.match(procedure, /PPF canon without explicit writer action/u);
});

test("#1908 binds reader review to canonical Story Blocks and keeps PlotPickle Score V1 isolated", async () => {
  const [harness, score] = await Promise.all([
    sourceFile("core/project/reader-simulation-harness.ts"),
    sourceFile("core/project/plotpickle-score.ts"),
  ]);

  assert.match(harness, /import \{ STORY_BLOCK_COUNT \} from "\.\/story-structure-v2"/u);
  assert.match(harness, /READER_SIMULATION_BLOCK_COUNT = STORY_BLOCK_COUNT/u);
  assert.match(harness, /READER_SIMULATION_OWNER = "draftlens"/u);
  assert.match(harness, /READER_SIMULATION_AUTHORITY = "advisory-review-evidence"/u);
  assert.doesNotMatch(harness, /calculatePlotPickleScore|plotpickle-score/u);
  assert.doesNotMatch(score, /reader-simulation|ReaderBlockEvidence|ReaderSimulationRun/u);
});

test("#1908 keeps the developer brief and convergence contract machine-checkable", async () => {
  const [brief, rawConvergence, workflow] = await Promise.all([
    sourceFile("docs/developer-briefs/1908-draftlens-reader-simulation-harness.md"),
    sourceFile("config/development-convergence/1908.json"),
    sourceFile(".github/workflows/pr-gate.yml"),
  ]);
  const convergence = JSON.parse(rawConvergence);

  assert.match(brief, /Fresh Reader Specialist -> Reader Simulation Harness -> owned\/orchestrated by DraftLens/u);
  assert.match(brief, /The Block is the durable evaluation\/persistence address/u);
  assert.match(brief, /No-lookahead must be enforced by mechanism, not prompt wording/u);
  assert.equal(convergence.issue, 1908);
  assert.equal(convergence.brief, "docs/developer-briefs/1908-draftlens-reader-simulation-harness.md");
  assert.ok(convergence.acceptance.length >= 6);
  assert.match(workflow, /Validate DraftLens Reader Simulation Harness/u);
});

test("#1908 no-lookahead feed exposes only the current segment and refuses N+1 until reaction and Block evidence", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot();
  let run = makeRun(harness);
  run = harness.beginReaderSimulation(run, source, "2026-09-11T20:00:01.000Z");
  const step = harness.releaseNextReaderSegment(run, source, "2026-09-11T20:00:02.000Z");

  assert.equal(step.kind, "segment");
  assert.equal(step.payload.blockId, "block-01");
  assert.equal(step.payload.segment.text, "BLOCK_1_TEXT");
  assert.doesNotMatch(JSON.stringify(step.payload), /BLOCK_2_TEXT/u);
  assert.throws(
    () => harness.releaseNextReaderSegment(step.run, source, "2026-09-11T20:00:03.000Z"),
    /READER_PENDING_EXPOSURE_MUST_BE_REACTED_TO/u,
  );

  run = harness.recordReaderSegmentObservation(step.run, source, {
    attention: 1,
    immediateResponse: "leaning in",
    memoryUpdate: "opening image",
  }, "2026-09-11T20:00:04.000Z");
  assert.throws(
    () => harness.releaseNextReaderSegment(run, source, "2026-09-11T20:00:05.000Z"),
    /READER_BLOCK_EVIDENCE_REQUIRED_BEFORE_ADVANCE/u,
  );
});

test("#1908 a reader who quits in Block 06 never receives Block 07 or later screenplay text", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot();
  let run = harness.beginReaderSimulation(makeRun(harness), source, "2026-09-11T20:00:01.000Z");

  for (let ordinal = 1; ordinal <= 6; ordinal += 1) {
    run = finishOneBlock(harness, run, source, ordinal, ordinal === 6 ? "quit" : "continue");
  }

  assert.equal(run.state, "quit");
  assert.equal(run.blockEvidence.at(-1).blockOrdinal, 6);
  assert.equal(run.blockEvidence.at(-1).quit.reason, "quit at block 6");
  assert.equal(run.segmentObservations.some((item) => item.blockOrdinal >= 7), false);
  assert.throws(
    () => harness.releaseNextReaderSegment(run, source, "2026-09-11T21:00:00.000Z"),
    /READER_FEED_REQUIRES_READING_STATE/u,
  );
});

test("#1908 recall receives accumulated reader state and transcript, never original screenplay text", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot();
  let run = harness.beginReaderSimulation(makeRun(harness), source, "2026-09-11T20:00:01.000Z");
  run = finishOneBlock(harness, run, source, 1, "quit");
  run = harness.beginReaderRecall(run, "2026-09-11T21:00:00.000Z");
  const recallInput = harness.buildReaderRecallInput(run);
  const serialized = JSON.stringify(recallInput);

  assert.deepEqual(recallInput.readerMemory, ["memory block 1"]);
  assert.equal(recallInput.blockEvidence.length, 1);
  assert.equal(recallInput.segmentTranscript.length, 1);
  assert.doesNotMatch(serialized, /BLOCK_1_TEXT|BLOCK_2_TEXT/u);
  assert.equal("source" in recallInput, false);
});

test("#1908 hidden future planning, outcome and DraftLens metadata cannot leak into an earlier reader payload", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot();
  source.blocks[1].pickleTurn = "FUTURE_PICKLE_SECRET";
  source.blocks[1].ending = "FUTURE_ENDING_SECRET";
  source.blocks[1].characterOutcome = "FUTURE_CHARACTER_SECRET";
  source.blocks[1].draftLensDiagnosis = "FUTURE_DIAGNOSIS_SECRET";
  const run = harness.beginReaderSimulation(makeRun(harness), source, "2026-09-11T20:00:01.000Z");
  const step = harness.releaseNextReaderSegment(run, source, "2026-09-11T20:00:02.000Z");
  const payload = JSON.stringify(step.payload);

  for (const secret of ["FUTURE_PICKLE_SECRET", "FUTURE_ENDING_SECRET", "FUTURE_CHARACTER_SECRET", "FUTURE_DIAGNOSIS_SECRET"]) {
    assert.doesNotMatch(payload, new RegExp(secret, "u"));
  }
});

test("#1908 empty or unmapped Blocks stay truthful instead of borrowing future material", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot();
  source.blocks[0] = { blockId: "block-01", blockOrdinal: 1, mapping: "unmapped", segments: [] };
  let run = harness.beginReaderSimulation(makeRun(harness), source, "2026-09-11T20:00:01.000Z");
  const step = harness.releaseNextReaderSegment(run, source, "2026-09-11T20:00:02.000Z");

  assert.equal(step.kind, "unmapped-block");
  run = harness.recordReaderBlockEvidence(step.run, source, blockInput(1, "continue", {
    strongestMoment: { segmentId: null, note: "No screenplay material was mapped to this Block." },
  }), "2026-09-11T20:00:03.000Z");
  assert.equal(run.blockEvidence[0].sourceEvidence.mapping, "unmapped");
  assert.deepEqual(run.blockEvidence[0].sourceEvidence.segmentIds, []);
  assert.equal(run.cursor.blockOrdinal, 2);
});

test("#1908 provider failure cannot silently switch a reader to a different provider or model", async () => {
  const harness = await harnessModule();
  assert.throws(
    () => makeRun(harness, "sha256:source-a", {
      runtime: runtime({ provider: "ollama", model: "local-model" }),
    }),
    /READER_PROVIDER_FALLBACK_FORBIDDEN/u,
  );
});

test("#1908 revision comparison retains stable Block identity while detecting changed draft, quit, attention and confusion evidence", async () => {
  const harness = await harnessModule();
  const firstSource = sourceSnapshot("sha256:first-draft");
  let first = harness.beginReaderSimulation(makeRun(harness, "sha256:first-draft", { runId: "run-first" }), firstSource, "2026-09-11T20:00:01.000Z");
  first = finishOneBlock(harness, first, firstSource, 1, "quit", { attention: -2 });

  const secondSource = sourceSnapshot("sha256:second-draft");
  let second = harness.beginReaderSimulation(makeRun(harness, "sha256:second-draft", { runId: "run-second", priorRunId: "run-first" }), secondSource, "2026-09-11T20:10:01.000Z");
  second = finishOneBlock(harness, second, secondSource, 1, "continue", {
    attention: 2,
    blockEvidence: { confusion: { kind: "productive-mystery", note: "I want the answer." } },
  });
  second = finishOneBlock(harness, second, secondSource, 2, "quit", { attention: 0 });

  const comparison = harness.compareReaderSimulationRuns(first, second);
  assert.equal(comparison.sourceChanged, true);
  assert.equal(comparison.blocks[0].blockId, "block-01");
  assert.equal(comparison.blocks[0].attentionDelta, 4);
  assert.equal(comparison.blocks[0].previousConfusion, "none");
  assert.equal(comparison.blocks[0].nextConfusion, "productive-mystery");
  assert.equal(comparison.quitPoint.previous.blockOrdinal, 1);
  assert.equal(comparison.quitPoint.next.blockOrdinal, 2);
  assert.equal(comparison.quitPoint.movedLaterOrDisappeared, true);
});

test("#1908 an unchanged source preserves coordinates and comparable evidence metadata", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot("sha256:unchanged");
  let before = harness.beginReaderSimulation(makeRun(harness, "sha256:unchanged", { runId: "run-before" }), source, "2026-09-11T20:00:01.000Z");
  before = finishOneBlock(harness, before, source, 1, "quit", { attention: 0 });
  let after = harness.beginReaderSimulation(makeRun(harness, "sha256:unchanged", { runId: "run-after", priorRunId: "run-before" }), source, "2026-09-11T20:10:01.000Z");
  after = finishOneBlock(harness, after, source, 1, "quit", { attention: 1 });

  const comparison = harness.compareReaderSimulationRuns(before, after);
  assert.equal(comparison.sourceChanged, false);
  assert.equal(comparison.readerProfileId, "skeptical-reader");
  assert.equal(comparison.blocks[0].blockId, "block-01");
  assert.equal(before.blockEvidence[0].sourceDraftFingerprint, "sha256:unchanged");
  assert.equal(after.blockEvidence[0].sourceDraftFingerprint, "sha256:unchanged");
});

test("#1908 source fingerprint changes when revised screenplay evidence changes", async () => {
  const harness = await harnessModule();
  const before = await harness.fingerprintReaderSource("Block 01 original screenplay text");
  const after = await harness.fingerprintReaderSource("Block 01 revised screenplay text");

  assert.match(before, /^sha256:[a-f0-9]{64}$/u);
  assert.match(after, /^sha256:[a-f0-9]{64}$/u);
  assert.notEqual(before, after);
});

test("#1908 raw reader observation stays separate from DraftLens diagnosis and never mutates source canon", async () => {
  const harness = await harnessModule();
  const source = sourceSnapshot();
  const sourceBefore = JSON.stringify(source);
  let run = harness.beginReaderSimulation(makeRun(harness), source, "2026-09-11T20:00:01.000Z");
  run = finishOneBlock(harness, run, source, 1, "quit");
  const rawEvidenceBeforeDiagnosis = JSON.stringify(run.blockEvidence);
  run = harness.beginReaderRecall(run, "2026-09-11T21:00:00.000Z");
  run = harness.completeReaderRecall(run, {
    storyAbout: "A protagonist under pressure.",
    whoAbout: "The protagonist.",
    protagonistWant: "To solve the immediate problem.",
    mostMemorableMoment: "The opening.",
    strongestUnresolvedQuestion: "What happens next?",
    believedChange: "The pressure increased.",
    laterRetelling: "A tense opening with an unresolved problem.",
  }, "2026-09-11T21:01:00.000Z");
  run = harness.attachDraftLensDiagnosis(run, {
    summary: "Reader attention dropped before the central objective became clear.",
    revisionQuestions: ["Can the objective become legible sooner without explaining it?"],
  }, "2026-09-11T21:02:00.000Z");

  assert.equal(run.owner, "draftlens");
  assert.equal(run.state, "diagnosed");
  assert.equal(JSON.stringify(run.blockEvidence), rawEvidenceBeforeDiagnosis);
  assert.equal(JSON.stringify(source), sourceBefore);
  assert.equal(run.draftLensDiagnosis.summary.includes("attention dropped"), true);
});

test("#1908 reader-run serialization preserves auditable run, provider and source metadata", async () => {
  const harness = await harnessModule();
  const run = makeRun(harness);
  const serialized = harness.serializeReaderSimulationRun(run);
  const restored = harness.parseReaderSimulationRun(serialized);

  assert.equal(restored.runId, "run-1908-a");
  assert.equal(restored.readerProfile.id, "skeptical-reader");
  assert.equal(restored.sourceDraftFingerprint, "sha256:source-a");
  assert.equal(restored.runtime.provider, "openai");
  assert.equal(restored.runtime.model, "gpt-test");
  assert.equal(restored.authority, "advisory-review-evidence");
});
