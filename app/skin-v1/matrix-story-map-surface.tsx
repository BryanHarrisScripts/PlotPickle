"use client";

import { useEffect, useState } from "react";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import type { PreproductionReviewAddress } from "./preproduction-review-surfaces";
import StoryCardFoundationBoard from "./story-card-foundation-board";

export default function MatrixStoryMapSurface({
  address,
  onAddressChange,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onAddressChange?: (address: PreproductionReviewAddress) => void;
}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const activeAct = Math.floor((address.blockNumber - 1) / 6) + 1;

  useEffect(() => {
    const sync = () => setProject(loadFoundationProject());
    sync();
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!project) return <p role="status">Opening Story Map…</p>;
  return (
    <div data-canonical-project-id={project.id} data-skin-v1-story-map-review="true">
      <ProgressiveStoryMap
        key={`${project.id}-act-${activeAct}`}
        project={project}
        act={activeAct}
        initialBlockNumber={address.blockNumber}
        initialMiniBlockNumber={address.miniBlockNumber}
        navigationOnly
        onSelectAddress={onAddressChange}
      />
      <StoryCardFoundationBoard project={project} onProjectChange={setProject} act={activeAct} baselinePresentation />
    </div>
  );
}
