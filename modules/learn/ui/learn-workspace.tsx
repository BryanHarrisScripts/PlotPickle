"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { applyStoryCommand } from "../../../core/project/apply-command";
import { createEmptyProject, type PPFProject } from "../../../core/project/project";
import styles from "./learn-workspace.module.css";

const PROJECT_KEY = "plotpickle.foundation.project.v1";
const THREAD_PREFIX = "plotpickle.foundation.thread.";

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

function curriculumReply(lesson: CurriculumLesson, question: string) {
  const focus = lesson.objectives[0] ?? lesson.overview;
  return [
    `For “${lesson.title},” the curriculum focus is: ${focus}`,
    lesson.overview,
    `A useful next step: ${lesson.exercise}`,
    question.trim()
      ? "I have kept your question in this Creative Room thread so we can continue from it."
      : "",
  ].filter(Boolean).join("\n\n");
}

export default function LearnWorkspace({
  curriculum,
}: {
  readonly curriculum: readonly CurriculumLesson[];
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

  function completeLesson() {
    if (!activeLesson) return;
    commit({
      type: "lesson.complete",
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
        text: curriculumReply(activeLesson, question),
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
    <main className={styles.workspace}>
      <aside className={styles.curriculum} aria-label="PlotPickle curriculum">
        <header className={styles.brand}>
          <span>PlotPickle</span>
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
                {completed.has(lesson.id) ? "✓" : ""}
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
        <section className={styles.exercise}>
          <span>Practice</span>
          <h2>Apply this lesson</h2>
          <p>{activeLesson.exercise}</p>
          <button type="button" onClick={completeLesson}>
            {completed.has(activeLesson.id) ? "Lesson completed" : "Mark lesson complete"}
          </button>
        </section>
      </article>

      <aside className={styles.room} aria-label="Persistent Creative Room">
        <header>
          <span>Creative Room</span>
          <h2>PlotPickle Curriculum Guide</h2>
          <p>Ask about the active lesson. This conversation stays with your workspace.</p>
        </header>
        <div className={styles.messages} aria-live="polite">
          {messages.length ? messages.map((message) => (
            <div className={message.role === "writer" ? styles.writerMessage : styles.guideMessage} key={message.id}>
              <strong>{message.role === "writer" ? "You" : "PlotPickle"}</strong>
              <p>{message.text}</p>
            </div>
          )) : (
            <div className={styles.guideMessage}>
              <strong>PlotPickle</strong>
              <p>We are working in “{activeLesson.title}.” What would you like to understand or try?</p>
            </div>
          )}
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
  );
}
