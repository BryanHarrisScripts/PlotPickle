"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculatePlotPickleScore,
  plotPickleScorePercent,
} from "../../core/project/plotpickle-score";
import {
  initializeProjectLibrary,
  PROJECT_LIBRARY_CHANGED_EVENT,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import styles from "./plotpickle-score-panel.module.css";

function readActiveProject() {
  try {
    return initializeProjectLibrary().activeProject;
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

export default function PlotPickleScorePanel() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);

  useEffect(() => {
    const refresh = () => setProject(readActiveProject());
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, []);

  const result = useMemo(() => project
    ? calculatePlotPickleScore({ structure: project.structure, sourceEvidence: project.sourceEvidence })
    : null, [project]);

  if (!project || !result) return null;

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

      <div className={styles.evidence}>
        <span>{evidenceLabel(result.evidence.basis)}</span>
        <span>{result.evidence.populatedUnits}/{result.evidence.totalUnits} MINI-BLOCKS POPULATED</span>
        <span>SCORE MODEL V{result.version}</span>
      </div>
    </section>
  );
}
