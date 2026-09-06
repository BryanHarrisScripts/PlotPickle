"use client";

import { useEffect, useState } from "react";
import { notifyPlotPickle } from "../../common-overlay-layer";
import { StoryPieceCard, type StoryPieceCardState } from "../story/story-piece-card";
import { StoryValidatorFinding, type StoryValidatorSeverity } from "../story/story-validator-finding";
import { StoryZeroWorkspaceView } from "../story/story-zero-workspace";
import { UiAction } from "./ui-action";
import { UiStateSurface, type UiSurfaceState } from "./ui-state-surface";
import { UiWorkStatus, type UiWorkStatusKind } from "./ui-work-status";
import styles from "./ui-experience-gallery.module.css";

const SURFACE_STATES: readonly UiSurfaceState[] = ["ideal", "empty", "loading", "partial", "error"];
const WORK_STATES: readonly UiWorkStatusKind[] = [
  "saving", "saved", "retrying", "offline", "stale", "resumed", "validating", "resolving", "session-accepted", "rejected",
];
const PIECE_STATES: readonly StoryPieceCardState[] = ["available", "selected", "illegal", "loading", "partial", "error"];
const VALIDATOR_STATES: readonly StoryValidatorSeverity[] = ["error", "warning", "note", "pass"];
const LONG_TOKEN = "unbroken-story-context-".repeat(20);

function ProbeSurface() {
  const [state, setState] = useState<UiSurfaceState>("loading");
  const [consequence, setConsequence] = useState(false);

  useEffect(() => {
    const probe = new URLSearchParams(window.location.search).get("probe") || "";
    if (probe === "transition") {
      const timer = window.setTimeout(() => setState("ideal"), 300);
      return () => window.clearTimeout(timer);
    }
    if (probe === "notification") {
      const timer = window.setTimeout(() => notifyPlotPickle({ message: "Checkpoint saved. Your work is safe.", tone: "success" }), 300);
      return () => window.clearTimeout(timer);
    }
    if (probe === "consequence") {
      const timer = window.setTimeout(() => setConsequence(true), 300);
      return () => window.clearTimeout(timer);
    }
  }, []);

  return (
    <div className={styles.probeFrame} data-ui-experience-probe="true">
      <UiStateSurface
        state={state}
        eyebrow="CLS probe"
        title={state === "loading" ? "Resolving a bounded state…" : "State resolved without moving the workspace."}
        message="This frame reserves the room needed for asynchronous feedback."
      />
      <div className={styles.consequenceSlot} data-story-consequence-probe="true">
        {consequence ? <UiWorkStatus status="session-accepted" detail="The gate is open. Session state changed; canon did not." /> : null}
      </div>
    </div>
  );
}

export default function UiExperienceGallery() {
  return (
    <main className={styles.gallery} data-ui-experience-gallery="true">
      <header className={styles.header}>
        <p>PlotPickle / UI Experience Lab</p>
        <h1>Real components. Every awkward state. No surprises later.</h1>
        <span>This route exists for development and automated verification only. It does not create a second product UI.</span>
      </header>

      <ProbeSurface />

      <section className={styles.section} aria-labelledby="gallery-five-states">
        <header><p>Foundation</p><h2 id="gallery-five-states">Five-state coverage</h2></header>
        <div className={styles.grid}>
          {SURFACE_STATES.map((state) => (
            <UiStateSurface
              key={state}
              state={state}
              eyebrow={state}
              title={`${state} state`}
              message="The same surface keeps context, status and recovery language in a predictable place."
              action={state === "error" ? <UiAction variant="primary">Try again</UiAction> : undefined}
            />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gallery-work-states">
        <header><p>Creative confidence</p><h2 id="gallery-work-states">Save, retry and STORY truth</h2></header>
        <div className={styles.statusGrid}>
          {WORK_STATES.map((status) => <UiWorkStatus key={status} status={status} />)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gallery-story-pieces">
        <header><p>STORY</p><h2 id="gallery-story-pieces">Story Piece states</h2></header>
        <div className={styles.cardGrid}>
          {PIECE_STATES.map((state) => (
            <StoryPieceCard
              key={state}
              type="Character"
              state={state}
              title={`The Keeper · ${state}`}
              description="A traveler deciding whether the sealed gate should open."
              meta="Character · active scene working set"
            />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gallery-validator">
        <header><p>STORY preflight</p><h2 id="gallery-validator">Validator language</h2></header>
        <div className={styles.stack}>
          {VALIDATOR_STATES.map((severity) => (
            <StoryValidatorFinding
              key={severity}
              severity={severity}
              title={`${severity.toUpperCase()} finding`}
              message="The mechanic is explained in story language first; technical evidence stays available without taking over the screen."
              repair={severity === "error" ? "Fix the missing Story Piece before play." : undefined}
            />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gallery-story-zero">
        <header><p>STORY entry</p><h2 id="gallery-story-zero">Zero-state context variants</h2></header>
        <div className={styles.storyFrame}>
          <StoryZeroWorkspaceView embedded model={{ kind: "empty" }} />
        </div>
        <div className={styles.storyFrame}>
          <StoryZeroWorkspaceView embedded model={{ kind: "project", project: { id: "gallery:project", revision: "42", title: "A Very Long but Still Human Story Title That Must Never Break the Workspace" } }} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gallery-authority">
        <header><p>Authority</p><h2 id="gallery-authority">Proposal is not acceptance is not canon</h2></header>
        <div className={styles.grid}>
          <UiStateSurface state="partial" eyebrow="AI suggestion" title="Proposed" message="An agent suggested a consequence. No mechanical or canon authority has changed." />
          <UiStateSurface state="ideal" eyebrow="STORY session" title="Accepted consequence" message="The deterministic STORY engine accepted the session transition." />
          <UiStateSurface state="ideal" eyebrow="PPF review" title="Canon accepted" message="A separate durable admission step accepted the reviewed project change." />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gallery-hostile-content">
        <header><p>Stress</p><h2 id="gallery-hostile-content">Long, localized and unbroken content</h2></header>
        <UiStateSurface
          state="partial"
          eyebrow="Hostile content fixture"
          title={`世界の物語 — ${LONG_TOKEN}`}
          message={`This content deliberately exceeds comfortable lengths so wrapping and 200% zoom failures appear here first. ${LONG_TOKEN}`}
          action={<UiAction variant="primary" data-pp-primary-probe="true">Keep moving forward</UiAction>}
        />
      </section>
    </main>
  );
}
