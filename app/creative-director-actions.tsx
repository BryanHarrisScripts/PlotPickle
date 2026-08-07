"use client";

import type { ReactNode } from "react";
import styles from "./creative-director-actions.module.css";

export type CreativeDirectorActionState = "idle" | "illustrating" | "animating" | "error";

function writerFacingMessage(message?: string) {
  if (!message) return "";
  return message
    .replace(/MiniMax H3/gi, "the active video route")
    .replace(/Open generation settings/gi, "Open Settings")
    .replace(/provider job/gi, "generation job")
    .replace(/provider request/gi, "generation request")
    .replace(/configured provider/gi, "configured route")
    .replace(/providers?/gi, "routes");
}

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
  const visibleMessage = writerFacingMessage(message);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span>{storyLabel}</span>
        <h2>{storyTitle}</h2>
        <p>{storyMoment || "Add the visible action or dramatic turn in the story block before directing this moment."}</p>
      </header>

      <figure className={styles.preview}>
        {currentVisual ?? <p className={styles.empty}><strong>No approved visual yet</strong><span>PlotPickle will build the direction from the story automatically.</span></p>}
      </figure>

      {versions ? <div className={styles.versions}>{versions}</div> : null}

      {identityWarning ? <p className={styles.warning}><strong>Continuity needs attention.</strong> {identityWarning}</p> : null}

      <fieldset className={styles.actions}>
        <legend className={styles.actionLegend}>Direct this story moment</legend>
        <button type="button" className={styles.primary} disabled={busy} onClick={onIllustrate}>
          <strong>{state === "illustrating" ? "Illustrating…" : "Illustrate"}</strong>
          <span>Create or try another image from this story moment and its approved visual rules.</span>
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onAnimate}>
          <strong>{state === "animating" ? "Animating…" : "Animate"}</strong>
          <span>Turn the current approved image and story action into a moving version.</span>
        </button>
      </fieldset>

      {visibleMessage ? <p className={state === "error" ? styles.error : styles.message} role="status">{visibleMessage}</p> : null}

      <details className={styles.advanced}>
        <summary>Advanced direction</summary>
        <p>Optional camera, continuity and generation-direction controls. PlotPickle already uses the story, character identities, locations and visual language automatically.</p>
        {advanced}
      </details>

      <footer className={styles.footer}>
        <span>Generation and routing details stay out of the creative flow unless you choose to change them.</span>
        <button type="button" onClick={onOpenSettings}>Open Settings</button>
      </footer>
    </section>
  );
}
