"use client";

import type { PPFProject } from "@/core/project/project";
import { deriveVisualReadiness, type VisualReadinessTarget } from "@/modules/build/visual-readiness";
import { AFTERGLOW_V9_VISUAL_READINESS_BLOCK_NUMBER } from "@/modules/library/reference/afterglow-v9-visual-readiness";
import StoryboardEditorialWorkspace from "./storyboard-editorial-workspace";
import styles from "./storyboard-readiness-workspace.module.css";

function blockNumber(target: VisualReadinessTarget) {
  const match = target.id.match(/^block:block-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

function stateLabel(target: VisualReadinessTarget) {
  return target.storyboardAllowed ? "Ready for Storyboard" : target.state.charAt(0).toUpperCase() + target.state.slice(1);
}

export default function StoryboardReadinessWorkspace({ project, onProjectChange, onOpenBuild }: {
  readonly project: PPFProject;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenBuild: () => void;
}) {
  const readiness = deriveVisualReadiness({ project });
  const blocks = readiness.targets
    .filter((target) => target.kind === "block")
    .sort((left, right) => blockNumber(left) - blockNumber(right));
  const readyCount = blocks.filter((target) => target.storyboardAllowed).length;
  const editorialTarget = blocks.find((target) => (
    blockNumber(target) === AFTERGLOW_V9_VISUAL_READINESS_BLOCK_NUMBER && target.storyboardAllowed
  )) ?? null;

  return (
    <main className={styles.workspace} aria-labelledby="storyboard-readiness-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Storyboard · Phase 8 re-adoption</span>
          <h1 id="storyboard-readiness-title">Sketch only what the story has earned.</h1>
          <p>
            Storyboard now reads the canonical PPF readiness contract. Existing Storyboard frames, assets and editorial tools are being re-adopted behind this gate rather than reviving a second project store.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Project</dt><dd>{project.title}</dd></div>
          <div><dt>PPF revision</dt><dd>{project.revision}</dd></div>
          <div><dt>Curriculum frontier</dt><dd>{readiness.curriculumFrontier}</dd></div>
          <div><dt>Storyboard-ready Blocks</dt><dd>{readyCount} / {blocks.length}</dd></div>
        </dl>
      </header>

      <section className={styles.notice} aria-label="Storyboard authority boundary">
        <strong>{readiness.storyboardAllowed ? "Storyboard has eligible targets." : "Storyboard is visible, but no Block is authorable yet."}</strong>
        <span>Locked or missing targets stay truthful. PlotPickle does not fabricate scene or frame readiness from early curriculum decisions.</span>
        <button type="button" onClick={onOpenBuild}>Open BUILD evidence</button>
      </section>

      <section className={styles.board} aria-label="Canonical Storyboard readiness by Block">
        {blocks.map((target) => {
          const number = blockNumber(target);
          return (
            <article className={styles.card} data-storyboard-allowed={target.storyboardAllowed ? "true" : "false"} key={target.id}>
              <header>
                <span>Block {String(number).padStart(2, "0")}</span>
                <strong>{stateLabel(target)}</strong>
              </header>
              <h2>{target.label.replace(/^Block \d+: /, "")}</h2>
              <p>{target.storyboardAllowed
                ? "Human-reviewed structural placement exists for this canonical target."
                : target.missingPrerequisites.join(" · ") || "Storyboard prerequisites remain unresolved."}</p>
              <dl>
                <div><dt>Evidence</dt><dd>{target.state}</dd></div>
                <div><dt>Frontier</dt><dd>{target.curriculumFrontier}</dd></div>
                <div><dt>Provenance</dt><dd>{target.provenance.length ? target.provenance.map((item) => item.source).join(" · ") : "No accepted placement evidence"}</dd></div>
              </dl>
            </article>
          );
        })}
      </section>

      {editorialTarget ? (
        <StoryboardEditorialWorkspace
          project={project}
          target={editorialTarget}
          onProjectChange={onProjectChange}
          onOpenBuild={onOpenBuild}
        />
      ) : null}

      <footer className={styles.footer}>
        Existing `VisualFrame` / `VisualMediaVersion` identity and Keep/Change/Compare semantics are being re-adopted behind canonical targets. This readiness gate writes no visual canon and triggers no media generation; an explicit Human Keep decision records only the approved visual projection in PPF.
      </footer>
    </main>
  );
}
