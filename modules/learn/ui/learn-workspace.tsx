"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CurriculumKnowledgeSource, CurriculumLesson } from "../../../core/contracts/curriculum";
import type { CurriculumGuide } from "../../../core/contracts/curriculum-guide";
import { applyStoryCommand } from "../../../core/project/apply-command";
import { createEmptyProject, type PPFProject } from "../../../core/project/project";
import styles from "./learn-workspace.module.css";

const PROJECT_KEY = "plotpickle.foundation.project.v1";
const THREAD_PREFIX = "plotpickle.foundation.thread.v2.";

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
  readonly sourceLessonIds?: readonly string[];
  readonly sourceReferenceIds?: readonly string[];
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
    if (!saved) return [];
    const parsed = JSON.parse(saved) as Message[];
    return parsed.filter((message) => (
      message
      && (message.role === "writer" || message.role === "guide")
      && typeof message.text === "string"
      && message.text.length <= 2_400
    )).slice(-30);
  } catch {
    return [];
  }
}

export default function LearnWorkspace({
  curriculum,
  guide,
  knowledgeSources,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly guide: CurriculumGuide;
  readonly knowledgeSources: readonly CurriculumKnowledgeSource[];
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [working, setWorking] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [catalogMode, setCatalogMode] = useState<"lessons" | "sources">("lessons");
  const [sourceSearch, setSourceSearch] = useState("");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

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

  const activeSource = useMemo(() => (
    knowledgeSources.find((source) => source.id === activeSourceId) ?? null
  ), [activeSourceId, knowledgeSources]);

  const visibleSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    if (!query) return knowledgeSources;
    return knowledgeSources.filter((source) => [
      source.title,
      source.repository,
      source.path,
      source.content,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [knowledgeSources, sourceSearch]);

  function commit(command: Parameters<typeof applyStoryCommand>[1]) {
    setProject((current) => {
      if (!current) return current;
      const next = applyStoryCommand(current, command);
      localStorage.setItem(PROJECT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function openLesson(lessonId: string) {
    setActiveSourceId(null);
    commit({
      type: "lesson.open",
      lessonId,
      occurredAt: new Date().toISOString(),
    });
  }

  function openSource(sourceId: string) {
    setActiveSourceId(sourceId);
  }

  function setLessonUnderstood(understood: boolean) {
    if (!activeLesson) return;
    commit({
      type: understood ? "lesson.complete" : "lesson.uncomplete",
      lessonId: activeLesson.id,
      occurredAt: new Date().toISOString(),
    });
  }

  function startFreshConversation() {
    if (!project?.creativeRoom.threadId || working) return;
    localStorage.removeItem(`${THREAD_PREFIX}${project.creativeRoom.threadId}`);
    setMessages([]);
    setQuestion("");
    setGuideError("");
  }

  async function askGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLesson || !project?.creativeRoom.threadId || !question.trim() || working) return;
    const submitted = question.trim();
    const writerMessage = { id: newId("message"), role: "writer" as const, text: submitted };
    const pending = [
      ...messages,
      writerMessage,
    ];
    setMessages(pending);
    localStorage.setItem(
      `${THREAD_PREFIX}${project.creativeRoom.threadId}`,
      JSON.stringify(pending),
    );
    setQuestion("");
    setGuideError("");
    setWorking(true);
    try {
      const answer = await guide({
        curriculum,
        knowledgeSources,
        activeLessonId: activeLesson.id,
        question: submitted,
        conversation: messages.map((message) => ({
          role: message.role,
          content: message.text,
        })),
        projectMemory: {
          id: project.id,
          title: project.title,
          revision: project.revision,
          completedLessonIds: project.learning.completedLessonIds,
        },
      });
      const next = [
        ...pending,
        {
          id: newId("message"),
          role: "guide" as const,
          text: answer.text,
          sourceLessonIds: answer.sourceLessonIds,
          sourceReferenceIds: answer.sourceReferenceIds,
        },
      ];
      setMessages(next);
      localStorage.setItem(`${THREAD_PREFIX}${project.creativeRoom.threadId}`, JSON.stringify(next));
    } catch (error) {
      setMessages(messages);
      localStorage.setItem(`${THREAD_PREFIX}${project.creativeRoom.threadId}`, JSON.stringify(messages));
      setQuestion(submitted);
      setGuideError(error instanceof Error ? error.message : "The Curriculum Guide could not answer.");
    } finally {
      setWorking(false);
    }
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
          <small>{curriculum.length} modules · {knowledgeSources.length} source references</small>
        </header>
        <div className={styles.catalogTabs} role="tablist" aria-label="Learning library">
          <button aria-selected={catalogMode === "lessons"} onClick={() => setCatalogMode("lessons")} role="tab" type="button">Lessons</button>
          <button aria-selected={catalogMode === "sources"} onClick={() => setCatalogMode("sources")} role="tab" type="button">Source library</button>
        </div>
        {catalogMode === "lessons" ? (
          <nav className={styles.lessonList} aria-label="Curriculum lessons">
            {curriculum.map((lesson) => (
              <button
                className={!activeSource && lesson.id === activeLesson.id ? styles.activeLesson : undefined}
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
        ) : (
          <div className={styles.sourceLibrary}>
            <label htmlFor="source-library-search">Search all learning sources</label>
            <input
              id="source-library-search"
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder="Try dialogue, character or pacing"
              type="search"
              value={sourceSearch}
            />
            <small>{visibleSources.length} of {knowledgeSources.length} sources</small>
            <nav className={styles.sourceList} aria-label="Curriculum source references">
              {visibleSources.map((source) => (
                <button
                  className={source.id === activeSource?.id ? styles.activeSource : undefined}
                  key={source.id}
                  onClick={() => openSource(source.id)}
                  type="button"
                >
                  <strong>{source.title}</strong>
                  <small>{source.repository} · {source.path}</small>
                </button>
              ))}
            </nav>
          </div>
        )}
      </aside>

      <article className={styles.lesson} aria-label="Active lesson">
        {activeSource ? (
          <>
            <div className={styles.lessonMeta}>
              <span>Source library</span>
              <span>{activeSource.repository}</span>
            </div>
            <h1>{activeSource.title}</h1>
            <p className={styles.overview}>{activeSource.scopeNote}</p>
            <p className={styles.sourcePath}>{activeSource.path}</p>
            <pre className={styles.sourceContent}>{activeSource.content}</pre>
          </>
        ) : (
        <>
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
        </>
        )}
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
              <h2>Curriculum Guide</h2>
              <p>Plain-language help with the lesson and your active story.</p>
            </div>
          </div>
          <button className={styles.freshButton} disabled={working} onClick={startFreshConversation} type="button">
            Start fresh
          </button>
        </header>
        <div className={styles.messages} aria-live="polite">
          {messages.length ? messages.map((message) => {
            const sourceTitles = message.sourceLessonIds?.map((lessonId) => (
              curriculum.find((lesson) => lesson.id === lessonId)?.title
            )).filter(Boolean);
            const referenceTitles = message.sourceReferenceIds?.map((sourceId) => (
              knowledgeSources.find((source) => source.id === sourceId)?.title
            )).filter(Boolean);
            return (
              <div className={message.role === "writer" ? styles.writerMessage : styles.guideMessage} key={message.id}>
                <strong>{message.role === "writer" ? "You" : "Guide"}</strong>
                <p>{message.text}</p>
                {sourceTitles?.length ? (
                  <small className={styles.messageSources}>Curriculum: {sourceTitles.join(" · ")}</small>
                ) : null}
                {referenceTitles?.length ? (
                  <small className={styles.messageSources}>Source library: {referenceTitles.join(" · ")}</small>
                ) : null}
              </div>
            );
          }) : (
            <div className={styles.welcomeMessage}>
              <strong>Let’s make this clear.</strong>
              <p>You’re reading “{activeLesson.title}.” Ask a question in your own words and I’ll answer simply.</p>
            </div>
          )}
          {working ? (
            <div className={styles.guideMessage}>
              <strong>Guide</strong>
              <p className={styles.thinking}>Thinking about your question…</p>
            </div>
          ) : null}
        </div>
        <form className={styles.composer} onSubmit={askGuide}>
          <label htmlFor="creative-room-question">Ask in your own words</label>
          <div className={styles.promptStarters} aria-label="Question starters">
            <button onClick={() => setQuestion("Explain this simply.")} type="button">Explain simply</button>
            <button onClick={() => setQuestion("Give me a short example.")} type="button">Give an example</button>
            <button onClick={() => setQuestion("How does this apply to my story?")} type="button">Use my story</button>
          </div>
          <textarea
            id="creative-room-question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: Does the inciting event usually happen in the first five minutes?"
            rows={3}
            value={question}
          />
          {guideError ? <p className={styles.guideError} role="alert">{guideError}</p> : null}
          <button disabled={working || !question.trim()} type="submit">
            {working ? "Thinking…" : "Ask the Guide"}
          </button>
        </form>
      </aside>
      </main>
    </div>
  );
}
