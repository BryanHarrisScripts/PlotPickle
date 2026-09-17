"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { PPFProject } from "@/core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import type { PreproductionReviewAddress } from "./preproduction-review-surfaces";

export type StoryMapReviewStage = "outline" | "build" | "storyboard";

function bounded(value: string | null, maximum: number) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(1, Math.trunc(number))) : 1;
}

export default function MatrixStoryMapSurface({
  onOpenStage,
  onOpenStoryModeSettings,
}: {
  readonly onOpenStage?: (stage: StoryMapReviewStage, address: PreproductionReviewAddress) => void;
  readonly onOpenStoryModeSettings?: () => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);

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

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!onOpenStage) return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!link) return;
    const destination = new URL(link.href, window.location.origin);
    const workspace = destination.searchParams.get("workspace");
    const stage: StoryMapReviewStage | null = destination.pathname === "/storyboard"
      ? "storyboard"
      : workspace === "build"
        ? "build"
        : workspace === "plan"
          ? "outline"
          : null;
    if (!stage) return;

    event.preventDefault();
    event.stopPropagation();
    onOpenStage(stage, {
      blockNumber: bounded(destination.searchParams.get("block"), 24),
      miniBlockNumber: bounded(destination.searchParams.get("mini"), 4),
    });
  }

  if (!project) return <p role="status">Opening Story Map…</p>;
  return (
    <div data-skin-v1-story-map-review="true" onClickCapture={handleClickCapture}>
      <div className="pp-skin-v1-preproduction-context">
        <strong>VISUAL GENERATION ROUTING</strong>
        <span>Story Mode and the selected image route remain governed by Manage → Story Mode. If Add a Visual reports a Local / Cloud mismatch, review that existing configuration rather than changing policy here.</span>
        {onOpenStoryModeSettings ? <button type="button" onClick={onOpenStoryModeSettings}>Open Story Mode Settings</button> : null}
      </div>
      <ProgressiveStoryMap project={project} />
    </div>
  );
}
