import type {
  PlotPickleProject,
  ScreenplayDraftElement,
  StoryBlock,
} from "./project";
import type { StoryScene } from "./structure";

export type SceneIndexEntry = {
  sceneId: string;
  globalNumber: number;
  blockNumber: number;
  localNumber: number;
  title: string;
  sceneType: StoryScene["sceneType"];
  miniBlockNumbers: number[];
  estimatedSeconds: number;
  pageEstimate: number;
};

export type SceneContinuityWarning = {
  sceneId: string;
  globalNumber: number;
  kind: "unmarked-entrance" | "unresolved-departure" | "invalid-entrance" | "invalid-departure";
  characterId: string;
  message: string;
};

export type SceneStructureDiagnostics = {
  totalScenes: number;
  targetRange: "below" | "within" | "above";
  unassignedSceneIds: string[];
  overcrowdedSceneIds: string[];
  blocksWithMiniBlockErrors: number[];
  continuityWarnings: SceneContinuityWarning[];
  totalPages: number;
  totalSeconds: number;
};

function byBlockNumber(left: StoryBlock, right: StoryBlock) {
  return left.number - right.number;
}

export function buildGlobalSceneIndex(blocks: StoryBlock[]): SceneIndexEntry[] {
  let globalNumber = 0;
  return [...blocks]
    .sort(byBlockNumber)
    .flatMap((block) => block.scenes.map((scene, localIndex) => {
      globalNumber += 1;
      return {
        sceneId: scene.id,
        globalNumber,
        blockNumber: block.number,
        localNumber: localIndex + 1,
        title: scene.title,
        sceneType: scene.sceneType,
        miniBlockNumbers: scene.miniBlocks.map((mini) => mini.number).sort((left, right) => left - right),
        estimatedSeconds: Math.max(0, Number(scene.estimatedSeconds) || 0),
        pageEstimate: Math.max(0, Number(scene.pageEstimate) || 0),
      };
    }));
}

export function sceneIndexEntryFor(
  blocks: StoryBlock[],
  sceneId: string | undefined,
  fallbackSceneNumber?: number,
): SceneIndexEntry | undefined {
  const index = buildGlobalSceneIndex(blocks);
  return index.find((entry) => entry.sceneId === sceneId)
    ?? index.find((entry) => entry.globalNumber === fallbackSceneNumber);
}

function closestScene(index: SceneIndexEntry[], blockNumber: number, globalNumber: number) {
  const sameBlock = index.filter((entry) => entry.blockNumber === blockNumber);
  const candidates = sameBlock.length ? sameBlock : index;
  return [...candidates].sort((left, right) => (
    Math.abs(left.globalNumber - globalNumber) - Math.abs(right.globalNumber - globalNumber)
  ))[0];
}

function sourceSceneForElement(element: ScreenplayDraftElement, previousIndex: SceneIndexEntry[]) {
  return previousIndex.find((entry) => entry.sceneId === element.sceneId)
    ?? previousIndex.find((entry) => entry.globalNumber === element.sceneNumber)
    ?? previousIndex.find((entry) => (
      entry.blockNumber === element.blockNumber
      && entry.miniBlockNumbers.includes(element.miniBlockNumber)
    ))
    ?? previousIndex.find((entry) => entry.blockNumber === element.blockNumber);
}

function synchronizeElement(
  element: ScreenplayDraftElement,
  previousIndex: SceneIndexEntry[],
  currentIndex: SceneIndexEntry[],
  now: string,
): ScreenplayDraftElement {
  const sourceScene = sourceSceneForElement(element, previousIndex);
  const targetScene = currentIndex.find((entry) => entry.sceneId === sourceScene?.sceneId)
    ?? closestScene(
      currentIndex,
      sourceScene?.blockNumber ?? element.blockNumber,
      sourceScene?.globalNumber ?? element.sceneNumber,
    );

  if (!targetScene) return element;

  const miniBlockNumber = targetScene.miniBlockNumbers.includes(element.miniBlockNumber)
    ? element.miniBlockNumber
    : targetScene.miniBlockNumbers[0] ?? Math.min(4, Math.max(1, element.miniBlockNumber));

  const changed = element.sceneId !== targetScene.sceneId
    || element.sceneNumber !== targetScene.globalNumber
    || element.blockNumber !== targetScene.blockNumber
    || element.miniBlockNumber !== miniBlockNumber;

  return {
    ...element,
    sceneId: targetScene.sceneId,
    sceneNumber: targetScene.globalNumber,
    blockNumber: targetScene.blockNumber,
    miniBlockNumber,
    updatedAt: changed ? now : element.updatedAt,
  };
}

export function synchronizeScreenplaySceneReferences(
  project: PlotPickleProject,
  previousBlocks: StoryBlock[] = project.blocks,
): PlotPickleProject {
  const previousIndex = buildGlobalSceneIndex(previousBlocks);
  const currentIndex = buildGlobalSceneIndex(project.blocks);
  const now = new Date().toISOString();
  return {
    ...project,
    screenplay: {
      ...project.screenplay,
      draftElements: project.screenplay.draftElements.map((element) => (
        synchronizeElement(element, previousIndex, currentIndex, now)
      )),
    },
  };
}

export function assignDraftElementToScene(
  element: ScreenplayDraftElement,
  entry: SceneIndexEntry,
): ScreenplayDraftElement {
  return {
    ...element,
    sceneId: entry.sceneId,
    sceneNumber: entry.globalNumber,
    blockNumber: entry.blockNumber,
    miniBlockNumber: entry.miniBlockNumbers[0] ?? Math.min(4, Math.max(1, element.miniBlockNumber)),
    updatedAt: new Date().toISOString(),
  };
}

function continuityWarnings(project: PlotPickleProject, index: SceneIndexEntry[]) {
  const scenesById = new Map(project.blocks.flatMap((block) => block.scenes).map((scene) => [scene.id, scene]));
  const warnings: SceneContinuityWarning[] = [];

  index.forEach((entry, position) => {
    const scene = scenesById.get(entry.sceneId);
    if (!scene) return;

    scene.charactersEntering.forEach((characterId) => {
      if (scene.characterIds.includes(characterId)) return;
      warnings.push({
        sceneId: entry.sceneId,
        globalNumber: entry.globalNumber,
        kind: "invalid-entrance",
        characterId,
        message: `Scene ${entry.globalNumber} marks a character entering without including them in the scene cast.`,
      });
    });

    scene.charactersLeaving.forEach((characterId) => {
      if (scene.characterIds.includes(characterId)) return;
      warnings.push({
        sceneId: entry.sceneId,
        globalNumber: entry.globalNumber,
        kind: "invalid-departure",
        characterId,
        message: `Scene ${entry.globalNumber} marks a character leaving who is not in the scene cast.`,
      });
    });

    const previousEntry = index[position - 1];
    const previous = previousEntry ? scenesById.get(previousEntry.sceneId) : undefined;
    if (!previous) return;

    scene.characterIds.forEach((characterId) => {
      const wasPresent = previous.characterIds.includes(characterId) && !previous.charactersLeaving.includes(characterId);
      if (wasPresent || scene.charactersEntering.includes(characterId)) return;
      warnings.push({
        sceneId: entry.sceneId,
        globalNumber: entry.globalNumber,
        kind: "unmarked-entrance",
        characterId,
        message: `Scene ${entry.globalNumber} adds a character without marking an entrance.`,
      });
    });

    previous.charactersLeaving.forEach((characterId) => {
      if (!scene.characterIds.includes(characterId) || scene.charactersEntering.includes(characterId)) return;
      warnings.push({
        sceneId: entry.sceneId,
        globalNumber: entry.globalNumber,
        kind: "unresolved-departure",
        characterId,
        message: `A character leaves Scene ${previousEntry.globalNumber} but remains in Scene ${entry.globalNumber} without re-entering.`,
      });
    });
  });

  return warnings;
}

export function analyzeSceneStructure(project: PlotPickleProject): SceneStructureDiagnostics {
  const index = buildGlobalSceneIndex(project.blocks);
  const totalScenes = index.length;
  const blocksWithMiniBlockErrors = project.blocks.flatMap((block) => {
    const miniNumbers = block.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => mini.number));
    const unique = new Set(miniNumbers);
    const valid = miniNumbers.length === 4
      && unique.size === 4
      && [1, 2, 3, 4].every((number) => unique.has(number));
    return valid ? [] : [block.number];
  });

  return {
    totalScenes,
    targetRange: totalScenes < 40 ? "below" : totalScenes > 60 ? "above" : "within",
    unassignedSceneIds: index.filter((entry) => entry.miniBlockNumbers.length === 0).map((entry) => entry.sceneId),
    overcrowdedSceneIds: index.filter((entry) => entry.miniBlockNumbers.length > 4).map((entry) => entry.sceneId),
    blocksWithMiniBlockErrors,
    continuityWarnings: continuityWarnings(project, index),
    totalPages: index.reduce((sum, entry) => sum + entry.pageEstimate, 0),
    totalSeconds: index.reduce((sum, entry) => sum + entry.estimatedSeconds, 0),
  };
}
