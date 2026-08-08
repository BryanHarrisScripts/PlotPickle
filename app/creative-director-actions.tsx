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
  const [decisionMessage, setDecisionMessage] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const versionsRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const visibleMessage = writerFacingMessage(message) || decisionMessage;

  function keepCandidate() {
    const approveButton = Array.from(versionsRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((button) => /^Approve (?:image|video)$/i.test(buttonText(button)));
    if (!approveButton) {
      setDecisionMessage("No new candidate is waiting for approval. Use Try Again to create one, or Compare the saved versions.");
      return;
    }
    setDecisionMessage("Keep selected. The reviewed candidate is now being approved for this exact story moment.");
    approveButton.click();
  }

  function changeDirection() {
    setAdvancedOpen(true);
    setDecisionMessage("Change direction opened. Adjust only what should change; the story, identity locks and continuity stay attached.");
    window.setTimeout(() => advancedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  }

  function tryAgain() {
    setDecisionMessage("");
    onIllustrate();
  }

  function compareVersions() {
    if (!versions) {
      setDecisionMessage("There is only one visual state to review. Use Try Again to create an alternative, then Compare will show the saved versions here.");
      return;
    }
    setDecisionMessage("Compare the saved versions below. Nothing becomes approved until you explicitly choose Keep.");
    window.setTimeout(() => versionsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  }

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

      {identityWarning ? <p className={styles.warning}><strong>Continuity needs attention.</strong> {identityWarning}</p> : null}

      <fieldset id="storyboard-decisions" className={styles.actions}>
        <legend className={styles.actionLegend}>Decide what happens to this visual</legend>
        <button type="button" className={styles.primary} disabled={busy} onClick={keepCandidate}>
          <strong>Keep</strong>
          <span>Approve the newest candidate for this exact story moment.</span>
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={changeDirection}>
          <strong>Change</strong>
          <span>Change the creative direction without losing story or continuity context.</span>
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={tryAgain}>
          <strong>{state === "illustrating" ? "Trying again…" : "Try Again"}</strong>
          <span>Create another image from this same story moment and approved visual rules.</span>
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={compareVersions}>
          <strong>Compare</strong>
          <span>Review alternatives side by side in the saved version queue.</span>
        </button>
      </fieldset>

      {visibleMessage ? <p className={state === "error" ? styles.error : styles.message} role="status">{visibleMessage}</p> : null}

      {versions ? <div className={styles.versions} ref={versionsRef}>{versions}</div> : <div ref={versionsRef} />}

      <div className={styles.motionAction}>
        <div><strong>Make it move</strong><span>Use the approved image as the starting point for motion.</span></div>
        <button type="button" disabled={busy || !currentVisual} onClick={onAnimate}>{state === "animating" ? "Animating…" : "Animate approved visual"}</button>
      </div>

      <details className={styles.advanced} open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} ref={advancedRef}>
        <summary>Change direction / Advanced</summary>
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
