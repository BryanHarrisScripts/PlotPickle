"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { buildFoundationPlanLessons } from "../../../core/contracts/foundation-plan";
import type { PPFProject } from "../../../core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import styles from "./plan-lesson-answer-preview.module.css";

function requestedLessonId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("lesson") ?? "";
}

export default function PlanLessonAnswerPreview({
  curriculum,
}: {
  readonly curriculum: readonly CurriculumLesson[];
}) {
  const lessons = useMemo(() => buildFoundationPlanLessons(curriculum), [curriculum]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [lessonId, setLessonId] = useState("");

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    setProject(loadFoundationProject());
    setLessonId(requestedLessonId());
  }, []);

  useEffect(() => {
    let frame = 0;
    let connectedPanel: HTMLElement | null = null;
    let previousLabel = "";

    const connect = () => {
      const panel = document.querySelector<HTMLElement>(
        'aside[aria-label="Saved Foundations Brief"], aside[data-plan-answer-panel="true"]',
      );
      if (!panel) {
        frame = window.requestAnimationFrame(connect);
        return;
      }

      connectedPanel = panel;
      previousLabel = panel.getAttribute("aria-label") || "Saved Foundations Brief";
      panel.dataset.planAnswerPanel = "true";
      panel.setAttribute("aria-label", "Read-only Foundations lesson answers");
      setTarget(panel);
      refresh();
    };

    connect();

    const handleSavedProject = () => refresh();
    const handleNavigation = () => refresh();
    const handleClick = () => window.setTimeout(refresh, 0);

    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, handleSavedProject);
    window.addEventListener("popstate", handleNavigation);
    document.addEventListener("click", handleClick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, handleSavedProject);
      window.removeEventListener("popstate", handleNavigation);
      document.removeEventListener("click", handleClick);
      if (connectedPanel) {
        delete connectedPanel.dataset.planAnswerPanel;
        connectedPanel.setAttribute("aria-label", previousLabel);
      }
    };
  }, [refresh]);

  if (!target) return null;

  const activeLesson = lessonId ? lessons.find((lesson) => lesson.id === lessonId) ?? null : null;
  const activeAnswers = activeLesson && project
    ? project.foundations.lessons[activeLesson.id]?.answers ?? {}
    : {};
  const answeredCount = activeLesson
    ? activeLesson.fields.filter((field) => Boolean(activeAnswers[field.id]?.trim())).length
    : 0;
  const completedLessons = project
    ? lessons.filter((lesson) => lesson.fields.every((field) => (
      Boolean(project.foundations.lessons[lesson.id]?.answers[field.id]?.trim())
    ))).length
    : 0;

  return createPortal(
    <div className={styles.preview} data-plan-answer-preview="true">
      <header className={styles.header}>
        <small>READ-ONLY LESSON VIEW</small>
        <h2>{activeLesson ? activeLesson.title : "Foundations Answers"}</h2>
        <p>
          {activeLesson
            ? "Create and edit in the middle column. This column mirrors the complete written answers for this lesson and cannot be edited."
            : "Open any of the eleven Foundations lessons to see that lesson's complete written answers here."}
        </p>
      </header>

      {activeLesson ? (
        <>
          <div className={styles.answerList} aria-label={`Read-only answers for ${activeLesson.title}`}>
            {activeLesson.fields.map((field, index) => {
              const answer = activeAnswers[field.id]?.trim() ?? "";
              return (
                <section className={styles.answerCard} key={field.id}>
                  <div className={styles.promptRow}>
                    <span>{index + 1}</span>
                    <h3>{field.prompt}</h3>
                  </div>
                  <div className={answer ? styles.answerText : styles.emptyAnswer}>
                    {answer || "No answer yet. Write it or create an AI draft in the middle column."}
                  </div>
                </section>
              );
            })}
          </div>

          <footer className={styles.footer}>
            <strong>{answeredCount} of {activeLesson.fields.length} answers complete</strong>
            <span>View only · edits happen in the middle column</span>
          </footer>
        </>
      ) : (
        <section className={styles.welcomeState}>
          <strong>{completedLessons} of {lessons.length} lessons complete</strong>
          <p>Select lesson 01–11 on the left. As you type or use local AI in the middle, the finished wording appears here automatically.</p>
        </section>
      )}
    </div>,
    target,
  );
}
