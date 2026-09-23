"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { plotPickleCurriculum } from "@/adapters/curriculum/current-catalog";
import type { PPFProject } from "@/core/project/project";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import FoundationsBuildWorkspace from "@/modules/build/ui/foundations-build-workspace";
import PrevisReadinessWorkspace from "../_components/previs/previs-readiness-workspace";
import { derivePrevisProjection, type PrevisAnchorProjection } from "../_components/previs/previs-projection-model";
import StoryboardReadinessWorkspace from "../_components/storyboard/storyboard-readiness-workspace";
import VisualStoryWorkspace from "../_components/storyboard/visual-story-workspace";

export type PreproductionReviewAddress = Readonly<{
  blockNumber: number;
  miniBlockNumber: number;
}>;

type MiniBlockVisualCoverage = Readonly<{
  miniBlockNumber: number;
  state: "accepted" | "candidate" | "missing";
  candidateCount: number;
}>;

function bounded(value: number, maximum: number) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value))) : 1;
}

function normalizedAddress(address: PreproductionReviewAddress): PreproductionReviewAddress {
  return {
    blockNumber: bounded(address.blockNumber, 24),
    miniBlockNumber: bounded(address.miniBlockNumber, 4),
  };
}

function visualCoverageForBlock(project: PPFProject, blockNumber: number): readonly MiniBlockVisualCoverage[] {
  const blockId = `block-${String(blockNumber).padStart(2, "0")}`;
  const artifacts = [
    ...project.build.foundations.visualArtifacts,
    ...project.build.world.visualArtifacts,
  ].filter((artifact) => artifact.reviewState !== "rejected");
  const acceptedIds = new Set([
    ...project.build.foundations.acceptedVisualArtifactIds,
    ...project.build.world.acceptedVisualArtifactIds,
  ]);

  return Array.from({ length: 4 }, (_, index): MiniBlockVisualCoverage => {
    const miniBlockNumber = index + 1;
    const anchor = `storyboard-anchor:block:${blockId}:mini-${miniBlockNumber}`;
    const candidates = artifacts.filter((artifact) => (artifact.sourceDecisionKeys ?? []).includes(anchor));
    const accepted = candidates.some((artifact) => acceptedIds.has(artifact.id) && artifact.reviewState === "accepted");
    return {
      miniBlockNumber,
      state: accepted ? "accepted" : candidates.length ? "candidate" : "missing",
      candidateCount: candidates.length,
    };
  });
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
  const [error, setError] = useState("");
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

    if ((button.textContent || "").trim() !== "Open Visual Story") return;
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
      <StoryboardReadinessWorkspace
        initialBlockNumber={normalized.blockNumber}
        initialMiniBlockNumber={normalized.miniBlockNumber}
        legacyProject={null}
        project={project}
        onProjectChange={applyProjectChange}
        onAddressChange={onAddressChange}
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
  const coverage = useMemo(
    () => project ? visualCoverageForBlock(project, normalized.blockNumber) : [],
    [normalized.blockNumber, project],
  );

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
      <section className="pp-skin-v1-previs-coverage" aria-labelledby="previs-visual-coverage-title">
        <header>
          <div><p>VISUAL COVERAGE</p><h2 id="previs-visual-coverage-title">Block {String(normalized.blockNumber).padStart(2, "0")} preview</h2></div>
          <span>{coverage.filter((item) => item.state === "accepted").length}/4 accepted visuals</span>
        </header>
        <p>Start with what you can already see. Previs then adds timing and camera intent without turning technical render slots into creative Shots.</p>
        <div className="pp-skin-v1-previs-coverage-grid" aria-label={`Block ${normalized.blockNumber} Mini-Block visual coverage`}>
          {coverage.map((item) => (
            <button
              aria-pressed={item.miniBlockNumber === normalized.miniBlockNumber}
              data-visual-coverage-state={item.state}
              key={item.miniBlockNumber}
              onClick={() => onAddressChange({ blockNumber: normalized.blockNumber, miniBlockNumber: item.miniBlockNumber })}
              type="button"
            >
              <strong>MINI {item.miniBlockNumber}</strong>
              <span>{item.state === "accepted" ? "Accepted visual" : item.state === "candidate" ? `${item.candidateCount} candidate${item.candidateCount === 1 ? "" : "s"}` : "No visual yet"}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>Previs is the visual preview/readiness view first, then downstream camera and timing intent for the same selected story address.</span>
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

export function SkinV1TimelineReviewSurface({
  address,
  onAddressChange,
  onOpenStoryboard,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onAddressChange: (address: PreproductionReviewAddress) => void;
  readonly onOpenStoryboard: (address: PreproductionReviewAddress) => void;
}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [error, setError] = useState("");
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

  function applyProjectChange(next: PPFProject) {
    setProject((current) => current ? {
      ...current,
      ...next,
      structure: current.structure,
      sourceEvidence: current.sourceEvidence,
    } : current);
  }

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Opening canonical Timeline projection…</p>;

  return (
    <div data-skin-v1-preproduction-review="timeline">
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>TIMELINE · BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>Script, Dialogue, Action, Shot and Audio stay synchronized against the same canonical story address. Missing Scene or timing evidence remains visibly missing.</span>
      </div>
      <nav className="pp-skin-v1-preproduction-address-rail" aria-label="Timeline Mini-Block address">
        {[1, 2, 3, 4].map((miniBlockNumber) => (
          <button
            aria-current={miniBlockNumber === normalized.miniBlockNumber ? "step" : undefined}
            key={miniBlockNumber}
            onClick={() => onAddressChange({ blockNumber: normalized.blockNumber, miniBlockNumber })}
            type="button"
          >
            Mini {miniBlockNumber}
          </button>
        ))}
      </nav>
      <VisualStoryWorkspace
        blockNumber={normalized.blockNumber}
        initialView="timeline"
        legacyProject={null}
        miniBlockNumber={normalized.miniBlockNumber}
        onProjectChange={applyProjectChange}
        onReturnToStoryboard={() => onOpenStoryboard(normalized)}
        project={project}
      />
    </div>
  );
}

export function SkinV1ProductionReviewSurface({
  address,
  onAddressChange,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onAddressChange: (address: PreproductionReviewAddress) => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [error, setError] = useState("");
  const normalized = normalizedAddress(address);
  const projection = useMemo(() => project ? derivePrevisProjection(project) : null, [project]);
  const selectedBlock = projection?.blocks.find((block) => block.blockNumber === normalized.blockNumber) ?? null;
  const selectedAnchor = selectedBlock?.anchors.find((anchor) => anchor.miniBlockNumber === normalized.miniBlockNumber)
    ?? selectedBlock?.anchors[0]
    ?? null;
  const approvedShots = selectedAnchor?.shots.filter((shot) => shot.reviewState === "approved") ?? [];
  const readiness = !selectedAnchor
    ? { label: "NO EVIDENCE", detail: "No canonical Previs anchor exists for this story address." }
    : selectedAnchor.storyboardCoverage !== "kept"
      ? { label: "NOT READY", detail: "A kept Storyboard visual is required before production intent can be treated as approved." }
      : selectedAnchor.staleShotIds.length
        ? { label: "REVIEW REQUIRED", detail: "Upstream Storyboard evidence changed. Stale Production Shots must be reviewed before handoff." }
        : approvedShots.length === 0
          ? { label: "NOT READY", detail: "No approved Previs Production Shot exists at this address yet." }
          : { label: "UPSTREAM READY", detail: "Approved upstream shot evidence exists. #2173 still validates Scene semantics and provider-neutral Director Specification readiness before execution." };

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

  if (error) return <p role="alert">{error}</p>;
  if (!project || !projection) return <p role="status">Opening canonical Production readiness…</p>;

  return (
    <div data-skin-v1-preproduction-review="production">
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>PRODUCTION · BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>This is a read-only projection over current Storyboard, Previs and #2173 provider-neutral production authorities. It does not use the legacy mutable Production Studio.</span>
      </div>

      <section
        aria-labelledby="production-stage-title"
        className="pp-skin-v1-production-stage"
        data-production-stage="provider-neutral-handoff"
      >
        <header>
          <div>
            <p>PROVIDER-NEUTRAL HANDOFF</p>
            <h2 id="production-stage-title">Production readiness</h2>
          </div>
          <strong data-production-readiness={readiness.label.toLowerCase().replaceAll(" ", "-")}>{readiness.label}</strong>
        </header>

        <nav className="pp-skin-v1-production-addresses" aria-label="Production Mini-Block address">
          {(selectedBlock?.anchors ?? []).map((anchor) => (
            <button
              aria-current={anchor.miniBlockNumber === normalized.miniBlockNumber ? "step" : undefined}
              key={anchor.id}
              onClick={() => onAddressChange({ blockNumber: anchor.blockNumber, miniBlockNumber: anchor.miniBlockNumber })}
              type="button"
            >
              <strong>MINI {anchor.miniBlockNumber}</strong>
              <span>{anchor.storyboardCoverage === "kept" ? "Kept visual" : anchor.storyboardCoverage === "candidate" ? "Candidate visual" : "No visual"}</span>
            </button>
          ))}
        </nav>

        {selectedAnchor ? (
          <>
            <div className="pp-skin-v1-production-evidence">
              <article>
                <span>Storyboard</span>
                <strong>{selectedAnchor.storyboardCoverage.toUpperCase()}</strong>
                <p>{selectedAnchor.storyboardArtifactId || "No kept Storyboard artifact."}</p>
              </article>
              <article>
                <span>Previs timing</span>
                <strong>{selectedAnchor.timingAllowed ? "ELIGIBLE" : "NOT READY"}</strong>
                <p>{selectedAnchor.authoredDurationSeconds > 0 ? `${selectedAnchor.authoredDurationSeconds}s authored` : "No authored duration."}</p>
              </article>
              <article>
                <span>Written evidence</span>
                <strong>{selectedAnchor.sourcePassageCount} passage{selectedAnchor.sourcePassageCount === 1 ? "" : "s"}</strong>
                <p>{selectedAnchor.sourceSceneCount} related Scene{selectedAnchor.sourceSceneCount === 1 ? "" : "s"}.</p>
              </article>
              <article>
                <span>Production Shots</span>
                <strong>{selectedAnchor.shots.length}</strong>
                <p>{approvedShots.length} approved · {selectedAnchor.staleShotIds.length} stale.</p>
              </article>
            </div>

            <section className="pp-skin-v1-production-shots" aria-label="Production Shots for selected story address">
              <header>
                <h3>Production Shots</h3>
                <span>Existing Previs authority</span>
              </header>
              {selectedAnchor.shots.length ? (
                <ol>
                  {selectedAnchor.shots.map((shot) => (
                    <li key={shot.id}>
                      <strong>Shot {shot.order}</strong>
                      <span>{shot.reviewState}</span>
                      <span>{shot.durationSeconds ? `${shot.durationSeconds}s` : "Timing open"}</span>
                      <small>{shot.visualIntent || shot.blockingIntent || shot.id}</small>
                    </li>
                  ))}
                </ol>
              ) : <p>No Production Shot exists at this address. PlotPickle leaves the slot empty rather than creating a placeholder Production Shot.</p>}
            </section>

            <section className="pp-skin-v1-production-handoff-state" aria-label="Provider-neutral production handoff state">
              <strong>{readiness.label}</strong>
              <p>{readiness.detail}</p>
              <small>{selectedAnchor.reason}</small>
            </section>
          </>
        ) : (
          <p>No production evidence exists for this selected story address.</p>
        )}
      </section>
    </div>
  );
}

export function SkinV1BuildReviewSurface({
  address,
  onOpenDashboard,
  onOpenOutline,
  onReturn,
  returnLabel,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onOpenDashboard: () => void;
  readonly onOpenOutline: () => void;
  readonly onReturn: () => void;
  readonly returnLabel: "Outline" | "Storyboard" | "Previs";
}) {
  const normalized = normalizedAddress(address);
  return (
    <div data-skin-v1-preproduction-review="build">
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>BUILD EVIDENCE · BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>This is the existing canonical Build authority projected inside the Skin V1 review flow.</span>
        <button type="button" data-preproduction-return onClick={onReturn}>Back to {returnLabel}</button>
      </div>
      <FoundationsBuildWorkspace
        curriculum={plotPickleCurriculum}
        onOpenDashboard={onOpenDashboard}
        onOpenPlan={onOpenOutline}
      />
    </div>
  );
}
