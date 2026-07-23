
"use client";

import { useMemo } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { scoreLogline } from "@/lib/logline-rubric";
import styles from "./logline-rubric.module.css";

export default function LoglineRubric({ project, text }: { project: PlotPickleProject; text: string }) {
  const result = useMemo(() => scoreLogline(project, text), [project, text]);
  return (
    <section className={styles.rubric} aria-labelledby="logline-rubric-title">
      <header>
        <div><span>20-point deconstruction</span><h2 id="logline-rubric-title">Score the promise, not the writer.</h2><p>Each point checks one audience-facing job. The score is local, deterministic guidance—not an industry verdict.</p></div>
        <div className={styles.score}><strong>{result.score}<small>/20</small></strong><span>{result.band}</span><em>{result.wordCount} words</em></div>
      </header>
      <div className={styles.grid}>{result.criteria.map((criterion, index) => (
        <article className={criterion.passed ? styles.pass : styles.review} key={criterion.id}>
          <b>{String(index + 1).padStart(2, "0")}</b>
          <div><strong>{criterion.label}</strong><span>{criterion.question}</span><p>{criterion.guidance}</p></div>
          <i aria-label={criterion.passed ? "Point earned" : "Needs review"}>{criterion.passed ? "✓" : "○"}</i>
        </article>
      ))}</div>
    </section>
  );
}
