"use client";

import { useMemo } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { LOGLINE_EVIDENCE_GROUPS, scoreLogline } from "@/lib/logline-rubric";
import type { LoglineEvidenceState } from "@/lib/logline-lab";
import styles from "./logline-rubric.module.css";

const stateLabels: Record<LoglineEvidenceState, string> = {
  "sentence-supported": "Supported in the sentence",
  "project-only": "Project record only",
  "intentional-omission": "Intentionally omitted",
  review: "Unclear or worth reviewing",
};

export default function LoglineRubric({ project, text, deliberateOmissions = [] }: { project: PlotPickleProject; text: string; deliberateOmissions?: string[] }) {
  const result = useMemo(() => scoreLogline(project, text, deliberateOmissions), [project, text, deliberateOmissions]);
  return (
    <section className={styles.rubric} aria-labelledby="logline-rubric-title">
      <header>
        <div><span>Evidence comparison</span><h2 id="logline-rubric-title">Review what the sentence communicates.</h2><p>Core engine jobs carry more weight than optional enhancements. These local checks distinguish sentence evidence from project evidence and deliberate omissions; they are not an industry quality score.</p></div>
        <div className={styles.score}><strong>{result.supportedCount}<small> supported</small></strong><span>{result.label}</span><em>{result.wordCount} words · guidance only</em></div>
      </header>
      {LOGLINE_EVIDENCE_GROUPS.map((group) => <section key={group} aria-label={group}>
        <h3>{group}</h3>
        <div className={styles.grid}>{result.items.filter((criterion) => criterion.group === group).map((criterion, index) => (
          <article className={criterion.state === "sentence-supported" ? styles.pass : styles.review} key={criterion.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <div><strong>{criterion.label}{criterion.optional ? " · optional" : ""}</strong><span>{criterion.question}</span><p>{criterion.guidance}</p>{criterion.projectEvidence ? <small>Project evidence: {criterion.projectEvidence}</small> : null}</div>
            <i aria-label={stateLabels[criterion.state]}>{stateLabels[criterion.state]}</i>
          </article>
        ))}</div>
      </section>)}
    </section>
  );
}
