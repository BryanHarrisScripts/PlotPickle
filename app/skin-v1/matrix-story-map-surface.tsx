"use client";

import { useEffect, useState } from "react";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import ActWrittenStoryBoard from "./act-written-story-board";
import type { PreproductionReviewAddress } from "./preproduction-review-surfaces";
import StoryCardFoundationBoard from "./story-card-foundation-board";

function currentAddress(): PreproductionReviewAddress {
  const query = new URLSearchParams(window.location.search);
  const bounded = (key: string, maximum: number) => {
    const value = Number(query.get(key) || 1);
    return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value))) : 1;
  };
  return { blockNumber: bounded("block", 24), miniBlockNumber: bounded("mini", 4) };
}

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

  function handleClickCapture() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => onAddressChange?.(currentAddress()));
    });
  }

  if (!project) return <p role="status">Opening Story Map…</p>;
  return (
    <div data-canonical-project-id={project.id} data-skin-v1-story-map-review="true" onClickCapture={handleClickCapture}>
      <ProgressiveStoryMap
        key={`${project.id}-act-${activeAct}`}
        project={project}
        act={activeAct}
        initialBlockNumber={address.blockNumber}
        initialMiniBlockNumber={address.miniBlockNumber}
        navigationOnly
      />
      <StoryCardFoundationBoard project={project} onProjectChange={setProject} act={activeAct} />
      <ActWrittenStoryBoard project={project} act={activeAct} />
    </div>
  );
}
