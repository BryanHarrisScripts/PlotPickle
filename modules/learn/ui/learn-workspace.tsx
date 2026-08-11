"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { CurriculumGuide } from "../../../core/contracts/curriculum-guide";
import { applyStoryCommand } from "../../../core/project/apply-command";
import { createEmptyProject, type PPFProject } from "../../../core/project/project";
import styles from "./learn-workspace.module.css";

const PROJECT_KEY = "plotpickle.foundation.project.v1";
const THREAD_PREFIX = "plotpickle.foundation.thread.";

const WORKFLOW_STAGES = [
  { id: "dashboard", mark: "D", label: "Dashboard", detail: "Start here" },
  { id: "learn", mark: "L", label: "Learn", detail: "Guides & tools" },
  { id: "plan", mark: "P", label: "Plan", detail: "Story design" },
  { id: "storyboard", mark: "S", label: "Storyboard", detail: "Visual direction" },
  { id: "write", mark: "W", label: "Write", detail: "Screenplay" },
  { id: "edit", mark: "E", label: "Edit", detail: "Refine copy" },
  { id: "graphic-novel", mark: "G", label: "Graphic Novel", detail: "Pages & panels" },
  { id: "build", mark: "B", label: "Build", detail: "Assemble" },
  { id: "feedback", mark: "F", label: "Feedback", detail: "AI & team" },
  { id: "refine", mark: "R", label: "Refine", detail: "Review & decide" },
  { id: "reports", mark: "X", label: "Reports / Export", detail: "Deliver story" },
] as const;

type Message = {
  readonly id: string;
  readonly role: "writer" | "guide";
  readonly text: string;
};

function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadProject(): PPFProject {
  try {
    const saved = localStorage.getItem(PROJECT_KEY);
    if (saved) return JSON.parse(saved) as PPFProject;
  } catch {
    // A corrupt or unavailable local cache starts clean; storage adapters will
    // replace this browser implementation without changing the module.
  }
  return createEmptyProject({
    id: newId("project"),
    now: new Date().toISOString(),
  });
}

function loadMessages(threadId: string): Message[] {
  try {
    const saved = localStorage.getItem(`${THREAD_PREFIX}${threadId}`);
    return saved ? (JSON.parse(saved) as Message[]) : [];
  } catch {
    return [];
  }
}

export default function LearnWorkspace({
  curriculum,
  guide,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly guide: CurriculumGuide;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    let current = loadProject();
    if (!current.creativeRoom.threadId) {
      current = applyStoryCommand(current, {
        type: "creative-room.thread.attach",
        threadId: newId("thread"),
        occurredAt: new Date().toISOString(),
      });
      localStorage.setItem(PROJECT_KEY, JSON.stringify(current));
    }
    setProject(current);
    setMessages(loadMessages(current.creativeRoom.threadId!));
  }, []);

  const activeLesson = useMemo(() => {
    if (!curriculum.length) return null;
    return curriculum.find((lesson) => lesson.id === project?.learning.activeLessonId) ?? curriculum[0];
  }, [curriculum, project?.learning.activeLessonId]);

  function commit(command: Parameters<typeof applyStoryCommand>[1]) {
    setProject((current) => {
      if (!current) return current;
      const next = applyStoryCommand(current, command);
      localStorage.setItem(PROJECT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function openLesson(lessonId: string) {
    commit({
      type: "lesson.open",
      lessonId,
      occurredAt: new Date().toISOString(),
    });
  }

  function setLessonUnderstood(understood: boolean) {
    if (!activeLesson) return;
    commit({
      type: understood ? "lesson.complete" : "lesson.uncomplete",
      lessonId: activeLesson.id,
      occurredAt: new Date().toISOString(),
    });
  }

  function askGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLesson || !project?.creativeRoom.threadId || !question.trim()) return;
    const next = [
      ...messages,
      { id: newId("message"), role: "writer" as const, text: question.trim() },
      {
        id: newId("message"),
        role: "guide" as const,
        text: guide({
          curriculum,
          activeLessonId: activeLesson.id,
          question,
        }).text,
      },
    ];
    setMessages(next);
    localStorage.setItem(
      `${THREAD_PREFIX}${project.creativeRoom.threadId}`,
      JSON.stringify(next),
    );
    setQuestion("");
  }

  if (!project || !activeLesson) {
    return <main className={styles.loading}>Opening PlotPickle LEARN…</main>;
  }

  const completed = new Set(project.learning.completedLessonIds);

  return (
    <div className={styles.learnScreen}>
      <nav className={styles.workflowNav} aria-label="PlotPickle workflow">
        <ol>
          {WORKFLOW_STAGES.map((stage) => (
            <li
              aria-current={stage.id === "learn" ? "page" : undefined}
              className={stage.id === "learn" ? styles.currentStage : undefined}
              key={stage.id}
            >
              <span aria-hidden="true" className={styles.stageMark}>{stage.mark}</span>
              <span className={styles.stageCopy}>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <main className={styles.workspace}>
      <aside className={styles.curriculum} aria-label="PlotPickle curriculum">
        <header className={styles.brand}>
          <strong>LEARN</strong>
          <small>{curriculum.length} curriculum modules</small>
        </header>
        <nav className={styles.lessonList} aria-label="Curriculum lessons">
          {curriculum.map((lesson) => (
            <button
              className={lesson.id === activeLesson.id ? styles.activeLesson : undefined}
              key={lesson.id}
              onClick={() => openLesson(lesson.id)}
              type="button"
            >
              <span>{String(lesson.number).padStart(2, "0")}</span>
              <span>
                <strong>{lesson.title}</strong>
                <small>{lesson.path} · {lesson.duration}</small>
              </span>
              <b aria-label={completed.has(lesson.id) ? "Completed" : "Not completed"}>
                {completed.has(lesson.id) ? "☑" : ""}
              </b>
            </button>
          ))}
        </nav>
      </aside>

      <article className={styles.lesson} aria-label="Active lesson">
        <div className={styles.lessonMeta}>
          <span>{activeLesson.path}</span>
          <span>{activeLesson.duration}</span>
        </div>
        <h1>{activeLesson.title}</h1>
        <p className={styles.overview}>{activeLesson.overview}</p>
        <label className={styles.understood}>
          <input
            checked={completed.has(activeLesson.id)}
            onChange={(event) => setLessonUnderstood(event.target.checked)}
            type="checkbox"
          />
          <span>I understand this module</span>
        </label>
        <section>
          <h2>What you will learn</h2>
          <ul>
            {activeLesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}
          </ul>
        </section>
        {activeLesson.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.points?.length ? (
              <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>
            ) : null}
          </section>
        ))}
        <section>
          <h2>Key terms</h2>
          <dl className={styles.definitions}>
            {activeLesson.definitions.map((definition) => (
              <div key={definition.term}>
                <dt>{definition.term}</dt>
                <dd>{definition.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2>{activeLesson.example.title}</h2>
          <p>{activeLesson.example.text}</p>
        </section>
        <section>
          <h2>Lesson checklist</h2>
          <ul>
            {activeLesson.checklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2>Common mistakes</h2>
          <ul>
            {activeLesson.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
          </ul>
        </section>
      </article>

      <aside className={styles.room} aria-label="Persistent Creative Room">
        <header>
          <div className={styles.guideIdentity}>
            <Image
              alt="Master Storyteller, PlotPickle Curriculum Guide"
              className={styles.guidePortrait}
              height={96}
              priority
              src="/assets/curriculum-guide-master-storyteller.png"
              width={96}
            />
            <div>
              <span>Creative Room</span>
              <h2>PlotPickle Curriculum Guide</h2>
              <p>Ask about the active lesson. This conversation stays with your workspace.</p>
            </div>
          </div>
        </header>
        <div className={styles.messages} aria-live="polite">
          {messages.length ? messages.map((message) => (
            <div className={message.role === "writer" ? styles.writerMessage : styles.guideMessage} key={message.id}>
              <strong>{message.role === "writer" ? "You" : "PlotPickle"}</strong>
              <p>{message.text}</p>
            </div>
          )) : null}
        </div>
        <form className={styles.composer} onSubmit={askGuide}>
          <label htmlFor="creative-room-question">Ask the curriculum guide</label>
          <textarea
            id="creative-room-question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about this lesson…"
            rows={4}
            value={question}
          />
          <button type="submit">Ask PlotPickle</button>
        </form>
      </aside>
      </main>
    </div>
  );
}
