import { STORY_BLOCK_COUNT } from "./story-structure-v2";

export const READER_SIMULATION_SCHEMA_VERSION = 1 as const;
export const READER_SIMULATION_OWNER = "draftlens" as const;
export const READER_SIMULATION_AUTHORITY = "advisory-review-evidence" as const;
export const READER_SIMULATION_BLOCK_COUNT = STORY_BLOCK_COUNT;

export const READER_RUN_STATES = [
  "created",
  "skimmed",
  "reading",
  "quit",
  "completed",
  "recall",
  "ready_for_diagnosis",
  "diagnosed",
  "superseded",
] as const;

export const READER_CONFUSION_KINDS = [
  "none",
  "productive-mystery",
  "missing-or-unclear-information",
] as const;

export const READER_MOMENTUM_STATES = ["rising", "holding", "falling", "mixed"] as const;
export const READER_DECISIONS = ["continue", "skim", "quit"] as const;
export const READER_SOURCE_MAPPINGS = ["rendered-pages", "scenes-passages", "mini-block-fallback", "unmapped"] as const;

export type ReaderRunState = (typeof READER_RUN_STATES)[number];
export type ReaderConfusionKind = (typeof READER_CONFUSION_KINDS)[number];
export type ReaderMomentumState = (typeof READER_MOMENTUM_STATES)[number];
export type ReaderDecision = (typeof READER_DECISIONS)[number];
export type ReaderSourceMapping = (typeof READER_SOURCE_MAPPINGS)[number];
export type ReaderAttentionValue = -2 | -1 | 0 | 1 | 2;

export type ReaderProfile = {
  readonly id: string;
  readonly label: string;
  readonly stance: string;
};

export const DEFAULT_READER_PROFILES: readonly ReaderProfile[] = [
  {
    id: "target-reader",
    label: "Target Reader",
    stance: "A sympathetic member of the intended audience who wants the story to work while reporting genuine attention loss or confusion.",
  },
  {
    id: "skeptical-reader",
    label: "Skeptical Reader",
    stance: "An interested but impatient reader who may skim or quit when the screenplay stops earning attention.",
  },
  {
    id: "industry-reader",
    label: "Industry Reader",
    stance: "A fast reader focused on clarity, momentum, visible and playable writing, character objective and practical screenplay readability.",
  },
] as const;

export type ReaderRuntimeMetadata = {
  readonly aiAssisted: boolean;
  readonly requestedProvider: string | null;
  readonly requestedModel: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly runtime: string;
};

export type ReaderSourceSegment = {
  readonly id: string;
  readonly text: string;
  readonly pageRange?: Readonly<{ start: number; end: number }>;
};

export type ReaderSourceBlock = {
  readonly blockId: string;
  readonly blockOrdinal: number;
  readonly mapping: ReaderSourceMapping;
  readonly segments: readonly ReaderSourceSegment[];
};

export type ReaderSourceSnapshot = {
  readonly projectId: string;
  readonly sourceDraftFingerprint: string;
  readonly blocks: readonly ReaderSourceBlock[];
};

export type ReaderSkimEvidence = {
  readonly decision: "continue" | "quit";
  readonly storyGuess: string;
  readonly visibleReason: string;
  readonly toneGenreExpectation: string;
  readonly createdAt: string;
};

export type ReaderSegmentObservation = {
  readonly blockId: string;
  readonly blockOrdinal: number;
  readonly segmentId: string;
  readonly attention: ReaderAttentionValue;
  readonly immediateResponse: string;
  readonly memoryUpdate: string;
  readonly createdAt: string;
};

export type ReaderBlockEvidence = {
  readonly runId: string;
  readonly readerProfileId: string;
  readonly blockId: string;
  readonly blockOrdinal: number;
  readonly sourceDraftFingerprint: string;
  readonly sourceEvidence: {
    readonly mapping: ReaderSourceMapping;
    readonly pageRange: Readonly<{ start: number; end: number }> | null;
    readonly segmentIds: readonly string[];
  };
  readonly attentionTrace: readonly Readonly<{
    segmentId: string;
    value: ReaderAttentionValue;
    note: string;
  }>[];
  readonly emotionalResponse: string;
  readonly expectationIn: string;
  readonly expectationOut: string;
  readonly openQuestion: string;
  readonly confusion: Readonly<{ kind: ReaderConfusionKind; note: string }>;
  readonly strongestMoment: Readonly<{ segmentId: string | null; note: string }>;
  readonly characterPull: string;
  readonly momentum: ReaderMomentumState;
  readonly memorableDetail: string;
  readonly readingDecision: ReaderDecision;
  readonly quit: Readonly<{ segmentId: string | null; reason: string }> | null;
  readonly runtime: ReaderRuntimeMetadata;
  readonly createdAt: string;
};

export type ReaderRecallEvidence = {
  readonly storyAbout: string;
  readonly whoAbout: string;
  readonly protagonistWant: string;
  readonly mostMemorableMoment: string;
  readonly strongestUnresolvedQuestion: string;
  readonly believedChange: string;
  readonly laterRetelling: string;
  readonly createdAt: string;
};

export type DraftLensReaderDiagnosis = {
  readonly summary: string;
  readonly revisionQuestions: readonly string[];
  readonly createdAt: string;
};

export type ReaderSimulationRun = {
  readonly schemaVersion: typeof READER_SIMULATION_SCHEMA_VERSION;
  readonly owner: typeof READER_SIMULATION_OWNER;
  readonly authority: typeof READER_SIMULATION_AUTHORITY;
  readonly runId: string;
  readonly projectId: string;
  readonly readerProfile: ReaderProfile;
  readonly sourceDraftFingerprint: string;
  readonly priorRunId: string | null;
  readonly mode: "quick" | "full";
  readonly skimEnabled: boolean;
  readonly runtime: ReaderRuntimeMetadata;
  readonly state: ReaderRunState;
  readonly cursor: Readonly<{ blockOrdinal: number; segmentIndex: number }>;
  readonly pendingExposure: Readonly<{ blockId: string; blockOrdinal: number; segmentId: string }> | null;
  readonly awaitingBlockEvidence: boolean;
  readonly skim: ReaderSkimEvidence | null;
  readonly segmentObservations: readonly ReaderSegmentObservation[];
  readonly blockEvidence: readonly ReaderBlockEvidence[];
  readonly readerMemory: readonly string[];
  readonly recall: ReaderRecallEvidence | null;
  readonly draftLensDiagnosis: DraftLensReaderDiagnosis | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ReaderExposurePayload = {
  readonly runId: string;
  readonly readerProfile: ReaderProfile;
  readonly blockId: string;
  readonly blockOrdinal: number;
  readonly segment: ReaderSourceSegment;
  readonly priorReaderMemory: readonly string[];
  readonly responseContract: readonly [
    "attention",
    "immediateResponse",
    "memoryUpdate",
  ];
};

export type ReaderFeedStep =
  | Readonly<{ kind: "segment"; run: ReaderSimulationRun; payload: ReaderExposurePayload }>
  | Readonly<{ kind: "unmapped-block"; run: ReaderSimulationRun; blockId: string; blockOrdinal: number }>;

export type ReaderBlockEvidenceInput = {
  readonly emotionalResponse: string;
  readonly expectationIn: string;
  readonly expectationOut: string;
  readonly openQuestion: string;
  readonly confusion: Readonly<{ kind: ReaderConfusionKind; note?: string }>;
  readonly strongestMoment: Readonly<{ segmentId?: string | null; note: string }>;
  readonly characterPull: string;
  readonly momentum: ReaderMomentumState;
  readonly memorableDetail: string;
  readonly readingDecision: ReaderDecision;
  readonly quitReason?: string;
};

export type ReaderRunComparison = {
  readonly projectId: string;
  readonly readerProfileId: string;
  readonly previousRunId: string;
  readonly nextRunId: string;
  readonly sourceChanged: boolean;
  readonly quitPoint: Readonly<{
    previous: Readonly<{ blockOrdinal: number; segmentId: string | null }> | null;
    next: Readonly<{ blockOrdinal: number; segmentId: string | null }> | null;
    movedLaterOrDisappeared: boolean;
  }>;
  readonly blocks: readonly Readonly<{
    blockId: string;
    blockOrdinal: number;
    previousAttention: number | null;
    nextAttention: number | null;
    attentionDelta: number | null;
    previousConfusion: ReaderConfusionKind | null;
    nextConfusion: ReaderConfusionKind | null;
    previousExpectationOut: string | null;
    nextExpectationOut: string | null;
    previousDecision: ReaderDecision | null;
    nextDecision: ReaderDecision | null;
  }>[];
  readonly recallChanged: boolean;
};

function fail(code: string): never {
  throw new Error(code);
}

function text(value: unknown, maximum = 20_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function requireText(value: unknown, code: string, maximum = 20_000) {
  const resolved = text(value, maximum);
  if (!resolved) fail(code);
  return resolved;
}

function timestamp(value: unknown, code: string) {
  const resolved = requireText(value, code, 120);
  if (Number.isNaN(Date.parse(resolved))) fail(code);
  return resolved;
}

function canonicalBlockId(ordinal: number) {
  return `block-${String(ordinal).padStart(2, "0")}`;
}

function validateAttention(value: number): asserts value is ReaderAttentionValue {
  if (![-2, -1, 0, 1, 2].includes(value)) fail("READER_ATTENTION_OUT_OF_RANGE");
}

function assertRuntime(runtime: ReaderRuntimeMetadata) {
  requireText(runtime.runtime, "READER_RUNTIME_REQUIRED", 240);
  if (!runtime.aiAssisted) {
    if (runtime.provider !== null || runtime.model !== null || runtime.requestedProvider !== null || runtime.requestedModel !== null) {
      fail("READER_MANUAL_RUNTIME_CANNOT_DECLARE_PROVIDER");
    }
    return;
  }
  const requestedProvider = requireText(runtime.requestedProvider, "READER_REQUESTED_PROVIDER_REQUIRED", 160);
  const requestedModel = requireText(runtime.requestedModel, "READER_REQUESTED_MODEL_REQUIRED", 200);
  const provider = requireText(runtime.provider, "READER_PROVIDER_REQUIRED", 160);
  const model = requireText(runtime.model, "READER_MODEL_REQUIRED", 200);
  if (provider !== requestedProvider || model !== requestedModel) fail("READER_PROVIDER_FALLBACK_FORBIDDEN");
}

function assertReaderProfile(profile: ReaderProfile) {
  requireText(profile.id, "READER_PROFILE_ID_REQUIRED", 160);
  requireText(profile.label, "READER_PROFILE_LABEL_REQUIRED", 240);
  requireText(profile.stance, "READER_PROFILE_STANCE_REQUIRED", 2_000);
}

function assertSourceBlock(block: ReaderSourceBlock, expectedOrdinal: number) {
  if (block.blockOrdinal !== expectedOrdinal) fail("READER_BLOCK_ORDER_INVALID");
  if (block.blockId !== canonicalBlockId(expectedOrdinal)) fail("READER_BLOCK_ID_INVALID");
  if (!READER_SOURCE_MAPPINGS.includes(block.mapping)) fail("READER_SOURCE_MAPPING_INVALID");
  if (!Array.isArray(block.segments)) fail("READER_SOURCE_SEGMENTS_INVALID");
  if (block.mapping === "unmapped" && block.segments.length > 0) fail("READER_UNMAPPED_BLOCK_HAS_TEXT");
  if (block.mapping !== "unmapped" && block.segments.length === 0) fail("READER_MAPPED_BLOCK_EMPTY");
  const seen = new Set<string>();
  for (const segment of block.segments) {
    const id = requireText(segment.id, "READER_SEGMENT_ID_REQUIRED", 200);
    requireText(segment.text, "READER_SEGMENT_TEXT_REQUIRED", 200_000);
    if (seen.has(id)) fail("READER_SEGMENT_ID_DUPLICATE");
    seen.add(id);
    if (segment.pageRange) {
      if (!Number.isInteger(segment.pageRange.start) || !Number.isInteger(segment.pageRange.end) || segment.pageRange.start < 1 || segment.pageRange.end < segment.pageRange.start) {
        fail("READER_PAGE_RANGE_INVALID");
      }
    }
  }
}

export function validateReaderSourceSnapshot(source: ReaderSourceSnapshot) {
  requireText(source.projectId, "READER_SOURCE_PROJECT_REQUIRED", 240);
  requireText(source.sourceDraftFingerprint, "READER_SOURCE_FINGERPRINT_REQUIRED", 240);
  if (!Array.isArray(source.blocks) || source.blocks.length !== READER_SIMULATION_BLOCK_COUNT) {
    fail("READER_SOURCE_REQUIRES_24_BLOCKS");
  }
  source.blocks.forEach((block, index) => assertSourceBlock(block, index + 1));
  return source;
}

export async function fingerprintReaderSource(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

export function createReaderSimulationRun(input: Readonly<{
  runId: string;
  projectId: string;
  readerProfile: ReaderProfile;
  sourceDraftFingerprint: string;
  runtime: ReaderRuntimeMetadata;
  createdAt: string;
  mode?: "quick" | "full";
  skimEnabled?: boolean;
  priorRunId?: string | null;
}>): ReaderSimulationRun {
  const runId = requireText(input.runId, "READER_RUN_ID_REQUIRED", 200);
  const projectId = requireText(input.projectId, "READER_PROJECT_ID_REQUIRED", 240);
  const sourceDraftFingerprint = requireText(input.sourceDraftFingerprint, "READER_FINGERPRINT_REQUIRED", 240);
  const createdAt = timestamp(input.createdAt, "READER_CREATED_AT_INVALID");
  assertReaderProfile(input.readerProfile);
  assertRuntime(input.runtime);
  const mode = input.mode ?? "full";
  const skimEnabled = mode === "quick" ? true : input.skimEnabled !== false;
  return {
    schemaVersion: READER_SIMULATION_SCHEMA_VERSION,
    owner: READER_SIMULATION_OWNER,
    authority: READER_SIMULATION_AUTHORITY,
    runId,
    projectId,
    readerProfile: { ...input.readerProfile },
    sourceDraftFingerprint,
    priorRunId: input.priorRunId ? requireText(input.priorRunId, "READER_PRIOR_RUN_ID_INVALID", 200) : null,
    mode,
    skimEnabled,
    runtime: { ...input.runtime },
    state: "created",
    cursor: { blockOrdinal: 1, segmentIndex: 0 },
    pendingExposure: null,
    awaitingBlockEvidence: false,
    skim: null,
    segmentObservations: [],
    blockEvidence: [],
    readerMemory: [],
    recall: null,
    draftLensDiagnosis: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function assertSourceMatchesRun(run: ReaderSimulationRun, source: ReaderSourceSnapshot) {
  validateReaderSourceSnapshot(source);
  if (source.projectId !== run.projectId) fail("READER_SOURCE_PROJECT_MISMATCH");
  if (source.sourceDraftFingerprint !== run.sourceDraftFingerprint) fail("READER_SOURCE_FINGERPRINT_MISMATCH");
}

export function recordReaderSkim(run: ReaderSimulationRun, input: Omit<ReaderSkimEvidence, "createdAt">, at: string): ReaderSimulationRun {
  if (run.state !== "created") fail("READER_SKIM_REQUIRES_CREATED_STATE");
  if (!run.skimEnabled) fail("READER_SKIM_DISABLED");
  const createdAt = timestamp(at, "READER_SKIM_TIMESTAMP_INVALID");
  if (input.decision !== "continue" && input.decision !== "quit") fail("READER_SKIM_DECISION_INVALID");
  const skim: ReaderSkimEvidence = {
    decision: input.decision,
    storyGuess: requireText(input.storyGuess, "READER_SKIM_STORY_GUESS_REQUIRED"),
    visibleReason: requireText(input.visibleReason, "READER_SKIM_VISIBLE_REASON_REQUIRED"),
    toneGenreExpectation: text(input.toneGenreExpectation, 4_000),
    createdAt,
  };
  const state: ReaderRunState = input.decision === "quit" ? "quit" : run.mode === "quick" ? "completed" : "skimmed";
  return { ...run, skim, state, updatedAt: createdAt };
}

export function beginReaderSimulation(run: ReaderSimulationRun, source: ReaderSourceSnapshot, at: string): ReaderSimulationRun {
  assertSourceMatchesRun(run, source);
  if (run.mode !== "full") fail("READER_QUICK_MODE_HAS_NO_FULL_READ");
  if (run.skimEnabled && run.state !== "skimmed") fail("READER_FULL_READ_REQUIRES_SKIM");
  if (!run.skimEnabled && run.state !== "created") fail("READER_FULL_READ_REQUIRES_CREATED_STATE");
  return { ...run, state: "reading", updatedAt: timestamp(at, "READER_BEGIN_TIMESTAMP_INVALID") };
}

export function releaseNextReaderSegment(run: ReaderSimulationRun, source: ReaderSourceSnapshot, at: string): ReaderFeedStep {
  assertSourceMatchesRun(run, source);
  if (run.state !== "reading") fail("READER_FEED_REQUIRES_READING_STATE");
  if (run.pendingExposure) fail("READER_PENDING_EXPOSURE_MUST_BE_REACTED_TO");
  if (run.awaitingBlockEvidence) fail("READER_BLOCK_EVIDENCE_REQUIRED_BEFORE_ADVANCE");
  const block = source.blocks[run.cursor.blockOrdinal - 1];
  if (!block) fail("READER_CURSOR_BLOCK_INVALID");
  const updatedAt = timestamp(at, "READER_EXPOSURE_TIMESTAMP_INVALID");
  if (block.segments.length === 0) {
    const nextRun = { ...run, awaitingBlockEvidence: true, updatedAt };
    return { kind: "unmapped-block", run: nextRun, blockId: block.blockId, blockOrdinal: block.blockOrdinal };
  }
  const segment = block.segments[run.cursor.segmentIndex];
  if (!segment) fail("READER_BLOCK_EVIDENCE_REQUIRED_BEFORE_ADVANCE");
  const pendingExposure = { blockId: block.blockId, blockOrdinal: block.blockOrdinal, segmentId: segment.id };
  const nextRun = { ...run, pendingExposure, updatedAt };
  return {
    kind: "segment",
    run: nextRun,
    payload: {
      runId: run.runId,
      readerProfile: { ...run.readerProfile },
      blockId: block.blockId,
      blockOrdinal: block.blockOrdinal,
      segment: {
        id: segment.id,
        text: segment.text,
        ...(segment.pageRange ? { pageRange: { ...segment.pageRange } } : {}),
      },
      priorReaderMemory: [...run.readerMemory],
      responseContract: ["attention", "immediateResponse", "memoryUpdate"],
    },
  };
}

export function recordReaderSegmentObservation(
  run: ReaderSimulationRun,
  source: ReaderSourceSnapshot,
  input: Readonly<{ attention: number; immediateResponse: string; memoryUpdate?: string }>,
  at: string,
): ReaderSimulationRun {
  assertSourceMatchesRun(run, source);
  if (run.state !== "reading" || !run.pendingExposure) fail("READER_SEGMENT_REACTION_REQUIRES_PENDING_EXPOSURE");
  validateAttention(input.attention);
  const createdAt = timestamp(at, "READER_SEGMENT_TIMESTAMP_INVALID");
  const pending = run.pendingExposure;
  if (pending.blockOrdinal !== run.cursor.blockOrdinal) fail("READER_PENDING_EXPOSURE_CURSOR_MISMATCH");
  const block = source.blocks[pending.blockOrdinal - 1];
  const segment = block.segments[run.cursor.segmentIndex];
  if (!segment || segment.id !== pending.segmentId) fail("READER_PENDING_EXPOSURE_SOURCE_MISMATCH");
  const observation: ReaderSegmentObservation = {
    blockId: pending.blockId,
    blockOrdinal: pending.blockOrdinal,
    segmentId: pending.segmentId,
    attention: input.attention,
    immediateResponse: requireText(input.immediateResponse, "READER_IMMEDIATE_RESPONSE_REQUIRED", 8_000),
    memoryUpdate: text(input.memoryUpdate, 8_000),
    createdAt,
  };
  const segmentIndex = run.cursor.segmentIndex + 1;
  const awaitingBlockEvidence = segmentIndex >= block.segments.length;
  const readerMemory = observation.memoryUpdate
    ? [...run.readerMemory, observation.memoryUpdate].slice(-64)
    : [...run.readerMemory];
  return {
    ...run,
    cursor: { blockOrdinal: run.cursor.blockOrdinal, segmentIndex },
    pendingExposure: null,
    awaitingBlockEvidence,
    segmentObservations: [...run.segmentObservations, observation],
    readerMemory,
    updatedAt: createdAt,
  };
}

function sourcePageRange(block: ReaderSourceBlock) {
  const pages = block.segments.flatMap((segment) => segment.pageRange ? [segment.pageRange.start, segment.pageRange.end] : []);
  if (!pages.length) return null;
  return { start: Math.min(...pages), end: Math.max(...pages) };
}

function currentBlockObservations(run: ReaderSimulationRun) {
  return run.segmentObservations.filter((item) => item.blockOrdinal === run.cursor.blockOrdinal);
}

export function recordReaderBlockEvidence(
  run: ReaderSimulationRun,
  source: ReaderSourceSnapshot,
  input: ReaderBlockEvidenceInput,
  at: string,
): ReaderSimulationRun {
  assertSourceMatchesRun(run, source);
  if (run.state !== "reading" || !run.awaitingBlockEvidence || run.pendingExposure) fail("READER_BLOCK_EVIDENCE_NOT_READY");
  if (!READER_CONFUSION_KINDS.includes(input.confusion.kind)) fail("READER_CONFUSION_KIND_INVALID");
  if (!READER_MOMENTUM_STATES.includes(input.momentum)) fail("READER_MOMENTUM_INVALID");
  if (!READER_DECISIONS.includes(input.readingDecision)) fail("READER_DECISION_INVALID");
  const createdAt = timestamp(at, "READER_BLOCK_TIMESTAMP_INVALID");
  const block = source.blocks[run.cursor.blockOrdinal - 1];
  const observations = currentBlockObservations(run);
  const segmentIds = observations.map((item) => item.segmentId);
  if (block.mapping === "unmapped") {
    if (segmentIds.length !== 0) fail("READER_UNMAPPED_BLOCK_OBSERVATION_INVALID");
  } else if (segmentIds.length !== block.segments.length || segmentIds.some((id, index) => id !== block.segments[index].id)) {
    fail("READER_BLOCK_EXPOSURE_INCOMPLETE");
  }
  const strongestSegmentId = input.strongestMoment.segmentId ?? null;
  if (strongestSegmentId && !segmentIds.includes(strongestSegmentId)) fail("READER_STRONGEST_MOMENT_NOT_EXPOSED");
  const quitReason = text(input.quitReason, 8_000);
  if (input.readingDecision === "quit" && !quitReason) fail("READER_QUIT_REASON_REQUIRED");
  const lastSegmentId = segmentIds.at(-1) ?? null;
  const evidence: ReaderBlockEvidence = {
    runId: run.runId,
    readerProfileId: run.readerProfile.id,
    blockId: block.blockId,
    blockOrdinal: block.blockOrdinal,
    sourceDraftFingerprint: run.sourceDraftFingerprint,
    sourceEvidence: {
      mapping: block.mapping,
      pageRange: sourcePageRange(block),
      segmentIds,
    },
    attentionTrace: observations.map((item) => ({
      segmentId: item.segmentId,
      value: item.attention,
      note: item.immediateResponse,
    })),
    emotionalResponse: requireText(input.emotionalResponse, "READER_BLOCK_EMOTIONAL_RESPONSE_REQUIRED", 8_000),
    expectationIn: text(input.expectationIn, 8_000),
    expectationOut: text(input.expectationOut, 8_000),
    openQuestion: text(input.openQuestion, 8_000),
    confusion: { kind: input.confusion.kind, note: text(input.confusion.note, 8_000) },
    strongestMoment: {
      segmentId: strongestSegmentId,
      note: requireText(input.strongestMoment.note, "READER_STRONGEST_MOMENT_NOTE_REQUIRED", 8_000),
    },
    characterPull: text(input.characterPull, 4_000),
    momentum: input.momentum,
    memorableDetail: text(input.memorableDetail, 8_000),
    readingDecision: input.readingDecision,
    quit: input.readingDecision === "quit" ? { segmentId: lastSegmentId, reason: quitReason } : null,
    runtime: { ...run.runtime },
    createdAt,
  };
  if (input.readingDecision === "quit") {
    return {
      ...run,
      state: "quit",
      awaitingBlockEvidence: false,
      blockEvidence: [...run.blockEvidence, evidence],
      updatedAt: createdAt,
    };
  }
  if (block.blockOrdinal === READER_SIMULATION_BLOCK_COUNT) {
    return {
      ...run,
      state: "completed",
      awaitingBlockEvidence: false,
      blockEvidence: [...run.blockEvidence, evidence],
      updatedAt: createdAt,
    };
  }
  return {
    ...run,
    cursor: { blockOrdinal: block.blockOrdinal + 1, segmentIndex: 0 },
    awaitingBlockEvidence: false,
    blockEvidence: [...run.blockEvidence, evidence],
    updatedAt: createdAt,
  };
}

export function beginReaderRecall(run: ReaderSimulationRun, at: string): ReaderSimulationRun {
  if (run.state !== "completed" && run.state !== "quit") fail("READER_RECALL_REQUIRES_SEALED_EXPOSURE");
  if (run.pendingExposure || run.awaitingBlockEvidence) fail("READER_RECALL_REQUIRES_SEALED_EXPOSURE");
  return { ...run, state: "recall", updatedAt: timestamp(at, "READER_RECALL_TIMESTAMP_INVALID") };
}

export function buildReaderRecallInput(run: ReaderSimulationRun) {
  if (run.state !== "recall") fail("READER_RECALL_INPUT_REQUIRES_RECALL_STATE");
  return {
    runId: run.runId,
    readerProfile: { ...run.readerProfile },
    skim: run.skim ? { ...run.skim } : null,
    readerMemory: [...run.readerMemory],
    segmentTranscript: run.segmentObservations.map((item) => ({ ...item })),
    blockEvidence: run.blockEvidence.map((item) => ({ ...item })),
    questions: [
      "What is the story about?",
      "Who is it about?",
      "What does the protagonist currently want?",
      "What moment is most memorable?",
      "What unresolved question remains strongest?",
      "What does the reader believe changed across the story?",
      "What would the reader tell someone else about the screenplay later?",
    ] as const,
  };
}

export function completeReaderRecall(
  run: ReaderSimulationRun,
  input: Omit<ReaderRecallEvidence, "createdAt">,
  at: string,
): ReaderSimulationRun {
  if (run.state !== "recall") fail("READER_RECALL_COMPLETION_REQUIRES_RECALL_STATE");
  const createdAt = timestamp(at, "READER_RECALL_COMPLETE_TIMESTAMP_INVALID");
  const recall: ReaderRecallEvidence = {
    storyAbout: requireText(input.storyAbout, "READER_RECALL_STORY_REQUIRED"),
    whoAbout: requireText(input.whoAbout, "READER_RECALL_WHO_REQUIRED"),
    protagonistWant: requireText(input.protagonistWant, "READER_RECALL_WANT_REQUIRED"),
    mostMemorableMoment: requireText(input.mostMemorableMoment, "READER_RECALL_MOMENT_REQUIRED"),
    strongestUnresolvedQuestion: requireText(input.strongestUnresolvedQuestion, "READER_RECALL_QUESTION_REQUIRED"),
    believedChange: requireText(input.believedChange, "READER_RECALL_CHANGE_REQUIRED"),
    laterRetelling: requireText(input.laterRetelling, "READER_RECALL_RETELLING_REQUIRED"),
    createdAt,
  };
  return { ...run, recall, state: "ready_for_diagnosis", updatedAt: createdAt };
}

export function attachDraftLensDiagnosis(
  run: ReaderSimulationRun,
  input: Omit<DraftLensReaderDiagnosis, "createdAt">,
  at: string,
): ReaderSimulationRun {
  if (run.state !== "ready_for_diagnosis") fail("DRAFTLENS_DIAGNOSIS_REQUIRES_SEALED_READER_EVIDENCE");
  const createdAt = timestamp(at, "DRAFTLENS_DIAGNOSIS_TIMESTAMP_INVALID");
  const diagnosis: DraftLensReaderDiagnosis = {
    summary: requireText(input.summary, "DRAFTLENS_DIAGNOSIS_SUMMARY_REQUIRED", 20_000),
    revisionQuestions: input.revisionQuestions.map((item) => requireText(item, "DRAFTLENS_REVISION_QUESTION_REQUIRED", 4_000)).slice(0, 24),
    createdAt,
  };
  return { ...run, draftLensDiagnosis: diagnosis, state: "diagnosed", updatedAt: createdAt };
}

export function markReaderRunSuperseded(run: ReaderSimulationRun, at: string): ReaderSimulationRun {
  if (run.state !== "diagnosed" && run.state !== "ready_for_diagnosis") fail("READER_SUPERSEDE_REQUIRES_FINISHED_RUN");
  return { ...run, state: "superseded", updatedAt: timestamp(at, "READER_SUPERSEDE_TIMESTAMP_INVALID") };
}

function quitPoint(run: ReaderSimulationRun) {
  const evidence = run.blockEvidence.find((item) => item.readingDecision === "quit");
  return evidence ? { blockOrdinal: evidence.blockOrdinal, segmentId: evidence.quit?.segmentId ?? null } : null;
}

function averageAttention(evidence: ReaderBlockEvidence | undefined) {
  if (!evidence || evidence.attentionTrace.length === 0) return null;
  return evidence.attentionTrace.reduce((sum, item) => sum + item.value, 0) / evidence.attentionTrace.length;
}

function movedLaterOrDisappeared(previous: ReturnType<typeof quitPoint>, next: ReturnType<typeof quitPoint>) {
  if (!previous) return false;
  if (!next) return true;
  return next.blockOrdinal > previous.blockOrdinal;
}

export function compareReaderSimulationRuns(previous: ReaderSimulationRun, next: ReaderSimulationRun): ReaderRunComparison {
  if (previous.projectId !== next.projectId) fail("READER_COMPARISON_PROJECT_MISMATCH");
  if (previous.readerProfile.id !== next.readerProfile.id) fail("READER_COMPARISON_PROFILE_MISMATCH");
  const previousQuit = quitPoint(previous);
  const nextQuit = quitPoint(next);
  const previousByBlock = new Map(previous.blockEvidence.map((item) => [item.blockId, item]));
  const nextByBlock = new Map(next.blockEvidence.map((item) => [item.blockId, item]));
  const blocks = Array.from({ length: READER_SIMULATION_BLOCK_COUNT }, (_, index) => {
    const blockId = canonicalBlockId(index + 1);
    const before = previousByBlock.get(blockId);
    const after = nextByBlock.get(blockId);
    const previousAttention = averageAttention(before);
    const nextAttention = averageAttention(after);
    return {
      blockId,
      blockOrdinal: index + 1,
      previousAttention,
      nextAttention,
      attentionDelta: previousAttention === null || nextAttention === null ? null : nextAttention - previousAttention,
      previousConfusion: before?.confusion.kind ?? null,
      nextConfusion: after?.confusion.kind ?? null,
      previousExpectationOut: before?.expectationOut ?? null,
      nextExpectationOut: after?.expectationOut ?? null,
      previousDecision: before?.readingDecision ?? null,
      nextDecision: after?.readingDecision ?? null,
    };
  });
  return {
    projectId: previous.projectId,
    readerProfileId: previous.readerProfile.id,
    previousRunId: previous.runId,
    nextRunId: next.runId,
    sourceChanged: previous.sourceDraftFingerprint !== next.sourceDraftFingerprint,
    quitPoint: {
      previous: previousQuit,
      next: nextQuit,
      movedLaterOrDisappeared: movedLaterOrDisappeared(previousQuit, nextQuit),
    },
    blocks,
    recallChanged: JSON.stringify(previous.recall) !== JSON.stringify(next.recall),
  };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

export function validateReaderSimulationRun(value: unknown): ReaderSimulationRun {
  const source = record(value);
  if (source.schemaVersion !== READER_SIMULATION_SCHEMA_VERSION) fail("READER_RUN_SCHEMA_UNSUPPORTED");
  if (source.owner !== READER_SIMULATION_OWNER) fail("READER_RUN_OWNER_INVALID");
  if (source.authority !== READER_SIMULATION_AUTHORITY) fail("READER_RUN_AUTHORITY_INVALID");
  const state = source.state;
  if (!READER_RUN_STATES.includes(state as ReaderRunState)) fail("READER_RUN_STATE_INVALID");
  const run = value as ReaderSimulationRun;
  requireText(run.runId, "READER_RUN_ID_REQUIRED", 200);
  requireText(run.projectId, "READER_PROJECT_ID_REQUIRED", 240);
  requireText(run.sourceDraftFingerprint, "READER_FINGERPRINT_REQUIRED", 240);
  assertReaderProfile(run.readerProfile);
  assertRuntime(run.runtime);
  timestamp(run.createdAt, "READER_CREATED_AT_INVALID");
  timestamp(run.updatedAt, "READER_UPDATED_AT_INVALID");
  if (!Number.isInteger(run.cursor?.blockOrdinal) || run.cursor.blockOrdinal < 1 || run.cursor.blockOrdinal > READER_SIMULATION_BLOCK_COUNT) fail("READER_CURSOR_BLOCK_INVALID");
  if (!Number.isInteger(run.cursor?.segmentIndex) || run.cursor.segmentIndex < 0) fail("READER_CURSOR_SEGMENT_INVALID");
  if (!Array.isArray(run.segmentObservations) || !Array.isArray(run.blockEvidence) || !Array.isArray(run.readerMemory)) fail("READER_RUN_EVIDENCE_INVALID");
  return run;
}

export function serializeReaderSimulationRun(run: ReaderSimulationRun) {
  validateReaderSimulationRun(run);
  return JSON.stringify(run);
}

export function parseReaderSimulationRun(serialized: string) {
  return validateReaderSimulationRun(JSON.parse(serialized));
}
