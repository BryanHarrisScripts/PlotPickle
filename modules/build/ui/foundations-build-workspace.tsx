"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { PPFProject } from "../../../core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import { deriveFoundationsProgression } from "../../dashboard/foundations-progression";
import styles from "./foundations-build-workspace.module.css";

export default function FoundationsBuildWorkspace({
  curriculum,
  onOpenDashboard,
  onOpenPlan,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onOpenDashboard: () => void;
  readonly onOpenPlan: () => void;
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
    () => project ? deriveFoundationsProgression(curriculum, project) : null,
    [curriculum, project],
  );

  if (!project || !progression) {
    return <main className={styles.screen}>Opening Foundations BUILD…</main>;
  }

  const unlocked = progression.build !== "locked";

  return (
    <main className={styles.screen} aria-label="Foundations BUILD">
      <section className={`${styles.panel} ${unlocked ? "" : styles.locked}`.trim()}>
        <p className={styles.kicker}>BUILD · Foundations</p>
        <h1>{unlocked ? "Your first visual workshop is unlocked." : "Finish PLAN before BUILD."}</h1>
        <p>
          {unlocked
            ? "This workspace is the handoff from your approved Foundations decisions into visual concept work. The Dashboard already tracks the rule that WORLD unlocks only after at least one visual artifact is accepted here."
            : `You have ${progression.answeredPlanFields} of ${progression.totalPlanFields} Foundations PLAN answers saved. Complete the remaining decisions first so BUILD has reliable story context.`}
        </p>
        {unlocked ? (
          <p>
            The image-generation canvas is the next BUILD slice; this landing screen deliberately does not invent an accepted visual or unlock WORLD before a real artifact exists.
          </p>
        ) : null}
        <div className={styles.actions}>
          <button onClick={onOpenDashboard} type="button">Return to Dashboard</button>
          <button onClick={onOpenPlan} type="button">Open PLAN</button>
        </div>
        {unlocked && project.foundations.brief.content ? (
          <pre className={styles.brief} aria-label="Saved Foundations brief">{project.foundations.brief.content}</pre>
        ) : null}
      </section>
    </main>
  );
}
