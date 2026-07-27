import type {
  PlotPickleProject,
  ReviewComment,
  ReviewThread,
  StoryBlock,
  VisualFrame,
} from "./project";
import type { MiniBlock, StoryScene } from "./structure";

const FEEDBACK_METADATA_PREFIX = "PLOTPICKLE_FEEDBACK_META ";

type MiniBlockPosition = {
  blockId: string;
  blockNumber: number;
  blockTitle: string;
  sceneId: string;
  sceneNumber: number;
  sceneTitle: string;
  miniBlockNumber: number;
};

type MiniBlockSlot = MiniBlockPosition & {
  miniBlockId: string;
};

function canonicalSlots(project: PlotPickleProject): MiniBlockSlot[] {
  return [...project.blocks]
    .sort((left, right) => left.number - right.number)
    .flatMap((block) => [...block.scenes]
      .sort((left, right) => left.order - right.order || left.number - right.number)
      .flatMap((scene) => [...scene.miniBlocks]
        .sort((left, right) => left.number - right.number)
        .map((miniBlock) => ({
          blockId: block.id,
          blockNumber: block.number,
          blockTitle: block.title,
          sceneId: scene.id,
          sceneNumber: scene.number,
          sceneTitle: scene.title,
          miniBlockNumber: miniBlock.number,
          miniBlockId: miniBlock.id,
        }))));
}

function sameOrder(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function positionKey(blockNumber: number, miniBlockNumber: number) {
  return `${blockNumber}:${miniBlockNumber}`;
}

function miniBlockAtPosition(
  slots: MiniBlockSlot[],
  blockNumber: number,
  miniBlockNumber: number,
  sceneId = "",
) {
  return slots.find((slot) => (
    slot.blockNumber === blockNumber
    && slot.miniBlockNumber === miniBlockNumber
    && (!sceneId || slot.sceneId === sceneId)
  )) ?? slots.find((slot) => (
    slot.blockNumber === blockNumber
    && slot.miniBlockNumber === miniBlockNumber
  ));
}

function feedbackCommentAtPosition(
  comment: ReviewComment,
  newPositionById: Map<string, MiniBlockPosition>,
  miniBlockById: Map<string, MiniBlock>,
) {
  if (!comment.body.startsWith(FEEDBACK_METADATA_PREFIX)) return comment;
  try {
    const metadata = JSON.parse(comment.body.slice(FEEDBACK_METADATA_PREFIX.length)) as {
      target?: {
        kind?: string;
        targetId?: string;
        miniBlockId?: string;
        blockId?: string;
        sceneId?: string;
        characterId?: string;
        label?: string;
      };
    };
    const target = metadata.target;
    const miniBlockId = target?.miniBlockId || (target?.kind === "mini-block" ? target.targetId : "");
    const position = miniBlockId ? newPositionById.get(miniBlockId) : undefined;
    const miniBlock = miniBlockId ? miniBlockById.get(miniBlockId) : undefined;
    if (!target || !position || !miniBlock) return comment;
    const next = {
      ...metadata,
      target: {
        ...target,
        blockId: position.blockId,
        sceneId: position.sceneId,
        characterId: miniBlock.characterId,
        label: `Block ${position.blockNumber} · ${miniBlock.label || `Mini-block ${position.miniBlockNumber}`}`,
      },
    };
    return { ...comment, body: `${FEEDBACK_METADATA_PREFIX}${JSON.stringify(next)}` };
  } catch {
    return comment;
  }
}

function feedbackThreadAtPosition(
  thread: ReviewThread,
  newPositionById: Map<string, MiniBlockPosition>,
  miniBlockById: Map<string, MiniBlock>,
  now: string,
) {
  const position = newPositionById.get(thread.anchor.targetId);
  const miniBlock = miniBlockById.get(thread.anchor.targetId);
  const comments = thread.comments.map((comment) => feedbackCommentAtPosition(comment, newPositionById, miniBlockById));
  const commentsChanged = comments.some((comment, index) => comment !== thread.comments[index]);
  if (!position && !commentsChanged) return thread;
  return {
    ...thread,
    anchor: position && miniBlock
      ? {
          ...thread.anchor,
          label: `Block ${position.blockNumber} · ${miniBlock.label || `Mini-block ${position.miniBlockNumber}`}`,
        }
      : thread.anchor,
    comments,
    updatedAt: now,
  };
}

export function canonicalMiniBlockOrder(project: PlotPickleProject) {
  return canonicalSlots(project).map((slot) => slot.miniBlockId);
}

export function applyCanonicalMiniBlockOrder(
  project: PlotPickleProject,
  orderedMiniBlockIds: string[],
): PlotPickleProject {
  const slots = canonicalSlots(project);
  const currentOrder = slots.map((slot) => slot.miniBlockId);
  if (orderedMiniBlockIds.length !== currentOrder.length) return project;
  if (new Set(orderedMiniBlockIds).size !== currentOrder.length) return project;
  if (currentOrder.some((id) => !orderedMiniBlockIds.includes(id))) return project;
  if (sameOrder(currentOrder, orderedMiniBlockIds)) return project;

  const miniBlockById = new Map<string, MiniBlock>();
  project.blocks.forEach((block) => block.scenes.forEach((scene) => {
    scene.miniBlocks.forEach((miniBlock) => miniBlockById.set(miniBlock.id, miniBlock));
  }));
  if (orderedMiniBlockIds.some((id) => !miniBlockById.has(id))) return project;

  const newPositionById = new Map<string, MiniBlockPosition>();
  orderedMiniBlockIds.forEach((miniBlockId, index) => {
    const slot = slots[index];
    newPositionById.set(miniBlockId, {
      blockId: slot.blockId,
      blockNumber: slot.blockNumber,
      blockTitle: slot.blockTitle,
      sceneId: slot.sceneId,
      sceneNumber: slot.sceneNumber,
      sceneTitle: slot.sceneTitle,
      miniBlockNumber: slot.miniBlockNumber,
    });
  });

  const assignedByScene = new Map<string, MiniBlock[]>();
  orderedMiniBlockIds.forEach((miniBlockId, index) => {
    const slot = slots[index];
    const miniBlock = miniBlockById.get(miniBlockId);
    if (!miniBlock) return;
    const assigned = { ...miniBlock, id: miniBlock.id, number: slot.miniBlockNumber };
    assignedByScene.set(slot.sceneId, [...(assignedByScene.get(slot.sceneId) ?? []), assigned]);
  });

  const frameOwnerById = new Map<string, string>();
  project.blocks.forEach((block) => block.visuals.forEach((frame) => {
    const owner = miniBlockAtPosition(slots, block.number, frame.miniBlockNumber);
    if (owner) frameOwnerById.set(frame.id, owner.miniBlockId);
  }));
  const visualsByBlock = new Map<string, VisualFrame[]>();
  project.blocks.forEach((block) => block.visuals.forEach((frame) => {
    const ownerId = frameOwnerById.get(frame.id);
    const nextPosition = ownerId ? newPositionById.get(ownerId) : undefined;
    const targetBlockId = nextPosition?.blockId ?? block.id;
    const nextFrame = nextPosition && nextPosition.miniBlockNumber !== frame.miniBlockNumber
      ? { ...frame, miniBlockNumber: nextPosition.miniBlockNumber }
      : frame;
    visualsByBlock.set(targetBlockId, [...(visualsByBlock.get(targetBlockId) ?? []), nextFrame]);
  }));

  const now = new Date().toISOString();
  const blocks: StoryBlock[] = project.blocks.map((block) => ({
    ...block,
    scenes: block.scenes.map((scene): StoryScene => ({
      ...scene,
      miniBlocks: assignedByScene.get(scene.id) ?? [],
    })),
    visuals: (visualsByBlock.get(block.id) ?? [])
      .sort((left, right) => left.miniBlockNumber - right.miniBlockNumber || left.id.localeCompare(right.id)),
  }));

  const screenplayOwnerById = new Map(project.screenplay.draftElements.flatMap((element) => {
    const owner = miniBlockAtPosition(slots, element.blockNumber, element.miniBlockNumber, element.sceneId);
    return owner ? [[element.id, owner.miniBlockId] as const] : [];
  }));
  const shotOwnerById = new Map(project.production.shots.flatMap((shot) => {
    const owner = miniBlockAtPosition(slots, shot.blockNumber, shot.miniBlockNumber, shot.sceneId);
    return owner ? [[shot.id, owner.miniBlockId] as const] : [];
  }));

  const screenplay = {
    ...project.screenplay,
    draftElements: project.screenplay.draftElements.map((element) => {
      const ownerId = screenplayOwnerById.get(element.id);
      const position = ownerId ? newPositionById.get(ownerId) : undefined;
      if (!position) return element;
      const changed = element.blockNumber !== position.blockNumber
        || element.miniBlockNumber !== position.miniBlockNumber
        || element.sceneId !== position.sceneId
        || element.sceneNumber !== position.sceneNumber;
      return changed ? {
        ...element,
        blockNumber: position.blockNumber,
        miniBlockNumber: position.miniBlockNumber,
        sceneId: position.sceneId,
        sceneNumber: position.sceneNumber,
        updatedAt: now,
      } : element;
    }),
  };

  const production = {
    ...project.production,
    shots: project.production.shots.map((shot) => {
      const ownerId = shotOwnerById.get(shot.id);
      const position = ownerId ? newPositionById.get(ownerId) : undefined;
      if (!position) return shot;
      const changed = shot.blockNumber !== position.blockNumber
        || shot.miniBlockNumber !== position.miniBlockNumber
        || shot.sceneId !== position.sceneId;
      return changed ? {
        ...shot,
        blockNumber: position.blockNumber,
        miniBlockNumber: position.miniBlockNumber,
        sceneId: position.sceneId,
        updatedAt: now,
      } : shot;
    }),
  };

  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    blocks,
    screenplay,
    production,
    review: {
      ...project.review,
      threads: project.review.threads.map((thread) => feedbackThreadAtPosition(thread, newPositionById, miniBlockById, now)),
    },
  };
}

export function moveCanonicalMiniBlock(
  project: PlotPickleProject,
  miniBlockId: string,
  targetMiniBlockId: string,
) {
  const order = canonicalMiniBlockOrder(project);
  const sourceIndex = order.indexOf(miniBlockId);
  const targetIndex = order.indexOf(targetMiniBlockId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return project;
  const nextOrder = [...order];
  const [movedId] = nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, movedId);
  return applyCanonicalMiniBlockOrder(project, nextOrder);
}

export function miniBlockReferenceAudit(project: PlotPickleProject) {
  const slots = canonicalSlots(project);
  const miniBlockIds = new Set(slots.map((slot) => slot.miniBlockId));
  const sceneIds = new Set(project.blocks.flatMap((block) => block.scenes.map((scene) => scene.id)));
  const frameIds = new Set(project.blocks.flatMap((block) => block.visuals.map((frame) => frame.id)));
  const screenplayIds = new Set(project.screenplay.draftElements.map((element) => element.id));
  const shotIds = new Set(project.production.shots.map((shot) => shot.id));
  const positionalKeys = new Set(slots.map((slot) => positionKey(slot.blockNumber, slot.miniBlockNumber)));
  return {
    miniBlockIds,
    danglingStoryThreadSceneIds: project.storyThreads.flatMap((thread) => thread.sceneIds).filter((id) => !sceneIds.has(id)),
    danglingCharacterArcSceneIds: project.characters.flatMap((character) => character.arcMatrix.checkpoints.map((checkpoint) => checkpoint.sceneId)).filter((id) => id && !sceneIds.has(id)),
    danglingFrameIds: [...frameIds].filter((id) => !id),
    danglingScreenplayIds: [...screenplayIds].filter((id) => !id),
    danglingShotIds: [...shotIds].filter((id) => !id),
    unrepresentedMiniBlockIds: slots.filter((slot) => !positionalKeys.has(positionKey(slot.blockNumber, slot.miniBlockNumber))).map((slot) => slot.miniBlockId),
    previousPositions: oldPositionByIdForAudit(slots),
  };
}

function oldPositionByIdForAudit(slots: MiniBlockSlot[]) {
  return Object.fromEntries(slots.map((slot) => [slot.miniBlockId, {
    blockId: slot.blockId,
    sceneId: slot.sceneId,
    miniBlockNumber: slot.miniBlockNumber,
  }]));
}
