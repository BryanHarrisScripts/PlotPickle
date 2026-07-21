export type PacingProfile = "original-24-96" | "contemplative" | "moderate" | "propulsive" | "custom";

export type MiniBlock = {
  id: string;
  number: number;
  label: string;
  function: string;
  purpose: string;
  characterId: string;
  objective: string;
  resistance: string;
  action: string;
  revelation: string;
  turn: string;
  visualBeat: string;
  dialogueIntention: string;
  entryState: string;
  exitState: string;
  setup: string;
  payoff: string;
  estimatedSeconds: number;
  beatTarget: number;
  shotTarget: number;
  notes: string;
};

export type StoryScene = {
  id: string;
  number: number;
  title: string;
  purpose: string;
  characterIds: string[];
  locationIds: string[];
  objective: string;
  conflict: string;
  turn: string;
  resolution: string;
  outcome: string;
  estimatedSeconds: number;
  miniBlocks: MiniBlock[];
};

export type StorySequence = {
  id: string;
  number: number;
  act: number;
  title: string;
  purpose: string;
  question: string;
  promise: string;
  escalation: string;
  climax: string;
  turningPoint: string;
  result: string;
  targetMinutes: number;
  blockNumbers: [number, number];
};

export type ProjectStructure = {
  pacingProfile: PacingProfile;
  averageShotSeconds: number;
  automaticTiming: boolean;
  sequences: StorySequence[];
};

export type ClockRow = {
  level: "sequence" | "block" | "scene" | "mini";
  id: string;
  label: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  beats: number;
  shots: number;
};

export const sequenceTemplates = [
  ["Awakening", "Introduce the world, protagonist, disturbance, and first live question."],
  ["Discovery", "Reveal the new opportunity, cost, or truth created by the disturbance."],
  ["Alliance", "Force commitment, relationship, or threshold movement into the larger story."],
  ["Conflict", "Test the initial approach against active opposition and changing relationships."],
  ["Struggle", "Complicate the plan until adaptation becomes unavoidable."],
  ["Pivot", "Deliver the midpoint reframe that changes direction, stakes, or understanding."],
  ["Apex", "Make prior choices generate consequences and tighter pressure."],
  ["Turn", "Collapse the current strategy and force a deeper internal or external change."],
  ["Reveal", "Convert new understanding into preparation for the decisive confrontation."],
  ["Fallout", "Show the immediate cost and unstable new condition after the major confrontation."],
  ["Mending", "Resolve remaining relationships, questions, and final tests of transformation."],
  ["Legacy", "Complete the final action, equilibrium, reflection, and closing image."],
] as const;

const miniTemplates = [
  ["Promise", "Establish the immediate condition, question, image, or objective."],
  ["Progress", "Develop the attempt and reveal meaningful movement or information."],
  ["Pressure", "Escalate resistance, complication, cost, or contradiction."],
  ["Payoff", "Force the turn, consequence, resolution, or exit hook."],
] as const;

export function pacingAverageShotSeconds(profile: PacingProfile, custom = 4.6875) {
  if (profile === "contemplative") return 8.5;
  if (profile === "moderate") return 6;
  if (profile === "propulsive") return 3.5;
  if (profile === "custom") return Math.max(0.5, custom);
  return 4.6875;
}

export function createDefaultMiniBlocks(blockNumber: number, blockSeconds: number): MiniBlock[] {
  return miniTemplates.map(([label, purpose], index) => ({
    id: `block-${String(blockNumber).padStart(2, "0")}-mini-${index + 1}`,
    number: index + 1,
    label,
    function: purpose,
    purpose: "",
    characterId: "",
    objective: "",
    resistance: "",
    action: "",
    revelation: "",
    turn: "",
    visualBeat: "",
    dialogueIntention: "",
    entryState: "",
    exitState: "",
    setup: "",
    payoff: "",
    estimatedSeconds: blockSeconds / 4,
    beatTarget: 4,
    shotTarget: 16,
    notes: "",
  }));
}

export function createDefaultScenes(blockNumber: number, targetMinutes: number): StoryScene[] {
  const blockSeconds = (targetMinutes * 60) / 24;
  const minis = createDefaultMiniBlocks(blockNumber, blockSeconds);
  return [0, 1].map((sceneIndex) => ({
    id: `block-${String(blockNumber).padStart(2, "0")}-scene-${sceneIndex + 1}`,
    number: sceneIndex + 1,
    title: sceneIndex === 0 ? "Scene 1 — Setup and escalation" : "Scene 2 — Confrontation and turn",
    purpose: sceneIndex === 0
      ? "Establish the block objective and develop the first meaningful pressure."
      : "Deepen the conflict, force a choice or action, and create the block consequence.",
    characterIds: [],
    locationIds: [],
    objective: "",
    conflict: "",
    turn: "",
    resolution: "",
    outcome: "",
    estimatedSeconds: blockSeconds / 2,
    miniBlocks: minis.slice(sceneIndex * 2, sceneIndex * 2 + 2),
  }));
}

export function createDefaultStructure(targetMinutes = 120): ProjectStructure {
  return {
    pacingProfile: "original-24-96",
    averageShotSeconds: 4.6875,
    automaticTiming: true,
    sequences: sequenceTemplates.map(([title, purpose], index) => ({
      id: `sequence-${String(index + 1).padStart(2, "0")}`,
      number: index + 1,
      act: Math.floor(index / 3) + 1,
      title,
      purpose,
      question: "",
      promise: "",
      escalation: "",
      climax: "",
      turningPoint: "",
      result: "",
      targetMinutes: targetMinutes / 12,
      blockNumbers: [index * 2 + 1, index * 2 + 2] as [number, number],
    })),
  };
}

function mergeMini(defaultMini: MiniBlock, value?: Partial<MiniBlock>): MiniBlock {
  return { ...defaultMini, ...value, number: defaultMini.number, id: value?.id || defaultMini.id };
}

function mergeScene(defaultScene: StoryScene, value?: Partial<StoryScene>): StoryScene {
  const incomingMinis = Array.isArray(value?.miniBlocks) ? value.miniBlocks : [];
  return {
    ...defaultScene,
    ...value,
    number: defaultScene.number,
    id: value?.id || defaultScene.id,
    characterIds: Array.isArray(value?.characterIds) ? value.characterIds : defaultScene.characterIds,
    locationIds: Array.isArray(value?.locationIds) ? value.locationIds : defaultScene.locationIds,
    miniBlocks: defaultScene.miniBlocks.map((mini, index) => mergeMini(mini, incomingMinis[index])),
  };
}

export function normalizeScenes(value: unknown, blockNumber: number, targetMinutes: number): StoryScene[] {
  const defaults = createDefaultScenes(blockNumber, targetMinutes);
  if (!Array.isArray(value)) return defaults;
  return defaults.map((scene, index) => mergeScene(scene, value[index] as Partial<StoryScene> | undefined));
}

export function normalizeStructure(value: unknown, targetMinutes: number): ProjectStructure {
  const defaults = createDefaultStructure(targetMinutes);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProjectStructure>;
  const incomingSequences = Array.isArray(candidate.sequences) ? candidate.sequences : [];
  return {
    pacingProfile: candidate.pacingProfile ?? defaults.pacingProfile,
    averageShotSeconds: Number(candidate.averageShotSeconds) > 0
      ? Number(candidate.averageShotSeconds)
      : defaults.averageShotSeconds,
    automaticTiming: candidate.automaticTiming ?? defaults.automaticTiming,
    sequences: defaults.sequences.map((sequence, index) => ({
      ...sequence,
      ...(incomingSequences[index] ?? {}),
      id: incomingSequences[index]?.id || sequence.id,
      number: sequence.number,
      act: sequence.act,
      blockNumbers: sequence.blockNumbers,
    })),
  };
}

export function rebalanceStoryTiming<
  T extends {
    metadata: { targetMinutes: number };
    structure: ProjectStructure;
    blocks: Array<{ number: number; sequenceNumber: number; targetMinutes: number; scenes: StoryScene[] }>;
  },
>(project: T, targetMinutes: number): T {
  const safeMinutes = Math.max(1, Number(targetMinutes) || 120);
  const blockSeconds = (safeMinutes * 60) / 24;
  const sequenceMinutes = safeMinutes / 12;
  return {
    ...project,
    metadata: { ...project.metadata, targetMinutes: safeMinutes },
    structure: {
      ...project.structure,
      sequences: project.structure.sequences.map((sequence) => ({ ...sequence, targetMinutes: sequenceMinutes })),
    },
    blocks: project.blocks.map((block) => ({
      ...block,
      targetMinutes: safeMinutes / 24,
      scenes: block.scenes.map((scene) => ({
        ...scene,
        estimatedSeconds: blockSeconds / 2,
        miniBlocks: scene.miniBlocks.map((mini) => ({ ...mini, estimatedSeconds: blockSeconds / 4 })),
      })),
    })),
  };
}

export function secondsToTimecode(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function buildStoryClock(project: {
  structure: ProjectStructure;
  blocks: Array<{ id: string; number: number; title: string; sequenceNumber: number; targetMinutes: number; scenes: StoryScene[] }>;
}): ClockRow[] {
  const rows: ClockRow[] = [];
  let cursor = 0;
  for (const sequence of project.structure.sequences) {
    const sequenceStart = cursor;
    const sequenceBlocks = project.blocks.filter((block) => block.sequenceNumber === sequence.number);
    for (const block of sequenceBlocks) {
      const blockStart = cursor;
      for (const scene of block.scenes) {
        const sceneStart = cursor;
        for (const mini of scene.miniBlocks) {
          const miniStart = cursor;
          cursor += mini.estimatedSeconds;
          rows.push({
            level: "mini",
            id: mini.id,
            label: `B${block.number}.${mini.number} ${mini.label}`,
            startSeconds: miniStart,
            endSeconds: cursor,
            durationSeconds: mini.estimatedSeconds,
            beats: mini.beatTarget,
            shots: mini.shotTarget,
          });
        }
        rows.push({
          level: "scene",
          id: scene.id,
          label: `Block ${block.number} · Scene ${scene.number}`,
          startSeconds: sceneStart,
          endSeconds: cursor,
          durationSeconds: cursor - sceneStart,
          beats: scene.miniBlocks.reduce((sum, mini) => sum + mini.beatTarget, 0),
          shots: scene.miniBlocks.reduce((sum, mini) => sum + mini.shotTarget, 0),
        });
      }
      rows.push({
        level: "block",
        id: block.id,
        label: `Block ${block.number}: ${block.title}`,
        startSeconds: blockStart,
        endSeconds: cursor,
        durationSeconds: cursor - blockStart,
        beats: block.scenes.flatMap((scene) => scene.miniBlocks).reduce((sum, mini) => sum + mini.beatTarget, 0),
        shots: block.scenes.flatMap((scene) => scene.miniBlocks).reduce((sum, mini) => sum + mini.shotTarget, 0),
      });
    }
    rows.push({
      level: "sequence",
      id: sequence.id,
      label: `Sequence ${sequence.number}: ${sequence.title}`,
      startSeconds: sequenceStart,
      endSeconds: cursor,
      durationSeconds: cursor - sequenceStart,
      beats: sequenceBlocks.flatMap((block) => block.scenes).flatMap((scene) => scene.miniBlocks).reduce((sum, mini) => sum + mini.beatTarget, 0),
      shots: sequenceBlocks.flatMap((block) => block.scenes).flatMap((scene) => scene.miniBlocks).reduce((sum, mini) => sum + mini.shotTarget, 0),
    });
  }
  return rows;
}
