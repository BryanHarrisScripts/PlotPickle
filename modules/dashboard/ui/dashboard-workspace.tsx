"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { PPFProject } from "../../../core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import {
  deriveGuidedCreationProgression,
  type ProgressStageState,
} from "../guided-progression";
import { deriveVisualWriterFrontierStatus } from "../visual-writer-frontier";
import styles from "./dashboard-workspace.module.css";

type DashboardDestination = "learn" | "plan" | "build";
type GuidedSection = "foundations" | "world";

const STAGES = [
  { id: "learn", label: "LEARN", relic: "/assets/workflow-relics/learn.webp" },
  { id: "plan", label: "PLAN", relic: "/assets/workflow-relics/plan.webp" },
  { id: "build", label: "BUILD", relic: "/assets/workflow-relics/build.webp" },
] as const;

function stateLabel(state: ProgressStageState) {
  if (state === "complete") return "✓ Complete";
  if (state === "available") return "→ Available";
  return "🔒 Locked";
}

function foundationStageCopy(stage: DashboardDestination, state: ProgressStageState) {
  if (stage === "learn") return state === "complete" ? "Foundations lessons complete." : "Learn the core story foundation in your own time.";
  if (stage === "plan") return state === "complete" ? "Foundations decisions complete." : state === "available" ? "Turn what you learned into story decisions." : "Finish Foundations LEARN first.";
  return state === "complete" ? "A Foundations visual has been accepted." : state === "available" ? "Create the first rough visual wireframe." : "Finish Foundations PLAN first.";
}

export default function DashboardWorkspace({
  curriculum,
  onNavigate,
  onNavigateGuided,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onNavigate: (destination: DashboardDestination) => void;
  readonly onNavigateGuided: (workspace: DashboardDestination, section: GuidedSection) => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);

  useEffect(() => {
    const sync = () => setProject(loadFoundationProject());
    sync();
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const progression = useMemo(
    () => project ? deriveGuidedCreationProgression(curriculum, project) : null,
    [curriculum, project],
  );
  const frontierStatus = useMemo(
    () => project ? deriveVisualWriterFrontierStatus(curriculum, project) : null,
    [curriculum, project],
  );

  if (!project || !progression || !frontierStatus) {
    return <main className={styles.screen}>Opening Dashboard…</main>;
  }

  const foundations = progression.foundations;
  const world = progression.world;
  const foundationStates: Readonly<Record<DashboardDestination, ProgressStageState>> = {
    learn: foundations.learn,
    plan: foundations.plan,
    build: foundations.build,
  };
  const worldStates: Readonly<Record<DashboardDestination, ProgressStageState>> = {
    learn: world.learn,
    plan: world.plan,
    build: world.build,
  };

  return (
    <main className={styles.screen} aria-label="PlotPickle Dashboard">
      <header className={styles.header}>
        <p className={styles.kicker}>Dashboard · Guided Visual Writer journey · {progression.journeyPercentComplete}% complete</p>
        <h1>Learn it. Plan it. See it. Then add the next layer.</h1>
        <p>
          Foundations establishes the first accepted story frontier. World now repeats the same LEARN → PLAN → BUILD cycle,
          adding only worldbuilding decisions and preserving earlier visual history.
        </p>
      </header>

      <section className={styles.nextModule} aria-label="Visual Writer current frontier">
        <div>
          <p className={styles.kicker}>Current Visual Writer state</p>
          <h2>{frontierStatus.currentGroupLabel} · {frontierStatus.currentWorkspace?.toUpperCase() ?? "GATED"}</h2>
          <p><strong>Frontier:</strong> {frontierStatus.frontierLabel}</p>
          <p><strong>Artifacts:</strong> {frontierStatus.acceptedArtifactCount} accepted · {frontierStatus.draftArtifactCount} draft</p>
          <p><strong>Next:</strong> {frontierStatus.nextActionLabel} — {frontierStatus.nextActionDetail}</p>
          {frontierStatus.stopReason ? <p><strong>Current stopping point:</strong> {frontierStatus.stopReason}</p> : null}
        </div>
        <span className={styles.nextBadge}>{frontierStatus.reachedImplementedBuildFrontier ? "Frontier reached" : "In progress"}</span>
      </section>

      <section className={styles.path} aria-label="Foundations LEARN PLAN BUILD progression">
        {STAGES.map((stage) => {
          const state = foundationStates[stage.id];
          const locked = state === "locked";
          const detail = stage.id === "learn"
            ? `${foundations.completedLessonCount} of ${foundations.lessonCount} Foundations lessons complete`
            : stage.id === "plan"
              ? `${foundations.answeredPlanFields} of ${foundations.totalPlanFields} PLAN answers saved`
              : `${foundations.acceptedVisualArtifactCount} accepted Foundations visual${foundations.acceptedVisualArtifactCount === 1 ? "" : "s"}`;
          return (
            <article className={styles.stage} data-state={state} key={stage.id}>
              <div className={styles.stageTop}>
                <span className={styles.relicWrap} aria-hidden="true">
                  <Image className={styles.relic} alt="" height={58} src={stage.relic} width={58} />
                </span>
                <span className={styles.stateMark}>{stateLabel(state)}</span>
              </div>
              <h2>FOUNDATIONS · {stage.label}</h2>
              <p>{foundationStageCopy(stage.id, state)}</p>
              <p><small>{detail}</small></p>
              <button aria-disabled={locked} disabled={locked} onClick={() => onNavigate(stage.id)} type="button">
                {state === "complete" ? `Open ${stage.label}` : state === "available" ? `Continue to ${stage.label}` : `${stage.label} locked`}
              </button>
            </article>
          );
        })}
      </section>

      <section className={styles.nextModule} data-unlocked={world.unlocked} aria-label="World Visual Writer cycle">
        <div>
          <p className={styles.kicker}>Second implemented curriculum group</p>
          <h2>WORLD · Foundations + World</h2>
          <p>
            {world.unlocked
              ? "World is active. LEARN records the existing five World lessons, PLAN captures only curriculum-supported World decisions, and BUILD branches the wireframe without replacing accepted Foundations history."
              : "World stays locked until the canonical Foundations completion rule is satisfied, including an explicitly accepted Foundations visual."}
          </p>
          <p><small>{world.completedLessonCount} / {world.lessonCount} World lessons · {world.answeredPlanFields} / {world.totalPlanFields} World PLAN decisions · {world.acceptedVisualArtifactCount} accepted World visual change{world.acceptedVisualArtifactCount === 1 ? "" : "s"}</small></p>
          <div className={styles.miniStages} aria-label="World stage states">
            <span data-state={worldStates.learn}>L</span>
            <span data-state={worldStates.plan}>P</span>
            <span data-state={worldStates.build}>B</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button disabled={world.learn === "locked"} onClick={() => onNavigateGuided("learn", "world")} type="button">World LEARN</button>
            <button disabled={world.plan === "locked"} onClick={() => onNavigateGuided("plan", "world")} type="button">World PLAN</button>
            <button disabled={world.build === "locked"} onClick={() => onNavigateGuided("build", "world")} type="button">World BUILD</button>
          </div>
        </div>
        <span className={styles.nextBadge}>{world.complete ? "✓ Complete" : world.unlocked ? "→ Active" : "🔒 Locked"}</span>
      </section>

      <section className={styles.curriculumOverview} aria-label="Full guided curriculum progression">
        <div className={styles.curriculumHeading}>
          <div>
            <p className={styles.kicker}>The complete guided journey</p>
            <h2>12 curriculum groups. One progression engine.</h2>
          </div>
          <p>Foundations and World are implemented vertical slices. Character is the next frontier after World is accepted; later groups remain honestly gated.</p>
        </div>
        <div className={styles.curriculumGrid}>
          {progression.groups.map((group, index) => {
            const activeImplemented = group.implemented && !group.complete && group.unlocked;
            const readyNext = group.unlocked && !group.implemented;
            const status = group.complete
              ? "✓ Complete"
              : activeImplemented
                ? "→ In progress"
                : readyNext
                  ? "→ Ready next"
                  : "🔒 Gated";
            return (
              <article className={styles.curriculumCard} data-current={activeImplemented} data-ready={readyNext} key={group.id}>
                <div className={styles.curriculumCardTop}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{status}</strong>
                </div>
                <h3>{group.label}</h3>
                <p>{group.completedLessonCount} / {group.lessonCount} lessons recorded</p>
                <div className={styles.miniStages} aria-label={`${group.label} stage states`}>
                  <span data-state={group.learn}>L</span>
                  <span data-state={group.plan}>P</span>
                  <span data-state={group.build}>B</span>
                </div>
                <div className={styles.progressTrack} aria-label={`${group.label} ${group.percentComplete}% complete`}>
                  <span style={{ width: `${group.percentComplete}%` }} />
                </div>
                {!group.implemented ? <small>Workspace intentionally gated until the prior approved cycle is proven.</small> : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
