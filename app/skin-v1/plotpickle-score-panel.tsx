"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PLOTPICKLE_SCORE_VERSION,
  calculatePlotPickleScore,
  plotPickleScorePercent,
} from "../../core/project/plotpickle-score";
import {
  DEFAULT_LOCAL_PROFILE_ID,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  initializeProjectLibrary,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import styles from "./plotpickle-score-panel.module.css";

const PROJECT_LIBRARY_SESSION_CHANGED_EVENT = "plotpickle:project-library-session-changed";
const SESSION_PROJECT_KEY_PREFIX = "plotpickle.project-library.session-project";

function currentProfileId() {
  return window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || DEFAULT_LOCAL_PROFILE_ID;
}

function currentSessionProjectKey() {
  return `${SESSION_PROJECT_KEY_PREFIX}:${currentProfileId()}`;
}

function currentSessionLibraryProject(): LibraryPPFProject | null {
  const projectId = window.sessionStorage.getItem(currentSessionProjectKey())?.trim();
  if (!projectId) return null;
  const activeProject = initializeProjectLibrary().activeProject;
  return activeProject?.id === projectId ? activeProject : null;
}

function readActiveProject() {
  try {
    return currentSessionLibraryProject();
  } catch {
    return null;
  }
}

function ratingLabel(state: "unrated" | "provisional" | "rated") {
  if (state === "rated") return "RATED";
  if (state === "provisional") return "PROVISIONAL";
  return "NOT RATED";
}

function evidenceLabel(basis: "imported-screenplay" | "native-structure" | "none") {
  if (basis === "imported-screenplay") return "IMPORTED SCREENPLAY EVIDENCE";
  if (basis === "native-structure") return "NATIVE 24/96 STORY EVIDENCE";
  return "NO USABLE STORY EVIDENCE";
}

const METRIC_LABELS = ["ALIGNMENT", "VERBOSITY", "EROSION", "PROGRESSION", "COVERAGE"] as const;

function EmptyScorePanel() {
  return (
    <section
      className={styles.panel}
      aria-label="PlotPickle Score"
      data-plotpickle-score="v1"
      data-plotpickle-score-state="unrated"
      data-plotpickle-score-basis="none"
      data-plotpickle-score-project="none"
    >
      <div className={styles.headingRow}>
        <div>
          <div className={styles.eyebrow}>PLOTPICKLE SCORE</div>
          <div className={styles.storyTitle}>No active story</div>
        </div>
        <div className={styles.scoreCluster}>
          <output className={styles.score} aria-label="PlotPickle Score NR">NR</output>
          <span className={styles.ratingState}>NOT RATED</span>
        </div>
      </div>

      <div className={styles.metrics} aria-label="PlotPickle Score dimensions">
        {METRIC_LABELS.map((label) => (
          <div className={styles.metric} key={label}>
            <span>{label}</span>
            <strong aria-label={`${label} unavailable`}>—</strong>
            {label === "VERBOSITY" || label === "EROSION" ? <small>LOWER IS BETTER</small> : null}
          </div>
        ))}
      </div>

      <div className={styles.evidence}>
        <span>NO ACTIVE STORY</span>
        <span>0/96 MINI-BLOCKS POPULATED</span>
        <span>SCORE MODEL V{PLOTPICKLE_SCORE_VERSION}</span>
      </div>
    </section>
  );
}

export default function PlotPickleScorePanel() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);

  useEffect(() => {
    const refresh = () => setProject(readActiveProject());
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    window.addEventListener(PROJECT_LIBRARY_SESSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
      window.removeEventListener(PROJECT_LIBRARY_SESSION_CHANGED_EVENT, refresh);
    };
  }, []);

  const result = useMemo(() => project
    ? calculatePlotPickleScore({ structure: project.structure, sourceEvidence: project.sourceEvidence })
    : null, [project]);

  if (!project || !result) return <EmptyScorePanel />;

  const metrics = [
    ["ALIGNMENT", result.metrics.alignment, false],
    ["VERBOSITY", result.metrics.verbosity, true],
    ["EROSION", result.metrics.erosion, true],
    ["PROGRESSION", result.metrics.progression, false],
    ["COVERAGE", result.metrics.coverage, false],
  ] as const;

  return (
    <section
      className={styles.panel}
      aria-label="PlotPickle Score"
      data-plotpickle-score="v1"
      data-plotpickle-score-state={result.ratingState}
      data-plotpickle-score-basis={result.evidence.basis}
      data-plotpickle-score-project="active"
    >
      <div className={styles.headingRow}>
        <div>
          <div className={styles.eyebrow}>PLOTPICKLE SCORE</div>
          <div className={styles.storyTitle}>{project.title || "Untitled Story"}</div>
        </div>
        <div className={styles.scoreCluster}>
          <output className={styles.score} aria-label={`PlotPickle Score ${result.displayScore}`}>
            {result.displayScore}
          </output>
          <span className={styles.ratingState}>{ratingLabel(result.ratingState)}</span>
        </div>
      </div>

      <div className={styles.metrics} aria-label="PlotPickle Score dimensions">
        {metrics.map(([label, value, lowerIsBetter]) => (
          <div className={styles.metric} key={label}>
            <span>{label}</span>
            <strong>{plotPickleScorePercent(value)}%</strong>
            {lowerIsBetter ? <small>LOWER IS BETTER</small> : null}
          </div>
        ))}
      </div>

      <details className={styles.explanation}>
        <summary>How can this score be {result.displayScore}?</summary>
        <p>
          PlotPickle balances all five structural dimensions geometrically. Alignment, Progression and Coverage reward higher values; Verbosity and Erosion are inverted because lower is better. A non-zero Erosion signal therefore lowers one of five balanced factors rather than subtracting that percentage directly from 100.
        </p>
        <small>This is a structural rating, not a judgment of creative quality, originality, emotion or commercial potential.</small>
      </details>

      <div className={styles.evidence}>
        <span>{evidenceLabel(result.evidence.basis)}</span>
        <span>{result.evidence.populatedUnits}/{result.evidence.totalUnits} MINI-BLOCKS POPULATED</span>
        <span>SCORE MODEL V{result.version}</span>
      </div>
    </section>
  );
}
