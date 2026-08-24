"use client";

import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { PPFProject } from "../../../core/project/project";
import {
  deriveFoundationsStoryCoverage,
  type FoundationsStoryEvidenceState,
} from "../foundations-story-coverage";
import styles from "./foundations-story-coverage.module.css";

const STATE_LABELS: Readonly<Record<FoundationsStoryEvidenceState, string>> = {
  defined: "Defined",
  emerging: "Emerging",
  missing: "Missing",
};

export default function FoundationsStoryCoverage({
  curriculum,
  project,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly project: PPFProject;
}) {
  const coverage = deriveFoundationsStoryCoverage(curriculum, project);

  return (
    <section className={styles.panel} aria-labelledby="foundations-story-coverage-title" data-story-coverage="live-foundations">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Story evidence · current PPF</p>
          <h2 id="foundations-story-coverage-title">Story Coverage</h2>
          <p>See which Foundations decisions are actually supported, which are still proposals, and which remain intentionally open.</p>
        </div>
        <div className={styles.score} aria-label={`${coverage.percent}% of current Foundations story decisions are defined`}>
          <strong>{coverage.percent}%</strong>
          <span>{coverage.defined} of {coverage.total} decisions defined</span>
        </div>
      </header>

      <dl className={styles.summary} aria-label="Foundations story evidence totals">
        <div data-state="defined"><dt>Defined</dt><dd>{coverage.defined}</dd><small>Saved Human-approved decisions</small></div>
        <div data-state="emerging"><dt>Emerging</dt><dd>{coverage.emerging}</dd><small>Draft proposals awaiting a decision</small></div>
        <div data-state="missing"><dt>Missing</dt><dd>{coverage.missing}</dd><small>No usable story support yet</small></div>
      </dl>

      <div className={styles.legend} aria-label="Story evidence meanings">
        <span data-state="defined"><i aria-hidden="true">✓</i><strong>Defined</strong> is canonical story material saved in PLAN.</span>
        <span data-state="emerging"><i aria-hidden="true">~</i><strong>Emerging</strong> is useful proposal material that still needs Human acceptance.</span>
        <span data-state="missing"><i aria-hidden="true">○</i><strong>Missing</strong> means PlotPickle leaves the decision open instead of inventing filler.</span>
      </div>

      <div className={styles.lessonGrid}>
        {coverage.lessons.map((lesson) => (
          <details className={styles.lesson} data-state={lesson.state} key={lesson.id}>
            <summary>
              <span className={styles.lessonNumber}>{String(lesson.number).padStart(2, "0")}</span>
              <strong>{lesson.title}</strong>
              <span className={styles.lessonCount}>{lesson.defined}/{lesson.total} defined</span>
              <em data-state={lesson.state}>{STATE_LABELS[lesson.state]}</em>
            </summary>
            <div className={styles.decisions}>
              {lesson.decisions.map((decision) => (
                <article className={styles.decision} data-state={decision.state} key={decision.id}>
                  <header><strong>{decision.prompt}</strong><span data-state={decision.state}>{STATE_LABELS[decision.state]}</span></header>
                  <p>{decision.reason}</p>
                  {decision.excerpt ? <blockquote>{decision.excerpt}</blockquote> : null}
                  <small>{decision.sourceLabel}</small>
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className={styles.footnote}>Story Coverage counts saved story decisions, not course completion and not generated wireframe frames. A visually complete BUILD cannot silently make an unresolved story decision canonical.</p>
    </section>
  );
}
