"use client";

import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { PPFProject } from "../../../core/project/project";
import {
  deriveFoundationsStoryCoverage,
  type FoundationsStoryEvidenceState,
} from "../foundations-story-coverage";
import ProgressiveStoryMap from "./progressive-story-map";
import styles from "./foundations-story-coverage.module.css";

const STATE_LABELS: Readonly<Record<FoundationsStoryEvidenceState, string>> = {
  defined: "Defined",
  observed: "Observed",
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
  const supported = coverage.defined + coverage.observed;

  return (
    <section className={styles.panel} aria-labelledby="foundations-story-coverage-title" data-story-coverage="live-foundations">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Story evidence · current PPF</p>
          <h2 id="foundations-story-coverage-title">Story Coverage</h2>
          <p>See what the writer has defined, what an immutable reference source directly supports, which ideas are still proposals, and which decisions remain intentionally open.</p>
        </div>
        <div className={styles.score} aria-label={`${coverage.percent}% of current Foundations story decisions are supported`}>
          <strong>{coverage.percent}%</strong>
          <span>{supported} of {coverage.total} decisions supported</span>
        </div>
      </header>

      <dl className={styles.summary} aria-label="Foundations story evidence totals">
        <div data-state="defined"><dt>Defined</dt><dd>{coverage.defined}</dd><small>Saved Human decisions or explicit reference-fixture decisions</small></div>
        <div data-state="observed"><dt>Observed</dt><dd>{coverage.observed}</dd><small>Directly supported by immutable reference/source evidence</small></div>
        <div data-state="emerging"><dt>Emerging</dt><dd>{coverage.emerging}</dd><small>Draft/import proposals awaiting a decision</small></div>
        <div data-state="missing"><dt>Missing</dt><dd>{coverage.missing}</dd><small>No usable story support yet</small></div>
      </dl>

      <div className={styles.legend} aria-label="Story evidence meanings">
        <span data-state="defined"><i aria-hidden="true">✓</i><strong>Defined</strong> is an explicit working decision. Reference fixtures label synthetic decisions so they are never mistaken for screenplay evidence.</span>
        <span data-state="observed"><i aria-hidden="true">●</i><strong>Observed</strong> is directly supported by the immutable imported/reference source.</span>
        <span data-state="emerging"><i aria-hidden="true">~</i><strong>Emerging</strong> is useful proposal/import interpretation that still needs Human acceptance.</span>
        <span data-state="missing"><i aria-hidden="true">○</i><strong>Missing</strong> means PlotPickle leaves the decision open instead of inventing filler.</span>
      </div>

      <ProgressiveStoryMap project={project} />

      <div className={styles.lessonGrid}>
        {coverage.lessons.map((lesson) => (
          <details className={styles.lesson} data-state={lesson.state} key={lesson.id}>
            <summary>
              <span className={styles.lessonNumber}>{String(lesson.number).padStart(2, "0")}</span>
              <strong>{lesson.title}</strong>
              <span className={styles.lessonCount}>{lesson.defined + lesson.observed}/{lesson.total} supported</span>
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

      <p className={styles.footnote}>Story Coverage counts supported story decisions, not course completion and not generated wireframe frames. Imported screenplay passages and the Afterglow reference fixture preserve provenance; synthetic fixture decisions are labelled separately from observed source evidence. A visually complete BUILD cannot silently make an unresolved story decision canonical.</p>
    </section>
  );
}
