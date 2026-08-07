import type { Character, ConceptCanvasTargetKind, Location, PlotPickleProject, StoryBlock, VisualReference } from "./project";
import type { MiniBlock, StoryScene } from "./structure";
import { continuityWarnings, effectiveContinuityLocks, type EffectiveContinuityLock } from "./continuity-locks";

export type VisualContextSourceKind = "project" | "story" | "world" | "character" | "location" | "block" | "scene" | "mini-block" | "reference" | "concept" | "continuity";

export type VisualContextSource = { kind: VisualContextSourceKind; id: string; label: string };
export type VisualStoryContextTarget = { kind: ConceptCanvasTargetKind; id: string; label: string };

export type VisualStoryContextReference = {
  id: string;
  title: string;
  purpose: VisualReference["purpose"];
  rightsStatus: VisualReference["rightsStatus"];
  permittedUse: string;
  attribution: string;
  sourceLabel: string;
  target: VisualStoryContextTarget;
  notes: string;
};

export type VisualStoryContextPackage = {
  version: 1;
  target: VisualStoryContextTarget;
  project: { title: string; format: string; genre: string; tone: string; audience: string; visualVision: string };
  story: { premise: string; logline: string; theme: string; dramaticQuestion: string; stakes: string; ending: string };
  world: { ordinaryWorld: string; newWorld: string; period: string; rules: string; technology: string; visualLanguage: string };
  concept: { text: string; emotionalPurpose: string; audienceExperience: string; desiredVisualImpact: string; mustKeepConstraints: string; openExploration: string };
  block?: { id: string; number: number; title: string; purpose: string; summary: string; goal: string; conflict: string; choice: string; action: string; consequence: string; emotionalTurn: string; storyboardDirection: string };
  scene?: { id: string; number: number; title: string; purpose: string; objective: string; opposition: string; conflict: string; action: string; turn: string; resolution: string; outcome: string };
  miniBlock?: { id: string; number: number; label: string; purpose: string; objective: string; resistance: string; action: string; revelation: string; turn: string; visualBeat: string; dialogueIntention: string };
  characters: Array<Pick<Character, "id" | "name" | "role" | "description" | "want" | "need" | "arc" | "voice">>;
  locations: Array<Pick<Location, "id" | "name" | "description">>;
  references: VisualStoryContextReference[];
  continuity: string[];
  continuityLocks: EffectiveContinuityLock[];
  continuityWarnings: string[];
  sources: VisualContextSource[];
  privacy: { credentialsIncluded: false; providerConfigurationIncluded: false; privateLocalPathsIncluded: false };
};

const targetPrecedence: Record<ConceptCanvasTargetKind, number> = {
  project: 0,
  block: 1,
  scene: 2,
  "mini-block": 3,
  character: 4,
  location: 4,
};

function filled(value: string) { return value.trim().length > 0; }
function textList(values: string[]) { return values.map((value) => value.trim()).filter(Boolean); }
function source(kind: VisualContextSourceKind, id: string, label: string): VisualContextSource { return { kind, id, label }; }
function target(kind: ConceptCanvasTargetKind, id: string, label: string): VisualStoryContextTarget { return { kind, id: id || "project", label: label || "Whole project" }; }

function findBlock(project: PlotPickleProject, contextTarget: VisualStoryContextTarget) {
  if (contextTarget.kind === "block") return project.blocks.find((block) => block.id === contextTarget.id);
  if (contextTarget.kind === "scene") return project.blocks.find((block) => block.scenes.some((scene) => scene.id === contextTarget.id));
  if (contextTarget.kind === "mini-block") return project.blocks.find((block) => block.scenes.some((scene) => scene.miniBlocks.some((mini) => mini.id === contextTarget.id)));
  return undefined;
}

function findScene(block: StoryBlock | undefined, contextTarget: VisualStoryContextTarget) {
  if (!block) return undefined;
  if (contextTarget.kind === "scene") return block.scenes.find((scene) => scene.id === contextTarget.id);
  if (contextTarget.kind === "mini-block") return block.scenes.find((scene) => scene.miniBlocks.some((mini) => mini.id === contextTarget.id));
  return undefined;
}

function findMiniBlock(scene: StoryScene | undefined, contextTarget: VisualStoryContextTarget) {
  if (!scene || contextTarget.kind !== "mini-block") return undefined;
  return scene.miniBlocks.find((mini) => mini.id === contextTarget.id);
}

function characterIds(block?: StoryBlock, scene?: StoryScene, mini?: MiniBlock, explicitId?: string) {
  return [...new Set([explicitId, ...(block?.characterIds ?? []), ...(scene?.characterIds ?? []), mini?.characterId].filter((id): id is string => Boolean(id)))];
}

function locationIds(block?: StoryBlock, scene?: StoryScene, explicitId?: string) {
  return [...new Set([explicitId, ...(block?.locationIds ?? []), ...(scene?.locationIds ?? [])].filter((id): id is string => Boolean(id)))];
}

function referenceApplies(reference: VisualReference, contextTarget: VisualStoryContextTarget, block?: StoryBlock, scene?: StoryScene, mini?: MiniBlock) {
  if (reference.targetKind === "project") return true;
  if (reference.targetKind === contextTarget.kind && reference.targetId === contextTarget.id) return true;
  if (reference.targetKind === "block" && block?.id === reference.targetId) return true;
  if (reference.targetKind === "scene" && scene?.id === reference.targetId) return true;
  if (reference.targetKind === "mini-block" && mini?.id === reference.targetId) return true;
  return false;
}

function referenceSourceLabel(reference: VisualReference) {
  if (filled(reference.importFileName)) return reference.importFileName;
  if (filled(reference.sourceUrl)) return reference.sourceUrl;
  return "No external source stored";
}

function contextLabelForProject(project: PlotPickleProject, contextTarget: VisualStoryContextTarget) {
  if (contextTarget.kind === "character") return project.characters.find((character) => character.id === contextTarget.id)?.name || contextTarget.label;
  if (contextTarget.kind === "location") return project.world.locations.find((location) => location.id === contextTarget.id)?.name || contextTarget.label;
  return contextTarget.label;
}

export function assembleVisualStoryContext(project: PlotPickleProject, requestedTarget?: Partial<VisualStoryContextTarget>): VisualStoryContextPackage {
  const canvas = project.development.conceptCanvas;
  const contextTarget = target(requestedTarget?.kind ?? canvas.targetKind, requestedTarget?.id ?? canvas.targetId, requestedTarget?.label ?? canvas.targetLabel);
  const resolvedTarget = { ...contextTarget, label: contextLabelForProject(project, contextTarget) };
  const block = findBlock(project, resolvedTarget);
  const scene = findScene(block, resolvedTarget);
  const miniBlock = findMiniBlock(scene, resolvedTarget);
  const sequenceId = block ? String(block.sequenceNumber) : undefined;
  const lockTarget = { sequenceId, blockId: block?.id, sceneId: scene?.id };
  const continuityLocks = effectiveContinuityLocks(project, lockTarget);
  const warnings = continuityWarnings(project, lockTarget);

  const characters = characterIds(block, scene, miniBlock, resolvedTarget.kind === "character" ? resolvedTarget.id : undefined)
    .map((id) => project.characters.find((character) => character.id === id))
    .filter((character): character is Character => Boolean(character))
    .map(({ id, name, role, description, want, need, arc, voice }) => ({ id, name, role, description, want, need, arc, voice }));

  const locations = locationIds(block, scene, resolvedTarget.kind === "location" ? resolvedTarget.id : undefined)
    .map((id) => project.world.locations.find((location) => location.id === id))
    .filter((location): location is Location => Boolean(location))
    .map(({ id, name, description }) => ({ id, name, description }));

  const references = project.development.visualReferences
    .filter((reference) => referenceApplies(reference, resolvedTarget, block, scene, miniBlock))
    .sort((left, right) => targetPrecedence[right.targetKind] - targetPrecedence[left.targetKind] || left.id.localeCompare(right.id))
    .map((reference) => ({
      id: reference.id,
      title: reference.title,
      purpose: reference.purpose,
      rightsStatus: reference.rightsStatus,
      permittedUse: reference.permittedUse,
      attribution: reference.attribution,
      sourceLabel: referenceSourceLabel(reference),
      target: target(reference.targetKind, reference.targetId, reference.targetLabel),
      notes: reference.notes,
    }));

  const sources = [
    source("project", project.id, project.metadata.title || "Untitled project"),
    source("story", "story", "Story foundation"),
    source("world", "world", "World bible"),
    source("concept", "concept-canvas", "Concept Canvas"),
    block ? source("block", block.id, `Block ${block.number}: ${block.title}`) : undefined,
    scene ? source("scene", scene.id, `Scene ${scene.number}: ${scene.title}`) : undefined,
    miniBlock ? source("mini-block", miniBlock.id, `Mini-block ${miniBlock.number}: ${miniBlock.label}`) : undefined,
    ...characters.map((character) => source("character", character.id, character.name || "Unnamed character")),
    ...locations.map((location) => source("location", location.id, location.name || "Unnamed location")),
    ...references.map((reference) => source("reference", reference.id, reference.title || reference.sourceLabel)),
    ...continuityLocks.map((lock) => source("continuity", lock.id, `${lock.kind}: ${lock.effectiveValue}`)),
  ].filter((item): item is VisualContextSource => Boolean(item));

  return {
    version: 1,
    target: resolvedTarget,
    project: { title: project.metadata.title, format: project.metadata.format, genre: project.metadata.genre, tone: project.metadata.tone, audience: project.development.storySetup.audience, visualVision: project.development.pitch.visualVision },
    story: { premise: project.story.premise, logline: project.story.logline, theme: project.story.theme, dramaticQuestion: project.story.dramaticQuestion, stakes: project.story.stakes, ending: project.story.ending },
    world: { ordinaryWorld: project.world.ordinaryWorld, newWorld: project.world.newWorld, period: project.world.period, rules: project.world.rules, technology: project.world.technology, visualLanguage: project.world.visualLanguage },
    concept: { text: canvas.conceptText, emotionalPurpose: canvas.emotionalPurpose, audienceExperience: canvas.audienceExperience, desiredVisualImpact: canvas.desiredVisualImpact, mustKeepConstraints: canvas.mustKeepConstraints, openExploration: canvas.openExploration },
    block: block ? { id: block.id, number: block.number, title: block.title, purpose: block.purpose, summary: block.summary, goal: block.goal, conflict: block.conflict, choice: block.choice, action: block.action, consequence: block.consequence, emotionalTurn: block.emotionalTurn, storyboardDirection: block.storyboardDirection } : undefined,
    scene: scene ? { id: scene.id, number: scene.number, title: scene.title, purpose: scene.purpose, objective: scene.objective, opposition: scene.opposition, conflict: scene.conflict, action: scene.action, turn: scene.turn, resolution: scene.resolution, outcome: scene.outcome } : undefined,
    miniBlock: miniBlock ? { id: miniBlock.id, number: miniBlock.number, label: miniBlock.label, purpose: miniBlock.purpose, objective: miniBlock.objective, resistance: miniBlock.resistance, action: miniBlock.action, revelation: miniBlock.revelation, turn: miniBlock.turn, visualBeat: miniBlock.visualBeat, dialogueIntention: miniBlock.dialogueIntention } : undefined,
    characters,
    locations,
    references,
    continuity: textList([project.development.notes.continuity, block?.setup ?? "", block?.payoff ?? "", block?.storyboardDirection ?? "", miniBlock?.setup ?? "", miniBlock?.payoff ?? ""]),
    continuityLocks,
    continuityWarnings: warnings,
    sources,
    privacy: { credentialsIncluded: false, providerConfigurationIncluded: false, privateLocalPathsIncluded: false },
  };
}
