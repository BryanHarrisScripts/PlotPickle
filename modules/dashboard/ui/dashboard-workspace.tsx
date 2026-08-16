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
import styles from "./dashboard-workspace.module.css";

type DashboardDestination = "learn" | "plan" | "build";

const STAGES = [
  {
    id: "learn",
    label: "LEARN",
    relic: "/assets/workflow-relics/learn.webp",
    completeCopy: "All Foundations lessons understood.",
    availableCopy: "Complete the 11 Foundations lessons in your own time.",
    lockedCopy: "LEARN is the starting point.",
  },
  {
    id: "plan",
    label: "PLAN",
    relic: "/assets/workflow-relics/plan.webp",
    completeCopy: "All Foundations story decisions are answered.",
    availableCopy: "Turn what you learned into decisions about your story.",
    lockedCopy: "Finish Foundations in LEARN to open PLAN.",
  },
  {
    id: "build",
    label: "BUILD",
    relic: "/assets/workflow-relics/build.webp",
    completeCopy: "At least one Foundations visual has been accepted.",
    availableCopy: "Your Foundations decisions are ready to become a visual concept.",
    lockedCopy: "Finish the Foundations PLAN questions to open BUILD.",
  },
] as const;

function stateLabel(state: ProgressStageState) {
  if (state === "complete") return "✓ Complete";
  if (state === "available") return "→ Available";
  return "🔒 Locked";
}

function stageCopy(stage: (typeof STAGES)[number], state: ProgressStageState) {
  if (state === "complete") return stage.completeCopy;
  if (state === "available") return stage.availableCopy;
  return stage.lockedCopy;
}

export default function DashboardWorkspace({
  curriculum,
  onNavigate,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onNavigate: (destination: DashboardDestination) => void;
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

  if (!project || !progression) {
    return <main className={styles.screen}>Opening Dashboard…</main>;
  }

  const foundations = progression.foundations;
  const world = progression.groups.find((group) => group.id === "world");
  const worldUnlocked = Boolean(world?.unlocked);
  const stageStates: Readonly<Record<DashboardDestination, ProgressStageState>> = {
    learn: foundations.learn,
    plan: foundations.plan,
    build: foundations.build,
  };

  return (
    <main className={styles.screen} aria-label="PlotPickle Dashboard">
      <header className={styles.header}>
        <p className={styles.kicker}>Dashboard · Guided creation journey · {progression.journeyPercentComplete}% complete</p>
        <h1>Learn it. Plan it. See it.</h1>
        <p>
          PlotPickle opens one step at a time. Finish the Foundations lessons, turn them into decisions about your story in PLAN,
          then use BUILD to create and accept the first visual expression of those decisions.
        </p>
        <p><strong>Next:</strong> {progression.nextAction.label} — {progression.nextAction.detail}</p>
      </header>

      <section className={styles.path} aria-label="Foundations LEARN PLAN BUILD progression">
        {STAGES.map((stage) => {
          const state = stageStates[stage.id];
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
              <h2>{stage.label}</h2>
              <p>{stageCopy(stage, state)}</p>
              <p><small>{detail}</small></p>
              <button
                aria-disabled={locked}
                disabled={locked}
                onClick={() => onNavigate(stage.id)}
                type="button"
              >
                {state === "complete" ? `Open ${stage.label}` : state === "available" ? `Continue to ${stage.label}` : `${stage.label} locked`}
              </button>
            </article>
          );
        })}
      </section>

      <section className={styles.nextModule} data-unlocked={worldUnlocked} aria-label="Next curriculum module">
        <div>
          <p className={styles.kicker}>Next curriculum group</p>
          <h2>WORLD</h2>
          <p>
            {worldUnlocked
              ? "Foundations is complete across LEARN, PLAN and BUILD. WORLD is unlocked in the journey, but its workspace remains gated until the Foundations cycle is approved."
              : "WORLD unlocks after at least one Foundations visual is accepted in BUILD."}
          </p>
        </div>
        <span className={styles.nextBadge}>{worldUnlocked ? "→ Unlocked" : "🔒 Locked"}</span>
      </section>
    </main>
  );
}
