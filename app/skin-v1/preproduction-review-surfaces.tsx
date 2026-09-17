"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { plotPickleCurriculum } from "@/adapters/curriculum/current-catalog";
import type { PPFProject } from "@/core/project/project";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { normalizePlotPickleProject, type PlotPickleProject } from "@/lib/projects/project";
import FoundationsBuildWorkspace from "@/modules/build/ui/foundations-build-workspace";
import PrevisReadinessWorkspace from "../_components/previs/previs-readiness-workspace";
import type { PrevisAnchorProjection } from "../_components/previs/previs-projection-model";
import StoryboardReadinessWorkspace from "../_components/storyboard/storyboard-readiness-workspace";

export type PreproductionReviewAddress = Readonly<{
  blockNumber: number;
  miniBlockNumber: number;
}>;

const LEGACY_PROJECT_STORAGE_KEY = "plotpickle.project.v1";

function bounded(value: number, maximum: number) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value))) : 1;
}

function normalizedAddress(address: PreproductionReviewAddress): PreproductionReviewAddress {
  return {
    blockNumber: bounded(address.blockNumber, 24),
    miniBlockNumber: bounded(address.miniBlockNumber, 4),
  };
}

function legacySceneProjectionSource() {
  try {
    const stored = window.localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY);
    return stored ? normalizePlotPickleProject(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function addressFromStoryboardTarget(target: string | null) {
  const match = String(target || "").match(/block:block-(\d{2}):mini-(\d+)/u);
  if (!match) return null;
  return normalizedAddress({ blockNumber: Number(match[1]), miniBlockNumber: Number(match[2]) });
}

export function SkinV1StoryboardReviewSurface({
  address,
  onAddressChange,
  onOpenBuild,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onAddressChange: (address: PreproductionReviewAddress) => void;
  readonly onOpenBuild: () => void;
}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [legacyProject, setLegacyProject] = useState<PlotPickleProject | null>(null);
  const [error, setError] = useState("");
  const normalized = normalizedAddress(address);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setLegacyProject(legacySceneProjectionSource());
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The canonical project could not be opened.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function applyProjectChange(next: PPFProject) {
    setProject((current) => current ? {
      ...current,
      ...next,
      structure: current.structure,
      sourceEvidence: current.sourceEvidence,
    } : current);
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;

    const blockMatch = (button.getAttribute("aria-label") || "").match(/^Block (\d{2}),/u);
    if (blockMatch) {
      onAddressChange(normalizedAddress({ blockNumber: Number(blockMatch[1]), miniBlockNumber: 1 }));
      return;
    }

    if ((button.textContent || "").trim() !== "Open Visual Story") return;
    const card = button.closest<HTMLElement>("[data-story-decision-target]");
    const next = addressFromStoryboardTarget(card?.getAttribute("data-story-decision-target") || null) || normalized;
    onAddressChange(next);
    window.requestAnimationFrame(() => {
      const visualStory = document.querySelector<HTMLElement>("[data-visual-story='scene-beat-shot-frame']");
      visualStory?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (visualStory) {
        visualStory.tabIndex = -1;
        visualStory.focus({ preventScroll: true });
      }
    });
  }

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Opening canonical Storyboard readiness…</p>;

  return (
    <div data-skin-v1-preproduction-review="storyboard" onClickCapture={handleClickCapture}>
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>Visual Story and Scene Timeline are sibling views of the same real Scene / Beat / Shot / Frame material.</span>
      </div>
      <StoryboardReadinessWorkspace
        initialBlockNumber={normalized.blockNumber}
        initialMiniBlockNumber={normalized.miniBlockNumber}
        legacyProject={legacyProject}
        project={project}
        onProjectChange={applyProjectChange}
        onOpenBuild={onOpenBuild}
      />
    </div>
  );
}

export function SkinV1PrevisReviewSurface({
  address,
  onAddressChange,
  onOpenStoryboard,
  onOpenBuild,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onAddressChange: (address: PreproductionReviewAddress) => void;
  readonly onOpenStoryboard: (address: PreproductionReviewAddress) => void;
  readonly onOpenBuild: () => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const normalized = normalizedAddress(address);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The canonical project could not be opened.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      const label = `Block ${String(normalized.blockNumber).padStart(2, "0")},`;
      rootRef.current?.querySelector<HTMLButtonElement>(`button[role='tab'][aria-label^='${label}']`)?.click();
      onAddressChange(normalized);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [normalized.blockNumber, normalized.miniBlockNumber, onAddressChange, project]);

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const blockMatch = (button.getAttribute("aria-label") || "").match(/^Block (\d{2}),/u);
    if (blockMatch && Number(blockMatch[1]) !== normalized.blockNumber) {
      onAddressChange(normalizedAddress({ blockNumber: Number(blockMatch[1]), miniBlockNumber: 1 }));
    }
  }

  function storyboardAddress(anchor?: PrevisAnchorProjection) {
    return normalizedAddress(anchor
      ? { blockNumber: anchor.blockNumber, miniBlockNumber: anchor.miniBlockNumber }
      : normalized);
  }

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Opening canonical Previs projection…</p>;

  return (
    <div ref={rootRef} data-skin-v1-preproduction-review="previs" onClickCapture={handleClickCapture}>
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>Previs is downstream camera and timing intent for the same selected story address.</span>
      </div>
      <PrevisReadinessWorkspace
        project={project}
        onProjectChange={setProject}
        onOpenStoryboard={(anchor) => onOpenStoryboard(storyboardAddress(anchor))}
        onOpenBuild={onOpenBuild}
      />
    </div>
  );
}

export function SkinV1BuildReviewSurface({
  address,
  onOpenDashboard,
  onOpenOutline,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onOpenDashboard: () => void;
  readonly onOpenOutline: () => void;
}) {
  const normalized = normalizedAddress(address);
  return (
    <div data-skin-v1-preproduction-review="build">
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>BUILD EVIDENCE · BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>This is the existing canonical Build authority projected inside the Skin V1 review flow.</span>
      </div>
      <FoundationsBuildWorkspace
        curriculum={plotPickleCurriculum}
        onOpenDashboard={onOpenDashboard}
        onOpenPlan={onOpenOutline}
      />
    </div>
  );
}
