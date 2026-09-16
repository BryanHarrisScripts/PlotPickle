"use client";

/* eslint-disable @next/next/no-img-element -- Scene Timeline previews existing local Storyboard artifacts. */

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  projectSceneTimeline,
  type SceneTimelineShotProjection,
} from "@/lib/preproduction/scene-timeline-projection";
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

function canEditTiming(shot: SceneTimelineShotProjection | null) {
  return Boolean(shot?.productionShotId && shot.reviewState === "planned");
}

export default function SceneTimelineWorkspace({
  project,
  visualStory,
  selectedShotId,
  active,
  onSelectShot,
  onProjectChange,
}: {
  readonly project: LibraryPPFProject;
  readonly visualStory: VisualStoryProjection;
  readonly selectedShotId: string;
  readonly active: boolean;
  readonly onSelectShot: (shotId: string) => void;
  readonly onProjectChange: (project: PPFProject) => void;
}) {
  const timeline = useMemo(() => projectSceneTimeline(visualStory), [visualStory]);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const selectedShot = timeline.shots.find((shot) => shot.id === selectedShotId) ?? timeline.shots[0] ?? null;
  const previewFrame = selectedShot?.frames[0] ?? null;
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
    if (!active || playing || !selectedShot || selectedShot.startSecond === null) return;
    setPlayheadSeconds(selectedShot.startSecond);
  }, [active, playing, selectedShot?.id, selectedShot?.startSecond]);

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
    if (active && playing && activeShot && activeShot.id !== selectedShotId) onSelectShot(activeShot.id);
  }, [active, activeShot?.id, onSelectShot, playing, selectedShotId]);

  function selectShot(shot: SceneTimelineShotProjection) {
    onSelectShot(shot.id);
    if (shot.startSecond !== null) setPlayheadSeconds(shot.startSecond);
  }

  function saveDuration(durationSeconds: number | null) {
    if (!selectedShot?.productionShotId) {
      setMessage("This visual Shot has no persisted Previs ProductionShotIntent yet, so there is no timing authority to update.");
      return;
    }
    const current = project.production.shots.find((shot) => shot.id === selectedShot.productionShotId);
    if (!current) {
      setMessage("The selected Previs Shot no longer exists in the current project revision.");
      return;
    }
    if (current.reviewState === "approved") {
      setMessage("Approved timing is protected in Slice 3. Consequential approved changes remain on the #2035 path proved in Slice 5.");
      return;
    }
    if (current.reviewState === "omitted") {
      setMessage("Omitted Shots are not timing-editable from the Scene Timeline.");
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
      : `Shot ${selectedShot.order} duration saved to ${normalized}s through the existing Previs Shot authority.`);
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
    const baseline = selectedShot.durationSeconds ?? 0;
    saveDuration(Math.max(0.01, baseline + deltaSeconds));
  }

  if (!visualStory.selectedScene) return null;

  return (
    <section
      aria-label={`Scene Timeline for ${visualStory.selectedScene.title}`}
      className={styles.workspace}
      data-projection-only="true"
      data-scene-timeline="frames-shots-action-timing"
      hidden={!active}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Scene Timeline · Frames / Shots / Action / Timing</p>
          <h3>{timeline.sceneTitle}</h3>
          <p>Temporal view of the same Visual Story objects. Shot order and authored Previs duration determine placement; untimed material remains untimed.</p>
        </div>
        <div className={styles.summary}>
          <span>{timeline.timedShotCount}/{timeline.shots.length} timed Shots</span>
          <span>{clock(timeline.totalSeconds)} scene span</span>
        </div>
      </header>

      <section className={styles.preview} aria-label="Scene Timeline intent preview">
        <div className={styles.previewImage}>
          {previewFrame
            ? <img alt={previewFrame.narrativePurpose || "Selected Shot frame"} src={previewFrame.assetUrl} />
            : <span>NO LINKED PREVIEW FRAME</span>}
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
            aria-label="Scene Timeline playhead"
            disabled={timeline.totalSeconds <= 0}
            max={Math.max(0.1, timeline.totalSeconds)}
            min="0"
            onChange={(event) => { setPlaying(false); setPlayheadSeconds(Number(event.currentTarget.value)); }}
            step="0.1"
            type="range"
            value={Math.min(playheadSeconds, Math.max(0.1, timeline.totalSeconds))}
          />
          <small>Transport previews intended timing only; it does not claim frame-accurate media playback or observed take timing.</small>
        </div>
      </section>

      <div className={styles.timeline}>
        <div className={styles.ruler} aria-label="Scene timing ruler">
          {timeline.anchors.map((anchor) => (
            <span key={anchor.anchorRef} style={markerStyle(anchor.startSecond, timeline.totalSeconds)}>
              {anchor.blockNumber}.{anchor.miniBlockNumber} · {clock(anchor.startSecond)}
            </span>
          ))}
        </div>

        <div className={styles.lane} data-lane="frames">
          <strong className={styles.laneLabel}>FRAMES</strong>
          <div className={styles.track}>
            {timeline.shots.flatMap((shot) => shot.startSecond === null || shot.endSecond === null
              ? []
              : shot.frames.map((frame, frameIndex) => {
                const count = Math.max(1, shot.frames.length);
                const segment = (shot.endSecond! - shot.startSecond!) / count;
                const start = shot.startSecond! + (segment * frameIndex);
                return (
                  <button
                    aria-label={`Select Shot ${shot.order} from Frame ${frame.id}`}
                    className={styles.frameItem}
                    data-selected={shot.id === selectedShot?.id ? "true" : undefined}
                    key={`${shot.id}:${frame.id}`}
                    onClick={() => selectShot(shot)}
                    style={spanStyle(start, start + segment, timeline.totalSeconds)}
                    type="button"
                  >
                    <img alt="" src={frame.assetUrl} />
                  </button>
                );
              }))}
          </div>
        </div>

        <div className={styles.lane} data-lane="shots">
          <strong className={styles.laneLabel}>SHOTS</strong>
          <div className={styles.track}>
            {timeline.shots.filter((shot) => shot.startSecond !== null && shot.endSecond !== null).map((shot) => (
              <button
                aria-pressed={shot.id === selectedShot?.id}
                className={styles.shotItem}
                key={shot.id}
                onClick={() => selectShot(shot)}
                style={spanStyle(shot.startSecond!, shot.endSecond!, timeline.totalSeconds)}
                type="button"
              >
                S{shot.order} · {shot.durationSeconds}s
              </button>
            ))}
          </div>
        </div>

        <div className={styles.lane} data-lane="action">
          <strong className={styles.laneLabel}>ACTION</strong>
          <div className={styles.track}>
            {timeline.shots.filter((shot) => shot.startSecond !== null && shot.endSecond !== null).map((shot) => (
              <button
                aria-label={`Select Shot ${shot.order}: ${shot.action}`}
                className={styles.actionItem}
                data-selected={shot.id === selectedShot?.id ? "true" : undefined}
                key={shot.id}
                onClick={() => selectShot(shot)}
                style={spanStyle(shot.startSecond!, shot.endSecond!, timeline.totalSeconds)}
                type="button"
              >
                {shot.action}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.lane} data-lane="timing">
          <strong className={styles.laneLabel}>TIMING</strong>
          <div className={`${styles.track} ${styles.timingTrack}`}>
            {timeline.anchors.map((anchor) => (
              <span className={styles.anchorSpan} key={anchor.anchorRef} style={spanStyle(anchor.startSecond, anchor.endSecond, timeline.totalSeconds)}>
                {clock(anchor.startSecond)}–{clock(anchor.endSecond)}
              </span>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className={styles.playhead} style={markerStyle(playheadSeconds, timeline.totalSeconds)} />
      </div>

      {(timeline.untimedShots.length || timeline.untimedFrames.length) ? (
        <section className={styles.untimed} aria-label="Untimed Scene material">
          <div>
            <strong>UNTIMED MATERIAL</strong>
            <span>Kept out of the temporal lanes until the existing timing authority can place it.</span>
          </div>
          <div className={styles.untimedItems}>
            {timeline.untimedShots.map((shot) => (
              <button key={shot.id} onClick={() => selectShot(shot)} type="button">
                Shot {shot.order} · {shot.durationSeconds === null ? "duration open" : `${shot.durationSeconds}s · start blocked by earlier untimed Shot`}
              </button>
            ))}
            {timeline.untimedFrames.map((frame) => <span key={frame.id}>Frame · {frame.narrativePurpose || frame.id}</span>)}
          </div>
        </section>
      ) : null}

      <section className={styles.timingControls} aria-label="Selected Shot timing controls">
        <div>
          <p className={styles.kicker}>Selected Shot Timing</p>
          {selectedShot ? (
            <>
              <strong>Shot {selectedShot.order}</strong>
              <span>{selectedShot.startSecond === null ? "Start unresolved" : `${clock(selectedShot.startSecond)} → ${clock(selectedShot.endSecond ?? selectedShot.startSecond)}`}</span>
            </>
          ) : <span>No Shot is selected.</span>}
        </div>
        {selectedShot ? (
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
        ) : null}
        <p className={styles.authorityNote}>
          Start position is derived from Shot order plus preceding authored durations; this Slice does not invent an independent start-time store. Planned Previs Shots can edit duration here. Approved timing remains protected for the later #2035 cross-view change proof.
        </p>
      </section>

      <p className={styles.message} aria-live="polite">{message}</p>
      <footer className={styles.boundary}>
        Projection only. Frames, Shots, action intent and timing remain owned by existing Storyboard / editorial Shot / Previs authorities. No technical RenderClip lane, audio lane or timeline-only canon is created here.
      </footer>
    </section>
  );
}
