"use client";

import { useMemo, useState } from "react";
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { LearningApplicationCourse } from "../../core/contracts/learning-application";
import { buildLearningApplicationView } from "../../core/learning/application-view";
import type { PPFProject } from "../../core/project/project";
import { loadFoundationProject } from "../../core/storage/foundation-project-browser";
import { answerWithEducationalAssistance } from "../../modules/creative-room/ea-reflection-guide";
import styles from "./learn-journey-preview.module.css";

function applicationHref(topic: string, lessonId: string) {
  const query = new URLSearchParams();
  switch (topic) {
    case "foundations":
      query.set("workspace", "plan");
      query.set("section", "foundations");
      query.set("lesson", lessonId);
      return `/?${query.toString()}`;
    case "world":
      query.set("workspace", "plan");
      query.set("section", "world");
      query.set("lesson", lessonId);
      return `/?${query.toString()}`;
    case "character":
    case "theme":
      return "/?workspace=plan&section=foundations";
    case "structure":
      return "/structure";
    case "visual-storytelling":
      return "/storyboard";
    case "drafting":
    case "dialogue":
      return "/pageflow";
    case "revision":
      return "/edit";
    case "responsible-ai":
      return "/?workspace=settings";
    case "industry":
      return "/production";
    case "collaboration":
      return "/?workspace=collab";
    default:
      return "/?workspace=plan&section=foundations";
  }
}

export default function LearnApplicationReflection({
  lesson,
  course,
  project,
  onBack,
  onContinue,
}: {
  readonly lesson: CurriculumLesson;
  readonly course: LearningApplicationCourse;
  readonly project: PPFProject;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) {
  const [currentProject, setCurrentProject] = useState(project);
  const [reflection, setReflection] = useState("");
  const [reflectionError, setReflectionError] = useState("");
  const [working, setWorking] = useState(false);
  const applicationView = useMemo(() => buildLearningApplicationView({
    project: currentProject,
    lesson,
    course,
  }), [course, currentProject, lesson]);

  function refreshDeterministicView() {
    try {
      setCurrentProject(loadFoundationProject());
      setReflection("");
      setReflectionError("");
    } catch (error) {
      setReflectionError(error instanceof Error ? error.message : "PlotPickle could not reload the current project.");
    }
  }

  async function requestReflection() {
    if (working) return;
    setWorking(true);
    setReflection("");
    setReflectionError("");
    try {
      const answer = await answerWithEducationalAssistance({
        curriculum: [lesson],
        activeLessonId: lesson.id,
        question: "Reflect this lesson against the visible story context and return the decision to me.",
        conversation: [],
        projectMemory: {
          id: currentProject.id,
          title: currentProject.title,
          revision: currentProject.revision,
          completedLessonIds: currentProject.learning.completedLessonIds,
        },
        interactionMode: "ea-reflection",
        applicationView,
      });
      setReflection(answer.text);
    } catch (error) {
      setReflectionError(error instanceof Error ? error.message : "Educational Assistance could not reflect on this lesson right now.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`}
      aria-label="LEARN application and Educational Assistance reflection"
      data-learn-application-phase="7"
      data-learn-application-authority="human-decides"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
        <div className="pp-skin-v1-bbs-banner">
          <h1>APPLY + REFLECT</h1>
          <button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Lesson</button>
        </div>
        <div className="pp-skin-v1-dashboard-title">LEARN → APPLY → DETERMINISTIC VIEW → EA REFLECTION → CONTINUE</div>

        <article className={styles.applicationPanel}>
          <header>
            <span>{course.title} · {lesson.title}</span>
            <h2>Apply this lesson to your story</h2>
            <p>{lesson.apply}</p>
          </header>

          <section>
            <h3>Application targets</h3>
            <ul>{course.applicationTargets.map((target) => <li key={target}>{target}</li>)}</ul>
            <a
              className={styles.applicationButton}
              href={applicationHref(lesson.topic, lesson.id)}
              target="_blank"
              rel="noreferrer"
              data-learn-apply-destination={lesson.topic}
            >Open application workspace</a>
            <p className={styles.applicationHint}>The workspace opens separately so this learning context remains available. Return here and refresh the deterministic view after reviewing or revising your story.</p>
          </section>

          <section className={styles.deterministicView} data-learn-deterministic-view="visible">
            <div className={styles.sectionHeadingRow}>
              <div>
                <h3>Deterministic view</h3>
                <p>These are the exact project facts the EA is allowed to reflect on. Nothing hidden is added.</p>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={refreshDeterministicView}>Refresh project facts</button>
            </div>
            <dl className={styles.factList}>
              <div><dt>Project</dt><dd>{applicationView.project.title}</dd></div>
              <div><dt>Project revision</dt><dd>{applicationView.project.revision}</dd></div>
              <div><dt>Lesson</dt><dd>{applicationView.lesson.title}</dd></div>
              <div><dt>Craft Module</dt><dd>{applicationView.craftModule.title}</dd></div>
              <div><dt>Apply instruction</dt><dd>{applicationView.lesson.applyInstruction}</dd></div>
            </dl>
            {applicationView.facts.length ? (
              <div className={styles.projectFacts}>
                {applicationView.facts.map((fact) => (
                  <article key={fact.id} data-learn-project-fact={fact.source}>
                    <h4>{fact.label}</h4>
                    <p>{fact.value}</p>
                    <small>Source: {fact.source}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyContext}>No bounded story facts are stored for this lesson yet. The EA may discuss the lesson and application target, but it must not invent story evidence.</p>
            )}
          </section>

          <section className={styles.eaPanel} data-learn-ea-authority="reflect-not-grade">
            <h3>Educational Assistance reflection</h3>
            <p>The EA connects this lesson to the visible story facts. It does not test, grade, score, unlock, or decide what your story should be.</p>
            <button type="button" className={styles.applicationButton} disabled={working} onClick={() => void requestReflection()}>
              {working ? "Reflecting…" : "Ask EA to reflect on my story"}
            </button>
            {reflection ? <blockquote className={styles.reflection}>{reflection}</blockquote> : null}
            {reflectionError ? <p className={styles.error} role="alert">{reflectionError}</p> : null}
          </section>

          <section className={styles.continuePanel}>
            <h3>Human decision</h3>
            <p>Revise, retain, discuss, skip, or continue. EA advice never changes canon and never controls access.</p>
            <button type="button" className={styles.completeButton} data-learn-continue-unlocked="true" onClick={onContinue}>Continue learning</button>
          </section>
        </article>
      </div>
    </section>
  );
}
