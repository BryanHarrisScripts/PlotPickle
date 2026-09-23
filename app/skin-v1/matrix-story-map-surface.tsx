"use client";

import { useEffect, useMemo, useState } from "react";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "@/core/storage/foundation-project-browser";
import ProgressiveStoryMap from "@/modules/build/ui/progressive-story-map";
import { deriveOutlineReadiness } from "@/modules/plan/outline-readiness";
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
        outlineReadiness={readiness}
      />
      <section className="pp-skin-v1-outline-readiness" aria-label={`Act ${activeAct} Outline readiness`} data-outline-readiness-summary={activeAct}>
        <h2>Act {activeAct} · Outline readiness</h2>
        <p>Observed means screenplay text is mapped. Readiness also checks reviewed structure, story intent, and Mini-Block support before Storyboard.</p>
        <div className="pp-skin-v1-outline-readiness-grid">
          {actReadiness.map((block) => (
            <article data-outline-readiness={block.status} key={block.blockNumber}>
              <strong>Block {String(block.blockNumber).padStart(2, "0")} · {block.status === "needs-support" ? "Needs support" : block.status === "review" ? "Review" : "Evidence ready"}</strong>
              {block.issues.length ? <ul>{block.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>No deterministic evidence gaps found. Human creative review still applies.</p>}
            </article>
          ))}
        </div>
      </section>
      <StoryCardFoundationBoard project={project} onProjectChange={setProject} act={activeAct} outlineReadiness={readiness} />
      <ActWrittenStoryBoard project={project} act={activeAct} outlineReadiness={readiness} />
    </div>
  );
}
