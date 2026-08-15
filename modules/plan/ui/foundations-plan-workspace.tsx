"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  assembleFoundationsBrief,
  buildFoundationPlanLessons,
  countFoundationAnswers,
  createEmptyFoundationLessonAnswers,
  type FoundationPlanLesson,
} from "../../../core/contracts/foundation-plan";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import {
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import { draftFoundationLesson } from "../foundations-plan-drafter";
import styles from "./foundations-plan-workspace.module.css";

const WORKFLOW_STAGES = [
  { id: "dashboard", relic: "/assets/workflow-relics/dashboard.webp", label: "Dashboard", detail: "Start", selectable: false, gapAfter: true },
  { id: "learn", relic: "/assets/workflow-relics/learn.webp", label: "Learn", detail: "Guides", selectable: true, gapAfter: false },
  { id: "plan", relic: "/assets/workflow-relics/plan.webp", label: "Plan", detail: "Design", selectable: true, gapAfter: false },
  { id: "build", relic: "/assets/workflow-relics/build.webp", label: "Build", detail: "Assemble", selectable: false, gapAfter: false },
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Sketch", detail: "Visualize", selectable: false, gapAfter: false },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Visualize", detail: "Pages", selectable: false, gapAfter: true },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft", selectable: false, gapAfter: false },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish", selectable: false, gapAfter: false },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review", selectable: false, gapAfter: false },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide", selectable: false, gapAfter: false },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver", selectable: false, gapAfter: false },
] as const;

function requestedLessonId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("lesson") ?? "";
}

function acceptedFoundationContext(
  lessons: readonly FoundationPlanLesson[],
  activeLessonId: string,
  project: PPFProject,
) {
  return lessons.filter((lesson) => lesson.id !== activeLessonId).flatMap((lesson) => {
    const saved = project.foundations.lessons[lesson.id]?.answers ?? {};
    return lesson.fields.flatMap((field) => {
      const answer = saved[field.id]?.trim();
      return answer ? [`${lesson.title} — ${field.prompt}\n${answer}`] : [];
    });
  }).join("\n\n");
}

export default function FoundationsPlanWorkspace({
  curriculum,
}: {
  readonly curriculum: readonly CurriculumLesson[];
}) {
  const lessons = useMemo(() => buildFoundationPlanLessons(curriculum), [curriculum]);
  const curriculumById = useMemo(
    () => new Map(curriculum.map((lesson) => [lesson.id, lesson])),
    [curriculum],
  );
  const [project, setProject] = useState<PPFProject | null>(null);
  const [briefDraft, setBriefDraft] = useState("");
  const [draftingLessonId, setDraftingLessonId] = useState("");
  const [draftError, setDraftError] = useState("");

  useEffect(() => {
    if (!lessons.length) return;
    const current = loadFoundationProject();
    const validIds = new Set(lessons.map((lesson) => lesson.id));
    const requested = requestedLessonId();
    const activeLessonId = [
      requested,
      current.foundations.activeLessonId ?? "",
      current.learning.activeLessonId ?? "",
      lessons[0].id,
    ].find((lessonId) => validIds.has(lessonId)) ?? lessons[0].id;
    const next = current.foundations.activeLessonId === activeLessonId
      ? current
      : applyStoryCommand(current, {
        type: "foundations.lesson.open",
        lessonId: activeLessonId,
        occurredAt: new Date().toISOString(),
      });
    saveFoundationProject(next);
    // This project is hydrated from the browser-only canonical store after
    // server rendering, so the mount effect intentionally publishes it once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProject(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBriefDraft(next.foundations.brief.content);
  }, [lessons]);

  const activeLesson = lessons.find((lesson) => lesson.id === project?.foundations.activeLessonId)
    ?? lessons[0];
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLesson?.id);
  const activeAnswers = activeLesson && project
    ? project.foundations.lessons[activeLesson.id] ?? createEmptyFoundationLessonAnswers()
    : createEmptyFoundationLessonAnswers();
  const totalFields = lessons.reduce((total, lesson) => total + lesson.fields.length, 0);
  const answeredFields = project ? countFoundationAnswers(lessons, project.foundations) : 0;
  const completedLessons = project ? lessons.filter((lesson) => (
    lesson.fields.every((field) => project.foundations.lessons[lesson.id]?.answers[field.id]?.trim())
  )).length : 0;

  function commit(command: Parameters<typeof applyStoryCommand>[1]) {
    setProject((current) => {
      if (!current) return current;
      const next = applyStoryCommand(current, command);
      saveFoundationProject(next);
      return next;
    });
  }

  function openPlanLesson(lessonId: string) {
    setDraftError("");
    commit({
      type: "foundations.lesson.open",
      lessonId,
      occurredAt: new Date().toISOString(),
    });
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "plan");
    url.searchParams.set("lesson", lessonId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function openLearn(lessonId?: string) {
    if (project && lessonId) {
      const next = applyStoryCommand(project, {
        type: "lesson.open",
        lessonId,
        occurredAt: new Date().toISOString(),
      });
      saveFoundationProject(next);
    }
    window.location.assign("/?workspace=learn");
  }

  async function requestLocalDraft() {
    if (!project || !activeLesson || draftingLessonId) return;
    const curriculumLesson = curriculumById.get(activeLesson.id);
    if (!curriculumLesson) return;
    const lessonId = activeLesson.id;
    setDraftError("");
    setDraftingLessonId(lessonId);
    try {
      const proposal = await draftFoundationLesson({
        projectTitle: project.title,
        lesson: activeLesson,
        curriculumLesson,
        currentAnswers: activeAnswers.answers,
        priorStoryContext: acceptedFoundationContext(lessons, activeLesson.id, project),
      });
      commit({
        type: "foundations.proposal.store",
        lessonId,
        proposal,
        occurredAt: proposal.generatedAt,
      });
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "The local Foundations drafter could not create a proposal.");
    } finally {
      setDraftingLessonId("");
    }
  }

  function buildBriefDraft() {
    if (!project) return;
    setBriefDraft(assembleFoundationsBrief({
      projectTitle: project.title,
      lessons,
      state: project.foundations,
    }));
  }

  if (!project || !activeLesson) {
    return <main className={styles.loading}>Opening PlotPickle PLAN…</main>;
  }

  const previousLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;
  const proposal = activeAnswers.proposal;
  const briefSaved = briefDraft === project.foundations.brief.content;

  function selectWorkflowStage(stageId: (typeof WORKFLOW_STAGES)[number]["id"]) {
    if (stageId === "learn") openLearn(activeLesson.id);
  }

  return (
    <div className={styles.screen} data-hide-agent-settings-anchor="true">
      <nav className={styles.workflowNav} aria-label="PlotPickle workflow">
        <ol style={{ minWidth: 920 }}>
          {WORKFLOW_STAGES.map((stage) => (
            <li
              aria-current={stage.id === "plan" ? "page" : undefined}
              className={stage.id === "plan" ? styles.currentStage : undefined}
              key={stage.id}
              style={{ marginRight: stage.gapAfter ? 44 : undefined }}
            >
              <button
                aria-label={stage.label}
                disabled={!stage.selectable}
                onClick={() => selectWorkflowStage(stage.id)}
                style={{
                  WebkitAppearance: "none",
                  appearance: "none",
                  display: "grid",
                  width: "100%",
                  justifyItems: "center",
                  gap: 2,
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  color: "inherit",
                  cursor: stage.selectable ? "pointer" : "default",
                  font: "inherit",
                  opacity: stage.selectable ? 1 : 0.62,
                  textAlign: "center",
                }}
                title={stage.selectable ? `Open ${stage.label}` : `${stage.label} is not available yet`}
                type="button"
              >
                <Image aria-hidden="true" alt="" height={56} src={stage.relic} width={56} />
                <span><strong>{stage.label}</strong><small>{stage.detail}</small></span>
              </button>
            </li>
          ))}
        </ol>
        <Image
          alt="PlotPickle"
          className={styles.workspaceBrandMark}
          height={64}
          priority
          src="/brand/favicon/plotpickle-ouroboros-v2-128.png"
          width={64}
        />
      </nav>

      <main className={styles.workspace} data-preserve-story-language="true">
        <aside className={styles.lessonRail} aria-label="PLAN Foundations lessons">
          <header>
            <strong>PLAN</strong>
            <span>Foundations</span>
            <small>{completedLessons} of {lessons.length} lessons answered · {answeredFields} of {totalFields} fields</small>
          </header>
          <button className={styles.returnLearn} onClick={() => openLearn(activeLesson.id)} type="button">
            ← Review this lesson in LEARN
          </button>
          <nav aria-label="Foundations planning path">
            {lessons.map((lesson) => {
              const saved = project.foundations.lessons[lesson.id]?.answers ?? {};
              const answered = lesson.fields.filter((field) => saved[field.id]?.trim()).length;
              const complete = answered === lesson.fields.length;
              return (
                <button
                  aria-current={lesson.id === activeLesson.id ? "step" : undefined}
                  className={lesson.id === activeLesson.id ? styles.activeLesson : undefined}
                  key={lesson.id}
                  onClick={() => openPlanLesson(lesson.id)}
                  type="button"
                >
                  <span className={styles.lessonNumber}>{String(lesson.number).padStart(2, "0")}</span>
                  <span className={styles.lessonName}>
                    <strong>{lesson.title}</strong>
                    <small>{answered} of {lesson.fields.length} answers saved</small>
                  </span>
                  <span aria-label={complete ? "Lesson answers complete" : "Lesson answers incomplete"} className={styles.completionMark}>
                    {complete ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <article className={styles.editor} aria-label="Active Foundations planning lesson">
          <header className={styles.lessonHeader}>
            <small>FOUNDATIONS · LESSON {String(activeLesson.number).padStart(2, "0")} OF {lessons.length}</small>
            <h1>{activeLesson.title}</h1>
            <p>{activeLesson.overview}</p>
            <button onClick={() => openLearn(activeLesson.id)} type="button">Review the full teaching lesson</button>
          </header>

          <section className={styles.manualPath}>
            <h2>Make the story decisions</h2>
            <p>Write directly in these fields. Local AI is optional and is never required to complete Foundations. Your words save to this project as you type.</p>
          </section>

          <div className={styles.answerFields}>
            {activeLesson.fields.map((field, index) => (
              <label htmlFor={`foundation-${activeLesson.id}-${field.id}`} key={field.id}>
                <span><b>{index + 1}</b>{field.prompt}</span>
                <textarea
                  id={`foundation-${activeLesson.id}-${field.id}`}
                  onChange={(event) => commit({
                    type: "foundations.answer.update",
                    lessonId: activeLesson.id,
                    fieldId: field.id,
                    value: event.target.value,
                    occurredAt: new Date().toISOString(),
                  })}
                  placeholder="Write your current best answer. Name uncertainties instead of hiding them."
                  rows={7}
                  value={activeAnswers.answers[field.id] ?? ""}
                />
              </label>
            ))}
          </div>

          <section className={styles.aiSection} aria-label="Optional local AI proposal">
            <div className={styles.aiHeading}>
              <div>
                <small>OPTIONAL · LOCAL ONLY</small>
                <h2>Ask Mastra + Ollama for a draft proposal</h2>
                <p>The proposal stays separate from your fields. PlotPickle changes your answers only after you choose to accept it.</p>
              </div>
              <button disabled={Boolean(draftingLessonId)} onClick={requestLocalDraft} type="button">
                {draftingLessonId === activeLesson.id ? "Drafting locally…" : proposal ? "Create a new proposal" : "Draft with local AI"}
              </button>
            </div>
            {draftError ? <p className={styles.error} role="alert">{draftError}</p> : null}
            {proposal ? (
              <div className={styles.proposal}>
                <header>
                  <strong>Reviewable proposal</strong>
                  <small>{proposal.model} · generated {new Date(proposal.generatedAt).toLocaleString()}</small>
                </header>
                {activeLesson.fields.map((field) => proposal.values[field.id] ? (
                  <section key={field.id}>
                    <h3>{field.prompt}</h3>
                    <p>{proposal.values[field.id]}</p>
                  </section>
                ) : null)}
                <div className={styles.proposalActions}>
                  <button
                    disabled={Boolean(activeAnswers.proposalAcceptedAt)}
                    onClick={() => commit({
                      type: "foundations.proposal.accept",
                      lessonId: activeLesson.id,
                      occurredAt: new Date().toISOString(),
                    })}
                    type="button"
                  >
                    {activeAnswers.proposalAcceptedAt ? "Accepted — edit in your fields above" : "Accept proposal into my fields"}
                  </button>
                  <button onClick={() => commit({
                    type: "foundations.proposal.dismiss",
                    lessonId: activeLesson.id,
                    occurredAt: new Date().toISOString(),
                  })} type="button">
                    {activeAnswers.proposalAcceptedAt ? "Hide proposal" : "Dismiss proposal"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <nav className={styles.lessonNavigation} aria-label="Foundations PLAN navigation">
            <button disabled={!previousLesson} onClick={() => previousLesson && openPlanLesson(previousLesson.id)} type="button">
              {previousLesson ? `← ${String(previousLesson.number).padStart(2, "0")} ${previousLesson.title}` : "Start of Foundations"}
            </button>
            <button disabled={!nextLesson} onClick={() => nextLesson && openPlanLesson(nextLesson.id)} type="button">
              {nextLesson ? `${String(nextLesson.number).padStart(2, "0")} ${nextLesson.title} →` : "All eleven lessons visited"}
            </button>
          </nav>
        </article>

        <aside className={styles.briefPanel} aria-label="Saved Foundations Brief">
          <header>
            <small>WRITER-OWNED PROJECT RECORD</small>
            <h2>Foundations Brief</h2>
            <p>Assemble all eleven lessons into one readable brief, edit it, then save the version later PlotPickle work should use.</p>
          </header>
          <div className={styles.briefActions}>
            <button onClick={buildBriefDraft} type="button">Build from saved answers</button>
            <button
              disabled={briefSaved}
              onClick={() => commit({
                type: "foundations.brief.save",
                content: briefDraft,
                occurredAt: new Date().toISOString(),
              })}
              type="button"
            >
              Save Foundations Brief
            </button>
          </div>
          <label htmlFor="foundations-brief">
            <span>Editable brief</span>
            <textarea
              id="foundations-brief"
              onChange={(event) => setBriefDraft(event.target.value)}
              placeholder="Build the brief from your saved lesson answers, or write it here manually."
              value={briefDraft}
            />
          </label>
          <p aria-live="polite" className={briefSaved ? styles.savedStatus : styles.unsavedStatus}>
            {project.foundations.brief.savedAt && briefSaved
              ? `Saved locally ${new Date(project.foundations.brief.savedAt).toLocaleString()}.`
              : briefSaved
                ? "No unsaved brief changes."
                : "Brief draft has unsaved changes."}
          </p>
          <section className={styles.briefGuidance}>
            <h3>What carries forward</h3>
            <p>Only answers in your editable fields and the brief you explicitly save are project decisions. An AI proposal remains a proposal until you accept it.</p>
          </section>
        </aside>
      </main>
    </div>
  );
}