"use client";

/* eslint-disable @next/next/no-img-element -- bundled Storyboard references are local PlotPickle assets. */

import { useMemo, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import { hasQaWorkspaceAccess, isQaAccessOverride } from "@/core/progression/qa-access";
import { deriveVisualReadiness, type VisualReadinessTarget } from "@/modules/build/visual-readiness";
import StoryboardEditorialWorkspace from "./storyboard-editorial-workspace";
import { storyboardAnchorTargetRef, storyboardReferenceCandidates } from "./storyboard-editorial-model";
import styles from "./storyboard-readiness-workspace.module.css";

const STATE_LABELS = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "MISSING",
  locked: "LOCKED",
} as const;

function blockNumber(target: VisualReadinessTarget) {
  const match = target.id.match(/^block:block-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

export default function StoryboardReadinessWorkspace({ project, onProjectChange, onOpenBuild }: {
  readonly project: PPFProject;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenBuild: () => void;
}) {
  const readiness = deriveVisualReadiness({ project });
  const blocks = readiness.targets
    .filter((target) => target.kind === "block")
    .sort((left, right) => blockNumber(left) - blockNumber(right));
  const readyCount = blocks.filter((target) => target.storyboardAllowed).length;
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [requestedCandidateId, setRequestedCandidateId] = useState<string | undefined>();
  const selectedTarget = blocks.find((target) => blockNumber(target) === selectedBlockNumber) ?? blocks[0] ?? null;
  const selectedNumber = selectedTarget ? blockNumber(selectedTarget) : 1;
  const storyboardAccessible = selectedTarget ? hasQaWorkspaceAccess(selectedTarget.storyboardAllowed) : false;
  const qaOnlyAccess = selectedTarget ? isQaAccessOverride(selectedTarget.storyboardAllowed) : false;
  const selectedReferences = useMemo(
    () => selectedTarget ? storyboardReferenceCandidates(project, selectedTarget.id) : [],
    [project, selectedTarget],
  );

  function openEditorial(candidateId: string) {
    setRequestedCandidateId(candidateId);
    window.requestAnimationFrame(() => {
      document.getElementById("storyboard-editorial")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className={styles.workspace} aria-labelledby="storyboard-readiness-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Storyboard · 24 Blocks / 96 Mini-Block anchors</span>
          <h1 id="storyboard-readiness-title">Build the story one visual beat at a time.</h1>
          <p>
            Each tab is one canonical Block. Its four Mini-Blocks are stable visual addresses, not a fixed final-frame quota. The 24/96 scaffold keeps every visual traceable while candidates and later visual beats can expand where the story needs more coverage.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Project</dt><dd>{project.title}</dd></div>
          <div><dt>PPF revision</dt><dd>{project.revision}</dd></div>
          <div><dt>Visual anchors</dt><dd>96</dd></div>
          <div><dt>Ready Blocks</dt><dd>{readyCount} / {blocks.length}</dd></div>
        </dl>
      </header>

      <section className={styles.notice} aria-label="Storyboard authority boundary">
        <strong>{readiness.storyboardAllowed ? "Storyboard has eligible visual targets." : "QA access is open; BUILD readiness remains unresolved."}</strong>
        <span>DEFINED, OBSERVED, EMERGING, MISSING and LOCKED remain canonical BUILD truth. QA access opens implemented Storyboard inspection without promoting an unearned target or changing project progression.</span>
        <button type="button" onClick={onOpenBuild}>Open BUILD evidence</button>
      </section>

      <nav aria-label="Storyboard Block tabs" className={styles.tabRail} role="tablist">
        {blocks.map((target) => {
          const number = blockNumber(target);
          const selected = number === selectedNumber;
          return (
            <button
              aria-controls="storyboard-block-panel"
              aria-label={`Block ${String(number).padStart(2, "0")}, ${STATE_LABELS[target.state]}`}
              aria-selected={selected}
              className={styles.blockTab}
              data-state={target.state}
              key={target.id}
              onClick={() => {
                setSelectedBlockNumber(number);
                setRequestedCandidateId(undefined);
              }}
              role="tab"
              type="button"
            >
              <i aria-hidden="true" className={styles.stateLight} />
              <span>{String(number).padStart(2, "0")}</span>
            </button>
          );
        })}
      </nav>

      {selectedTarget ? (
        <section
          aria-label={`Block ${String(selectedNumber).padStart(2, "0")} Storyboard workspace`}
          className={styles.blockWorkspace}
          data-state={selectedTarget.state}
          id="storyboard-block-panel"
          role="tabpanel"
        >
          <header className={styles.blockHeader}>
            <div>
              <p className={styles.blockKicker}>Block {String(selectedNumber).padStart(2, "0")}</p>
              <h2>{selectedTarget.label.replace(/^Block \d+: /, "")}</h2>
              <p>{selectedTarget.storyboardAllowed
                ? "This Block has enough reviewed structural evidence to begin visual decisions."
                : qaOnlyAccess
                  ? `QA access is open for this Block. Canonical prerequisites remain unresolved: ${selectedTarget.missingPrerequisites.join(" · ") || "BUILD evidence is incomplete."}`
                  : selectedTarget.missingPrerequisites.join(" · ") || "This Block remains visible but is not ready for visual authoring."}</p>
            </div>
            <span aria-label={`Status: ${STATE_LABELS[selectedTarget.state]}`} className={styles.blockState} data-state={selectedTarget.state}>
              <i aria-hidden="true" className={styles.stateLight} />
              <strong>{STATE_LABELS[selectedTarget.state]}</strong>
            </span>
          </header>

          <div className={styles.miniBlockGrid} aria-label={`Block ${selectedNumber} Mini-Block visual anchors`}>
            {[1, 2, 3, 4].map((miniNumber) => {
              const reference = selectedReferences.find((candidate) => candidate.miniBlockNumber === miniNumber);
              const canReviewReference = Boolean(storyboardAccessible && reference);
              return (
                <article
                  className={styles.miniBlock}
                  data-authorable={storyboardAccessible ? "true" : "false"}
                  data-story-decision-target={storyboardAnchorTargetRef(selectedTarget.id, miniNumber)}
                  key={miniNumber}
                >
                  <div className={styles.miniPreview}>
                    {reference
                      ? <img alt={reference.caption} decoding="async" loading="lazy" src={reference.assetUrl} />
                      : <span aria-hidden="true" className={styles.emptyFrame}>+</span>}
                  </div>
                  <header>
                    <div>
                      <span>Mini-Block anchor</span>
                      <strong>{selectedNumber}.{miniNumber}</strong>
                    </div>
                    <i aria-label={`Status: ${STATE_LABELS[selectedTarget.state]}`} className={styles.stateLight} data-state={selectedTarget.state} />
                  </header>
                  <p>{reference?.caption || (selectedTarget.storyboardAllowed
                    ? "Visual anchor is ready, but no candidate has been attached yet."
                    : qaOnlyAccess
                      ? "QA access is open. A real visual candidate is still required before this anchor can be reviewed."
                      : "Visual anchor reserved. BUILD evidence must mature before authoring begins.")}</p>
                  <button
                    disabled={!canReviewReference}
                    onClick={reference && canReviewReference ? () => openEditorial(reference.id) : undefined}
                    type="button"
                  >
                    {reference
                      ? reference.acceptedArtifactId ? "Review kept visual" : "Review visual"
                      : storyboardAccessible ? "Awaiting candidate" : "Locked by BUILD"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {storyboardAccessible && selectedTarget ? (
        <div id="storyboard-editorial">
          <StoryboardEditorialWorkspace
            project={project}
            requestedCandidateId={requestedCandidateId}
            target={selectedTarget}
            onProjectChange={onProjectChange}
            onOpenBuild={onOpenBuild}
          />
        </div>
      ) : null}

      <footer className={styles.footer}>
        Storyboard starts from 24 Block tabs and 96 canonical Mini-Block anchors so visual intent never loses its story address. The final image count is intentionally flexible: an anchor may have no visual yet, one preferred visual, or multiple candidates and later visual beats as the story develops.
      </footer>
    </main>
  );
}