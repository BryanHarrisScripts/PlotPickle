"use client";

import { useRef, useState, type ReactNode } from "react";
import styles from "./creative-director-actions.module.css";

export type CreativeDirectorActionState = "idle" | "illustrating" | "animating" | "error";

function writerFacingMessage(message?: string) {
  if (!message) return "";
  return message
    .replace(/Open generation settings/gi, "Open Settings")
    .replace(/provider job/gi, "generation job")
    .replace(/provider request/gi, "generation request")
    .replace(/configured provider/gi, "configured route")
    .replace(/providers?/gi, "routes");
}

function buttonText(button: HTMLButtonElement) {
  return (button.textContent || "").replace(/\s+/g, " ").trim();
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
  const versionsRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<HTMLDetailsElement>(null);
  const [decisionMessage, setDecisionMessage] = useState("");

  function keepNewestCandidate() {
    const approveButton = Array.from(versionsRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((button) => /^Approve (?:image|video)$/i.test(buttonText(button)) || /^Keep this (?:image|video)$/i.test(buttonText(button)));
    if (!approveButton) {
      setDecisionMessage("No new candidate is waiting for approval. Try Again to create another version, or Compare the versions already saved.");
      return;
    }
    setDecisionMessage("Keeping the newest candidate as the approved visual for this story moment.");
    approveButton.click();
  }

  function changeDirection() {
    if (!directionRef.current) return;
    directionRef.current.open = true;
    directionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setDecisionMessage("Creative direction is open. Change only what you want to explore, then create another version.");
  }

  function tryAgain() {
    setDecisionMessage("Creating another image candidate from the same story and continuity context.");
    onIllustrate();
  }

  function compareVersions() {
    if (!versionsRef.current || !versions) {
      setDecisionMessage("There are no saved alternatives to compare yet. Try Again to create another version.");
      return;
    }
    versionsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setDecisionMessage("Compare the saved candidates with the current approved visual before deciding what to Keep.");
  }

  return (
    <section className={styles.panel} aria-label="Direct selected story moment">
      <header className={styles.header}>
        <span>{storyLabel}</span>
        <h2>{storyTitle}</h2>
        <p>{storyMoment || "Add the visible action or dramatic turn in the story block before directing this moment."}</p>
      </header>

      <figure className={styles.preview}>
        {currentVisual ?? <p className={styles.empty}><strong>No approved visual yet</strong><span>PlotPickle will build the direction from the story automatically.</span></p>}
      </figure>

      {versions ? <div className={styles.versions} ref={versionsRef}>{versions}</div> : <div ref={versionsRef} />}

      {identityWarning ? <p className={styles.warning}><strong>Continuity needs attention.</strong> {identityWarning}</p> : null}

      <fieldset className={styles.decisions} aria-label="Visual decision">
        <legend>What do you want to do with this visual?</legend>
        <button type="button" className={styles.keep} disabled={busy} onClick={keepNewestCandidate}>
          <strong>Keep</strong>
          <span>Approve the newest candidate for this exact story moment.</span>
        </button>
        <button type="button" disabled={busy} onClick={changeDirection}>
          <strong>Change Direction</strong>
          <span>Adjust composition, action, mood, continuity or visual emphasis.</span>
        </button>
        <button type="button" disabled={busy} onClick={tryAgain}>
          <strong>{state === "illustrating" ? "Trying Again…" : "Try Again"}</strong>
          <span>Create another image candidate from the same story context.</span>
        </button>
        <button type="button" onClick={compareVersions}>
          <strong>Compare</strong>
          <span>Review saved alternatives beside the current approved direction.</span>
        </button>
      </fieldset>

      {decisionMessage ? <p className={styles.decisionMessage} role="status">{decisionMessage}</p> : null}
      {visibleMessage ? <p className={state === "error" ? styles.error : styles.message} role="status">{visibleMessage}</p> : null}

      <fieldset className={styles.generationActions}>
        <legend className={styles.actionLegend}>Create another visual version</legend>
        <button type="button" className={styles.primary} disabled={busy} onClick={onIllustrate}>
          <strong>{state === "illustrating" ? "Illustrating…" : "Illustrate this moment"}</strong>
          <span>Create an image from this story moment and its approved visual rules.</span>
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onAnimate}>
          <strong>{state === "animating" ? "Animating…" : "Animate approved image"}</strong>
          <span>Turn the approved image and visible story action into a moving version.</span>
        </button>
      </fieldset>

      <details className={styles.advanced} ref={directionRef}>
        <summary>Creative direction</summary>
        <p>Optional shot, composition, continuity and generation-direction controls. PlotPickle already carries the story, character identities, locations and visual language into this moment.</p>
        {advanced}
      </details>

      <footer className={styles.footer}>
        <span>Technical routing stays in Settings. Nothing becomes approved until you choose Keep.</span>
        <button type="button" onClick={onOpenSettings}>Open Settings</button>
      </footer>
    </section>
  );
}
