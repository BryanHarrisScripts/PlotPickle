"use client";

/* eslint-disable @next/next/no-img-element -- Scene Workspace previews existing local Storyboard/Previs artifacts. */

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import type { PlotPickleProject } from "@/lib/projects/project";
import {
  projectSceneWorkspace,
  type SceneWorkspaceCue,
} from "@/lib/preproduction/scene-workspace-projection";
import type { VisualStoryProjection } from "@/lib/preproduction/visual-story-projection";
import styles from "./scene-timeline-workspace.module.css";

function clock(seconds: number) {
  const bounded = Math.max(0, seconds);
  const minutes = Math.floor(bounded / 60);
  const remainder = bounded - (minutes * 60);
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function spanStyle(startSecond: number, endSecond: number, totalSeconds: number): CSSProperties {
  const total = Math.max(totalSeconds, 0.01);
  const left = Math.max(0, Math.min(100, (startSecond / total) * 100));
  const width = Math.max(0.8, Math.min(100 - left, ((endSecond - startSecond) / total) * 100));
  return { left: `${left}%`, width: `${width}%` };
}

function markerStyle(second: number, totalSeconds: number): CSSProperties {
  const total = Math.max(totalSeconds, 0.01);
  return { left: `${Math.max(0, Math.min(100, (second / total) * 100))}%` };
}

function canEditTiming(
  shot: ReturnType<typeof projectSceneWorkspace>["timeline"]["shots"][number] | null,
) {
  return Boolean(shot?.productionShotId && shot.reviewState === "planned");
}

function timingLabel(cue: SceneWorkspaceCue) {
  if (cue.startSecond !== null && cue.endSecond !== null) {
    return `${clock(cue.startSecond)} → ${clock(cue.endSecond)}`;
  }
  return cue.timingState === "blocked"
    ? "Position blocked by earlier untimed Shot"
    : "Timing not authored";
}

export default function SceneTimelineWorkspace({
  project,
  legacyProject,
  visualStory,
  selectedShotId,
  active,
  onSelectShot,
  onProjectChange,
}: {
  readonly project: LibraryPPFProject;
  readonly legacyProject: PlotPickleProject | null;
  readonly visualStory: VisualStoryProjection;
  readonly selectedShotId: string;
  readonly active: boolean;
  readonly onSelectShot: (shotId: string) => void;
  readonly onProjectChange: (project: PPFProject) => void;
}) {
  const workspace = useMemo(
    () => projectSceneWorkspace({ project, visualStory, legacyProject }),
    [legacyProject, project, visualStory],
  );
  const timeline = workspace.timeline;
  const [selectedCueId, setSelectedCueId] = useState("");
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");

  const selectedCue = workspace.cues.find((cue) => cue.id === selectedCueId)
    ?? workspace.shot.find((cue) => cue.shotId === selectedShotId)
    ?? workspace.shot[0]
    ?? workspace.dialogue[0]
    ?? workspace.action[0]
    ?? workspace.audio[0]
    ?? null;
  const selectedShot = timeline.shots.find((shot) => (
    shot.id === selectedCue?.shotId || shot.id === selectedShotId
  )) ?? timeline.shots[0] ?? null;
  const previewFrame = selectedShot?.frames[0]
    ?? visualStory.anchors.flatMap((anchor) => anchor.frames)[0]
    ?? null;
  const activeShot = timeline.shots.find((shot) => (
    shot.startSecond !== null
    && shot.endSecond !== null
    && playheadSeconds >= shot.startSecond
    && playheadSeconds < shot.endSecond
  )) ?? null;

  useEffect(() => {
    if (!active && playing) setPlaying(false);
  }, [active, playing]);

  useEffect(() => {
    if (timeline.totalSeconds <= 0) {
      setPlayheadSeconds(0);
      setPlaying(false);
      return;
    }
    setPlayheadSeconds((current) => Math.min(current, timeline.totalSeconds));
  }, [timeline.sceneId, timeline.totalSeconds]);

  useEffect(() => {
    if (!active || playing || !selectedCue || selectedCue.startSecond === null) return;
    setPlayheadSeconds(selectedCue.startSecond);
  }, [active, playing, selectedCue?.id, selectedCue?.startSecond]);

  useEffect(() => {
    if (!active || !playing || timeline.totalSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setPlayheadSeconds((current) => {
        const next = Math.min(timeline.totalSeconds, current + 0.1);
        if (next >= timeline.totalSeconds) window.setTimeout(() => setPlaying(false), 0);
        return next;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [active, playing, timeline.totalSeconds]);

  useEffect(() => {
    if (!active || !playing || !activeShot || activeShot.id === selectedShotId) return;
    onSelectShot(activeShot.id);
    const cue = workspace.shot.find((candidate) => candidate.shotId === activeShot.id);
    if (cue) setSelectedCueId(cue.id);
  }, [active, activeShot?.id, onSelectShot, playing, selectedShotId, workspace.shot]);

  function preserveSceneWorkspaceAddress(cue: SceneWorkspaceCue | null) {
    if (!cue) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", "timeline");
    url.searchParams.set("block", String(cue.blockNumber));
    url.searchParams.set("mini", String(cue.miniBlockNumber));
    if (workspace.sceneId) url.searchParams.set("scene", workspace.sceneId);
    if (cue.shotId) url.searchParams.set("shot", cue.shotId);
    else url.searchParams.delete("shot");
    window.history.replaceState(window.history.state, "", url);
  }

  function selectCue(cue: SceneWorkspaceCue) {
    setSelectedCueId(cue.id);
    preserveSceneWorkspaceAddress(cue);
    if (cue.shotId) onSelectShot(cue.shotId);
    if (cue.startSecond !== null) setPlayheadSeconds(cue.startSecond);
  }

  function saveDuration(durationSeconds: number | null) {
    if (!selectedShot?.productionShotId) {
      setMessage("This cue has no persisted Previs ProductionShotIntent, so Scene Workspace has no timing authority to update.");
      return;
    }
    const current = project.production.shots.find((shot) => shot.id === selectedShot.productionShotId);
    if (!current) {
      setMessage("The selected Previs Shot no longer exists in the current project revision.");
      return;
    }
    if (current.reviewState === "approved") {
      setMessage("Approved Shot timing is protected. Consequential approved changes remain on the existing creative-transaction path.");
      return;
    }
    if (current.reviewState === "omitted") {
      setMessage("Omitted Shots are not timing-editable from Scene Workspace.");
      return;
    }

    const normalized = durationSeconds === null
      ? null
      : Math.max(0.01, Math.min(3600, Math.round(durationSeconds * 100) / 100));
    const now = new Date().toISOString();
    const next = applyStoryCommand(project, {
      type: "previs.shot.store",
      shot: { ...current, durationSeconds: normalized, updatedAt: now },
      occurredAt: now,
    });
    const saved = saveFoundationProject(next);
    onProjectChange(saved);
    setMessage(normalized === null
      ? `Shot ${selectedShot.order} is untimed again. No replacement timestamp was invented.`
      : `Shot ${selectedShot.order} duration saved to ${normalized}s through the existing Previs authority. Dialogue, Action and Audio source cues were unchanged.`);
  }

  function submitDuration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = String(data.get("durationSeconds") ?? "").trim();
    if (!raw) {
      saveDuration(null);
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Enter a positive duration in seconds, or clear the field to leave the Shot untimed.");
      return;
    }
    saveDuration(value);
  }

  function nudgeDuration(deltaSeconds: number) {
    if (!selectedShot) return;
    saveDuration(Math.max(0.01, (selectedShot.durationSeconds ?? 0) + deltaSeconds));
  }

  function renderLane(label: string, cues: readonly SceneWorkspaceCue[]) {
    const timed = cues.filter((cue) => cue.startSecond !== null && cue.endSecond !== null);
    const unplaced = cues.filter((cue) => cue.startSecond === null || cue.endSecond === null);
    return (
      <div className={styles.lane} data-lane={label.toLowerCase()}>
        <strong className={styles.laneLabel}>{label}</strong>
        <div className={styles.laneBody}>
          <div className={styles.track}>
            {timed.map((cue) => (
              <button
                aria-pressed={cue.id === selectedCue?.id}
                className={styles.timedCue}
                data-owner={cue.owner}
                key={cue.id}
                onClick={() => selectCue(cue)}
                style={spanStyle(cue.startSecond!, cue.endSecond!, timeline.totalSeconds)}
                title={cue.detail}
                type="button"
              >
                {cue.label}
              </button>
            ))}
          </div>
          {unplaced.length ? (
            <div className={styles.unplaced}>
              {unplaced.map((cue) => (
                <button
                  aria-pressed={cue.id === selectedCue?.id}
                  data-owner={cue.owner}
                  key={cue.id}
                  onClick={() => selectCue(cue)}
                  type="button"
                >
                  <strong>{cue.label}</strong>
                  <span>{cue.detail}</span>
                  <small>{cue.timingState === "blocked" ? "BLOCKED" : "UNTIMED"} · {cue.sourceRef}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!visualStory.selectedScene) return null;

  return (
    <section
      aria-label={`Scene Workspace for ${visualStory.selectedScene.title}`}
      className={styles.workspace}
      data-projection-only="true"
      data-scene-workspace="dialogue-action-shot-audio"
      hidden={!active}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Scene Workspace · Dialogue / Action / Shot / Audio</p>
          <h3>{workspace.sceneTitle}</h3>
          <p>One synchronized projection over the screenplay, Storyboard, Previs and audio authorities. Cue placement never creates a parallel timeline canon.</p>
        </div>
        <div className={styles.summary}>
          <span>{workspace.sourcePassages.length} source passages</span>
          <span>{workspace.cues.length} cues</span>
          <span>{timeline.timedShotCount}/{timeline.shots.length} timed Shots</span>
        </div>
      </header>

      <div className={styles.contextStrip} aria-label="Scene Workspace story address">
        <span>Scene · {workspace.sceneId}</span>
        {selectedCue ? <span>Block {String(selectedCue.blockNumber).padStart(2, "0")} · Mini-Block {selectedCue.miniBlockNumber}</span> : null}
        <span>{workspace.sourceFileName || "No screenplay source file"}</span>
      </div>

      <div className={styles.topGrid}>
        <section className={styles.sourcePanel} aria-label="Scene screenplay source">
          <div className={styles.panelHeading}>
            <p className={styles.kicker}>Screenplay source</p>
            <strong>{workspace.sourcePassages.length ? "REAL IMPORTED EVIDENCE" : "NO MAPPED SOURCE"}</strong>
          </div>
          <div className={styles.sourceScroll}>
            {workspace.sourcePassages.length ? workspace.sourcePassages.map((passage) => (
              <button
                className={styles.sourcePassage}
                data-source-type={passage.type}
                key={passage.id}
                onClick={() => {
                  const cue = workspace.cues.find((candidate) => candidate.sourceRef === passage.sourceRef);
                  if (cue) selectCue(cue);
                }}
                type="button"
              >
                <small>{passage.type} · Scene {passage.sceneNumber} · {passage.blockNumber}.{passage.miniBlockNumber}</small>
                <span>{passage.text}</span>
              </button>
            )) : (
              <p className={styles.empty}>No imported screenplay passage is mapped to this Scene. Scene Workspace does not fabricate dialogue or action to fill the source panel.</p>
            )}
          </div>
        </section>

        <section className={styles.preview} aria-label="Scene intent playback">
          <div className={styles.panelHeading}>
            <p className={styles.kicker}>Intent playback</p>
            <strong>ROUGH / PREVIS MEDIA IS VALID</strong>
          </div>
          <div className={styles.previewImage}>
            {previewFrame
              ? <img alt={previewFrame.narrativePurpose || "Selected Scene Workspace frame"} src={previewFrame.assetUrl} />
              : <span>NO LINKED PLAYBACK FRAME</span>}
            <i>INTENT PREVIEW</i>
          </div>
          <div className={styles.transport}>
            <div className={styles.transportButtons}>
              <button disabled={timeline.totalSeconds <= 0} onClick={() => { setPlaying(false); setPlayheadSeconds(0); }} type="button">|◀</button>
              <button disabled={timeline.totalSeconds <= 0} onClick={() => setPlaying((value) => !value)} type="button">{playing ? "Pause" : "Play"}</button>
              <button disabled={timeline.totalSeconds <= 0} onClick={() => { setPlaying(false); setPlayheadSeconds(timeline.totalSeconds); }} type="button">▶|</button>
            </div>
            <strong>{clock(playheadSeconds)}</strong>
            <input
              aria-label="Scene Workspace playhead"
              disabled={timeline.totalSeconds <= 0}
              max={Math.max(0.1, timeline.totalSeconds)}
              min="0"
              onChange={(event) => { setPlaying(false); setPlayheadSeconds(Number(event.currentTarget.value)); }}
              step="0.1"
              type="range"
              value={Math.min(playheadSeconds, Math.max(0.1, timeline.totalSeconds))}
            />
            <small>Intent playback follows authored Shot timing only. It does not claim frame-accurate final-media playback.</small>
          </div>
        </section>

        <aside className={styles.inspector} aria-label="Selected Scene Workspace cue inspector">
          <p className={styles.kicker}>Cue inspector</p>
          {selectedCue ? (
            <>
              <h4>{selectedCue.lane.toUpperCase()} · {selectedCue.label}</h4>
              <p className={styles.intent}>{selectedCue.detail || "No intent detail is authored for this cue."}</p>
              <dl className={styles.cueFacts}>
                <div><dt>Owner</dt><dd>{selectedCue.owner}</dd></div>
                <div><dt>Timing</dt><dd>{timingLabel(selectedCue)}</dd></div>
                <div><dt>Address</dt><dd>{selectedCue.blockNumber}.{selectedCue.miniBlockNumber}</dd></div>
                <div><dt>Source</dt><dd>{selectedCue.sourceRef}</dd></div>
              </dl>
              <div className={styles.inspectorActions}>
                <button
                  onClick={() => window.location.assign(`/?workspace=write&block=${selectedCue.blockNumber}&mini=${selectedCue.miniBlockNumber}`)}
                  type="button"
                >
                  Back to Write
                </button>
                <button
                  onClick={() => window.location.assign(`/previs?block=${selectedCue.blockNumber}&mini=${selectedCue.miniBlockNumber}`)}
                  type="button"
                >
                  Open Previs / Production intent
                </button>
              </div>
            </>
          ) : <p className={styles.empty}>No real cue exists in this Scene yet.</p>}
        </aside>
      </div>

      <section className={styles.timelinePanel} aria-label="Synchronized Scene Workspace timeline">
        <div className={styles.ruler}>
          {timeline.anchors.map((anchor) => (
            <span key={anchor.anchorRef} style={markerStyle(anchor.startSecond, timeline.totalSeconds)}>
              {anchor.blockNumber}.{anchor.miniBlockNumber}
            </span>
          ))}
        </div>
        {renderLane("Dialogue", workspace.dialogue)}
        {renderLane("Action", workspace.action)}
        {renderLane("Shot", workspace.shot)}
        {renderLane("Audio", workspace.audio)}
        {timeline.totalSeconds > 0 ? (
          <div aria-hidden="true" className={styles.playhead} style={markerStyle(playheadSeconds, timeline.totalSeconds)} />
        ) : null}
      </section>

      {selectedCue?.lane === "shot" && selectedShot ? (
        <section className={styles.timingControls} aria-label="Selected Shot bounded timing edit">
          <div>
            <p className={styles.kicker}>Bounded Shot timing change</p>
            <strong>Shot {selectedShot.order}</strong>
            <span>{selectedShot.startSecond === null ? "Start unresolved" : `${clock(selectedShot.startSecond)} → ${clock(selectedShot.endSecond ?? selectedShot.startSecond)}`}</span>
          </div>
          <form key={`${selectedShot.id}:${selectedShot.durationSeconds ?? "untimed"}`} onSubmit={submitDuration}>
            <label>
              Duration seconds
              <input
                defaultValue={selectedShot.durationSeconds ?? ""}
                disabled={!canEditTiming(selectedShot)}
                min="0.01"
                name="durationSeconds"
                placeholder="Untimed"
                step="0.01"
                type="number"
              />
            </label>
            <div className={styles.nudges}>
              <button disabled={!canEditTiming(selectedShot)} onClick={() => nudgeDuration(-1)} type="button">−1s</button>
              <button disabled={!canEditTiming(selectedShot)} onClick={() => nudgeDuration(-0.25)} type="button">−.25</button>
              <button disabled={!canEditTiming(selectedShot)} onClick={() => nudgeDuration(0.25)} type="button">+.25</button>
              <button disabled={!canEditTiming(selectedShot)} onClick={() => nudgeDuration(1)} type="button">+1s</button>
              <button disabled={!canEditTiming(selectedShot)} onClick={() => saveDuration(null)} type="button">Clear timing</button>
              <button disabled={!canEditTiming(selectedShot)} type="submit">Save duration</button>
            </div>
          </form>
          <p className={styles.authorityNote}>
            Only the existing planned Previs ProductionShotIntent duration is editable here. Dialogue, Action and Audio remain source-owned and are never shifted into a Scene Workspace store.
          </p>
        </section>
      ) : null}

      <p className={styles.message} aria-live="polite">{message}</p>
      <footer className={styles.boundary}>
        Projection only. Dialogue stays screenplay-owned; Action stays screenplay/Beat-owned; Shot timing stays Previs-owned; Audio stays Sequence Director / Sonic Cue-owned. Missing cues remain missing and no Scene Workspace canon store is created.
      </footer>
    </section>
  );
}
