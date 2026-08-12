"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  FOUNDATION_BUILDER_STEPS,
  createEmptyFoundationBuilderState,
  type FoundationBuilderField,
} from "../../../core/contracts/foundation-builder";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { applyStoryCommand } from "../../../core/project/apply-command";
import {
  createEmptyProject,
  normalizeFoundationProject,
  type PPFProject,
} from "../../../core/project/project";
import styles from "./foundations-plan-workspace.module.css";

const PROJECT_KEY = "plotpickle.foundation.project.v1";

const WORKFLOW_STAGES = [
  { id: "dashboard", relic: "/assets/workflow-relics/dashboard.webp", label: "Dashboard", detail: "Start" },
  { id: "learn", relic: "/assets/workflow-relics/learn.webp", label: "Learn", detail: "Guides" },
  { id: "plan", relic: "/assets/workflow-relics/plan.webp", label: "Plan", detail: "Design" },
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Storyboard", detail: "Visualize" },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft" },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish" },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Synthfiction", detail: "Pages" },
  { id: "build", relic: "/assets/workflow-relics/build.webp", label: "Build", detail: "Assemble" },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review" },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide" },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver" },
] as const;

function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadProject(): PPFProject {
  try {
    const saved = localStorage.getItem(PROJECT_KEY);
    if (saved) return normalizeFoundationProject(JSON.parse(saved) as PPFProject);
  } catch {
    // Fall through to a clean canonical project if the local cache is corrupt.
  }
  return createEmptyProject({ id: newId("project"), now: new Date().toISOString() });
}

export default function FoundationsPlanWorkspace({
  curriculum,
}: {
  readonly curriculum: readonly CurriculumLesson[];
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [activeField, setActiveField] = useState<FoundationBuilderField>("storyPromise");

  useEffect(() => {
    const current = loadProject();
    localStorage.setItem(PROJECT_KEY, JSON.stringify(current));
    setProject(current);
  }, []);

  const foundationLessons = useMemo(
    () => curriculum.filter((lesson) => lesson.topic === "foundations").sort((a, b) => a.number - b.number),
    [curriculum],
  );
  const activeStep = FOUNDATION_BUILDER_STEPS.find((step) => step.id === activeField) ?? FOUNDATION_BUILDER_STEPS[0];
  const activeLesson = foundationLessons.find((lesson) => lesson.title === activeStep.lessonTitle) ?? null;
  const completedLearning = foundationLessons.filter((lesson) => project?.learning.completedLessonIds.includes(lesson.id)).length;
  const completedBuilder = project
    ? FOUNDATION_BUILDER_STEPS.filter((step) => project.foundations[step.id].trim()).length
    : 0;

  function commitField(field: FoundationBuilderField, value: string) {
    setProject((current) => {
      if (!current) return current;
      const next = applyStoryCommand(current, {
        type: "foundations.field.update",
        field,
        value,
        occurredAt: new Date().toISOString(),
      });
      localStorage.setItem(PROJECT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function openLearn() {
    window.location.assign("/?workspace=learn");
  }

  if (!project) return <main className={styles.loading}>Opening PLAN…</main>;

  const activeIndex = FOUNDATION_BUILDER_STEPS.findIndex((step) => step.id === activeField);
  const previous = activeIndex > 0 ? FOUNDATION_BUILDER_STEPS[activeIndex - 1] : null;
  const next = activeIndex < FOUNDATION_BUILDER_STEPS.length - 1 ? FOUNDATION_BUILDER_STEPS[activeIndex + 1] : null;

  return (
    <div className={styles.screen} data-hide-agent-settings-anchor="true">
      <nav className={styles.workflowNav} aria-label="PlotPickle workflow">
        <ol>
          {WORKFLOW_STAGES.map((stage) => (
            <li
              aria-current={stage.id === "plan" ? "page" : undefined}
              className={stage.id === "plan" ? styles.currentStage : undefined}
              key={stage.id}
            >
              <Image aria-hidden="true" alt="" height={56} src={stage.relic} width={56} />
              <span><strong>{stage.label}</strong><small>{stage.detail}</small></span>
            </li>
          ))}
        </ol>
      </nav>

      <main className={styles.workspace}>
        <aside className={styles.rail} aria-label="PLAN Foundations builder">
          <header>
            <strong>PLAN</strong>
            <small>Foundations · {completedBuilder}/11 working answers</small>
          </header>
          <button className={styles.returnLearn} onClick={openLearn} type="button">Return to LEARN</button>
          <nav aria-label="Foundation builder steps">
            {FOUNDATION_BUILDER_STEPS.map((step) => {
              const hasAnswer = Boolean(project.foundations[step.id].trim());
              return (
                <button
                  aria-current={step.id === activeField ? "step" : undefined}
                  className={step.id === activeField ? styles.activeStep : undefined}
                  key={step.id}
                  onClick={() => setActiveField(step.id)}
                  type="button"
                >
                  <span>{String(step.number).padStart(2, "0")}</span>
                  <div><strong>{step.title}</strong><small>Lesson {step.number}: {step.lessonTitle}</small></div>
                  <b aria-label={hasAnswer ? "Working answer saved" : "Not started"}>{hasAnswer ? "✓" : ""}</b>
                </button>
              );
            })}
          </nav>
        </aside>

        <article className={styles.builder} aria-label="Active Foundation builder step">
          <div className={styles.eyebrow}>FOUNDATIONS · STEP {String(activeStep.number).padStart(2, "0")}</div>
          <h1>{activeStep.title}</h1>
          <p className={styles.prompt}>{activeStep.prompt}</p>

          {activeLesson ? (
            <section className={styles.lessonBridge}>
              <div>
                <small>From LEARN Lesson {activeLesson.number}</small>
                <h2>{activeLesson.title}</h2>
                <p>{activeLesson.overview}</p>
              </div>
              <button onClick={openLearn} type="button">Review lesson</button>
            </section>
          ) : null}

          <label className={styles.answerField} htmlFor={`foundation-${activeStep.id}`}>
            <span>Your working answer</span>
            <textarea
              id={`foundation-${activeStep.id}`}
              onChange={(event) => commitField(activeStep.id, event.target.value)}
              placeholder={activeStep.placeholder}
              rows={14}
              value={project.foundations[activeStep.id]}
            />
            <small>Saved locally to the same canonical PlotPickle project used by LEARN.</small>
          </label>

          <nav className={styles.stepNavigation} aria-label="Foundation builder navigation">
            <button disabled={!previous} onClick={() => previous && setActiveField(previous.id)} type="button">
              {previous ? `← ${String(previous.number).padStart(2, "0")} ${previous.title}` : "Start of Foundations"}
            </button>
            <button disabled={!next} onClick={() => next && setActiveField(next.id)} type="button">
              {next ? `${String(next.number).padStart(2, "0")} ${next.title} →` : "Foundations Brief complete"}
            </button>
          </nav>
        </article>

        <aside className={styles.summary} aria-label="Foundations progress summary">
          <header>
            <small>Learning → application</small>
            <h2>Foundations Brief</h2>
            <p>{completedLearning}/11 lessons marked understood · {completedBuilder}/11 PLAN answers started.</p>
          </header>
          <div className={styles.summaryList}>
            {FOUNDATION_BUILDER_STEPS.map((step) => (
              <section key={step.id}>
                <span>{String(step.number).padStart(2, "0")}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{project.foundations[step.id].trim() || "No working answer yet."}</p>
                </div>
              </section>
            ))}
          </div>
          <div className={styles.summaryNote}>
            <strong>How this works</strong>
            <p>LEARN teaches the craft. PLAN turns those lessons into decisions about your story. Later workspaces should inherit the approved Foundation rather than asking you to recreate it.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
