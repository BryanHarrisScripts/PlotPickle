"use client";

/* eslint-disable @next/next/no-img-element -- Previs keyframes are lazy local PlotPickle assets. */

import { useMemo, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import { derivePrevisProjection, type PrevisAnchorProjection } from "./previs-projection-model";
import styles from "./previs-readiness-workspace.module.css";

const STATE_LABELS = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "MISSING",
  locked: "LOCKED",
} as const;

export default function PrevisReadinessWorkspace({
  project,
  onOpenStoryboard,
  onOpenBuild,
}: {
  readonly project: PPFProject;
  readonly onOpenStoryboard: (anchor?: PrevisAnchorProjection) => void;
  readonly onOpenBuild: () => void;
}) {
  const projection = useMemo(() => derivePrevisProjection(project), [project]);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const selectedBlock = projection.blocks.find((block) => block.blockNumber === selectedBlockNumber)
    ?? projection.blocks[0]
    ?? null;

  return (
    <main className={styles.workspace} aria-labelledby="previs-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Previs · 24 Blocks / 96 canonical timing anchors</span>
          <h1 id="previs-title">See how the visual story plays over time.</h1>
          <p>
            Previs uses the same Block and Mini-Block addresses as Storyboard, but the final clip count is intentionally flexible. One anchor can carry several shots or variations while another may need only one—or none yet.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Project</dt><dd>{project.title}</dd></div>
          <div><dt>PPF revision</dt><dd>{projection.projectRevision}</dd></div>
          <div><dt>Story anchors</dt><dd>{projection.totalAnchors}</dd></div>
          <div><dt>Ready for timing</dt><dd>{projection.timingReadyAnchors}</dd></div>
        </dl>
      </header>

      <section className={styles.notice} aria-label="Previs authority boundary">
        <div>
          <strong>Storyboard approval unlocks timing; it does not create timing automatically.</strong>
          <span>DEFINED, OBSERVED, EMERGING, MISSING and LOCKED use the same colour language as BUILD and Storyboard.</span>
        </div>
        <div className={styles.noticeActions}>
          <button type="button" onClick={() => onOpenStoryboard()}>Open Storyboard</button>
          <button type="button" onClick={onOpenBuild}>Open BUILD evidence</button>
        </div>
      </section>

      <nav aria-label="Previs Block tabs" className={styles.tabRail} role="tablist">
        {projection.blocks.map((block) => {
          const selected = block.blockNumber === selectedBlock?.blockNumber;
          return (
            <button
              aria-controls="previs-block-panel"
              aria-label={`Block ${String(block.blockNumber).padStart(2, "0")}, ${STATE_LABELS[block.state]}`}
              aria-selected={selected}
              className={styles.blockTab}
              data-state={block.state}
              key={block.targetId}
              onClick={() => setSelectedBlockNumber(block.blockNumber)}
              role="tab"
              type="button"
            >
              <i aria-hidden="true" className={styles.stateLight} />
              <span>{String(block.blockNumber).padStart(2, "0")}</span>
            </button>
          );
        })}
      </nav>

      {selectedBlock ? (
        <section
          aria-label={`Block ${String(selectedBlock.blockNumber).padStart(2, "0")} Previs workspace`}
          className={styles.blockWorkspace}
          data-state={selectedBlock.state}
          id="previs-block-panel"
          role="tabpanel"
        >
          <header className={styles.blockHeader}>
            <div>
              <p className={styles.blockKicker}>Block {String(selectedBlock.blockNumber).padStart(2, "0")}</p>
              <h2>{selectedBlock.label.replace(/^Block \d+: /, "")}</h2>
              <p>Four Mini-Block anchors keep timing traceable. Shot and clip density may expand or contract underneath them as the sequence finds its real rhythm.</p>
            </div>
            <span aria-label={`Status: ${STATE_LABELS[selectedBlock.state]}`} className={styles.blockState} data-state={selectedBlock.state}>
              <i aria-hidden="true" className={styles.stateLight} />
              <strong>{STATE_LABELS[selectedBlock.state]}</strong>
            </span>
          </header>

          <div className={styles.anchorGrid} aria-label={`Block ${selectedBlock.blockNumber} Previs anchors`}>
            {selectedBlock.anchors.map((anchor) => (
              <article className={styles.anchorCard} data-state={anchor.state} key={anchor.id}>
                <div className={styles.videoFrame}>
                  {anchor.storyboardAssetUrl
                    ? <img alt={`Storyboard keyframe for ${selectedBlock.blockNumber}.${anchor.miniBlockNumber}`} decoding="async" loading="lazy" src={anchor.storyboardAssetUrl} />
                    : <span className={styles.emptyVideo}>VIDEO / ANIMATIC</span>}
                  <span className={styles.videoBadge}>{anchor.timingAllowed ? "READY FOR TIMING" : anchor.observedReference ? "REFERENCE ONLY" : "NO TIMING YET"}</span>
                </div>
                <header className={styles.anchorHeader}>
                  <div>
                    <span>Mini-Block anchor</span>
                    <strong>{selectedBlock.blockNumber}.{anchor.miniBlockNumber}</strong>
                  </div>
                  <span aria-label={`Status: ${STATE_LABELS[anchor.state]}`} className={styles.anchorState} data-state={anchor.state}>
                    <i aria-hidden="true" className={styles.stateLight} />
                    <b>{STATE_LABELS[anchor.state]}</b>
                  </span>
                </header>
                <p>{anchor.reason}</p>
                <dl className={styles.anchorMeta}>
                  <div><dt>Timing</dt><dd>{anchor.timingAllowed ? "Human can plan next" : "Not earned"}</dd></div>
                  <div><dt>Clip density</dt><dd>0 / 1 / many</dd></div>
                  <div><dt>Duration</dt><dd>Not inferred</dd></div>
                </dl>
                <button type="button" onClick={() => anchor.storyboardAllowed ? onOpenStoryboard(anchor) : onOpenBuild()}>
                  {anchor.storyboardAllowed ? "Open owning Storyboard anchor" : "Review BUILD prerequisite"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.timelinePreview} aria-label="Previs timeline placeholder">
        <header>
          <div>
            <span>Temporal projection</span>
            <h2>Timeline stays empty until timing is actually authored.</h2>
          </div>
          <strong>{selectedBlock?.anchors.filter((anchor) => anchor.timingAllowed).length ?? 0} timing-ready anchors in this Block</strong>
        </header>
        <div className={styles.timelineRail}>
          {(selectedBlock?.anchors ?? []).map((anchor) => (
            <div className={styles.timelineAnchor} data-state={anchor.state} key={anchor.id}>
              <i aria-hidden="true" className={styles.stateLight} />
              <span>{anchor.blockNumber}.{anchor.miniBlockNumber}</span>
              <small>{anchor.timingAllowed ? "Timing slot available" : "Placeholder"}</small>
            </div>
          ))}
        </div>
        <p>No seconds, transitions, movement or media are fabricated in this read-only projection. The next #1425 slice adapts the existing Production Shot and Animatic controls onto these canonical anchors.</p>
      </section>

      <footer className={styles.footer}>
        The 24/96 structure is provenance, not a production quota. Previs can become denser or lighter by Mini-Block, Block, Sequence or Act while every timed shot remains traceable to the canonical PPF story evidence it serves.
      </footer>
    </main>
  );
}
