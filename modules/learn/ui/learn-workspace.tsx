"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { CurriculumGuide } from "../../../core/contracts/curriculum-guide";
import { applyStoryCommand } from "../../../core/project/apply-command";
import { createEmptyProject, type PPFProject } from "../../../core/project/project";
import styles from "./learn-workspace.module.css";

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

function topicName(topic: string) {
  if (topic === "responsible-ai") return "Responsible AI";
  if (topic === "visual-storytelling") return "Visual Storytelling";
  return topic.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function FantasyWayfinderGlyph({ direction }: { readonly direction: "previous" | "next" }) {
  const arrow = direction === "previous"
    ? "M17.5 8.5 11 14l6.5 5.5M11 14h10"
    : "M10.5 8.5 17 14l-6.5 5.5M7 14h10";

  return (
    <svg
      aria-hidden="true"
      className={styles.questGlyph}
      focusable="false"
      viewBox="0 0 28 28"
    >
      <path className={styles.glyphFrame} d="M14 2.75 24 8.5v11L14 25.25 4 19.5v-11Z" />
      <path className={styles.glyphRune} d={arrow} />
      <path className={styles.glyphAccent} d="M14 4.75v3M14 20.25v3" />
    </svg>
  );
}

function FantasyCompassGlyph() {
  return (
    <svg
      aria-hidden="true"
      className={styles.compassGlyph}
      focusable="false"
      viewBox="0 0 32 32"
    >
      <circle cx="16" cy="16" r="12.5" />
      <path d="m16 5 3.25 7.75L27 16l-7.75 3.25L16 27l-3.25-7.75L5 16l7.75-3.25Z" />
      <circle cx="16" cy="16" r="2.25" />
    </svg>
  );
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
  const [working, setWorking] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [lessonSearch, setLessonSearch] = useState("");
  const [collapsedTopics, setCollapsedTopics] = useState<readonly string[]>([]);

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
  }, []);

  const activeLesson = useMemo(() => {
    if (!curriculum.length) return null;
    return curriculum.find((lesson) => lesson.id === project?.learning.activeLessonId) ?? curriculum[0];
  }, [curriculum, project?.learning.activeLessonId]);

  const activeLessonIndex = curriculum.findIndex((lesson) => lesson.id === activeLesson?.id);
  const previousLesson = activeLessonIndex > 0 ? curriculum[activeLessonIndex - 1] : null;
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < curriculum.length - 1
    ? curriculum[activeLessonIndex + 1]
    : null;

  const sourceCount = useMemo(() => (
    curriculum.reduce((total, lesson) => total + lesson.sources.length, 0)
  ), [curriculum]);

  const visibleLessons = useMemo(() => {
    const query = lessonSearch.trim().toLowerCase();
    if (!query) return curriculum;
    return curriculum.filter((lesson) => [
      lesson.title,
      lesson.topic,
      lesson.overview,
      ...lesson.tags,
      ...lesson.sources.flatMap((source) => [source.title, source.path, source.content]),
    ].some((value) => value.toLowerCase().includes(query)));
  }, [curriculum, lessonSearch]);

  const lessonGroups = useMemo(() => (
    [...new Set(curriculum.map((lesson) => lesson.topic))].map((topic) => ({
      topic,
      lessons: visibleLessons.filter((lesson) => lesson.topic === topic),
    })).filter((group) => group.lessons.length)
  ), [curriculum, visibleLessons]);

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

  function toggleTopic(topic: string) {
    setCollapsedTopics((current) => (
      current.includes(topic)
        ? current.filter((currentTopic) => currentTopic !== topic)
        : [...current, topic]
    ));
  }

  function toggleLessonCompletion(lessonId: string, isCompleted: boolean) {
    commit({
      type: isCompleted ? "lesson.uncomplete" : "lesson.complete",
      lessonId,
      occurredAt: new Date().toISOString(),
    });
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
    setQuestion("");
    setGuideError("");
    setWorking(true);
    try {
      const answer = await guide({
        curriculum,
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
    } catch (error) {
      setMessages(messages);
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
    <div className={styles.learnScreen} data-hide-agent-settings-anchor="true">
      <nav className={styles.workflowNav} aria-label="PlotPickle workflow">
        <ol>
          {WORKFLOW_STAGES.map((stage) => (
            <li
              aria-current={stage.id === "learn" ? "page" : undefined}
              className={stage.id === "learn" ? styles.currentStage : undefined}
              key={stage.id}
            >
              <Image
                aria-hidden="true"
                alt=""
                className={styles.stageRelic}
                height={56}
                src={stage.relic}
                width={56}
              />
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
          <small>{curriculum.length} lessons · {sourceCount} embedded references</small>
        </header>
        <div className={styles.lessonSearch}>
          <label htmlFor="lesson-search">Search every lesson</label>
          <input
            id="lesson-search"
            onChange={(event) => setLessonSearch(event.target.value)}
            placeholder="Try theme, dialogue or pacing"
            type="search"
            value={lessonSearch}
          />
          <small>{visibleLessons.length} of {curriculum.length} lessons</small>
        </div>
        <nav className={styles.lessonList} aria-label="Curriculum lessons">
          {lessonGroups.map((group) => {
            const collapsed = collapsedTopics.includes(group.topic);
            return (
            <section className={styles.topicGroup} data-collapsed={collapsed ? "true" : "false"} key={group.topic}>
              <button
                aria-controls={`learn-topic-${group.topic}`}
                aria-expanded={!collapsed}
                className={styles.topicToggle}
                onClick={() => toggleTopic(group.topic)}
                type="button"
              >
                <span aria-hidden="true" className={styles.topicChevron}>›</span>
                <span>{topicName(group.topic)}</span>
                <small>{group.lessons.length}</small>
              </button>
              <div className={styles.topicLessons} id={`learn-topic-${group.topic}`}>
              {collapsed ? null : group.lessons.map((lesson, lessonIndex) => {
                const isCompleted = completed.has(lesson.id);
                return (
                <div
                  className={`${styles.lessonRow} ${lesson.id === activeLesson.id ? styles.activeLesson : ""}`}
                  key={lesson.id}
                >
                  <span className={styles.lessonNumber}>{String(lessonIndex + 1).padStart(2, "0")}</span>
                  <button className={styles.lessonOpen} onClick={() => openLesson(lesson.id)} type="button">
                    <strong>{lesson.title}</strong>
                    <small>{lesson.sources.length} references</small>
                  </button>
                  <button
                    aria-label={isCompleted ? `Mark ${lesson.title} incomplete` : `Mark ${lesson.title} complete`}
                    aria-pressed={isCompleted}
                    className={styles.lessonCompleteMark}
                    onClick={() => toggleLessonCompletion(lesson.id, isCompleted)}
                    title={isCompleted ? "Completed" : "Mark complete"}
                    type="button"
                  >
                    <span aria-hidden="true">{isCompleted ? "✓" : ""}</span>
                  </button>
                </div>
                );
              })}
              {collapsed ? null : (
                <div className={styles.applyLearningRow} aria-label={`Apply what you have learned in ${topicName(group.topic)}`}>
                  <span aria-hidden="true" className={styles.applyLearningGlyph}>✦</span>
                  <strong>Apply what you have learned</strong>
                  <small>Coming soon</small>
                </div>
              )}
              </div>
            </section>
            );
          })}
        </nav>
      </aside>

      <article className={styles.lesson} aria-label="Active lesson">
        <nav className={styles.lessonNavigation} aria-label="Lesson navigation">
          <button
            disabled={!previousLesson}
            onClick={() => previousLesson && openLesson(previousLesson.id)}
            title={previousLesson ? `Previous: ${previousLesson.title}` : "This is the first lesson"}
            type="button"
          >
            <FantasyWayfinderGlyph direction="previous" />
            <span>Previous</span>
          </button>
          <div className={styles.lessonPosition} aria-label={`Lesson ${activeLessonIndex + 1} of ${curriculum.length}`}>
            <FantasyCompassGlyph />
            <small>{activeLessonIndex + 1} / {curriculum.length}</small>
          </div>
          <button
            disabled={!nextLesson}
            onClick={() => nextLesson && openLesson(nextLesson.id)}
            title={nextLesson ? `Next: ${nextLesson.title}` : "This is the final lesson"}
            type="button"
          >
            <span>Next</span>
            <FantasyWayfinderGlyph direction="next" />
          </button>
        </nav>
        <>
        <div className={styles.lessonMeta}>
          <span>{topicName(activeLesson.topic)}</span>
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
        {activeLesson.definitions.length ? (
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
        ) : null}
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
        <section className={styles.lessonExercise}>
          <h2>Practice: apply this lesson</h2>
          <p>{activeLesson.exercise}</p>
          <p><strong>Save this work to:</strong> {activeLesson.apply}</p>
        </section>
        <section>
          <h2>Supporting lesson material</h2>
          {activeLesson.sources.length ? (
            <div className={styles.lessonSources}>
              {activeLesson.sources.map((source) => (
                <details key={source.id}>
                  <summary>
                    <strong>{source.title}</strong>
                    <small>{source.repository} · {source.path}</small>
                  </summary>
                  <p>{source.scopeNote}</p>
                  <pre>{source.content}</pre>
                </details>
              ))}
            </div>
          ) : <p>This lesson is complete without an additional repository reference.</p>}
        </section>
        </>
      </article>

      <aside className={styles.room} aria-label="Persistent Creative Room">
        <header>
          <div className={styles.guideIdentity}>
            <Image
              alt="Sage Brinewick, PlotPickle Curriculum Guide"
              className={styles.guidePortrait}
              height={96}
              priority
              src="/assets/curriculum-guide-master-storyteller.png"
              width={96}
            />
            <div>
              <h2>Sage Brinewick</h2>
              <p>PlotPickle Curriculum Guide for your lesson and active story.</p>
            </div>
          </div>
        </header>
        <div className={styles.messages} aria-live="polite">
          {messages.length ? messages.map((message) => {
            const sourceTitles = message.sourceLessonIds?.map((lessonId) => (
              curriculum.find((lesson) => lesson.id === lessonId)?.title
            )).filter(Boolean);
            const referenceTitles = message.sourceReferenceIds?.map((sourceId) => (
              curriculum.flatMap((lesson) => lesson.sources).find((source) => source.id === sourceId)?.title
            )).filter(Boolean);
            return (
              <div className={message.role === "writer" ? styles.writerMessage : styles.guideMessage} key={message.id}>
                <strong>{message.role === "writer" ? "You" : "Guide"}</strong>
                <p>{message.text}</p>
                {sourceTitles?.length ? (
                  <small className={styles.messageSources}>Curriculum: {sourceTitles.join(" · ")}</small>
                ) : null}
                {referenceTitles?.length ? (
                  <small className={styles.messageSources}>Lesson references: {referenceTitles.join(" · ")}</small>
                ) : null}
              </div>
            );
          }) : (
            <div className={`${styles.guideMessage} ${styles.welcomeMessage}`}>
              <strong>Guide</strong>
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
          <div className={styles.composerField}>
            <textarea
              id="creative-room-question"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="For example: Does the inciting event usually happen in the first five minutes?"
              rows={3}
              value={question}
            />
            <button aria-label="Ask the Guide" disabled={working || !question.trim()} title="Ask the Guide" type="submit">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <path d="m3.5 11 16.5-7-7 16.5-2.5-7Z" />
                <path d="m10.5 13.5 4-4" />
              </svg>
            </button>
          </div>
          {guideError ? <p className={styles.guideError} role="alert">{guideError}</p> : null}
        </form>
      </aside>
      </main>
    </div>
  );
}
