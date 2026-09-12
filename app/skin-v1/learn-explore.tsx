"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import styles from "./learn-journey-preview.module.css";

type ExploreCraftModule = Readonly<{
  id: string;
  path: number;
  title: string;
  applicationTargets: readonly string[];
}>;

type ExploreEntry = Readonly<{
  presentationId: string;
  presentationOrder: number;
  canonicalLessonId: string;
  coverageMode: "journey" | "reference-coverage";
  topic: Readonly<{ id: string; title: string }>;
  craftModule: Readonly<{
    id: string;
    year: number;
    path: number;
    orderInPath: number;
    title: string;
    applicationTargets: readonly string[];
  }>;
  concepts: readonly string[];
  applicationAreas: readonly string[];
  lesson: CurriculumLesson;
}>;

type ExplorePayload = Readonly<{
  schemaVersion: string;
  issue: number;
  phase: "phase-6-explore-all-curriculum";
  topicCount: 12;
  presentationLessonCount: 88;
  craftModuleCount: 24;
  bundledSourceCount: 95;
  referenceCoverageCount: 7;
  authority: Readonly<{
    curriculumOwner: "adapters/curriculum/current-catalog.ts";
    journeyMapOwner: "learn/program-map-spec.mjs";
    progressOwner: "PPFProject.learning.completedLessonIds";
    journeyAndExploreShareProgress: true;
    accessMode: "unrestricted";
    recommendedSequenceIsAccessControl: false;
    humanMayLearnOutOfOrder: true;
    curriculumBodiesDuplicated: false;
  }>;
  topics: readonly Readonly<{ id: string; title: string }>[];
  craftModules: readonly ExploreCraftModule[];
  entries: readonly ExploreEntry[];
}>;

type LearnExploreProps = Readonly<{
  completedLessonIds: ReadonlySet<string>;
  onBack: () => void;
  onLessonOpen: (lessonId: string) => void;
  onToggleLessonCompletion: (lesson: CurriculumLesson) => void;
}>;

function craftModuleNumber(courseId: string) {
  return /^course-(\d+)$/u.exec(courseId)?.[1] ?? courseId.toUpperCase();
}

function assertExplorePayload(value: ExplorePayload) {
  if (value.issue !== 1918 || value.phase !== "phase-6-explore-all-curriculum") {
    throw new Error("LEARN Explore returned the wrong program phase.");
  }
  if (
    value.topicCount !== 12
    || value.presentationLessonCount !== 88
    || value.craftModuleCount !== 24
    || value.bundledSourceCount !== 95
    || value.referenceCoverageCount !== 7
  ) {
    throw new Error("LEARN Explore returned an incomplete canonical curriculum inventory.");
  }
  if (value.topics.length !== 12 || value.craftModules.length !== 24 || value.entries.length !== 88) {
    throw new Error("LEARN Explore did not return the complete browse index.");
  }
  if (
    value.authority.curriculumOwner !== "adapters/curriculum/current-catalog.ts"
    || value.authority.journeyMapOwner !== "learn/program-map-spec.mjs"
    || value.authority.progressOwner !== "PPFProject.learning.completedLessonIds"
    || !value.authority.journeyAndExploreShareProgress
    || value.authority.accessMode !== "unrestricted"
    || value.authority.recommendedSequenceIsAccessControl
    || !value.authority.humanMayLearnOutOfOrder
    || value.authority.curriculumBodiesDuplicated
  ) {
    throw new Error("LEARN Explore violated canonical curriculum, progress, or open-access authority.");
  }
  if (value.entries.some((entry) => !entry.topic.id || !entry.craftModule.id || !entry.lesson.id)) {
    throw new Error("LEARN Explore returned an unowned presentation lesson.");
  }
}

function matchesQuery(entry: ExploreEntry, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const searchable = [
    entry.presentationId,
    entry.canonicalLessonId,
    entry.topic.id,
    entry.topic.title,
    entry.craftModule.id,
    entry.craftModule.title,
    entry.lesson.id,
    entry.lesson.title,
    entry.lesson.overview,
    entry.lesson.duration,
    entry.lesson.apply,
    ...entry.lesson.objectives,
    ...entry.concepts,
    ...entry.applicationAreas,
    ...entry.lesson.sources.map((source) => source.title),
  ].join("\n").toLowerCase();
  return searchable.includes(normalized);
}

export default function LearnExplore({
  completedLessonIds,
  onBack,
  onLessonOpen,
  onToggleLessonCompletion,
}: LearnExploreProps) {
  const [payload, setPayload] = useState<ExplorePayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [craftModuleFilter, setCraftModuleFilter] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openEntry, setOpenEntry] = useState<ExploreEntry | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/learn/explore", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ExplorePayload>;
      })
      .then((value) => {
        assertExplorePayload(value);
        setPayload(value);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Unknown Explore error");
      });
    return () => controller.abort();
  }, []);

  const filteredEntries = useMemo(() => {
    if (!payload) return [] as readonly ExploreEntry[];
    return payload.entries.filter((entry) => (
      (topicFilter === "all" || entry.topic.id === topicFilter)
      && (craftModuleFilter === "all" || entry.craftModule.id === craftModuleFilter)
      && matchesQuery(entry, query)
    ));
  }, [payload, topicFilter, craftModuleFilter, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, topicFilter, craftModuleFilter]);

  function selectResult(index: number) {
    if (!filteredEntries.length) return;
    const normalized = (index + filteredEntries.length) % filteredEntries.length;
    setSelectedIndex(normalized);
    window.requestAnimationFrame(() => resultRefs.current[normalized]?.focus());
  }

  function openResult(index: number) {
    const entry = filteredEntries[index];
    if (!entry) return;
    setSelectedIndex(index);
    setOpenEntry(entry);
    onLessonOpen(entry.lesson.id);
  }

  function handleResultKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") { event.preventDefault(); selectResult(index + 1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); selectResult(index - 1); return; }
    if (event.key === "Home") { event.preventDefault(); selectResult(0); return; }
    if (event.key === "End") { event.preventDefault(); selectResult(filteredEntries.length - 1); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openResult(index); }
  }

  if (!payload) {
    return (
      <section className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`} aria-label="LEARN Explore loading" data-learn-explore-phase="6">
        <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner"><h1>LEARN EXPLORE</h1><button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Journey</button></div>
          <div className="pp-skin-v1-dashboard-title">ALL CURRICULUM / UNRESTRICTED ACCESS</div>
          <p className={`pp-skin-v1-bbs-help ${styles.help}`} role={loadError ? "alert" : "status"}>{loadError ? `EXPLORE UNAVAILABLE — ${loadError}` : "LOADING THE CANONICAL ALL-CURRICULUM INDEX…"}</p>
        </div>
      </section>
    );
  }

  if (openEntry) {
    const completed = completedLessonIds.has(openEntry.lesson.id);
    return (
      <section
        className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`}
        aria-label="LEARN Explore lesson"
        data-learn-explore-phase="6"
        data-learn-progress-owner="PPFProject.learning.completedLessonIds"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpenEntry(null);
          }
        }}
      >
        <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner"><h1>LEARN EXPLORE</h1><button type="button" className="pp-skin-v1-return" onClick={() => setOpenEntry(null)}>Back to All Curriculum</button></div>
          <article className={styles.lesson} data-learn-explore-presentation={openEntry.presentationId} data-learn-explore-coverage={openEntry.coverageMode}>
            <header>
              <span>ALL CURRICULUM · LESSON {openEntry.presentationOrder} OF 88 · {openEntry.topic.title.toUpperCase()} · CRAFT MODULE {craftModuleNumber(openEntry.craftModule.id)}</span>
              <h2>{openEntry.lesson.title}</h2>
              <p>{openEntry.lesson.overview}</p>
              <p>{openEntry.coverageMode === "reference-coverage" ? "PROMOTED FOUNDATIONS REFERENCE · LINKED TO ITS CANONICAL JOURNEY LESSON" : "JOURNEY-BACKED PRESENTATION LESSON"}</p>
            </header>
            <section><h3>Objectives</h3><ul>{openEntry.lesson.objectives.map((item) => <li key={item}>{item}</li>)}</ul></section>
            {openEntry.lesson.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points?.length ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</section>)}
            {openEntry.lesson.definitions.length ? <section><h3>Definitions</h3><dl>{openEntry.lesson.definitions.map((definition) => <div key={definition.term}><dt>{definition.term}</dt><dd>{definition.meaning}</dd></div>)}</dl></section> : null}
            <section><h3>{openEntry.lesson.example.title}</h3><p>{openEntry.lesson.example.text}</p></section>
            <section><h3>Checklist</h3><ul>{openEntry.lesson.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3>Common mistakes</h3><ul>{openEntry.lesson.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3>Exercise</h3><p>{openEntry.lesson.exercise}</p><h3>Apply in PlotPickle</h3><p>{openEntry.lesson.apply}</p></section>
            {openEntry.lesson.sources.map((source) => <details className={styles.source} key={source.id}><summary>{source.title} · canonical bundled source</summary><p>{source.scopeNote}</p><pre>{source.content}</pre></details>)}
            <button className={styles.completeButton} type="button" data-learn-progress-owner="PPFProject.learning.completedLessonIds" data-learn-lesson-completed={completed ? "true" : "false"} onClick={() => onToggleLessonCompletion(openEntry.lesson)}>{completed ? "Mark lesson incomplete" : "Mark lesson complete"}</button>
          </article>
          <p className={`pp-skin-v1-bbs-help ${styles.help}`} role="status">EXPLORE AND JOURNEY SHARE THE SAME LEARNING HISTORY. NO PATH OR PREREQUISITE GATES ACCESS.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`}
      aria-label="LEARN Explore All Curriculum"
      data-learn-explore-phase="6"
      data-learn-explore-access="unrestricted"
      data-learn-progress-owner="PPFProject.learning.completedLessonIds"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
        <div className="pp-skin-v1-bbs-banner"><h1>LEARN EXPLORE</h1><button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Journey</button></div>
        <div className="pp-skin-v1-dashboard-title">ALL CURRICULUM / 12 TOPICS / 88 PRESENTATION LESSONS / 95 BUNDLED SOURCES</div>
        <div className={styles.exploreControls} data-learn-explore-controls="true">
          <label>
            <span>SEARCH TOPIC / CRAFT MODULE / LESSON / CONCEPT / APPLICATION</span>
            <input
              autoFocus
              type="search"
              value={query}
              aria-label="Search all curriculum"
              data-learn-explore-search="true"
              placeholder="Type a topic, lesson, concept or PlotPickle application…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && filteredEntries.length) {
                  event.preventDefault();
                  selectResult(0);
                }
              }}
            />
          </label>
          <label>
            <span>TOPIC</span>
            <select aria-label="Filter Explore by topic" data-learn-explore-topic-filter="true" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
              <option value="all">ALL 12 TOPICS</option>
              {payload.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
          </label>
          <label>
            <span>CRAFT MODULE</span>
            <select aria-label="Filter Explore by Craft Module" data-learn-explore-course-filter="true" value={craftModuleFilter} onChange={(event) => setCraftModuleFilter(event.target.value)}>
              <option value="all">ALL 24 CRAFT MODULES</option>
              {payload.craftModules.map((course) => <option key={course.id} value={course.id}>CRAFT MODULE {craftModuleNumber(course.id)} · {course.title}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.exploreSummary} role="status" aria-live="polite">{filteredEntries.length} OF 88 PRESENTATION LESSONS SHOWN · ORDER DOES NOT CONTROL ACCESS</div>
        <div className={styles.exploreResults} role="listbox" aria-label="All Curriculum results">
          {filteredEntries.map((entry, index) => {
            const selected = index === selectedIndex;
            const completed = completedLessonIds.has(entry.lesson.id);
            return (
              <button
                ref={(node) => { resultRefs.current[index] = node; }}
                key={entry.presentationId}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item ${styles.row}${selected ? " is-selected" : ""}`}
                data-learn-explore-lesson={entry.presentationId}
                data-learn-explore-topic={entry.topic.id}
                data-learn-explore-course={entry.craftModule.id}
                data-learn-explore-coverage={entry.coverageMode}
                data-learn-lesson-completed={completed ? "true" : "false"}
                onClick={() => openResult(index)}
                onKeyDown={(event) => handleResultKeyDown(event, index)}
              >
                <span className="pp-skin-v1-dashboard-command-line">LESSON {String(entry.presentationOrder).padStart(2, "0")} · {entry.lesson.title} - {entry.topic.title} · CRAFT MODULE {craftModuleNumber(entry.craftModule.id)} · {entry.lesson.apply} · {completed ? "COMPLETE" : "OPEN"}</span>
                <span className="pp-skin-v1-dashboard-status-box is-active" aria-label={completed ? "Lesson complete and available" : "Lesson available"} data-dashboard-status="active" data-skin-menu-indicator="connected" />
              </button>
            );
          })}
          {!filteredEntries.length ? <p className={styles.emptyResults}>NO MATCHES. CLEAR A FILTER OR SEARCH ANOTHER TOPIC, CRAFT MODULE, LESSON, CONCEPT OR APPLICATION AREA.</p> : null}
        </div>
        <p className={`pp-skin-v1-bbs-help ${styles.help}`} role="status">EXPLORE IS UNRESTRICTED. JOURNEY ORDER IS GUIDANCE, NOT ACCESS CONTROL. ESC RETURNS TO THE JOURNEY.</p>
      </div>
    </section>
  );
}
