/**
 * #2977 short film / feature timing: identical 4 / 12 / 24 / 96 structural
 * addresses, but duration derives only from an explicit selected PPF intent.
 *
 * Nominal intervals are reference coordinates, not authored edit timing or
 * created visual media. Never infer a 120-minute runtime for older PPFs.
 */
export function projectRuntimeGrid(project) {
  if (!project || typeof project.id !== "string" || !project.id.trim()) {
    throw new Error("A selected Library PPF is required to inspect runtime.");
  }
  const blocks = project.structure?.blocks;
  if (!Array.isArray(blocks) || blocks.length !== 24
      || blocks.some((block, index) => block?.number !== index + 1
        || !Array.isArray(block.miniBlocks) || block.miniBlocks.length !== 4
        || block.miniBlocks.some((mini, ordinal) => mini?.ordinal !== ordinal + 1))) {
    throw new Error("Runtime projection requires the canonical 24 Blocks and 96 Mini-Blocks.");
  }
  const intent = project.storyIntent;
  if (intent == null) {
    return Object.freeze({
      status: "runtime-unset",
      projectId: project.id,
      revision: project.revision,
      structuralCounts: Object.freeze({ acts: 4, sequences: 12, blocks: 24, miniBlocks: 96 }),
      reason: "The selected PPF has no explicit film format and target runtime. No feature default was inferred.",
    });
  }
  if (!intent || typeof intent !== "object" || Array.isArray(intent)
      || (intent.format !== "Short Film" && intent.format !== "Feature")
      || typeof intent.targetMinutes !== "number"
      || !Number.isInteger(intent.targetMinutes)
      || intent.targetMinutes < 1 || intent.targetMinutes > 240) {
    return Object.freeze({
      status: "runtime-invalid",
      projectId: project.id,
      revision: project.revision,
      structuralCounts: Object.freeze({ acts: 4, sequences: 12, blocks: 24, miniBlocks: 96 }),
      reason: "The selected PPF runtime intent is invalid. A new verified Human format/target choice is required.",
    });
  }

  // Integer whole-minute intent and 24 fps yield exact integer boundaries.
  // Every address remains present even for a one-minute target.
  const fps = 24;
  const totalFrames = intent.targetMinutes * 60 * fps;
  const frameBoundary = (index, count) => Math.floor(index * totalFrames / count);
  const interval = (index, count) => {
    const startFrame = frameBoundary(index, count);
    const endFrame = frameBoundary(index + 1, count);
    return Object.freeze({
      startFrame, endFrame, durationFrames: endFrame - startFrame,
      startSeconds: startFrame / fps,
      endSeconds: endFrame / fps,
      durationSeconds: (endFrame - startFrame) / fps,
    });
  };
  const miniBlocks = Object.freeze(Array.from({ length: 96 }, (_, index) => Object.freeze({
    blockNumber: Math.floor(index / 4) + 1,
    ordinal: index % 4 + 1,
    globalNumber: index + 1,
    ...interval(index, 96),
  })));
  const blocksProjection = Object.freeze(Array.from({ length: 24 }, (_, index) => Object.freeze({
    number: index + 1,
    actNumber: Math.floor(index / 6) + 1,
    sequenceNumber: Math.floor(index / 2) + 1,
    ...interval(index, 24),
  })));
  const shotPlanningSlotSeconds = (totalFrames / fps) / (96 * 25);
  const defaultThreeSecondPresetFits = intent.targetMinutes === 120;

  return Object.freeze({
    status: "runtime-configured",
    projectId: project.id,
    revision: project.revision,
    structuralCounts: Object.freeze({ acts: 4, sequences: 12, blocks: 24, miniBlocks: 96 }),
    format: intent.format,
    targetMinutes: intent.targetMinutes,
    fps,
    totalFrames,
    blocks: blocksProjection,
    miniBlocks,
    shotPlanningSlotsPerMiniBlock: 25,
    shotPlanningSlotSeconds,
    defaultThreeSecondPresetFits,
    requiresTimingReview: !defaultThreeSecondPresetFits,
    // The numeric slot budget never authorizes rendering or inventing scenes.
    mediaGenerated: false,
    canonicalStoryChanged: false,
  });
}
