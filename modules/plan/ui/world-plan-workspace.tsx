"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  assembleWorldBrief,
  buildWorldPlanLessons,
  countWorldAnswers,
  createEmptyWorldLessonAnswers,
} from "../../../core/contracts/world-plan";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import { hasQaWorkspaceAccess, isQaAccessOverride } from "../../../core/progression/qa-access";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import { deriveGuidedCreationProgression } from "../../dashboard/guided-progression";
import styles from "./world-plan-workspace.module.css";

export default function WorldPlanWorkspace({
  curriculum,
  onOpenLearn,
  onOpenBuild,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onOpenLearn: () => void;
  readonly onOpenBuild: () => void;
}) {
  const lessons = useMemo(() => buildWorldPlanLessons(curriculum), [curriculum]);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [briefDraft, setBriefDraft] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    if (!lessons.length) return;
    const current = loadFoundationProject();
    const validIds = new Set(lessons.map((lesson) => lesson.id));
    const requested = typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("lesson") ?? "";
    const activeLessonId = [requested, current.world.activeLessonId ?? "", lessons[0].id]
      .find((lessonId) => validIds.has(lessonId)) ?? lessons[0].id;
    if (current.world.activeLessonId !== activeLessonId) {
      const next = applyStoryCommand(current, {
        type: "world.lesson.open",
        lessonId: activeLessonId,
        occurredAt: new Date().toISOString(),
      });
      saveFoundationProject(next);
      setProject(next);
      setBriefDraft(next.world.brief.content);
    } else {
      setBriefDraft(current.world.brief.content);
    }
  }, [lessons]);

  const progression = useMemo(
    () => project ? deriveGuidedCreationProgression(curriculum, project) : null,
    [curriculum, project],
  );

  if (!project || !progression || !lessons.length) {
    return <main className={styles.screen}>Opening World PLAN…</main>;
  }

  const world = progression.world;
  const canonicalPlanAccess = world.plan !== "locked";
  const planAccessible = hasQaWorkspaceAccess(canonicalPlanAccess);
  const qaOnlyAccess = isQaAccessOverride(canonicalPlanAccess);
  if (!planAccessible) {
    return (
      <main className={styles.screen} aria-label="World PLAN locked">
        <section className={styles.locked}>
          <p className={styles.kicker}>WORLD · PLAN</p>
          <h1>World PLAN is still locked.</h1>
          <p>
            {world.unlocked
              ? `Finish World LEARN first. ${world.completedLessonCount} of ${world.lessonCount} World lessons are complete.`
              : "Finish and approve the Foundations LEARN → PLAN → BUILD cycle before World can add project truth."}
          </p>
          <div className={styles.actions}>
            <button onClick={onOpenLearn} type="button">Open LEARN</button>
          </div>
        </section>
      </main>
    );
  }

  const activeLesson = lessons.find((lesson) => lesson.id === project.world.activeLessonId) ?? lessons[0];
  const activeAnswers = project.world.lessons[activeLesson.id] ?? createEmptyWorldLessonAnswers();
  const totalFields = lessons.reduce((total, lesson) => total + lesson.fields.length, 0);
  const answeredFields = countWorldAnswers(lessons, project.world);
  const planComplete = answeredFields === totalFields && totalFields > 0;
  const buildNavigationAccessible = hasQaWorkspaceAccess(planComplete);

  function commit(command: Parameters<typeof applyStoryCommand>[1]) {
    setProject((current) => {
      const next = applyStoryCommand(current ?? loadFoundationProject(), command);
      saveFoundationProject(next);
      return next;
    });
  }

  function openLesson(lessonId: string) {
    commit({ type: "world.lesson.open", lessonId, occurredAt: new Date().toISOString() });
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "plan");
    url.searchParams.set("section", "world");
    url.searchParams.set("lesson", lessonId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function updateAnswer(fieldId: string, value: string) {
    commit({
      type: "world.answer.update",
      lessonId: activeLesson.id,
      fieldId,
      value,
      occurredAt: new Date().toISOString(),
    });
    setMessage("World decision saved locally. Foundations was not changed.");
  }

  function buildBrief() {
    const content = assembleWorldBrief({ projectTitle: project.title, lessons, state: project.world });
    setBriefDraft(content);
    commit({ type: "world.brief.save", content, occurredAt: new Date().toISOString() });
    setMessage("World Brief rebuilt from your saved World decisions.");
  }

  function saveBrief() {
    commit({ type: "world.brief.save", content: briefDraft, occurredAt: new Date().toISOString() });
    setMessage("World Brief saved locally.");
  }

  return (
    <main className={styles.screen} aria-label="World PLAN">
      <header className={styles.header}>
        <p className={styles.kicker}>WORLD · PLAN · Foundations + World</p>
        <h1>Define the world without rewriting the story foundation.</h1>
        <p>
          These fields come from the existing World curriculum. They add locations, rules, culture, environment,
          genre constraints and continuity evidence to the accepted Foundations frontier. Character, Theme and Structure stay out.
        </p>
        {qaOnlyAccess ? <p role="status"><strong>QA access:</strong> this implemented workspace is open even though World PLAN remains canonically locked. Saved decisions do not mark prior LEARN or Foundations stages complete.</p> : null}
        <div className={styles.status}>
          <span>World LEARN: {world.learn === "complete" ? "Complete" : "In progress"}</span>
          <span>World PLAN: {answeredFields} / {totalFields}</span>
          <span>World BUILD: {world.build === "locked" ? "Locked" : world.build === "complete" ? "Complete" : "Available"}</span>
        </div>
      </header>

      <section className={styles.workspace}>
        <nav className={styles.rail} aria-label="World PLAN lessons">
          {lessons.map((lesson) => {
            const savedAnswers = project.world.lessons[lesson.id]?.answers ?? {};
            const complete = lesson.fields.every((field) => Boolean(savedAnswers[field.id]?.trim()));
            return (
              <button
                data-active={lesson.id === activeLesson.id ? "true" : "false"}
                key={lesson.id}
                onClick={() => openLesson(lesson.id)}
                type="button"
              >
                <strong>{String(lesson.number).padStart(2, "0")} · {lesson.title}</strong>
                <small>{complete ? "PLAN answers complete" : `${lesson.fields.filter((field) => savedAnswers[field.id]?.trim()).length} / ${lesson.fields.length} answered`}</small>
              </button>
            );
          })}
        </nav>

        <section className={styles.editor} aria-label={`World PLAN ${activeLesson.title}`}>
          <p className={styles.kicker}>World decision set</p>
          <h2>{activeLesson.title}</h2>
          <p className={styles.overview}>{activeLesson.overview}</p>

          {activeLesson.fields.map((field) => (
            <div className={styles.field} key={field.id}>
              <label htmlFor={`world-${activeLesson.id}-${field.id}`}>{field.prompt}</label>
              <textarea
                id={`world-${activeLesson.id}-${field.id}`}
                onChange={(event) => updateAnswer(field.id, event.target.value)}
                placeholder="Write the current World decision. Keep unknowns explicit rather than inventing an answer."
                value={activeAnswers.answers[field.id] ?? ""}
              />
            </div>
          ))}

          <div className={styles.actions}>
            <button onClick={onOpenLearn} type="button">Back to World LEARN</button>
            <button onClick={buildBrief} type="button">Build World Brief</button>
            <button disabled={!buildNavigationAccessible} onClick={onOpenBuild} type="button">{isQaAccessOverride(planComplete) ? "Open World BUILD · QA" : "Open World BUILD"}</button>
          </div>
          {message ? <p role="status">{message}</p> : null}

          <div className={styles.brief}>
            <strong>World Brief</strong>
            <p className={styles.overview}>A readable source of World truth for the next wireframe pass. It remains separate from Foundations history.</p>
            <textarea onChange={(event) => setBriefDraft(event.target.value)} value={briefDraft} />
            <div className={styles.actions}>
              <button onClick={saveBrief} type="button">Save World Brief</button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
