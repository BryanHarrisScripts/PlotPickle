import type { PlotPickleProject } from "./projects/project";
import {
  SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS,
  SEQUENCE_DIRECTOR_RENDER_CLIP_SECONDS,
  normalizeSequenceDirectorDraft,
  sequenceDirectorAnchorRef,
  sequenceDirectorRenderSlots,
  type SequenceDirectorBeat,
  type SequenceDirectorDraft,
  type SequenceDirectorRenderPrompt,
  type SequenceDirectorSurface,
} from "../core/contracts/sequence-director";
import {
  compileBeatCinematography,
  compileSequenceCinematography,
} from "./sequence-director-cinematography";

export type SequenceDirectorSeed = {
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly anchorRef: string;
  readonly sequenceNumber: number;
  readonly act: number;
  readonly sceneId: string;
  readonly miniBlockId: string;
  readonly characterIds: readonly string[];
  readonly locationIds: readonly string[];
  readonly storyboardFrameId: string;
  readonly draft: SequenceDirectorDraft;
};

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function sequenceDirectorSeedFromProject(
  project: PlotPickleProject,
  blockNumber: number,
  miniBlockNumber: number,
): SequenceDirectorSeed | null {
  const anchorRef = sequenceDirectorAnchorRef(blockNumber, miniBlockNumber);
  if (!anchorRef) return null;
  const block = project.blocks.find((candidate) => candidate.number === blockNumber);
  if (!block) return null;
  const scene = block.scenes.find((candidate) => candidate.miniBlocks.some((mini) => mini.number === miniBlockNumber));
  const mini = scene?.miniBlocks.find((candidate) => candidate.number === miniBlockNumber);
  if (!scene || !mini) return null;
  const frame = block.visuals.find((visual) => visual.miniBlockNumber === miniBlockNumber) ?? null;
  const continuity = unique([
    mini.entryState ? `Entry state: ${mini.entryState}` : "",
    mini.exitState ? `Exit state: ${mini.exitState}` : "",
    mini.setup ? `Setup to preserve: ${mini.setup}` : "",
    mini.payoff ? `Payoff to preserve: ${mini.payoff}` : "",
    block.storyboardDirection ? `Block visual direction: ${block.storyboardDirection}` : "",
  ]);
  const draft = normalizeSequenceDirectorDraft({
    version: 1,
    blockNumber,
    miniBlockNumber,
    title: `${block.title} · ${mini.label}`,
    purpose: mini.purpose || mini.function || block.purpose,
    rhythm: "",
    motionFlow: "",
    globalContinuity: continuity,
    hardRules: [],
    references: frame ? [{
      id: `storyboard-reference-${frame.id}`,
      role: "storyboard",
      assetId: frame.id,
      label: frame.caption || frame.alt || `Block ${blockNumber} Mini-Block ${miniBlockNumber} storyboard`,
      instruction: frame.continuity || "Preserve the approved Storyboard visual intent.",
    }] : [],
    beats: [],
    status: "proposal",
  });
  if (!draft) return null;
  return {
    blockNumber,
    miniBlockNumber,
    anchorRef,
    sequenceNumber: block.sequenceNumber,
    act: block.act,
    sceneId: scene.id,
    miniBlockId: mini.id,
    characterIds: unique([mini.characterId, ...scene.characterIds, ...block.characterIds]),
    locationIds: unique([...scene.locationIds, ...block.locationIds]),
    storyboardFrameId: frame?.id ?? "",
    draft,
  };
}

function lines(values: readonly string[], empty = "None supplied.") {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : empty;
}

function referenceMap(draft: SequenceDirectorDraft) {
  if (!draft.references.length) return "No approved visual references attached.";
  return draft.references.map((reference, index) => [
    `[REF ${String(index + 1).padStart(2, "0")}] ${reference.role.toUpperCase()} · ${reference.label || reference.id}`,
    `SOURCE: ${reference.assetId}`,
    `USE: ${reference.instruction || "Use only for the declared reference role."}`,
  ].join("\n")).join("\n\n");
}

function beatText(beat: SequenceDirectorBeat, includeTiming: boolean) {
  const timing = includeTiming && beat.startSecond !== null && beat.endSecond !== null
    ? ` · ${beat.startSecond.toFixed(2)}-${beat.endSecond.toFixed(2)}s`
    : "";
  return [
    `BEAT ${String(beat.order).padStart(2, "0")} · ${beat.label || beat.id}${timing} · ${beat.density.toUpperCase()}`,
    beat.purpose ? `PURPOSE: ${beat.purpose}` : "",
    beat.visualAction ? `VISIBLE ACTION: ${beat.visualAction}` : "",
    beat.cameraIntent ? `CAMERA: ${beat.cameraIntent}` : "",
    beat.continuityIn ? `START STATE: ${beat.continuityIn}` : "",
    beat.continuityOut ? `END STATE: ${beat.continuityOut}` : "",
    beat.soundIntent ? `SOUND INTENT: ${beat.soundIntent}` : "",
  ].filter(Boolean).join("\n");
}

export function compileSequenceDirectorBrief(draft: SequenceDirectorDraft, surface: SequenceDirectorSurface) {
  const stageRule = surface === "plan"
    ? "PLAN: define intent, rhythm, references and continuity. Do not invent provider or render settings."
    : surface === "storyboard"
      ? "STORYBOARD: express ordered visible beats and continuity. Creative shot count is variable and is not the 25-clip render grid."
      : "PREVIS: preserve the approved visual plan while authoring camera, motion and timing. Timing must cover the complete 75-second Mini-Block before Render Plan is ready.";
  const includeTiming = surface === "previs";
  return [
    "=== PLOTPICKLE SEQUENCE DIRECTOR ===",
    `SURFACE: ${surface.toUpperCase()}`,
    `ADDRESS: Block ${String(draft.blockNumber).padStart(2, "0")} / Mini-Block ${draft.miniBlockNumber}`,
    `ANCHOR: ${draft.anchorRef}`,
    stageRule,
    "",
    "=== PURPOSE ===",
    draft.title || "Untitled sequence",
    draft.purpose || "No purpose supplied.",
    "",
    "=== CINEMATOGRAPHY GRAMMAR ===",
    compileSequenceCinematography(draft, surface),
    "",
    "=== REFERENCE MAP ===",
    referenceMap(draft),
    "",
    "=== CONTINUITY LOCKS ===",
    lines(draft.globalContinuity),
    "",
    "=== RHYTHM ===",
    draft.rhythm || "Not authored yet.",
    "",
    "=== MOTION FLOW ===",
    draft.motionFlow || "Not authored yet.",
    "",
    "=== ORDERED VISUAL BEATS ===",
    draft.beats.length ? draft.beats.map((beat) => beatText(beat, includeTiming)).join("\n\n") : "No beats authored yet.",
    "",
    "=== HARD RULES ===",
    lines(draft.hardRules),
  ].join("\n");
}

export type SequenceDirectorPrevisReadiness = {
  readonly ready: boolean;
  readonly reason: string;
  readonly authoredSeconds: number;
  readonly gapSeconds: number;
};

export function sequenceDirectorPrevisReadiness(draft: SequenceDirectorDraft): SequenceDirectorPrevisReadiness {
  if (draft.status !== "approved") return { ready: false, reason: "Sequence proposal is not approved.", authoredSeconds: 0, gapSeconds: SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS };
  if (!draft.beats.length) return { ready: false, reason: "No creative beats are authored.", authoredSeconds: 0, gapSeconds: SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS };
  const timed = draft.beats
    .filter((beat) => beat.startSecond !== null && beat.endSecond !== null)
    .sort((left, right) => (left.startSecond as number) - (right.startSecond as number));
  if (timed.length !== draft.beats.length) return { ready: false, reason: "Every creative beat needs Previs timing.", authoredSeconds: 0, gapSeconds: SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS };
  let cursor = 0;
  let authoredSeconds = 0;
  let gapSeconds = 0;
  for (const beat of timed) {
    const start = beat.startSecond as number;
    const end = beat.endSecond as number;
    if (start < cursor - 0.01) return { ready: false, reason: `Beat ${beat.order} overlaps the previous beat.`, authoredSeconds, gapSeconds };
    if (start > cursor + 0.01) gapSeconds += start - cursor;
    authoredSeconds += end - start;
    cursor = end;
  }
  if (cursor < SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS) gapSeconds += SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS - cursor;
  if (gapSeconds > 0.01 || Math.abs(authoredSeconds - SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS) > 0.01) {
    return {
      ready: false,
      reason: `Previs timing must cover the full ${SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS}-second Mini-Block without gaps.`,
      authoredSeconds: Math.round(authoredSeconds * 100) / 100,
      gapSeconds: Math.round(gapSeconds * 100) / 100,
    };
  }
  return { ready: true, reason: "Previs timing covers the complete Mini-Block.", authoredSeconds, gapSeconds: 0 };
}

function overlappingBeats(draft: SequenceDirectorDraft, localStartSecond: number, localEndSecond: number) {
  return draft.beats.filter((beat) => beat.startSecond !== null && beat.endSecond !== null
    && (beat.startSecond as number) < localEndSecond
    && (beat.endSecond as number) > localStartSecond);
}

function clipPrompt(draft: SequenceDirectorDraft, clipNumber: number) {
  const localStartSecond = (clipNumber - 1) * SEQUENCE_DIRECTOR_RENDER_CLIP_SECONDS;
  const localEndSecond = clipNumber * SEQUENCE_DIRECTOR_RENDER_CLIP_SECONDS;
  const beats = overlappingBeats(draft, localStartSecond, localEndSecond);
  const previous = draft.beats
    .filter((beat) => beat.endSecond !== null && (beat.endSecond as number) <= localStartSecond + 0.01)
    .sort((left, right) => (right.endSecond as number) - (left.endSecond as number))[0];
  const next = draft.beats
    .filter((beat) => beat.startSecond !== null && (beat.startSecond as number) >= localEndSecond - 0.01)
    .sort((left, right) => (left.startSecond as number) - (right.startSecond as number))[0];
  return [
    "=== PLOTPICKLE RENDER CLIP ===",
    `ADDRESS: Block ${String(draft.blockNumber).padStart(2, "0")} / Mini-Block ${draft.miniBlockNumber} / Clip ${String(clipNumber).padStart(2, "0")}`,
    `LOCAL TIME: ${localStartSecond.toFixed(2)}-${localEndSecond.toFixed(2)}s`,
    "",
    "=== REFERENCE MAP ===",
    referenceMap(draft),
    "",
    "=== WHAT STAYS ===",
    lines(draft.globalContinuity),
    "",
    "=== START STATE ===",
    previous?.continuityOut || beats[0]?.continuityIn || "Continue exactly from the approved previous boundary keyframe.",
    "",
    "=== WHAT CHANGES IN THIS CLIP ===",
    beats.length ? beats.map((beat) => beatText(beat, true)).join("\n\n") : "No new creative event; preserve approved continuity through this interval.",
    "",
    "=== CINEMATOGRAPHY GRAMMAR ===",
    compileBeatCinematography(draft, beats),
    "",
    "=== END STATE ===",
    beats.at(-1)?.continuityOut || next?.continuityIn || "End on a stable boundary that can seed the next 3-second clip.",
    "",
    "=== MOTION FLOW ===",
    draft.motionFlow || "Preserve continuous physical motion and causal handoff between boundaries.",
    "",
    "=== HARD RULES ===",
    lines(draft.hardRules),
    "",
    "Do not add unrequested characters, props, text, logos, cuts, camera moves or continuity changes.",
  ].join("\n");
}

export function compileSequenceDirectorRenderPrompts(draft: SequenceDirectorDraft): readonly SequenceDirectorRenderPrompt[] {
  const readiness = sequenceDirectorPrevisReadiness(draft);
  if (!readiness.ready) return [];
  return sequenceDirectorRenderSlots(draft.blockNumber, draft.miniBlockNumber).map((slot) => {
    const localStartSecond = (slot.clipNumber - 1) * SEQUENCE_DIRECTOR_RENDER_CLIP_SECONDS;
    const localEndSecond = slot.clipNumber * SEQUENCE_DIRECTOR_RENDER_CLIP_SECONDS;
    const beats = overlappingBeats(draft, localStartSecond, localEndSecond);
    return {
      slot,
      localStartSecond,
      localEndSecond,
      beatIds: beats.map((beat) => beat.id),
      prompt: clipPrompt(draft, slot.clipNumber),
    };
  });
}
