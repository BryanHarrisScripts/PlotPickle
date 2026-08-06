"use client";

import type { ReactNode } from "react";
import styles from "./creative-director-actions.module.css";

export type CreativeDirectorActionState = "idle" | "illustrating" | "animating" | "error";

export default function CreativeDirectorActions({
  storyLabel,
  storyTitle,
  storyMoment,
  currentVisual,
  versions,
  identityWarning,
  state,
  message,
  onIllustrate,
  onAnimate,
  onOpenSettings,
  advanced,
}: {
  storyLabel: string;
  storyTitle: string;
  storyMoment: string;
  currentVisual?: ReactNode;
  versions?: ReactNode;
  identityWarning?: string;
  state: CreativeDirectorActionState;
  message?: string;
  onIllustrate: () => void;
  onAnimate: () => void;
  onOpenSettings: () => void;
  advanced: ReactNode;
}) {
  const busy = state === "illustrating" || state === "animating";

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span>{storyLabel}</span>
        <h2>{storyTitle}</h2>
        <p>{storyMoment || "Add the visible action or dramatic turn in the story block before directing this moment."}</p>
      </header>

      <figure className={styles.preview}>
        {currentVisual ?? <div className={styles.empty}><strong>No approved visual yet</strong><span>PlotPickle will build the direction from the story automatically.</span></div>}
      </figure>

      {versions ? <div className={styles.versions}>{versions}</div> : null}

      {identityWarning ? <p className={styles.warning}><strong>Continuity needs attention.</strong> {identityWarning}</p> : null}

      <div className={styles.actions} role="group" aria-label="Direct this story moment">
        <button type="button" className={styles.primary} disabled={busy} onClick={onIllustrate}>
          <strong>{state === "illustrating" ? "Illustrating…" : "Illustrate"}</strong>
          <span>Create or try another image for this exact story moment.</span>
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onAnimate}>
          <strong>{state === "animating" ? "Animating…" : "Animate"}</strong>
          <span>Turn the current approved image and story action into a video.</span>
        </button>
      </div>

      {message ? <p className={state === "error" ? styles.error : styles.message} role="status">{message}</p> : null}

      <details className={styles.advanced}>
        <summary>Advanced direction</summary>
        <p>Optional camera, continuity and prompt controls. PlotPickle already uses the story, character identities, locations and visual language automatically.</p>
        {advanced}
      </details>

      <footer className={styles.footer}>
        <span>Provider, model, checkpoint and workflow choices stay in Settings.</span>
        <button type="button" onClick={onOpenSettings}>Open generation settings</button>
      </footer>
    </section>
  );
}
