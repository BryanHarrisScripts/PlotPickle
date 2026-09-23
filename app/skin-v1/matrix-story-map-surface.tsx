"use client";

import { useEffect, useMemo, useState } from "react";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import { deriveOutlineReadiness } from "@/modules/plan/outline-readiness";
import { outlineTurningPoint } from "@/modules/plan/outline-turning-point";
import ActWrittenStoryBoard from "./act-written-story-board";
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
  const [turningPointAct, setTurningPointAct] = useState<number | null>(null);
  const activeAct = Math.floor((address.blockNumber - 1) / 6) + 1;
  const turningPointSelected = turningPointAct === activeAct;
  const turningPoint = outlineTurningPoint(activeAct);
  const readiness = useMemo(() => project ? deriveOutlineReadiness(project) : [], [project]);
  const actReadiness = readiness.filter((block) => Math.floor((block.blockNumber - 1) / 6) + 1 === activeAct);

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

  function selectAddress(next: PreproductionReviewAddress) {
    setTurningPointAct(null);
    onAddressChange?.(next);
  }

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
        outlineReadiness={readiness}
        onSelectAddress={selectAddress}
        onSelectTurningPoint={setTurningPointAct}
        turningPointSelected={turningPointSelected}
      />
      <section className="pp-skin-v1-outline-readiness" aria-label={`Act ${activeAct} Outline readiness`} data-outline-readiness-summary={activeAct}>
        <h2>Act {activeAct} · Outline readiness</h2>
        <p>Observed means screenplay text is mapped. Readiness checks source placement, Story Architect findings, story intent, and Mini-Block support before Storyboard. Run the Act assessment below to replace generic pending findings with cited proposals.</p>
        <div className="pp-skin-v1-outline-readiness-grid">
          {actReadiness.map((block) => (
            <article data-outline-readiness={block.status} data-selected={block.blockNumber === address.blockNumber && !turningPointSelected ? "true" : undefined} key={block.blockNumber}>
              <strong>Block {String(block.blockNumber).padStart(2, "0")} · {block.status === "needs-support" ? "Needs support" : block.status === "review" ? "Review" : "Evidence ready"}</strong>
              <div className="pp-skin-v1-outline-mini-picks" aria-label={`Block ${block.blockNumber} Mini-Blocks`}>
                {[1, 2, 3, 4].map((mini) => <button aria-pressed={!turningPointSelected && address.blockNumber === block.blockNumber && address.miniBlockNumber === mini} data-selected={!turningPointSelected && address.blockNumber === block.blockNumber && address.miniBlockNumber === mini ? "true" : undefined} onClick={() => selectAddress({ blockNumber: block.blockNumber, miniBlockNumber: mini })} type="button" key={mini}>Mini {mini}</button>)}
              </div>
              {block.issues.length ? <ul>{block.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>No deterministic evidence gaps found. Human creative review still applies.</p>}
            </article>
          ))}
        </div>
        <button className="pp-skin-v1-outline-turning-point" data-selected={turningPointSelected ? "true" : undefined} aria-pressed={turningPointSelected} onClick={() => setTurningPointAct(activeAct)} type="button">
          <strong>{turningPoint.label}</strong><span>After Block {String(turningPoint.blockNumber).padStart(2, "0")} · Confirm the Act change before Storyboard. No separate script address is assigned.</span>
        </button>
      </section>
      <StoryCardFoundationBoard project={project} onProjectChange={setProject} act={activeAct} outlineReadiness={readiness} selectedAddress={address} onSelectAddress={selectAddress} turningPointSelected={turningPointSelected} onSelectTurningPoint={() => setTurningPointAct(activeAct)} />
      <ActWrittenStoryBoard project={project} act={activeAct} outlineReadiness={readiness} selectedAddress={address} onSelectAddress={selectAddress} turningPointSelected={turningPointSelected} onSelectTurningPoint={() => setTurningPointAct(activeAct)} />
    </div>
  );
}
