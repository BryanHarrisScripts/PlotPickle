"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  assembleFoundationsBrief,
  buildFoundationPlanLessons,
  countFoundationAnswers,
  createEmptyFoundationLessonAnswers,
  guidingQuestionsForFoundationField,
  isUsableFoundationAnswer,
  type FoundationDraftProposal,
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
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Storyboard", detail: "Sketch", selectable: false, gapAfter: false },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Previs", detail: "Visualize", selectable: false, gapAfter: true },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft", selectable: false, gapAfter: false },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish", selectable: false, gapAfter: false },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review", selectable: false, gapAfter: false },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide", selectable: false, gapAfter: false },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver", selectable: false, gapAfter: false },
] as const;

type FoundationPpfSource = {
  readonly fileName: string;
  readonly projectId: string;
  readonly projectTitle: string;
  readonly context: string;
};

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
  const ppfInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [briefDraft, setBriefDraft] = useState("");
  const [draftingLessonId, setDraftingLessonId] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftFieldIds, setDraftFieldIds] = useState<readonly string[]>([]);
  const [ppfSource, setPpfSource] = useState<FoundationPpfSource | null>(null);
  const [loadingPpf, setLoadingPpf] = useState(false);
  const [autoCompletingFoundations, setAutoCompletingFoundations] = useState(false);
  const [autoCompleteStatus, setAutoCompleteStatus] = useState("");

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

  function applyGeneratedDraft(lessonId: string, proposal: FoundationDraftProposal) {
    setProject((current) => {
      if (!current) return current;
      const stored = applyStoryCommand(current, {
        type: "foundations.proposal.store",
        lessonId,
        proposal,
        occurredAt: proposal.generatedAt,
      });
      const accepted = applyStoryCommand(stored, {
        type: "foundations.proposal.accept",
        lessonId,
        occurredAt: proposal.generatedAt,
      });
      saveFoundationProject(accepted);
      return accepted;
    });
  }

  function openPlanLesson(lessonId: string) {
    setDraftError("");
    setDraftFieldIds([]);
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

  function toggleDraftField(fieldId: string) {
    setDraftError("");
    setDraftFieldIds((current) => (
      current.includes(fieldId)
        ? current.filter((currentId) => currentId !== fieldId)
        : [...current, fieldId]
    ));
  }

  async function loadPpfSource(file: File) {
    if (loadingPpf || autoCompletingFoundations) return;
    setDraftError("");
    setAutoCompleteStatus("");
    setLoadingPpf(true);
    try {
      const response = await fetch("/api/plan/foundations/ppf-context", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-PlotPickle-Project-Filename": encodeURIComponent(file.name),
        },
        body: await file.arrayBuffer(),
      });
      const result = await response.json() as {
        readonly message?: string;
        readonly projectId?: string;
        readonly projectTitle?: string;
        readonly context?: string;
      };
      if (!response.ok || !result.context) {
        throw new Error(result.message || "PlotPickle could not extract story evidence from this .ppf.");
      }
      setPpfSource({
        fileName: file.name,
        projectId: result.projectId || "imported-project",
        projectTitle: result.projectTitle || file.name.replace(/\.ppf$/i, ""),
        context: result.context,
      });
      setAutoCompleteStatus(`${result.projectTitle || file.name} is loaded as read-only story evidence. Nothing has been changed yet.`);
    } catch (error) {
      setPpfSource(null);
      setDraftError(error instanceof Error ? error.message : "PlotPickle could not read this .ppf for PLAN Foundations.");
    } finally {
      setLoadingPpf(false);
    }
  }

  async function autoCompleteAllFoundations() {
    if (!project || !ppfSource || autoCompletingFoundations || draftingLessonId) return;
    setDraftError("");
    setAutoCompletingFoundations(true);
    setAutoCompleteStatus(`Starting Foundations from ${ppfSource.projectTitle}…`);
    let workingProject = project;
    try {
      for (const [index, lesson] of lessons.entries()) {
        const curriculumLesson = curriculumById.get(lesson.id);
        if (!curriculumLesson) throw new Error(`PLAN could not find the curriculum guidance for ${lesson.title}.`);
        const currentAnswers = workingProject.foundations.lessons[lesson.id]?.answers ?? {};
        const emptyFields = lesson.fields.filter((field) => !isUsableFoundationAnswer(currentAnswers[field.id]));
        setAutoCompleteStatus(`Foundations ${index + 1} of ${lessons.length}: ${lesson.title}${emptyFields.length ? "" : " — already complete"}`);
        if (!emptyFields.length) continue;

        const proposal = await draftFoundationLesson({
          projectTitle: ppfSource.projectTitle,
          lesson: { ...lesson, fields: emptyFields },
          curriculumLesson,
          currentAnswers,
          priorStoryContext: acceptedFoundationContext(lessons, lesson.id, workingProject),
          sourceStoryContext: ppfSource.context,
        });
        const stored = applyStoryCommand(workingProject, {
          type: "foundations.proposal.store",
          lessonId: lesson.id,
          proposal,
          occurredAt: proposal.generatedAt,
        });
        workingProject = applyStoryCommand(stored, {
          type: "foundations.proposal.accept",
          lessonId: lesson.id,
          occurredAt: proposal.generatedAt,
        });
        saveFoundationProject(workingProject);
        setProject(workingProject);
      }

      const content = assembleFoundationsBrief({
        projectTitle: ppfSource.projectTitle,
        lessons,
        state: workingProject.foundations,
      });
      workingProject = applyStoryCommand(workingProject, {
        type: "foundations.brief.save",
        content,
        occurredAt: new Date().toISOString(),
      });
      saveFoundationProject(workingProject);
      setProject(workingProject);
      setBriefDraft(content);
      setAutoCompleteStatus(`Foundations complete from ${ppfSource.projectTitle}. Existing answers were preserved; no area outside PLAN / Foundations was changed.`);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "PLAN could not finish the Foundations auto-complete pass.");
      setAutoCompleteStatus("The pass stopped. Any Foundations answers completed before the error remain saved; everything outside Foundations remains untouched.");
    } finally {
      setAutoCompletingFoundations(false);
    }
  }

  async function requestLocalDraft() {
    if (!project || !activeLesson || draftingLessonId || autoCompletingFoundations) return;
    const curriculumLesson = curriculumById.get(activeLesson.id);
    if (!curriculumLesson) return;
    const selectedFields = activeLesson.fields.filter((field) => draftFieldIds.includes(field.id));
    if (!selectedFields.length) {
      setDraftError("Choose one or more PLAN answers for local AI before drafting.");
      return;
    }
    const lessonId = activeLesson.id;
    setDraftError("");
    setDraftingLessonId(lessonId);
    try {
      const proposal = await draftFoundationLesson({
        projectTitle: ppfSource?.projectTitle || project.title,
        lesson: {
          ...activeLesson,
          fields: selectedFields,
        },
        curriculumLesson,
        currentAnswers: activeAnswers.answers,
        priorStoryContext: acceptedFoundationContext(lessons, activeLesson.id, project),
        sourceStoryContext: ppfSource?.context,
      });
      applyGeneratedDraft(lessonId, proposal);
      setDraftFieldIds([]);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "The local Foundations drafter could not create an editable answer.");
    } finally {
      setDraftingLessonId("");
    }
  }

  function buildBriefDraft() {
    if (!project) return;
    setBriefDraft(assembleFoundationsBrief({
      projectTitle: ppfSource?.projectTitle || project.title,
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
            <p>Use the three helper questions under each decision to think it through. Write your own answer, or select local AI for the answers where you want a working draft you can immediately edit.</p>
          </section>

          <div className={styles.answerFields}>
            {activeLesson.fields.map((field, index) => (
              <section className={styles.answerField} key={field.id}>
                <label className={styles.fieldPrompt} htmlFor={`foundation-${activeLesson.id}-${field.id}`}>
                  <span><b>{index + 1}</b>{field.prompt}</span>
                </label>
                <div className={styles.guidingQuestions} aria-label={`Three questions to help answer field ${index + 1}`}>
                  <small>Three questions to help you answer</small>
                  <ol>
                    {guidingQuestionsForFoundationField(field).map((guideQuestion) => (
                      <li key={guideQuestion}>{guideQuestion}</li>
                    ))}
                  </ol>
                </div>
                <textarea
                  id={`foundation-${activeLesson.id}-${field.id}`}
                  onChange={(event) => commit({
                    type: "foundations.answer.update",
                    lessonId: activeLesson.id,
                    fieldId: field.id,
                    value: event.target.value,
                    occurredAt: new Date().toISOString(),
                  })}
                  placeholder="Write your current best answer, or select local AI below for an editable draft."
                  rows={7}
                  value={activeAnswers.answers[field.id] ?? ""}
                />
                <label className={styles.aiFieldChoice}>
                  <input
                    aria-label={`Use local AI for field ${index + 1}: ${field.prompt}`}
                    checked={draftFieldIds.includes(field.id)}
                    onChange={() => toggleDraftField(field.id)}
                    type="checkbox"
                  />
                  <span>Use local AI to draft this answer</span>
                </label>
              </section>
            ))}
          </div>

          <section className={styles.aiSection} aria-label="Optional local AI drafting">
            <div className={styles.aiHeading}>
              <div>
                <small>PPF AUTO-COMPLETE · FOUNDATIONS ONLY</small>
                <h2>Use an existing story to complete Foundations</h2>
                <p>Load afterglow.ppf or another PlotPickle project as read-only story evidence. PlotPickle can then fill every currently empty Foundations answer and save the Foundations Brief. Existing answers are preserved. LEARN and every area after Foundations stay untouched.</p>
                <input
                  accept=".ppf,application/octet-stream"
                  aria-label="Choose PlotPickle PPF source"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void loadPpfSource(file);
                    event.currentTarget.value = "";
                  }}
                  ref={ppfInputRef}
                  style={{ display: "none" }}
                  type="file"
                />
              </div>
              <button
                disabled={loadingPpf || autoCompletingFoundations || Boolean(draftingLessonId)}
                onClick={() => ppfInputRef.current?.click()}
                type="button"
              >
                {loadingPpf ? "Reading .ppf…" : ppfSource ? "Replace .ppf source" : "Load .ppf source"}
              </button>
            </div>
            <p className={styles.aiSelectionStatus} aria-live="polite">
              {ppfSource
                ? `${ppfSource.fileName} → ${ppfSource.projectTitle}. Source is read-only and is not saved into other PlotPickle areas.`
                : "No .ppf source loaded. Loading a source does not change the project."}
            </p>

            <div className={styles.aiHeading} style={{ marginTop: 26 }}>
              <div>
                <small>ONE PASS · LOCAL AI</small>
                <h2>Auto-complete PLAN / Foundations only</h2>
                <p>The pass works lesson by lesson, fills only empty fields, saves after each completed lesson, then builds and saves the Foundations Brief. If local AI stops, completed Foundations work is kept and nothing else is changed.</p>
              </div>
              <button
                disabled={!ppfSource || loadingPpf || autoCompletingFoundations || Boolean(draftingLessonId)}
                onClick={autoCompleteAllFoundations}
                type="button"
              >
                {autoCompletingFoundations ? "Completing Foundations…" : "Auto-complete Foundations only"}
              </button>
            </div>
            {autoCompleteStatus ? <p className={styles.aiSelectionStatus} aria-live="polite">{autoCompleteStatus}</p> : null}

            <div className={styles.aiHeading} style={{ marginTop: 34 }}>
              <div>
                <small>OPTIONAL · LOCAL ONLY</small>
                <h2>Draft the selected answers with local AI</h2>
                <p>Choose AI under any answer above, then draft those selections. PlotPickle inserts the result directly into only those editable fields. Each AI answer is kept concise at no more than four short paragraphs, and you can change every word.</p>
              </div>
              <button
                disabled={Boolean(draftingLessonId) || autoCompletingFoundations || draftFieldIds.length === 0}
                onClick={requestLocalDraft}
                type="button"
              >
                {draftingLessonId === activeLesson.id
                  ? "Drafting selected answers…"
                  : `Fill ${draftFieldIds.length || "selected"} with local AI`}
              </button>
            </div>

            <p className={styles.aiSelectionStatus} aria-live="polite">
              {draftFieldIds.length
                ? `${draftFieldIds.length} of ${activeLesson.fields.length} answers selected. Existing text in those selected fields will be replaced by the new editable AI draft.`
                : "No answers selected for AI. Manual writing remains unchanged."}
            </p>

            {draftError ? <p className={styles.error} role="alert">{draftError}</p> : null}
            {proposal ? (
              <div className={styles.proposal}>
                <header>
                  <strong>AI draft inserted into your editable fields</strong>
                  <small>{proposal.model} · generated {new Date(proposal.generatedAt).toLocaleString()}</small>
                </header>
                {activeLesson.fields.map((field) => proposal.values[field.id] ? (
                  <section key={field.id}>
                    <h3>{field.prompt}</h3>
                    <p>{proposal.values[field.id]}</p>
                  </section>
                ) : null)}
                <div className={styles.proposalActions}>
                  <button onClick={() => commit({
                    type: "foundations.proposal.dismiss",
                    lessonId: activeLesson.id,
                    occurredAt: new Date().toISOString(),
                  })} type="button">
                    Hide generation details
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
            <p>Your editable PLAN answers are the working project decisions. AI can fill only the answers you explicitly select, and the PPF auto-complete path can fill only currently empty Foundations answers. Review or edit that working text before using it downstream.</p>
          </section>
        </aside>
      </main>
    </div>
  );
}
