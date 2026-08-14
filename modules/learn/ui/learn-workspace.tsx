"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { CurriculumGuide } from "../../../core/contracts/curriculum-guide";
import { applyStoryCommand } from "../../../core/project/apply-command";
import { createEmptyProject, type PPFProject } from "../../../core/project/project";
import { buildLocalCurriculumSourceIndex, localCurriculumSourceKey } from "../model/local-curriculum-links";
import styles from "./learn-workspace.module.css";
import { CurriculumMaterial } from "./curriculum-material";

const PROJECT_KEY = "plotpickle.foundation.project.v1";

const WORKFLOW_STAGES = [
  { id: "dashboard", relic: "/assets/workflow-relics/dashboard.webp", label: "Dashboard", detail: "Start", selectable: false, gapAfter: true },
  { id: "learn", relic: "/assets/workflow-relics/learn.webp", label: "Learn", detail: "Guides", selectable: true, gapAfter: false },
  { id: "plan", relic: "/assets/workflow-relics/plan.webp", label: "Plan", detail: "Design", selectable: true, gapAfter: false },
  { id: "build", relic: "/assets/workflow-relics/build.webp", label: "Build", detail: "Assemble", selectable: false, gapAfter: false },
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Storyboard", detail: "Visualize", selectable: false, gapAfter: false },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Synthfiction", detail: "Pages", selectable: false, gapAfter: true },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft", selectable: false, gapAfter: false },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish", selectable: false, gapAfter: false },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review", selectable: false, gapAfter: false },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide", selectable: false, gapAfter: false },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver", selectable: false, gapAfter: false },
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

function splitLeadingKeyLabel(text: string) {
  const match = text.match(/^([^:\n]{1,96}:)(\s+)([\s\S]+)$/);
  if (!match) return null;
  const label = match[1];
  if (!/[A-Za-z]/.test(label) || /[.!?]/.test(label)) return null;
  return { label, remainder: match[3], separator: match[2] };
}

function KeyTakeawayText({ enabled, text }: { readonly enabled: boolean; readonly text: string }) {
  const keyLabel = enabled ? splitLeadingKeyLabel(text) : null;
  if (!keyLabel) return <>{text}</>;
  return (
    <>
      <strong data-key-term-label><u>{keyLabel.label}</u></strong>
      {keyLabel.separator}
      {keyLabel.remainder}
    </>
  );
}

function searchableLessonText(lesson: CurriculumLesson) {
  return [
    lesson.title,
    lesson.topic,
    lesson.overview,
    ...lesson.objectives,
    ...lesson.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]),
    ...lesson.definitions.flatMap((definition) => [definition.term, definition.meaning]),
    lesson.example.title,
    lesson.example.text,
    ...lesson.checklist,
    ...lesson.mistakes,
    lesson.exercise,
    lesson.apply,
    ...lesson.tags,
    ...lesson.sources.flatMap((source) => [
      source.title,
      source.kind,
      source.scopeNote,
      source.content,
    ]),
  ];
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

function LessonTopGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 28 28">
      <path d="M7.5 17.5 14 11l6.5 6.5" />
      <path d="M8 7.5h12" />
    </svg>
  );
}

export default function LearnWorkspace({
  curriculum,
  guide,
  onOpenFoundationsPlan,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly guide: CurriculumGuide;
  readonly onOpenFoundationsPlan?: (lessonId?: string) => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [working, setWorking] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [lessonSearch, setLessonSearch] = useState("");
  const [collapsedTopics, setCollapsedTopics] = useState<readonly string[]>([]);
  const lessonArticleRef = useRef<HTMLElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);

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

  useEffect(() => {
    const article = lessonArticleRef.current;
    if (!article || !activeLesson) return;
    article.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (window.matchMedia("(max-width: 820px)").matches) {
      article.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [activeLesson?.id]);

  const activeTopicLessons = useMemo(() => (
    activeLesson ? curriculum.filter((lesson) => lesson.topic === activeLesson.topic) : []
  ), [activeLesson, curriculum]);
  const activeTopicLessonIndex = activeTopicLessons.findIndex((lesson) => lesson.id === activeLesson?.id);
  const previousLesson = activeTopicLessonIndex > 0 ? activeTopicLessons[activeTopicLessonIndex - 1] : null;
  const nextLesson = activeTopicLessonIndex >= 0 && activeTopicLessonIndex < activeTopicLessons.length - 1
    ? activeTopicLessons[activeTopicLessonIndex + 1]
    : null;
  const integratedContentIndex = activeLesson?.sections.at(-1)?.heading === "Apply this to your story"
    ? activeLesson.sections.length - 1
    : activeLesson?.sections.length ?? 0;

  const localSourceIndex = useMemo(() => buildLocalCurriculumSourceIndex(curriculum), [curriculum]);

  const visibleLessons = useMemo(() => {
    const query = lessonSearch.trim().toLowerCase();
    if (!query) return curriculum;
    return curriculum.filter((lesson) => (
      searchableLessonText(lesson).some((value) => value.toLowerCase().includes(query))
    ));
  }, [curriculum, lessonSearch]);

  const topicLessonNumbers = useMemo(() => {
    const positions = new Map<string, number>();
    const nextPosition = new Map<string, number>();
    curriculum.forEach((lesson) => {
      const number = (nextPosition.get(lesson.topic) ?? 0) + 1;
      nextPosition.set(lesson.topic, number);
      positions.set(lesson.id, number);
    });
    return positions;
  }, [curriculum]);

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

  function returnToLessonTop() {
    const article = lessonArticleRef.current;
    if (!article) return;
    article.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    if (window.matchMedia("(max-width: 820px)").matches) {
      article.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    lessonHeadingRef.current?.focus({ preventScroll: true });
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
  const emphasizeFoundationsLabels = activeLesson.topic === "foundations";

  function selectWorkflowStage(stageId: (typeof WORKFLOW_STAGES)[number]["id"]) {
    if (stageId === "plan" && onOpenFoundationsPlan) {
      onOpenFoundationsPlan(activeLesson.topic === "foundations" ? activeLesson.id : undefined);
    }
  }

  return (
    <div className={styles.learnScreen} data-hide-agent-settings-anchor="true">
      <nav className={styles.workflowNav} aria-label="PlotPickle workflow">
        <ol style={{ minWidth: 920 }}>
          {WORKFLOW_STAGES.map((stage) => {
            const unavailable = !stage.selectable || (stage.id === "plan" && !onOpenFoundationsPlan);
            return (
            <li
              aria-current={stage.id === "learn" ? "page" : undefined}
              className={stage.id === "learn" ? styles.currentStage : undefined}
              key={stage.id}
              style={{ marginRight: stage.gapAfter ? 44 : undefined }}
            >
              <button
                aria-label={stage.label}
                disabled={unavailable}
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
                  cursor: unavailable ? "default" : "pointer",
                  font: "inherit",
                  opacity: unavailable ? 0.62 : 1,
                  textAlign: "center",
                }}
                title={unavailable ? `${stage.label} is not available yet` : `Open ${stage.label}`}
                type="button"
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
              </button>
            </li>
            );
          })}
        </ol>
        <Image
          alt="PlotPickle"
          className={styles.workspaceBrandMark}
          height={80}
          priority
          src="/brand/favicon/plotpickle-ouroboros-v2-128.png"
          width={80}
        />
      </nav>
      <main className={styles.workspace} data-preserve-story-language="true">
      <aside className={styles.curriculum} aria-label="PlotPickle curriculum">
        <header className={styles.brand}>
          <strong>LEARN</strong>
          <small>{curriculum.length} complete local lessons</small>
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
              {collapsed ? null : group.lessons.map((lesson) => {
                const isCompleted = completed.has(lesson.id);
                return (
                <div
                  className={`${styles.lessonRow} ${lesson.id === activeLesson.id ? styles.activeLesson : ""}`}
                  key={lesson.id}
                >
                  <span className={styles.lessonNumber}>{String(topicLessonNumbers.get(lesson.id) ?? 1).padStart(2, "0")}</span>
                  <button className={styles.lessonOpen} onClick={() => openLesson(lesson.id)} type="button">
                    <strong>{lesson.title}</strong>
                    <small>PlotPickle lesson</small>
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
              {collapsed ? null : group.topic === "foundations" && onOpenFoundationsPlan ? (
                <button
                  aria-label="Apply what you have learned in Foundations"
                  className={`${styles.applyLearningRow} ${styles.applyLearningAction}`}
                  onClick={() => onOpenFoundationsPlan(
                    activeLesson.topic === "foundations" ? activeLesson.id : undefined,
                  )}
                  type="button"
                >
                  <span aria-hidden="true" className={styles.applyLearningGlyph}>✦</span>
                  <strong>Apply what you have learned</strong>
                  <small>Open PLAN</small>
                </button>
              ) : collapsed ? null : (
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

      <article className={styles.lesson} aria-label="Active lesson" ref={lessonArticleRef}>
        <button
          aria-label="Return to the top of this lesson"
          className={styles.lessonTopButton}
          onClick={returnToLessonTop}
          title="Return to lesson top"
          type="button"
        >
          <LessonTopGlyph />
          <span>Top</span>
        </button>
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
          <div className={styles.lessonPosition} aria-label={`${topicName(activeLesson.topic)} lesson ${activeTopicLessonIndex + 1} of ${activeTopicLessons.length}`}>
            <FantasyCompassGlyph />
            <small>{activeTopicLessonIndex + 1} / {activeTopicLessons.length}</small>
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
        <h1 ref={lessonHeadingRef} tabIndex={-1}>{activeLesson.title}</h1>
        <p className={styles.overview}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={activeLesson.overview} /></p>
        <section data-lesson-block="objectives">
          <h2>What you will learn</h2>
          <ul>
            {activeLesson.objectives.map((objective) => <li key={objective}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={objective} /></li>)}
          </ul>
        </section>
        {activeLesson.sections.slice(0, integratedContentIndex).map((section, sectionIndex) => (
          <section data-lesson-block="teaching" key={`${sectionIndex}-${section.heading}`}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={paragraph} /></p>)}
            {section.points?.length ? (
              <ul>{section.points.map((point) => <li key={point}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={point} /></li>)}</ul>
            ) : null}
          </section>
        ))}
        {activeLesson.sources.map((source) => (
          <section data-integrated-curriculum-section data-lesson-block="teaching" key={source.id}>
            <CurriculumMaterial
              emphasizeKeyLabels={emphasizeFoundationsLabels}
              onOpenLesson={openLesson}
              resolveLocalReference={(href) => localSourceIndex.get(localCurriculumSourceKey(href))}
              source={source}
            />
          </section>
        ))}
        {activeLesson.sections.slice(integratedContentIndex).map((section, sectionIndex) => (
          <section data-lesson-block="teaching" key={`${integratedContentIndex + sectionIndex}-${section.heading}`}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={paragraph} /></p>)}
            {section.points?.length ? (
              <ul>{section.points.map((point) => <li key={point}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={point} /></li>)}</ul>
            ) : null}
          </section>
        ))}
        {activeLesson.definitions.length ? (
          <section data-lesson-block="definitions">
            <h2>Key terms</h2>
            <dl className={styles.definitions}>
              {activeLesson.definitions.map((definition) => (
                <div key={definition.term}>
                  <dt>{definition.term}</dt>
                  <dd><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={definition.meaning} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <section data-lesson-block="example">
          <h2>{activeLesson.example.title}</h2>
          <p><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={activeLesson.example.text} /></p>
        </section>
        <section data-lesson-block="checklist">
          <h2>Lesson checklist</h2>
          <ul>
            {activeLesson.checklist.map((item) => <li key={item}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={item} /></li>)}
          </ul>
        </section>
        <section data-lesson-block="mistakes">
          <h2>Common mistakes</h2>
          <ul>
            {activeLesson.mistakes.map((mistake) => <li key={mistake}><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={mistake} /></li>)}
          </ul>
        </section>
        <section className={styles.lessonExercise} data-lesson-block="exercise">
          <h2>Practice: apply this lesson</h2>
          <p><KeyTakeawayText enabled={emphasizeFoundationsLabels} text={activeLesson.exercise} /></p>
          <p><strong>Save this work to:</strong> {activeLesson.apply}</p>
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
              src="/assets/sage-brinewick-v2.png"
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