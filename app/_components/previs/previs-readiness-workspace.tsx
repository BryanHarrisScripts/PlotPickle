"use client";

/* eslint-disable @next/next/no-img-element -- Previs keyframes are lazy local PlotPickle assets. */

import { useMemo, useState, type FormEvent } from "react";
import {
  RENDER_CLIP_SECONDS,
  RENDER_CLIPS_PER_BLOCK,
  RENDER_CLIPS_PER_FEATURE,
  RENDER_CLIPS_PER_MINI_BLOCK,
  RENDER_KEYFRAMES_PER_FEATURE,
  RENDER_MINI_BLOCK_SECONDS,
  type ProductionShotIntent,
  type ProductionShotReviewState,
} from "@/core/contracts/previs";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import {
  createProductionShotForAnchor,
  derivePrevisProjection,
  shotNeedsReview,
  type PrevisAnchorProjection,
} from "./previs-projection-model";
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
  onProjectChange,
  onOpenStoryboard,
  onOpenBuild,
}: {
  readonly project: PPFProject;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenStoryboard: (anchor?: PrevisAnchorProjection) => void;
  readonly onOpenBuild: () => void;
}) {
  const projection = useMemo(() => derivePrevisProjection(project), [project]);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedShotId, setSelectedShotId] = useState("");
  const [message, setMessage] = useState("");
  const selectedBlock = projection.blocks.find((block) => block.blockNumber === selectedBlockNumber)
    ?? projection.blocks[0]
    ?? null;
  const allAnchors = projection.blocks.flatMap((block) => block.anchors);
  const selectedAnchor = allAnchors.find((anchor) => anchor.shots.some((shot) => shot.id === selectedShotId)) ?? null;
  const selectedShot = selectedAnchor?.shots.find((shot) => shot.id === selectedShotId) ?? null;
  const selectedShotStale = Boolean(selectedShot && selectedAnchor && shotNeedsReview(selectedAnchor, selectedShot));

  function commit(command: Parameters<typeof applyStoryCommand>[1]) {
    const next = applyStoryCommand(project, command);
    saveFoundationProject(next);
    onProjectChange(next);
    return next;
  }

  function addShot(anchor: PrevisAnchorProjection) {
    const now = new Date().toISOString();
    const shot = createProductionShotForAnchor(project, anchor, now);
    if (!shot) {
      setMessage("Keep a current Storyboard visual before adding a creative Previs shot to this anchor.");
      return;
    }
    commit({ type: "previs.shot.store", shot, occurredAt: now });
    setSelectedShotId(shot.id);
    setMessage(`Shot ${shot.order} added under ${anchor.blockNumber}.${anchor.miniBlockNumber}. Author the creative timing until this Mini-Block totals ${RENDER_MINI_BLOCK_SECONDS}s.`);
  }

  function saveShot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShot || !selectedAnchor || !selectedAnchor.storyboardArtifactId || !selectedAnchor.storyboardDependencyKey) return;
    const data = new FormData(event.currentTarget);
    const rawDuration = String(data.get("durationSeconds") ?? "").trim();
    const parsedDuration = rawDuration ? Number(rawDuration) : null;
    const now = new Date().toISOString();
    const shot: ProductionShotIntent = {
      ...selectedShot,
      storyboardArtifactId: selectedAnchor.storyboardArtifactId,
      storyboardDependencyKey: selectedAnchor.storyboardDependencyKey,
      shotSize: String(data.get("shotSize") ?? "").trim(),
      angle: String(data.get("angle") ?? "").trim(),
      movement: String(data.get("movement") ?? "").trim(),
      lens: String(data.get("lens") ?? "").trim(),
      visualIntent: String(data.get("visualIntent") ?? "").trim(),
      durationSeconds: parsedDuration && Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null,
      transitionIn: String(data.get("transitionIn") ?? "").trim(),
      transitionOut: String(data.get("transitionOut") ?? "").trim(),
      reviewState: String(data.get("reviewState") ?? "planned") as ProductionShotReviewState,
      updatedAt: now,
    };
    commit({ type: "previs.shot.store", shot, occurredAt: now });
    setMessage(`Shot ${shot.order} saved. When this Mini-Block reaches ${RENDER_MINI_BLOCK_SECONDS}s of reviewed Previs timing, PlotPickle can hand it to the fixed ${RENDER_CLIPS_PER_MINI_BLOCK}-clip Render Plan.`);
  }

  function removeShot() {
    if (!selectedShot) return;
    const now = new Date().toISOString();
    commit({ type: "previs.shot.remove", shotId: selectedShot.id, occurredAt: now });
    setSelectedShotId("");
    setMessage("Creative Previs shot removed. Storyboard, Render Plan addresses and story canon were not changed.");
  }

  return (
    <main className={styles.workspace} aria-labelledby="previs-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Previs · 24 Blocks / 96 Mini-Blocks / {RENDER_CLIPS_PER_FEATURE.toLocaleString()} render clips</span>
          <h1 id="previs-title">See how the visual story plays before PlotPickle renders it.</h1>
          <p>
            Storyboard and Visualize establish what the film looks like. Previs authors camera and editorial timing. Render Plan then maps every 75-second Mini-Block onto exactly 25 technical 3-second generation clips. A creative shot may span one clip or several; the clip grid is production plumbing, not a second storytelling structure.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Project</dt><dd>{project.title}</dd></div>
          <div><dt>PPF revision</dt><dd>{projection.projectRevision}</dd></div>
          <div><dt>Mini-Blocks</dt><dd>{projection.totalAnchors}</dd></div>
          <div><dt>Render clips</dt><dd>{projection.totalRenderClips || RENDER_CLIPS_PER_FEATURE}</dd></div>
          <div><dt>Boundary keyframes</dt><dd>{projection.totalRenderKeyframes || RENDER_KEYFRAMES_PER_FEATURE}</dd></div>
        </dl>
      </header>

      <section className={styles.notice} aria-label="Previs and Render Plan authority boundary">
        <div>
          <strong>Storyboard → Visualize → Previs → Render Plan → Generate.</strong>
          <span>Previs decides creative camera timing. Render Plan only divides the approved 75-second Mini-Block into deterministic 3-second generation addresses.</span>
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
              <p>Four 75-second Mini-Blocks preserve story structure. Each becomes a fixed {RENDER_CLIPS_PER_MINI_BLOCK} × {RENDER_CLIP_SECONDS}s Render Plan, for {RENDER_CLIPS_PER_BLOCK} generation clips per five-minute Block.</p>
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
                  <span className={styles.videoBadge}>{anchor.renderPlanReady ? "RENDER PLAN READY" : anchor.timingAllowed ? "PREVIS OPEN" : anchor.observedReference ? "REFERENCE ONLY" : "NO TIMING YET"}</span>
                </div>
                <header className={styles.anchorHeader}>
                  <div>
                    <span>Mini-Block</span>
                    <strong>{selectedBlock.blockNumber}.{anchor.miniBlockNumber}</strong>
                  </div>
                  <span aria-label={`Status: ${STATE_LABELS[anchor.state]}`} className={styles.anchorState} data-state={anchor.state}>
                    <i aria-hidden="true" className={styles.stateLight} />
                    <b>{STATE_LABELS[anchor.state]}</b>
                  </span>
                </header>
                <p>{anchor.reason}</p>
                <dl className={styles.anchorMeta}>
                  <div><dt>Creative shots</dt><dd>{anchor.shots.length}</dd></div>
                  <div><dt>Render clips</dt><dd>{anchor.renderClips.length} × {RENDER_CLIP_SECONDS}s</dd></div>
                  <div><dt>Previs timing</dt><dd>{anchor.authoredDurationSeconds}/{RENDER_MINI_BLOCK_SECONDS}s</dd></div>
                </dl>
                <div className={styles.shotList} aria-label={`Creative Previs shots for ${anchor.blockNumber}.${anchor.miniBlockNumber}`}>
                  {anchor.shots.map((shot) => (
                    <button
                      data-stale={anchor.staleShotIds.includes(shot.id) ? "true" : "false"}
                      key={shot.id}
                      onClick={() => setSelectedShotId(shot.id)}
                      type="button"
                    >
                      Shot {shot.order} · {shot.durationSeconds ? `${shot.durationSeconds}s` : "timing open"}
                    </button>
                  ))}
                </div>
                <div className={styles.anchorActions}>
                  <button disabled={!anchor.timingAllowed} type="button" onClick={() => addShot(anchor)}>Add creative shot</button>
                  <button type="button" onClick={() => anchor.storyboardAllowed ? onOpenStoryboard(anchor) : onOpenBuild()}>
                    {anchor.storyboardAllowed ? "Open Storyboard" : "Review BUILD"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {selectedShot && selectedAnchor ? (
        <section className={styles.shotEditor} aria-labelledby="production-shot-title">
          <header>
            <div>
              <span>Creative Previs Shot · {selectedAnchor.blockNumber}.{selectedAnchor.miniBlockNumber}</span>
              <h2 id="production-shot-title">Shot {selectedShot.order}</h2>
            </div>
            <div className={styles.noticeActions}>
              <button type="button" onClick={() => onOpenStoryboard(selectedAnchor)}>Open owning Storyboard Mini-Block</button>
              <button type="button" onClick={removeShot}>Remove shot</button>
            </div>
          </header>
          {selectedShotStale ? (
            <p className={styles.staleNotice} role="status">This shot needs review because its approved Storyboard dependency changed. Saving below is an explicit Human confirmation against the current kept Storyboard visual.</p>
          ) : null}
          <form key={`${selectedShot.id}:${selectedShot.updatedAt}`} onSubmit={saveShot} className={styles.shotForm}>
            <label>Shot size<input name="shotSize" defaultValue={selectedShot.shotSize} /></label>
            <label>Angle<input name="angle" defaultValue={selectedShot.angle} /></label>
            <label>Movement<input name="movement" defaultValue={selectedShot.movement} /></label>
            <label>Lens<input name="lens" defaultValue={selectedShot.lens} /></label>
            <label>Duration seconds<input name="durationSeconds" type="number" min="0.01" step="0.01" defaultValue={selectedShot.durationSeconds ?? ""} placeholder={`Mini-Block total must reach ${RENDER_MINI_BLOCK_SECONDS}s`} /></label>
            <label>Status<select name="reviewState" defaultValue={selectedShot.reviewState}><option value="planned">Planned</option><option value="approved">Approved</option><option value="omitted">Omitted</option></select></label>
            <label>Transition in<input name="transitionIn" defaultValue={selectedShot.transitionIn} placeholder="Optional" /></label>
            <label>Transition out<input name="transitionOut" defaultValue={selectedShot.transitionOut} placeholder="Optional" /></label>
            <label className={styles.fullField}>Visual / production intent<textarea name="visualIntent" defaultValue={selectedShot.visualIntent} placeholder="Camera, movement or execution intent. Story changes belong upstream." /></label>
            <div className={styles.fullField}><button type="submit">Save creative shot</button></div>
          </form>
        </section>
      ) : null}

      <section className={styles.timelinePreview} aria-label="Previs to Render Plan projection">
        <header>
          <div>
            <span>Previs → Render Plan</span>
            <h2>Creative timing flows onto a fixed generation grid.</h2>
          </div>
          <strong>{RENDER_CLIPS_PER_BLOCK} fixed render clips in this Block</strong>
        </header>
        <div className={styles.timelineRail}>
          {(selectedBlock?.anchors ?? []).map((anchor) => (
            <div className={styles.timelineAnchor} data-state={anchor.state} key={anchor.id}>
              <i aria-hidden="true" className={styles.stateLight} />
              <span>{anchor.blockNumber}.{anchor.miniBlockNumber}</span>
              <small>{anchor.renderPlanReady ? `${RENDER_CLIPS_PER_MINI_BLOCK} render clips ready` : `${anchor.authoredDurationSeconds}/${RENDER_MINI_BLOCK_SECONDS}s Previs · ${RENDER_CLIPS_PER_MINI_BLOCK} reserved clips`}</small>
            </div>
          ))}
        </div>
        <p>Creative shots are not the render quota. PlotPickle preserves Human-authored camera intent, then maps the complete 75-second Mini-Block onto Clip 01–25. Each clip has a stable address and shares its boundary keyframe with the next clip, enabling surgical regeneration without rebuilding the whole sequence.</p>
      </section>

      <p className={styles.message} role="status">{message}</p>
      <footer className={styles.footer}>
        The default two-hour production grid is deterministic: 24 Blocks → 96 Mini-Blocks → {RENDER_CLIPS_PER_FEATURE.toLocaleString()} × {RENDER_CLIP_SECONDS}s render clips → {RENDER_KEYFRAMES_PER_FEATURE.toLocaleString()} shared boundary keyframes. Story canon remains upstream; Previs remains Human-authored; Render Plan remains technical.
      </footer>
    </main>
  );
}
