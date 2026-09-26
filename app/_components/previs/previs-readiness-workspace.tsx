"use client";

/* eslint-disable @next/next/no-img-element -- Previs keyframes are lazy local PlotPickle assets. */

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  storyboardAnchorEvidence,
  storyboardPositionProgression,
} from "../storyboard/storyboard-editorial-model";
import {
  createProductionShotForAnchor,
  derivePrevisProjection,
  shotNeedsReview,
  type PrevisAnchorProjection,
} from "./previs-projection-model";
import {
  PREVIS_FLIP_BOOK_INTERVAL_MS,
  PREVIS_GRAPHIC_NOVEL_INTERVAL_MS,
  buildPrevisGraphicNovelExportHtml,
  buildPrevisGraphicNovelPanel,
  graphicNovelExportFileName,
  type PrevisGraphicNovelPanel,
} from "./previs-graphic-novel-presentation";
import styles from "./previs-readiness-workspace.module.css";

function requestedAddress() {
  if (typeof window === "undefined") return { blockNumber: 1, miniBlockNumber: 1 };
  const query = new URLSearchParams(window.location.search);
  const blockNumber = Math.min(24, Math.max(1, Number(query.get("block") || 1) || 1));
  const miniBlockNumber = Math.min(4, Math.max(1, Number(query.get("mini") || 1) || 1));
  return { blockNumber, miniBlockNumber };
}

function preservePrevisAddress(blockNumber: number, miniBlockNumber: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("block", String(blockNumber));
  url.searchParams.set("mini", String(miniBlockNumber));
  window.history.replaceState(window.history.state, "", url);
}

const STATE_LABELS = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "AVAILABLE",
  locked: "BLOCKED",
} as const;

export default function PrevisReadinessWorkspace({
  project,
  onProjectChange,
  address,
  onAddressChange,
  embeddedNavigation = false,
}: {
  readonly project: PPFProject;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenStoryboard: (anchor?: PrevisAnchorProjection) => void;
  readonly address?: { readonly blockNumber: number; readonly miniBlockNumber: number };
  readonly onAddressChange?: (address: { blockNumber: number; miniBlockNumber: number }) => void;
  readonly embeddedNavigation?: boolean;
}) {
  const projection = useMemo(() => derivePrevisProjection(project), [project]);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(() => address?.blockNumber ?? requestedAddress().blockNumber);
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(() => address?.miniBlockNumber ?? requestedAddress().miniBlockNumber);
  const [selectedFramePosition, setSelectedFramePosition] = useState(1);
  const [flipBookPlaying, setFlipBookPlaying] = useState(false);
  const [graphicNovelPlaying, setGraphicNovelPlaying] = useState(false);
  useEffect(() => {
    if (!address) return;
    const timer = window.setTimeout(() => {
      setSelectedBlockNumber(address.blockNumber);
      setSelectedMiniBlockNumber(address.miniBlockNumber);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [address?.blockNumber, address?.miniBlockNumber]);
  const [selectedShotId, setSelectedShotId] = useState("");
  const [message, setMessage] = useState("");
  const selectedBlock = projection.blocks.find((block) => block.blockNumber === selectedBlockNumber)
    ?? projection.blocks[0]
    ?? null;
  const allAnchors = projection.blocks.flatMap((block) => block.anchors);
  const selectedAddressAnchor = selectedBlock?.anchors.find((anchor) => anchor.miniBlockNumber === selectedMiniBlockNumber)
    ?? selectedBlock?.anchors[0]
    ?? null;
  const selectedAnchor = allAnchors.find((anchor) => anchor.shots.some((shot) => shot.id === selectedShotId)) ?? null;
  const selectedShot = selectedAnchor?.shots.find((shot) => shot.id === selectedShotId) ?? null;
  const selectedShotStale = Boolean(selectedShot && selectedAnchor && shotNeedsReview(selectedAnchor, selectedShot));
  const selectedAct = Math.ceil(selectedBlockNumber / 6);
  const actBlocks = projection.blocks.filter((block) => Math.ceil(block.blockNumber / 6) === selectedAct);
  const acceptedVisualIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const activeFrameArtifacts = selectedAddressAnchor
    ? project.build.foundations.visualArtifacts
      .filter((artifact) => artifact.workflow === "storyboard-frame-webp-v2"
        && artifact.reviewState !== "rejected"
        && (artifact.sourceDecisionKeys ?? []).includes(selectedAddressAnchor.id))
    : [];
  const flipBookFrames = Array.from({ length: 25 }, (_, index) => {
    const position = index + 1;
    const artifacts = activeFrameArtifacts
      .filter((artifact) => artifact.frameNumber === position)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const locked = artifacts.find((artifact) => acceptedVisualIds.has(artifact.id) && artifact.reviewState === "accepted") ?? null;
    const candidate = artifacts[0] ?? null;
    return {
      position,
      locked,
      candidate,
      visual: locked ?? candidate,
      state: locked ? "locked" as const : candidate ? "review" as const : "empty" as const,
    };
  });
  const selectedFlipBookFrame = flipBookFrames[selectedFramePosition - 1];
  const lockedFrameCount = flipBookFrames.filter((frame) => frame.locked).length;
  const selectedFrameEvidence = selectedAddressAnchor
    ? storyboardAnchorEvidence(project, selectedAddressAnchor.targetId, selectedAddressAnchor.miniBlockNumber)
    : null;
  const selectedFrameSceneNumbers = [...new Set((selectedFrameEvidence?.passages ?? []).map((passage) => passage.sceneNumber).filter(Boolean))];
  const selectedFrameProgression = storyboardPositionProgression(selectedFramePosition);
  const selectedFrameShot = selectedAddressAnchor?.shots.find((shot) => shot.order === selectedFramePosition) ?? null;

  function graphicNovelPanelFor(position: number): PrevisGraphicNovelPanel {
    const frame = flipBookFrames[position - 1];
    const progression = storyboardPositionProgression(position);
    const shot = selectedAddressAnchor?.shots.find((candidate) => candidate.order === position) ?? null;
    return buildPrevisGraphicNovelPanel({
      position,
      assetUrl: frame?.locked?.assetUrl ?? "",
      authoritative: Boolean(frame?.locked),
      narrativeIntention: frame?.locked?.narrativeIntention ?? "",
      sceneNumbers: selectedFrameSceneNumbers.map((number) => String(number)),
      beatLabel: progression.label,
      beatDirection: progression.direction,
      shotLabel: shot ? `Shot ${String(shot.order).padStart(2, "0")} · ${shot.shotSize || "size open"}` : "Shot intent open",
      shotContext: shot ? [shot.angle, shot.movement, shot.visualIntent].filter(Boolean).join(" · ") : "",
    });
  }

  const graphicNovelPanels = flipBookFrames.map((frame) => graphicNovelPanelFor(frame.position));
  const selectedGraphicNovelPanel = graphicNovelPanels[selectedFramePosition - 1];

  useEffect(() => {
    setSelectedFramePosition(1);
    setFlipBookPlaying(false);
    setGraphicNovelPlaying(false);
  }, [selectedBlockNumber, selectedMiniBlockNumber]);

  useEffect(() => {
    if (!flipBookPlaying && !graphicNovelPlaying) return;
    const timer = window.setInterval(() => {
      setSelectedFramePosition((position) => position >= 25 ? 1 : position + 1);
    }, graphicNovelPlaying ? PREVIS_GRAPHIC_NOVEL_INTERVAL_MS : PREVIS_FLIP_BOOK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [flipBookPlaying, graphicNovelPlaying]);

  function exportGraphicNovel() {
    if (!selectedAddressAnchor) return;
    setFlipBookPlaying(false);
    setGraphicNovelPlaying(false);
    const exportPanels = graphicNovelPanels.map((panel) => ({
      ...panel,
      assetUrl: panel.authoritative && panel.assetUrl ? new URL(panel.assetUrl, window.location.origin).toString() : "",
    }));
    const html = buildPrevisGraphicNovelExportHtml({
      projectTitle: project.title || "Untitled Story",
      blockNumber: selectedAddressAnchor.blockNumber,
      miniBlockNumber: selectedAddressAnchor.miniBlockNumber,
      panels: exportPanels,
    });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = graphicNovelExportFileName(project.title || "Untitled Story", selectedAddressAnchor.blockNumber, selectedAddressAnchor.miniBlockNumber);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`Graphic Novel exported with ${lockedFrameCount} locked panel${lockedFrameCount === 1 ? "" : "s"}. Images remain linked to this local PlotPickle installation; derived narration is presentation-only and did not change story canon or Storyboard approval.`);
  }

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
    setMessage(`Shot ${shot.order} added under ${anchor.blockNumber}.${anchor.miniBlockNumber}. Camera, blocking, performance and timing remain Human-authored; leave unknown fields empty rather than inferring them from the story grid.`);
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
      blockingIntent: String(data.get("blockingIntent") ?? "").trim(),
      performanceEnergy: String(data.get("performanceEnergy") ?? "").trim(),
      pacingIntent: String(data.get("pacingIntent") ?? "").trim(),
      roughMotionEvidenceRefs: String(data.get("roughMotionEvidenceRefs") ?? "")
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 32),
      durationSeconds: parsedDuration && Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null,
      transitionIn: String(data.get("transitionIn") ?? "").trim(),
      transitionOut: String(data.get("transitionOut") ?? "").trim(),
      reviewState: String(data.get("reviewState") ?? "planned") as ProductionShotReviewState,
      updatedAt: now,
    };
    commit({ type: "previs.shot.store", shot, occurredAt: now });
    setMessage(`Shot ${shot.order} saved. Previs intent remains Human-authored. For the current 120-minute render preset, a reviewed ${RENDER_MINI_BLOCK_SECONDS}s Mini-Block can map to the fixed ${RENDER_CLIPS_PER_MINI_BLOCK}-clip technical Render Plan.`);
  }

  return (
    <main className={styles.workspace} aria-labelledby="previs-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Previs · Flip Book → Scene → Beat Detail → Shot → Frame</span>
          <h1 id="previs-title">Previs · {project.title || "Untitled Story"}</h1>
          <p>
            Previs inherits the Human-kept Storyboard sequence and tests how the visual story plays. Locked frames form the Flip Book; Scene, Beat Detail, Shot and Frame stay attached to the same story address while camera, blocking, performance, motion and timing remain Human-authored downstream intent.
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
          <strong>Locked Storyboard frames → Previs Flip Book → motion and timing intent.</strong>
          <span>Storyboard owns the still image and Keep / Lock decision. Previs can inspect draft positions, but only locked Storyboard frames become authoritative Flip Book material. Beat Detail is derived working context and never creates a new canonical Beat.</span>
        </div>
      </section>

      {!embeddedNavigation ? (
        <>
          <nav aria-label="Previs Acts" className={styles.actRail} role="tablist">
            {[1, 2, 3, 4].map((act) => (
              <button
                aria-selected={selectedAct === act}
                className={styles.actTab}
                key={act}
                onClick={() => {
                  const firstBlock = (act - 1) * 6 + 1;
                  setSelectedBlockNumber(firstBlock);
                  setSelectedMiniBlockNumber(1);
                  preservePrevisAddress(firstBlock, 1);
                  onAddressChange?.({ blockNumber: firstBlock, miniBlockNumber: 1 });
                }}
                role="tab"
                type="button"
              >
                Act {act}
              </button>
            ))}
          </nav>
          <nav aria-label={`Act ${selectedAct} Previs Block tabs`} className={styles.tabRail} role="tablist">
            {actBlocks.map((block) => {
              const selected = block.blockNumber === selectedBlock?.blockNumber;
              return (
                <button
                  aria-controls="previs-block-panel"
                  aria-label={`Block ${String(block.blockNumber).padStart(2, "0")}, ${STATE_LABELS[block.state]}`}
                  aria-selected={selected}
                  className={styles.blockTab}
                  data-state={block.state}
                  key={block.targetId}
                  onClick={() => {
                    setSelectedBlockNumber(block.blockNumber);
                    setSelectedMiniBlockNumber(1);
                    preservePrevisAddress(block.blockNumber, 1);
                    onAddressChange?.({ blockNumber: block.blockNumber, miniBlockNumber: 1 });
                  }}
                  role="tab"
                  type="button"
                >
                  <i aria-hidden="true" className={styles.stateLight} />
                  <span>Block {block.blockNumber - (selectedAct - 1) * 6}</span>
                </button>
              );
            })}
          </nav>
        </>
      ) : null}

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
              <p>Four canonical Mini-Block addresses preserve story provenance. Their creative shot density and timing remain variable. Under the current two-hour technical preset, a fully timed Mini-Block can project to {RENDER_CLIPS_PER_MINI_BLOCK} × {RENDER_CLIP_SECONDS}s render slots, for {RENDER_CLIPS_PER_BLOCK} technical clips per Block.</p>
            </div>
            <span aria-label={`Status: ${STATE_LABELS[selectedBlock.state]}`} className={styles.blockState} data-state={selectedBlock.state}>
              <i aria-hidden="true" className={styles.stateLight} />
              <strong>{STATE_LABELS[selectedBlock.state]}</strong>
            </span>
          </header>

          <div className={styles.anchorGrid} aria-label={`Block ${selectedBlock.blockNumber} Previs anchors`}>
            {selectedBlock.anchors.map((anchor) => (
              <article
                className={styles.anchorCard}
                data-selected={selectedMiniBlockNumber === anchor.miniBlockNumber ? "true" : undefined}
                data-state={anchor.state}
                key={anchor.id}
              >
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
                  <div><dt>Visual coverage</dt><dd>{anchor.storyboardCoverage === "kept" ? "Kept" : anchor.storyboardCoverage === "candidate" ? "Candidate" : "None"}</dd></div>
                  <div><dt>Creative shots</dt><dd>{anchor.shots.length}</dd></div>
                  <div><dt>Previs timing</dt><dd>{anchor.authoredDurationSeconds ? `${anchor.authoredDurationSeconds}s authored` : "Missing"}</dd></div>
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
                </div>
              </article>
            ))}
          </div>

          {selectedAddressAnchor ? (
            <section className={styles.flipBook} aria-labelledby="previs-flipbook-title" data-previs-flipbook="25-positions">
              <header className={styles.flipBookHeader}>
                <div>
                  <span className={styles.eyebrow}>Locked Storyboard sequence</span>
                  <h3 id="previs-flipbook-title">Flip Book · Mini-Block {selectedAddressAnchor.blockNumber}.{selectedAddressAnchor.miniBlockNumber}</h3>
                  <p>Fan through the 25 Storyboard positions as one visual sequence. Only Keep / Lock frames are authoritative Previs inputs; unlocked candidates stay visible in the strip for review context only.</p>
                </div>
                <strong>{lockedFrameCount}/25 locked</strong>
              </header>

              <div className={styles.flipBookViewer}>
                <div className={styles.flipBookStage} data-frame-state={selectedFlipBookFrame.locked ? "locked" : selectedFlipBookFrame.candidate ? "review" : "empty"}>
                  {selectedFlipBookFrame.locked ? (
                    <img
                      alt={selectedFlipBookFrame.locked.narrativeIntention || `Locked Storyboard frame ${selectedFramePosition}`}
                      decoding="async"
                      src={selectedFlipBookFrame.locked.assetUrl}
                    />
                  ) : (
                    <div className={styles.flipBookBlocked}>
                      <strong>Position {String(selectedFramePosition).padStart(2, "0")} is not locked for Previs.</strong>
                      <span>{selectedFlipBookFrame.candidate ? "A Storyboard candidate exists, but Keep / Lock is required before it enters the Flip Book." : "No Storyboard frame is available at this position yet."}</span>
                    </div>
                  )}
                  {graphicNovelPlaying ? (
                    <aside className={styles.graphicNovelCaption} aria-live="polite">
                      <small>{selectedGraphicNovelPanel.caption}</small>
                      <strong>{selectedGraphicNovelPanel.narration}</strong>
                      <span>{selectedGraphicNovelPanel.shotLabel}{selectedGraphicNovelPanel.shotContext ? ` · ${selectedGraphicNovelPanel.shotContext}` : ""}</span>
                      <em>Derived Previs narration · presentation only</em>
                    </aside>
                  ) : null}
                  <span className={styles.flipBookCounter}>Frame {String(selectedFramePosition).padStart(2, "0")} / 25</span>
                </div>

                <div className={styles.flipBookControls} aria-label="Previs presentation playback">
                  <button type="button" onClick={() => {
                    setFlipBookPlaying(false);
                    setGraphicNovelPlaying(false);
                    setSelectedFramePosition((position) => position <= 1 ? 25 : position - 1);
                  }}>Previous</button>
                  <button aria-pressed={flipBookPlaying} type="button" onClick={() => {
                    setGraphicNovelPlaying(false);
                    setFlipBookPlaying((playing) => !playing);
                  }}>{flipBookPlaying ? "Pause Flip Book" : "Play Flip Book"}</button>
                  <button aria-pressed={graphicNovelPlaying} type="button" onClick={() => {
                    setFlipBookPlaying(false);
                    setGraphicNovelPlaying((playing) => !playing);
                  }}>{graphicNovelPlaying ? "Pause Graphic Novel" : "Play Graphic Novel"}</button>
                  <button disabled={!lockedFrameCount} type="button" onClick={exportGraphicNovel}>Export Graphic Novel</button>
                  <button type="button" onClick={() => {
                    setFlipBookPlaying(false);
                    setGraphicNovelPlaying(false);
                    setSelectedFramePosition((position) => position >= 25 ? 1 : position + 1);
                  }}>Next</button>
                </div>
              </div>

              <div className={styles.flipBookStrip} aria-label="25 Previs Flip Book positions">
                {flipBookFrames.map((frame) => (
                  <button
                    aria-current={frame.position === selectedFramePosition ? "true" : undefined}
                    aria-label={`Position ${frame.position}, ${frame.locked ? "locked" : frame.candidate ? "unlocked Storyboard candidate" : "empty"}`}
                    data-frame-state={frame.state}
                    key={frame.position}
                    onClick={() => {
                      setFlipBookPlaying(false);
                      setGraphicNovelPlaying(false);
                      setSelectedFramePosition(frame.position);
                    }}
                    type="button"
                  >
                    {frame.visual
                      ? <img alt="" aria-hidden="true" decoding="async" loading="lazy" src={frame.visual.assetUrl} />
                      : <span className={styles.flipBookEmpty}>—</span>}
                    <strong>{String(frame.position).padStart(2, "0")}</strong>
                    <small>{frame.locked ? "LOCKED" : frame.candidate ? "REVIEW" : "EMPTY"}</small>
                  </button>
                ))}
              </div>

              <div className={styles.flipBookDetail} aria-label={`Previs detail for position ${selectedFramePosition}`}>
                <article>
                  <span>Scene</span>
                  <strong>{selectedFrameSceneNumbers.length ? selectedFrameSceneNumbers.map((number) => `Scene ${number}`).join(" · ") : "No mapped Scene"}</strong>
                  <p>{selectedFrameEvidence?.passages.length ? `${selectedFrameEvidence.passages.length} screenplay passage${selectedFrameEvidence.passages.length === 1 ? "" : "s"} support this Mini-Block.` : "Previs will not invent a Scene where screenplay evidence is missing."}</p>
                </article>
                <article>
                  <span>Beat Detail</span>
                  <strong>{selectedFrameProgression.label}</strong>
                  <p>{selectedFrameProgression.direction}</p>
                  <small>Derived Previs detail only · does not create a canonical Beat.</small>
                </article>
                <article>
                  <span>Shot</span>
                  <strong>{selectedFrameShot ? `Shot ${String(selectedFrameShot.order).padStart(2, "0")} · ${selectedFrameShot.shotSize || "size open"}` : "Shot intent open"}</strong>
                  <p>{selectedFrameShot ? [selectedFrameShot.angle, selectedFrameShot.movement, selectedFrameShot.visualIntent].filter(Boolean).join(" · ") || "Camera intent remains open." : "Storyboard owns the locked still; Previs adds camera, blocking, performance and timing intent without rewriting the story."}</p>
                </article>
                <article>
                  <span>Frame</span>
                  <strong>Position {String(selectedFramePosition).padStart(2, "0")} · {selectedFlipBookFrame.locked ? "Locked" : selectedFlipBookFrame.candidate ? "Awaiting Keep / Lock" : "Missing"}</strong>
                  <p>{selectedFlipBookFrame.locked?.narrativeIntention || selectedFlipBookFrame.candidate?.narrativeIntention || "No Storyboard frame is attached to this position."}</p>
                </article>
              </div>
            </section>
          ) : null}

          {selectedAddressAnchor ? (
            <section className={styles.evidencePanel} id="previs-selected-evidence" aria-label="Selected Previs anchor source and Storyboard provenance">
              <header>
                <div>
                  <span>Selected story address</span>
                  <h3>Block {String(selectedAddressAnchor.blockNumber).padStart(2, "0")} · Mini-Block {selectedAddressAnchor.miniBlockNumber}</h3>
                </div>
                <strong>{selectedAddressAnchor.storyboardCoverage === "kept" ? "KEPT STORYBOARD" : selectedAddressAnchor.storyboardCoverage === "candidate" ? "CANDIDATE STORYBOARD" : "NO STORYBOARD VISUAL"}</strong>
              </header>
              <div className={styles.evidenceGrid}>
                <div>
                  <b>Written / structural evidence</b>
                  <p>{selectedAddressAnchor.sourcePassageCount} screenplay passage{selectedAddressAnchor.sourcePassageCount === 1 ? "" : "s"} · {selectedAddressAnchor.sourceSceneCount} scene{selectedAddressAnchor.sourceSceneCount === 1 ? "" : "s"}</p>
                  <p>{selectedAddressAnchor.structuralResponsibility || "No structural responsibility is recorded for this address."}</p>
                  <small>Human structural finding: {selectedAddressAnchor.structuralFinding.replaceAll("-", " / ")}</small>
                </div>
                <div>
                  <b>Storyboard provenance</b>
                  <p>{selectedAddressAnchor.storyboardSourceKind
                    ? selectedAddressAnchor.storyboardSourceKind === "historical-storyboard"
                      ? "Historical Storyboard reference candidate"
                      : "PlotPickle replacement concept candidate"
                    : selectedAddressAnchor.storyboardCoverage === "kept"
                      ? "Human-kept PPF visual"
                      : "No visual candidate"}</p>
                  <small>{selectedAddressAnchor.storyboardProvenanceRefs.length} candidate provenance refs · {selectedAddressAnchor.acceptedVisualRefs.length} accepted target-scoped visual refs</small>
                </div>
                <div>
                  <b>Previs motion / timing evidence</b>
                  <p>{selectedAddressAnchor.shots.length} creative Production Shot{selectedAddressAnchor.shots.length === 1 ? "" : "s"} · {selectedAddressAnchor.authoredDurationSeconds ? `${selectedAddressAnchor.authoredDurationSeconds}s authored timing` : "timing missing"}</p>
                  <small>{selectedAddressAnchor.shots.reduce((sum, shot) => sum + (shot.roughMotionEvidenceRefs?.length ?? 0), 0)} rough/local motion evidence ref{selectedAddressAnchor.shots.reduce((sum, shot) => sum + (shot.roughMotionEvidenceRefs?.length ?? 0), 0) === 1 ? "" : "s"}</small>
                </div>
              </div>
              <div className={styles.mappingRefs}>
                {selectedAddressAnchor.sourceMappings.map((mapping) => (
                  <small key={`${mapping.sourceVersion}:${mapping.sourceRef}`}>
                    {mapping.sourceVersion.toUpperCase()} · {mapping.sourceRole.replaceAll("-", " ")} · {mapping.mappingMethod.replaceAll("-", " ")}
                    {mapping.candidateOnly ? " · comparison only" : ""} · {mapping.sourceRef}
                  </small>
                ))}
              </div>
              <p className={styles.evidenceBoundary}>Missing motion or timing stays missing. Rough previews and motion references are evidence only; adding them does not change a Production Shot from Planned to Approved or promote a visual into canon.</p>
            </section>
          ) : null}
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
            <label>Duration seconds<input name="durationSeconds" type="number" min="0.01" step="0.01" defaultValue={selectedShot.durationSeconds ?? ""} placeholder="Optional until Human-authored" /></label>
            <label>Status<select name="reviewState" defaultValue={selectedShot.reviewState === "omitted" ? "planned" : selectedShot.reviewState}><option value="planned">Planned</option><option value="approved">Approved</option></select></label>
            <label>Transition in<input name="transitionIn" defaultValue={selectedShot.transitionIn} placeholder="Optional" /></label>
            <label>Transition out<input name="transitionOut" defaultValue={selectedShot.transitionOut} placeholder="Optional" /></label>
            <label className={styles.fullField}>Blocking intent<textarea name="blockingIntent" defaultValue={selectedShot.blockingIntent ?? ""} placeholder="Human-authored movement, position, eyeline or staging intent. Leave blank when unknown." /></label>
            <label className={styles.fullField}>Performance energy<textarea name="performanceEnergy" defaultValue={selectedShot.performanceEnergy ?? ""} placeholder="Human-authored performance intensity or behavioural energy. Leave blank when unknown." /></label>
            <label className={styles.fullField}>Pacing / rhythm intent<textarea name="pacingIntent" defaultValue={selectedShot.pacingIntent ?? ""} placeholder="Human-authored rhythm, hold, acceleration or pause intent. Exact timing remains separate." /></label>
            <label className={styles.fullField}>Visual / production intent<textarea name="visualIntent" defaultValue={selectedShot.visualIntent} placeholder="Camera, movement or execution intent. Story changes belong upstream." /></label>
            <label className={styles.fullField}>Rough motion evidence refs<textarea name="roughMotionEvidenceRefs" defaultValue={(selectedShot.roughMotionEvidenceRefs ?? []).join("\n")} placeholder="Optional local/rough animatic or motion-evidence refs, one per line. These do not approve the shot." /></label>
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
              <small>{anchor.renderPlanReady
                ? `${RENDER_CLIPS_PER_MINI_BLOCK} render clips ready`
                : anchor.authoredDurationSeconds
                  ? `${anchor.authoredDurationSeconds}/${RENDER_MINI_BLOCK_SECONDS}s authored · ${RENDER_CLIPS_PER_MINI_BLOCK} reserved technical clips`
                  : `timing missing · ${RENDER_CLIPS_PER_MINI_BLOCK} reserved technical clips`}</small>
            </div>
          ))}
        </div>
        <p>Creative shots are not the render quota. PlotPickle preserves Human-authored camera, blocking, performance and timing intent. For the current two-hour preset only, a complete 75-second Mini-Block maps onto Clip 01–25. Each clip has a stable address and shares its boundary keyframe with the next clip, enabling surgical regeneration without rebuilding the whole sequence.</p>
      </section>

      <p className={styles.message} role="status">{message}</p>
      <footer className={styles.footer}>
        The default two-hour technical production grid is deterministic: 24 Blocks → 96 Mini-Blocks → {RENDER_CLIPS_PER_FEATURE.toLocaleString()} × {RENDER_CLIP_SECONDS}s render clips → {RENDER_KEYFRAMES_PER_FEATURE.toLocaleString()} shared boundary keyframes. Story canon remains upstream; Previs remains Human-authored; Render Plan remains technical.
      </footer>
    </main>
  );
}
