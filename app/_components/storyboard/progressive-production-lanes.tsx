"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { PlotPickleProject } from "@/lib/projects/project";
import { projectProgressiveProductionLanes } from "@/lib/preproduction/progressive-production-lanes";
import type { VisualStoryProjection } from "@/lib/preproduction/visual-story-projection";
import styles from "./progressive-production-lanes.module.css";

type LayerId = "dialogue" | "sound" | "camera" | "transitions";

function spanStyle(startSecond: number, endSecond: number, totalSeconds: number): CSSProperties {
  const total = Math.max(totalSeconds, 0.01);
  const left = Math.max(0, Math.min(100, (startSecond / total) * 100));
  const width = Math.max(0.8, Math.min(100 - left, ((endSecond - startSecond) / total) * 100));
  return { left: `${left}%`, width: `${width}%` };
}

export default function ProgressiveProductionLanes({
  visualStory,
  legacyProject,
  selectedShotId,
  onSelectShot,
}: {
  readonly visualStory: VisualStoryProjection;
  readonly legacyProject: PlotPickleProject | null;
  readonly selectedShotId: string;
  readonly onSelectShot: (shotId: string) => void;
}) {
  const projection = useMemo(() => projectProgressiveProductionLanes({ visualStory, legacyProject }), [legacyProject, visualStory]);
  const [visibleLayers, setVisibleLayers] = useState<ReadonlySet<LayerId>>(() => new Set());
  const layerOptions = [
    { id: "dialogue" as const, label: "Dialogue", count: projection.dialogue.length },
    { id: "sound" as const, label: "Sound", count: projection.sound.length },
    { id: "camera" as const, label: "Camera", count: projection.camera.length },
    { id: "transitions" as const, label: "Transitions", count: projection.transitions.length },
  ];
  const availableCount = layerOptions.reduce((total, option) => total + option.count, 0);

  function toggleLayer(id: LayerId) {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!visualStory.selectedScene) return null;

  return (
    <section className={styles.workspace} data-progressive-production-lanes="dialogue-sound-camera-transitions">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Progressive Production Layers</p>
          <h3>Add production context only when it helps.</h3>
          <p>The visual core remains Frames / Shots / Action / Timing. These optional layers project existing screenplay, sound, camera and transition owners without creating new production stores.</p>
        </div>
        <span className={styles.available}>{availableCount} existing cue{availableCount === 1 ? "" : "s"}</span>
      </header>

      <nav className={styles.layerControls} aria-label="Optional Scene Timeline production layers">
        {layerOptions.map((option) => (
          <button
            aria-pressed={visibleLayers.has(option.id)}
            disabled={option.count === 0}
            key={option.id}
            onClick={() => toggleLayer(option.id)}
            type="button"
          >
            {option.label} · {option.count}
          </button>
        ))}
      </nav>

      {availableCount === 0 ? (
        <p className={styles.empty}>No existing screenplay dialogue, sound intent/cues, camera detail or transitions are linked to this Scene yet. Slice 4 does not manufacture production context to populate empty lanes.</p>
      ) : null}

      <div className={styles.lanes}>
        {visibleLayers.has("dialogue") && projection.dialogue.length ? (
          <div className={styles.lane} data-lane="dialogue">
            <strong className={styles.laneLabel}>DIALOGUE</strong>
            <div className={styles.laneBody}>
              <div className={styles.contextTrack}><span>SOURCE CONTEXT · UNTIMED</span></div>
              <div className={styles.contextItems}>
                {projection.dialogue.map((item) => (
                  <article data-timing="unplaced" key={item.id}>
                    <strong>{item.speaker || "Speaker not linked"}</strong>
                    <p>{item.text}</p>
                    <small>{item.elementType} · {item.blockNumber}.{item.miniBlockNumber}</small>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {visibleLayers.has("sound") && projection.sound.length ? (
          <div className={styles.lane} data-lane="sound">
            <strong className={styles.laneLabel}>SOUND</strong>
            <div className={styles.laneBody}>
              <div className={styles.track}>
                {projection.sound.filter((item) => item.timingState === "timed" && item.startSecond !== null && item.endSecond !== null).map((item) => (
                  <span
                    className={styles.timedItem}
                    data-source={item.source}
                    key={item.id}
                    style={spanStyle(item.startSecond!, item.endSecond!, projection.totalSeconds)}
                    title={item.detail}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
              <div className={styles.contextItems}>
                {projection.sound.filter((item) => item.timingState === "unplaced").map((item) => (
                  <article data-timing="unplaced" key={item.id}>
                    <strong>{item.category.toUpperCase()} · {item.label}</strong>
                    <p>{item.detail || "Sound cue has no descriptive purpose yet."}</p>
                    <small>{item.cueIn || item.cueOut ? `${item.cueIn || "Cue in open"} → ${item.cueOut || "Cue out open"}` : "Timing not authored"}</small>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {visibleLayers.has("camera") && projection.camera.length ? (
          <div className={styles.lane} data-lane="camera">
            <strong className={styles.laneLabel}>CAMERA</strong>
            <div className={styles.laneBody}>
              <div className={styles.track}>
                {projection.camera.filter((item) => item.timingState === "timed" && item.startSecond !== null && item.endSecond !== null).map((item) => (
                  <button
                    aria-pressed={item.shotId === selectedShotId}
                    className={styles.timedButton}
                    key={item.id}
                    onClick={() => onSelectShot(item.shotId)}
                    style={spanStyle(item.startSecond!, item.endSecond!, projection.totalSeconds)}
                    title={item.detail}
                    type="button"
                  >
                    {item.detail}
                  </button>
                ))}
              </div>
              <div className={styles.contextItems}>
                {projection.camera.filter((item) => item.timingState === "unplaced").map((item) => (
                  <button data-timing="unplaced" key={item.id} onClick={() => onSelectShot(item.shotId)} type="button">{item.detail}</button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {visibleLayers.has("transitions") && projection.transitions.length ? (
          <div className={styles.lane} data-lane="transitions">
            <strong className={styles.laneLabel}>TRANSITIONS</strong>
            <div className={styles.laneBody}>
              <div className={styles.track}>
                {projection.transitions.filter((item) => item.timingState === "timed" && item.startSecond !== null && item.endSecond !== null).map((item) => (
                  <button
                    aria-pressed={item.shotId === selectedShotId}
                    className={styles.timedButton}
                    key={item.id}
                    onClick={() => onSelectShot(item.shotId)}
                    style={spanStyle(item.startSecond!, item.endSecond!, projection.totalSeconds)}
                    type="button"
                  >
                    {item.detail}
                  </button>
                ))}
              </div>
              <div className={styles.contextItems}>
                {projection.transitions.filter((item) => item.timingState === "unplaced").map((item) => (
                  <button data-timing="unplaced" key={item.id} onClick={() => onSelectShot(item.shotId)} type="button">{item.detail}</button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <footer className={styles.boundary}>
        View-only production context in Slice 4. Dialogue remains screenplay-owned; Sound remains Sequence Director / Sonic Cue-owned; Camera remains editorial/Previs-owned; transitions remain Previs-owned. Foley, ambience, music and voice are not split into new authorities here.
      </footer>
    </section>
  );
}
