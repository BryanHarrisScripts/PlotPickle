"use client";

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import { storyLearningContext, storyLearningHref } from "@/modules/learn/model/story-learning-context";
import type { PreproductionReviewAddress } from "./preproduction-review-surfaces";
import StoryCardFoundationBoard from "./story-card-foundation-board";

export type StoryMapReviewStage = "outline" | "build" | "storyboard";

function bounded(value: string | null, maximum: number) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(1, Math.trunc(number))) : 1;
}

function currentAddress(): PreproductionReviewAddress {
  if (typeof window === "undefined") return { blockNumber: 1, miniBlockNumber: 1 };
  const query = new URLSearchParams(window.location.search);
  return {
    blockNumber: bounded(query.get("block"), 24),
    miniBlockNumber: bounded(query.get("mini"), 4),
  };
}

export default function MatrixStoryMapSurface({
  onOpenStage,
  onOpenPrevis,
  onOpenStoryModeSettings,
}: {
  readonly onOpenStage?: (stage: StoryMapReviewStage, address: PreproductionReviewAddress) => void;
  readonly onOpenPrevis?: (address: PreproductionReviewAddress) => void;
  readonly onOpenStoryModeSettings?: () => void;
}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [address, setAddress] = useState<PreproductionReviewAddress>(() => currentAddress());

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

  const screenplay = useMemo(
    () => project ? normalizeProjectSourceEvidence(project.sourceEvidence).screenplay : null,
    [project],
  );
  const blockPassages = useMemo(
    () => screenplay?.passages.filter((passage) => passage.blockNumber === address.blockNumber) ?? [],
    [address.blockNumber, screenplay],
  );
  const miniPassages = useMemo(
    () => blockPassages.filter((passage) => passage.miniBlockNumber === address.miniBlockNumber),
    [address.miniBlockNumber, blockPassages],
  );
  const learningContext = useMemo(
    () => storyLearningContext(address),
    [address],
  );

  function syncAddressAfterSelection() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAddress(currentAddress()));
    });
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    syncAddressAfterSelection();
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
    const nextAddress = {
      blockNumber: bounded(destination.searchParams.get("block"), 24),
      miniBlockNumber: bounded(destination.searchParams.get("mini"), 4),
    };
    setAddress(nextAddress);
    onOpenStage(stage, nextAddress);
  }

  if (!project) return <p role="status">Opening Story Map…</p>;
  return (
    <div data-skin-v1-story-map-review="true" onClickCapture={handleClickCapture}>
      <StoryCardFoundationBoard project={project} onProjectChange={setProject} />
      <ProgressiveStoryMap project={project} />

      <section className="pp-skin-v1-writer-story-panel" aria-labelledby="writer-story-position-title" data-writer-story-projection="mini-block-source">
        <header>
          <div>
            <p>SELECTED STORY POSITION</p>
            <h2 id="writer-story-position-title">Block {String(address.blockNumber).padStart(2, "0")} · Mini-Block {address.miniBlockNumber}</h2>
          </div>
          <div className="pp-skin-v1-writer-flow" aria-label="Writer story flow">
            <span aria-current="step">WRITTEN STORY</span>
            <button
              type="button"
              onClick={() => window.location.assign(`/?workspace=write&block=${address.blockNumber}&mini=${address.miniBlockNumber}`)}
            >
              WRITE
            </button>
            <button
              type="button"
              onClick={() => {
                const returnPath = encodeURIComponent(`/?workspace=dashboard&block=${address.blockNumber}&mini=${address.miniBlockNumber}`);
                window.location.assign(`/pageflow?block=${address.blockNumber}&mini=${address.miniBlockNumber}&from=preproduction&return=${returnPath}`);
              }}
            >
              PAGEFLOW
            </button>
            <button type="button" onClick={() => onOpenStage?.("storyboard", address)}>STORYBOARD</button>
            <button type="button" onClick={() => onOpenPrevis?.(address)}>PREVIS</button>
          </div>
        </header>

        <div className="pp-skin-v1-story-layer-explainer">
          <strong>HOW THIS STORY ADDRESS CONNECTS</strong>
          <p><b>Block / Mini-Block</b> tells you where you are in the story structure. <b>Scene / Beat</b> is authored story material related to that address. <b>Shot / Frame</b> is how that material is visualized. These relationships are variable-density, not a forced one-to-one ladder.</p>
        </div>

        <div className="pp-skin-v1-story-layer-explainer" data-story-learning-context="true">
          <strong>LEARN THIS STORY POSITION</strong>
          <p>{learningContext.positionNote}</p>
          <div className="pp-skin-v1-writer-flow">
            {learningContext.references.map((reference) => (
              <button
                data-learning-lesson-id={reference.lessonId}
                key={reference.lessonId}
                onClick={() => window.location.assign(storyLearningHref(reference, address))}
                type="button"
              >
                {reference.actionLabel}
              </button>
            ))}
          </div>
        </div>

        <section className="pp-skin-v1-written-story" aria-label="Written Story for selected Mini-Block">
          <div className="pp-skin-v1-written-story-heading">
            <div><p>WRITTEN STORY</p><h3>What is actually written here?</h3></div>
            <small>{miniPassages.length} source passage{miniPassages.length === 1 ? "" : "s"}</small>
          </div>
          {miniPassages.length ? (
            <ol>
              {miniPassages.map((passage) => (
                <li key={passage.id}>
                  <small>Scene {passage.sceneNumber || "—"} · {passage.type}</small>
                  <p>{passage.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pp-skin-v1-writer-empty">No observed screenplay text is attached to this Mini-Block. PlotPickle leaves it empty rather than inventing story text.</p>
          )}

          <details>
            <summary>View the whole Block source ({blockPassages.length} passage{blockPassages.length === 1 ? "" : "s"})</summary>
            {blockPassages.length ? (
              <ol>
                {blockPassages.map((passage) => (
                  <li key={passage.id}>
                    <small>Scene {passage.sceneNumber || "—"} · Mini-Block {passage.miniBlockNumber} · {passage.type}</small>
                    <p>{passage.text}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="pp-skin-v1-writer-empty">No observed screenplay text is attached to this Block.</p>}
          </details>
        </section>
      </section>

      <div className="pp-skin-v1-preproduction-context">
        <strong>VISUAL GENERATION ROUTING</strong>
        <span>Story Mode and the selected image route remain governed by Manage → Story Mode. If Add a Visual reports a Local / Cloud mismatch, review that existing configuration rather than changing policy here.</span>
        {onOpenStoryModeSettings ? <button type="button" onClick={onOpenStoryModeSettings}>Open Story Mode Settings</button> : null}
      </div>
    </div>
  );
}
