export type PacingProfile = "original-24-96" | "contemplative" | "moderate" | "propulsive" | "custom";

export type SceneType = "action" | "dialogue" | "suspense" | "revelation" | "montage" | "transition" | "other";

export type ShortScene = {
  id: string;
  title: string;
  sceneType: SceneType;
  entryCondition: string;
  objective: string;
  opposition: string;
  action: string;
  reversal: string;
  outcome: string;
  charactersEntering: string[];
  charactersLeaving: string[];
  estimatedSeconds: number;
  pageEstimate: number;
};

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
  shortScenes: ShortScene[];
};

export type StoryScene = {
  id: string;
  number: number;
  title: string;
  sceneType: SceneType;
  purpose: string;
  entryCondition: string;
  exitCondition: string;
  characterIds: string[];
  locationIds: string[];
  charactersEntering: string[];
  charactersLeaving: string[];
  objective: string;
  opposition: string;
  conflict: string;
  action: string;
  reversal: string;
  turn: string;
  resolution: string;
  outcome: string;
  estimatedSeconds: number;
  pageEstimate: number;
  order: number;
  threadIds: string[];
  status: "outline" | "draft" | "revised" | "locked" | "omitted";
  revisionColour: "none" | "blue" | "pink" | "yellow" | "green" | "goldenrod" | "buff" | "salmon" | "cherry" | "tan" | "gray";
  locked: boolean;
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
  level: "sequence" | "block" | "scene" | "mini" | "short-scene";
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

const sceneTypes: SceneType[] = ["action", "dialogue", "suspense", "revelation", "montage", "transition", "other"];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

function safeSceneType(value: unknown): SceneType {
  return sceneTypes.includes(value as SceneType) ? value as SceneType : "other";
}

export function pacingAverageShotSeconds(profile: PacingProfile, custom = 4.6875) {
  if (profile === "contemplative") return 8.5;
  if (profile === "moderate") return 6;
  if (profile === "propulsive") return 3.5;
  if (profile === "custom") return Math.max(0.5, custom);
  return 4.6875;
}

export function createShortScene(index = 1): ShortScene {
  return {
    id: makeId("short-scene"),
    title: `Short scene ${index}`,
    sceneType: "transition",
    entryCondition: "",
    objective: "",
    opposition: "",
    action: "",
    reversal: "",
    outcome: "",
    charactersEntering: [],
    charactersLeaving: [],
    estimatedSeconds: 15,
    pageEstimate: 0.25,
  };
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
    shortScenes: [],
  }));
}

function blankScene(blockNumber: number, number: number, estimatedSeconds: number): StoryScene {
  return {
    id: `block-${String(blockNumber).padStart(2, "0")}-scene-${number}`,
    number,
    title: `Scene ${number} — New movement`,
    sceneType: "other",
    purpose: "Define the objective, opposition, action, reversal, and outcome for this scene.",
    entryCondition: "",
    exitCondition: "",
    characterIds: [],
    locationIds: [],
    charactersEntering: [],
    charactersLeaving: [],
    objective: "",
    opposition: "",
    conflict: "",
    action: "",
    reversal: "",
    turn: "",
    resolution: "",
    outcome: "",
    estimatedSeconds,
    pageEstimate: estimatedSeconds / 60,
    order: number - 1,
    threadIds: [],
    status: "outline",
    revisionColour: "none",
    locked: false,
    miniBlocks: [],
  };
}

export function createDefaultScenes(blockNumber: number, targetMinutes: number): StoryScene[] {
  const blockSeconds = (targetMinutes * 60) / 24;
  const minis = createDefaultMiniBlocks(blockNumber, blockSeconds);
  return [0, 1].map((sceneIndex) => ({
    ...blankScene(blockNumber, sceneIndex + 1, blockSeconds / 2),
    title: sceneIndex === 0 ? "Scene 1 — Setup and escalation" : "Scene 2 — Confrontation and turn",
    sceneType: sceneIndex === 0 ? "dialogue" : "action",
    purpose: sceneIndex === 0
      ? "Establish the block objective and develop the first meaningful pressure."
      : "Deepen the conflict, force a choice or action, and create the block consequence.",
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

function normalizeShortScenes(value: unknown): ShortScene[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ShortScene>;
    const estimatedSeconds = Math.max(0, Number(candidate.estimatedSeconds) || 0);
    return [{
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : makeId("short-scene"),
      title: typeof candidate.title === "string" ? candidate.title : `Short scene ${index + 1}`,
      sceneType: safeSceneType(candidate.sceneType),
      entryCondition: typeof candidate.entryCondition === "string" ? candidate.entryCondition : "",
      objective: typeof candidate.objective === "string" ? candidate.objective : "",
      opposition: typeof candidate.opposition === "string" ? candidate.opposition : "",
      action: typeof candidate.action === "string" ? candidate.action : "",
      reversal: typeof candidate.reversal === "string" ? candidate.reversal : "",
      outcome: typeof candidate.outcome === "string" ? candidate.outcome : "",
      charactersEntering: strings(candidate.charactersEntering),
      charactersLeaving: strings(candidate.charactersLeaving),
      estimatedSeconds,
      pageEstimate: Math.max(0, Number(candidate.pageEstimate) || estimatedSeconds / 60),
    }];
  });
}

function mergeMini(defaultMini: MiniBlock, value?: Partial<MiniBlock>): MiniBlock {
  return {
    ...defaultMini,
    ...value,
    number: defaultMini.number,
    id: value?.id || defaultMini.id,
    estimatedSeconds: Math.max(0, Number(value?.estimatedSeconds) || defaultMini.estimatedSeconds),
    beatTarget: Math.max(0, Number(value?.beatTarget) || 0),
    shotTarget: Math.max(0, Number(value?.shotTarget) || 0),
    shortScenes: normalizeShortScenes(value?.shortScenes),
  };
}

function normalizeScene(value: Partial<StoryScene>, index: number, blockNumber: number, blockSeconds: number): StoryScene {
  const fallback = blankScene(blockNumber, index + 1, blockSeconds / Math.max(1, index + 1));
  const estimatedSeconds = Math.max(0, Number(value.estimatedSeconds) || 0);
  return {
    ...fallback,
    ...value,
    id: typeof value.id === "string" && value.id ? value.id : makeId(`block-${String(blockNumber).padStart(2, "0")}-scene`),
    number: index + 1,
    title: typeof value.title === "string" ? value.title : fallback.title,
    sceneType: safeSceneType(value.sceneType),
    purpose: typeof value.purpose === "string" ? value.purpose : "",
    entryCondition: typeof value.entryCondition === "string" ? value.entryCondition : "",
    exitCondition: typeof value.exitCondition === "string" ? value.exitCondition : "",
    characterIds: strings(value.characterIds),
    locationIds: strings(value.locationIds),
    charactersEntering: strings(value.charactersEntering),
    charactersLeaving: strings(value.charactersLeaving),
    objective: typeof value.objective === "string" ? value.objective : "",
    opposition: typeof value.opposition === "string" ? value.opposition : typeof value.conflict === "string" ? value.conflict : "",
    conflict: typeof value.conflict === "string" ? value.conflict : typeof value.opposition === "string" ? value.opposition : "",
    action: typeof value.action === "string" ? value.action : "",
    reversal: typeof value.reversal === "string" ? value.reversal : typeof value.turn === "string" ? value.turn : "",
    turn: typeof value.turn === "string" ? value.turn : typeof value.reversal === "string" ? value.reversal : "",
    resolution: typeof value.resolution === "string" ? value.resolution : "",
    outcome: typeof value.outcome === "string" ? value.outcome : "",
    estimatedSeconds,
    pageEstimate: Math.max(0, Number(value.pageEstimate) || estimatedSeconds / 60),
    order: index,
    threadIds: strings(value.threadIds),
    status: (["outline", "draft", "revised", "locked", "omitted"] as StoryScene["status"][]).includes(value.status as StoryScene["status"]) ? value.status as StoryScene["status"] : "outline",
    revisionColour: (["none", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"] as StoryScene["revisionColour"][]).includes(value.revisionColour as StoryScene["revisionColour"]) ? value.revisionColour as StoryScene["revisionColour"] : "none",
    locked: Boolean(value.locked),
    miniBlocks: [],
  };
}

export function normalizeScenes(value: unknown, blockNumber: number, targetMinutes: number): StoryScene[] {
  const blockSeconds = (targetMinutes * 60) / 24;
  if (!Array.isArray(value) || value.length === 0) return createDefaultScenes(blockNumber, targetMinutes);
  const candidates = value.filter((item): item is Partial<StoryScene> => Boolean(item && typeof item === "object"));
  if (candidates.length === 0) return createDefaultScenes(blockNumber, targetMinutes);

  const defaultMinis = createDefaultMiniBlocks(blockNumber, blockSeconds);
  const usedNumbers = new Set<number>();
  const scenes = candidates.map((candidate, index) => {
    const scene = normalizeScene(candidate, index, blockNumber, blockSeconds);
    const incomingMinis = Array.isArray(candidate.miniBlocks) ? candidate.miniBlocks : [];
    scene.miniBlocks = incomingMinis.flatMap((mini) => {
      if (!mini || typeof mini !== "object") return [];
      const candidateMini = mini as Partial<MiniBlock>;
      const number = Math.min(4, Math.max(1, Math.round(Number(candidateMini.number) || 1)));
      if (usedNumbers.has(number)) return [];
      usedNumbers.add(number);
      return [mergeMini(defaultMinis[number - 1], candidateMini)];
    });
    return scene;
  });

  defaultMinis.forEach((mini) => {
    if (usedNumbers.has(mini.number)) return;
    const recipient = scenes.reduce((best, scene) => scene.miniBlocks.length < best.miniBlocks.length ? scene : best, scenes[0]);
    recipient.miniBlocks.push(mini);
  });

  return scenes.map((scene, index) => {
    const estimatedSeconds = scene.miniBlocks.reduce((sum, mini) => sum + mini.estimatedSeconds, 0);
    const duration = estimatedSeconds || scene.estimatedSeconds;
    return {
      ...scene,
      number: index + 1,
      miniBlocks: [...scene.miniBlocks].sort((left, right) => left.number - right.number),
      estimatedSeconds: duration,
      pageEstimate: scene.pageEstimate > 0 ? scene.pageEstimate : duration / 60,
    };
  });
}

export function normalizeStructure(value: unknown, targetMinutes: number): ProjectStructure {
  const defaults = createDefaultStructure(targetMinutes);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProjectStructure>;
  const incomingSequences = Array.isArray(candidate.sequences) ? candidate.sequences : [];
  return {
    pacingProfile: candidate.pacingProfile ?? defaults.pacingProfile,
    averageShotSeconds: Number(candidate.averageShotSeconds) > 0 ? Number(candidate.averageShotSeconds) : defaults.averageShotSeconds,
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

function renumberScenes(scenes: StoryScene[]): StoryScene[] {
  return scenes.map((scene, index) => ({ ...scene, number: index + 1 }));
}

function sceneDuration(scene: StoryScene) {
  const miniDuration = scene.miniBlocks.reduce((sum, mini) => sum + Math.max(0, Number(mini.estimatedSeconds) || 0), 0);
  return miniDuration || Math.max(0, Number(scene.estimatedSeconds) || 0);
}

function refreshSceneDurations(scenes: StoryScene[]): StoryScene[] {
  return renumberScenes(scenes).map((scene) => {
    const estimatedSeconds = sceneDuration(scene);
    return { ...scene, estimatedSeconds, pageEstimate: estimatedSeconds / 60 };
  });
}

function newDynamicScene(blockNumber: number, scenes: StoryScene[]): StoryScene {
  return {
    ...blankScene(blockNumber, scenes.length + 1, 0),
    id: makeId(`block-${String(blockNumber).padStart(2, "0")}-scene`),
  };
}

export function addDynamicScene(scenes: StoryScene[], blockNumber: number, afterSceneId?: string): StoryScene[] {
  const next = scenes.map((scene) => ({ ...scene, miniBlocks: [...scene.miniBlocks] }));
  const created = newDynamicScene(blockNumber, next);
  const donor = [...next].sort((left, right) => right.miniBlocks.length - left.miniBlocks.length)[0];
  if (donor?.miniBlocks.length > 1) {
    const moved = donor.miniBlocks.pop();
    if (moved) created.miniBlocks = [moved];
  }
  const currentIndex = afterSceneId ? next.findIndex((scene) => scene.id === afterSceneId) : next.length - 1;
  next.splice(Math.max(0, currentIndex + 1), 0, created);
  return refreshSceneDurations(next);
}

export function duplicateDynamicScene(scenes: StoryScene[], sceneId: string, blockNumber: number): StoryScene[] {
  const source = scenes.find((scene) => scene.id === sceneId);
  if (!source) return scenes;
  const added = addDynamicScene(scenes, blockNumber, sceneId);
  const copyIndex = added.findIndex((scene) => scene.id !== sceneId && scene.number === source.number + 1);
  if (copyIndex < 0) return added;
  const assignedMinis = added[copyIndex].miniBlocks;
  added[copyIndex] = {
    ...source,
    id: added[copyIndex].id,
    number: added[copyIndex].number,
    title: `${source.title} — Copy`,
    miniBlocks: assignedMinis,
    estimatedSeconds: assignedMinis.reduce((sum, mini) => sum + mini.estimatedSeconds, 0),
    pageEstimate: assignedMinis.reduce((sum, mini) => sum + mini.estimatedSeconds, 0) / 60,
  };
  return refreshSceneDurations(added);
}

export function removeDynamicScene(scenes: StoryScene[], sceneId: string): StoryScene[] {
  if (scenes.length <= 1) return scenes;
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return scenes;
  const next = scenes.map((scene) => ({ ...scene, miniBlocks: [...scene.miniBlocks] }));
  const [removed] = next.splice(index, 1);
  const recipientIndex = Math.max(0, Math.min(index - 1, next.length - 1));
  next[recipientIndex] = {
    ...next[recipientIndex],
    miniBlocks: [...next[recipientIndex].miniBlocks, ...removed.miniBlocks].sort((left, right) => left.number - right.number),
  };
  return refreshSceneDurations(next);
}

export function moveDynamicScene(scenes: StoryScene[], sceneId: string, direction: "up" | "down"): StoryScene[] {
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= scenes.length) return scenes;
  const next = [...scenes];
  [next[index], next[target]] = [next[target], next[index]];
  return renumberScenes(next);
}

export function assignMiniBlockToScene(scenes: StoryScene[], miniBlockId: string, targetSceneId: string): StoryScene[] {
  const target = scenes.find((scene) => scene.id === targetSceneId);
  if (!target || target.miniBlocks.length >= 4 || target.miniBlocks.some((mini) => mini.id === miniBlockId)) return scenes;
  let moved: MiniBlock | undefined;
  const next = scenes.map((scene) => ({
    ...scene,
    miniBlocks: scene.miniBlocks.filter((mini) => {
      if (mini.id !== miniBlockId) return true;
      moved = mini;
      return false;
    }),
  }));
  if (!moved) return scenes;
  return refreshSceneDurations(next.map((scene) => scene.id === targetSceneId
    ? { ...scene, miniBlocks: [...scene.miniBlocks, moved as MiniBlock].sort((left, right) => left.number - right.number) }
    : scene));
}

export function moveSceneBetweenBlocks<T extends { number: number; scenes: StoryScene[] }>(
  blocks: T[],
  sceneId: string,
  targetBlockNumber: number,
  afterSceneId?: string,
): T[] {
  const sourceIndex = blocks.findIndex((block) => block.scenes.some((scene) => scene.id === sceneId));
  const targetIndex = blocks.findIndex((block) => block.number === targetBlockNumber);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex || blocks[sourceIndex].scenes.length <= 1) return blocks;

  const next = blocks.map((block) => ({ ...block, scenes: block.scenes.map((scene) => ({ ...scene, miniBlocks: [...scene.miniBlocks] })) }));
  const sourceScenes = next[sourceIndex].scenes;
  const movingIndex = sourceScenes.findIndex((scene) => scene.id === sceneId);
  const [moving] = sourceScenes.splice(movingIndex, 1);
  const sourceRecipient = Math.max(0, Math.min(movingIndex - 1, sourceScenes.length - 1));
  sourceScenes[sourceRecipient].miniBlocks = [...sourceScenes[sourceRecipient].miniBlocks, ...moving.miniBlocks].sort((left, right) => left.number - right.number);
  next[sourceIndex].scenes = refreshSceneDurations(sourceScenes);

  const targetScenes = next[targetIndex].scenes;
  const donor = [...targetScenes].sort((left, right) => right.miniBlocks.length - left.miniBlocks.length)[0];
  const movedScene: StoryScene = { ...moving, miniBlocks: [], estimatedSeconds: 0, pageEstimate: 0 };
  if (donor?.miniBlocks.length > 1) {
    const donorIndex = targetScenes.findIndex((scene) => scene.id === donor.id);
    const borrowed = targetScenes[donorIndex].miniBlocks.pop();
    if (borrowed) movedScene.miniBlocks = [borrowed];
  }
  const insertionIndex = afterSceneId ? targetScenes.findIndex((scene) => scene.id === afterSceneId) + 1 : targetScenes.length;
  targetScenes.splice(Math.max(0, insertionIndex), 0, movedScene);
  next[targetIndex].scenes = refreshSceneDurations(targetScenes);
  return next as T[];
}

export function addShortSceneToMini(mini: MiniBlock): MiniBlock {
  return { ...mini, shortScenes: [...mini.shortScenes, createShortScene(mini.shortScenes.length + 1)] };
}

export function updateShortSceneInMini(mini: MiniBlock, shortSceneId: string, patch: Partial<ShortScene>): MiniBlock {
  return {
    ...mini,
    shortScenes: mini.shortScenes.map((scene) => scene.id === shortSceneId
      ? {
          ...scene,
          ...patch,
          sceneType: patch.sceneType ? safeSceneType(patch.sceneType) : scene.sceneType,
          charactersEntering: patch.charactersEntering ? strings(patch.charactersEntering) : scene.charactersEntering,
          charactersLeaving: patch.charactersLeaving ? strings(patch.charactersLeaving) : scene.charactersLeaving,
          estimatedSeconds: patch.estimatedSeconds === undefined ? scene.estimatedSeconds : Math.max(0, Number(patch.estimatedSeconds) || 0),
          pageEstimate: patch.pageEstimate === undefined ? scene.pageEstimate : Math.max(0, Number(patch.pageEstimate) || 0),
        }
      : scene),
  };
}

export function removeShortSceneFromMini(mini: MiniBlock, shortSceneId: string): MiniBlock {
  return { ...mini, shortScenes: mini.shortScenes.filter((scene) => scene.id !== shortSceneId) };
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
      scenes: refreshSceneDurations(block.scenes.map((scene) => ({
        ...scene,
        miniBlocks: scene.miniBlocks.map((mini) => ({ ...mini, estimatedSeconds: blockSeconds / 4 })),
      }))),
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

function shortSceneDurations(mini: MiniBlock) {
  if (mini.shortScenes.length === 0) return [];
  const explicit = mini.shortScenes.reduce((sum, scene) => sum + Math.max(0, scene.estimatedSeconds), 0);
  if (explicit <= 0) return mini.shortScenes.map(() => mini.estimatedSeconds / mini.shortScenes.length);
  const scale = mini.estimatedSeconds / explicit;
  return mini.shortScenes.map((scene) => scene.estimatedSeconds * scale);
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
          let shortCursor = miniStart;
          shortSceneDurations(mini).forEach((duration, index) => {
            const shortScene = mini.shortScenes[index];
            rows.push({
              level: "short-scene",
              id: shortScene.id,
              label: `B${block.number}.${mini.number} · ${shortScene.title}`,
              startSeconds: shortCursor,
              endSeconds: shortCursor + duration,
              durationSeconds: duration,
              beats: 0,
              shots: 0,
            });
            shortCursor += duration;
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
