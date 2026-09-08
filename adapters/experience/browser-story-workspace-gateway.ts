import { loadFoundationProject } from "../../core/storage/foundation-project-browser";
import {
  hydratedStoryMapContext,
  persistStoryMapContext,
} from "../../core/storage/profile-private-browser";
import type {
  StoryWorkspaceGateway,
  StoryWorkspaceSource,
} from "../../lib/experience/story-workspace-use-case";
import { deriveProgressiveStoryMap } from "../../modules/build/progressive-story-map";

/**
 * Transitional browser adapter for ARCH-01.
 *
 * The deterministic 24/96 projection already exists and is intentionally
 * reused. The Experience layer depends only on StoryWorkspaceGateway; this
 * adapter is the temporary seam to the existing project/persistence owners.
 */
export const browserStoryWorkspaceGateway: StoryWorkspaceGateway = {
  async read(): Promise<StoryWorkspaceSource> {
    const project = loadFoundationProject();
    const map = deriveProgressiveStoryMap(project);
    return {
      projectId: project.id,
      projectTitle: project.title || "Untitled Story",
      revision: project.revision,
      remembered: hydratedStoryMapContext(project.id),
      blocks: map.blocks.map((block) => ({
        id: block.id,
        number: block.number,
        act: block.act,
        sequenceNumber: block.sequenceNumber,
        sequenceTitle: block.sequenceTitle,
        sequencePurpose: block.sequencePurpose,
        state: block.state,
        acceptedMiniBlockCount: block.acceptedMiniBlockCount,
        mappingNote: block.mappingNote,
        miniBlocks: block.miniBlocks.map((mini) => ({
          id: mini.id,
          number: mini.number,
          label: mini.label,
          state: mini.state,
        })),
      })),
    };
  },

  async persistSelection(input) {
    await persistStoryMapContext(input.projectId, {
      blockNumber: input.blockNumber,
      miniBlockNumber: input.miniBlockNumber,
      stage: input.stage,
    });
  },
};
