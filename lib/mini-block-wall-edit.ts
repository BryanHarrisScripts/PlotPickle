import type { PlotPickleProject } from "./project";
import type { MiniBlock } from "./structure";

export type MiniBlockWallPatch = Partial<Pick<MiniBlock,
  | "label"
  | "function"
  | "purpose"
  | "characterId"
  | "objective"
  | "resistance"
  | "action"
  | "revelation"
  | "turn"
  | "visualBeat"
  | "dialogueIntention"
  | "entryState"
  | "exitState"
  | "setup"
  | "payoff"
  | "notes"
>>;

export function findCanonicalMiniBlock(project: PlotPickleProject, miniBlockId: string) {
  for (const block of project.blocks) {
    for (const scene of block.scenes) {
      const miniBlock = scene.miniBlocks.find((mini) => mini.id === miniBlockId);
      if (miniBlock) return { block, scene, miniBlock };
    }
  }
  return null;
}

export function updateCanonicalMiniBlock(
  project: PlotPickleProject,
  miniBlockId: string,
  patch: MiniBlockWallPatch,
): PlotPickleProject {
  let changed = false;
  const blocks = project.blocks.map((block) => ({
    ...block,
    scenes: block.scenes.map((scene) => ({
      ...scene,
      miniBlocks: scene.miniBlocks.map((mini) => {
        if (mini.id !== miniBlockId) return mini;
        changed = true;
        return {
          ...mini,
          ...patch,
          id: mini.id,
          number: mini.number,
        };
      }),
    })),
  }));

  if (!changed) return project;
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
    blocks,
  };
}
