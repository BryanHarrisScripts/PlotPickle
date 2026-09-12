"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import { applyStoryCommand } from "../../core/project/apply-command";
import { createEmptyProject, type PPFProject } from "../../core/project/project";
import { loadFoundationProject, saveFoundationProject } from "../../core/storage/foundation-project-browser";
import LearnApplicationReflection from "./learn-application-reflection";
import LearnExplore from "./learn-explore";
import styles from "./learn-journey-preview.module.css";

type JourneyCoursePreview = Readonly<{
  id: string;
  year: number;
  semester: number;
  orderInSemester: number;
  title: string;
  purpose: string;
  lessonCount: number;
  advisoryPrerequisites: readonly string[];
  applicationTargets: readonly string[];
  access: "open";
  prerequisiteMode: "advisory-only";
  status: "wired";
  contentAvailable: true;
}>;

type JourneySemesterPreview = Readonly<{
  id: string;
  year: number;
  semester: number;
  courses: readonly JourneyCoursePreview[];
}>;

type JourneyPreview = Readonly<{
  schemaVersion: string;
  issue: number;
  phase: "phase-5-all-paths";
  yearCount: number;
  semesterCount: number;
  coursesPerSemester: number;
  courseCount: number;
  authority: Readonly<{
    recommendedSequenceIsAccessControl: false;
    humanMayLearnOutOfOrder: true;
    semesterOneLessonContentExposed: true;
    laterSemesterLessonContentExposed: true;
    allPathLessonContentExposed: true;
  }>;
  semesters: readonly JourneySemesterPreview[];
}>;

type JourneyCourseContent = Omit<JourneyCoursePreview, "lessonCount"> & Readonly<{
  lessons: readonly CurriculumLesson[];
}>;

type JourneyContentPayload = Readonly<{
  schemaVersion: string;
  issue: number;
  phase: "phase-5-all-paths";
  courseCount: 24;
  authority: Readonly<{
    curriculumOwner: "existing LEARN archive";
    progressOwner: "PPFProject.learning.completedLessonIds";
    recommendedSequenceIsAccessControl: false;
    humanMayLearnOutOfOrder: true;
    curriculumBodiesDuplicated: false;
  }>;
  courses: readonly JourneyCourseContent[];
}>;

const PATH_LABELS = [
  "STORY FOUNDATIONS",
  "STRUCTURE & STORY MOTION",
  "CHARACTER, DIALOGUE & VISUAL STORYTELLING",
  "DRAFTING THE STORY",
  "REVISION & COLLABORATIVE CRAFT",
  "PROFESSIONAL PRACTICE",
] as const;

function visiblePathLabel(pathNumber: number) {
  const label = PATH_LABELS[pathNumber - 1] ?? "OPEN CRAFT";
  return `PATH ${String(pathNumber).padStart(2, "0")} — ${label}`;
}

function craftModuleNumber(courseId: string) {
  return /^course-(\d+)$/u.exec(courseId)?.[1] ?? courseId.toUpperCase();
}

function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadProject(): PPFProject {
  try {
    return loadFoundationProject();
  } catch {
    return createEmptyProject({ id: newId("project"), now: new Date().toISOString() });
  }
}

function assertJourneyPreview(value: JourneyPreview) {
  if (value.issue !== 1918 || value.phase !== "phase-5-all-paths") throw new Error("LEARN Journey returned the wrong program phase.");
  if (value.yearCount !== 3 || value.semesterCount !== 6 || value.coursesPerSemester !== 4 || value.courseCount !== 24) {
    throw new Error("LEARN Journey did not return the canonical internal program-map structure.");
  }
  if (value.semesters.length !== 6 || value.semesters.some((semester) => semester.courses.length !== 4)) {
    throw new Error("LEARN Journey must expose exactly six Paths with four Craft Modules each.");
  }
  if (value.authority.recommendedSequenceIsAccessControl || !value.authority.humanMayLearnOutOfOrder || !value.authority.allPathLessonContentExposed) {
    throw new Error("LEARN Journey violated Phase 5 guided-not-gated authority.");
  }
  if (value.semesters.some((semester) => semester.courses.some((course) => !course.contentAvailable || course.status !== "wired"))) {
    throw new Error("Phase 5 must wire all 24 Craft Modules.");
  }
}

function assertJourneyContent(value: JourneyContentPayload) {
  if (value.issue !== 1918 || value.phase !== "phase-5-all-paths" || value.courseCount !== 24 || value.courses.length !== 24) {
    throw new Error("Phase 5 content returned the wrong Journey projection.");
  }
  if (value.authority.curriculumOwner !== "existing LEARN archive" || value.authority.progressOwner !== "PPFProject.learning.completedLessonIds") {
    throw new Error("Phase 5 content returned the wrong curriculum/progress authority.");
  }
  if (value.authority.recommendedSequenceIsAccessControl || !value.authority.humanMayLearnOutOfOrder || value.authority.curriculumBodiesDuplicated) {
    throw new Error("Phase 5 content violated guided-not-gated authority.");
  }
  if (value.courses.some((course) => !course.contentAvailable || course.status !== "wired" || !course.lessons.length)) {
    throw new Error("Every Phase 5 Craft Module must expose mapped canonical lessons.");
  }
}

export default function LearnJourneyPreview({ onBack }: { readonly onBack: () => void }) {
  const [preview, setPreview] = useState<JourneyPreview | null>(null);
  const [journeyContent, setJourneyContent] = useState<JourneyContentPayload | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [loadError, setLoadError] = useState("");
  const [contentError, setContentError] = useState("");
  const [exploreOpen, setExploreOpen] = useState(false);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [semesterOpen, setSemesterOpen] = useState(false);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState(0);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [courseOpenId, setCourseOpenId] = useState<string | null>(null);
  const [lessonOpenId, setLessonOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState("CHOOSE ANY PATH. MOVE AT YOUR OWN PACE. THE ORDER IS A GUIDE, NOT A GATE.");
  const semesterRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const courseRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lessonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setProject(loadProject());
    const controller = new AbortController();
    void fetch("/api/learn/journey-preview", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<JourneyPreview>;
      })
      .then((value) => {
        assertJourneyPreview(value);
        setPreview(value);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Unknown Journey error");
      });
    return () => controller.abort();
  }, []);

  const completedLessonIds = useMemo(() => new Set(project?.learning.completedLessonIds ?? []), [project]);

  function commit(command: Parameters<typeof applyStoryCommand>[1]) {
    setProject((current) => {
      if (!current) return current;
      const next = applyStoryCommand(current, command);
      saveFoundationProject(next);
      return next;
    });
  }

  async function loadJourneyContent(): Promise<JourneyContentPayload | null> {
    if (journeyContent) return journeyContent;
    setContentError("");
    try {
      const response = await fetch("/api/learn/journey-courses", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.json() as JourneyContentPayload;
      assertJourneyContent(value);
      setJourneyContent(value);
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Journey content error";
      setContentError(message);
      setNotice(`JOURNEY CONTENT UNAVAILABLE — ${message}`);
      return null;
    }
  }

  function selectSemester(index: number) {
    if (!preview) return;
    const normalized = (index + preview.semesters.length) % preview.semesters.length;
    setSelectedSemesterIndex(normalized);
    window.requestAnimationFrame(() => semesterRefs.current[normalized]?.focus());
  }

  function openSemester(index: number) {
    if (!preview) return;
    const normalized = (index + preview.semesters.length) % preview.semesters.length;
    const semester = preview.semesters[normalized];
    if (!semester) return;
    setSelectedSemesterIndex(normalized);
    setSelectedCourseIndex(0);
    setSelectedLessonIndex(0);
    setCourseOpenId(null);
    setLessonOpenId(null);
    setApplicationOpen(false);
    setSemesterOpen(true);
    setNotice(`${visiblePathLabel(semester.semester)} IS AVAILABLE. OPEN ANY CRAFT MODULE IN ANY ORDER.`);
    void loadJourneyContent();
  }

  function handleSemesterKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1 && /^[1-6]$/u.test(event.key)) {
      const shortcutIndex = Number(event.key) - 1;
      event.preventDefault();
      selectSemester(shortcutIndex);
      openSemester(shortcutIndex);
      return;
    }
    if (event.key === "ArrowDown") { event.preventDefault(); selectSemester(index + 1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); selectSemester(index - 1); return; }
    if (event.key === "Home") { event.preventDefault(); selectSemester(0); return; }
    if (event.key === "End") { event.preventDefault(); selectSemester((preview?.semesters.length ?? 1) - 1); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSemester(index); }
  }

  function selectCourse(index: number) {
    const courses = preview?.semesters[selectedSemesterIndex]?.courses ?? [];
    if (!courses.length) return;
    const normalized = (index + courses.length) % courses.length;
    setSelectedCourseIndex(normalized);
    window.requestAnimationFrame(() => courseRefs.current[normalized]?.focus());
  }

  async function openCourse(index: number) {
    const course = preview?.semesters[selectedSemesterIndex]?.courses[index];
    if (!course) return;
    setSelectedCourseIndex(index);
    const content = await loadJourneyContent();
    const wired = content?.courses.find((candidate) => candidate.id === course.id);
    if (!wired) return;
    setCourseOpenId(course.id);
    setLessonOpenId(null);
    setApplicationOpen(false);
    setSelectedLessonIndex(0);
    setNotice(`${course.title.toUpperCase()} — ${wired.lessons.length} CANONICAL LESSONS. COMPLETION ORDER IS YOUR CHOICE.`);
  }

  function handleCourseKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1 && /^[1-4]$/u.test(event.key)) {
      const shortcutIndex = Number(event.key) - 1;
      event.preventDefault();
      selectCourse(shortcutIndex);
      void openCourse(shortcutIndex);
      return;
    }
    if (event.key === "ArrowDown") { event.preventDefault(); selectCourse(index + 1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); selectCourse(index - 1); return; }
    if (event.key === "Home") { event.preventDefault(); selectCourse(0); return; }
    if (event.key === "End") { event.preventDefault(); selectCourse(3); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openCourse(index); }
  }

  const openCourseContent = journeyContent?.courses.find((course) => course.id === courseOpenId) ?? null;
  const openLesson = openCourseContent?.lessons.find((lesson) => lesson.id === lessonOpenId) ?? null;

  function selectLesson(index: number) {
    const lessons = openCourseContent?.lessons ?? [];
    if (!lessons.length) return;
    const normalized = (index + lessons.length) % lessons.length;
    setSelectedLessonIndex(normalized);
    window.requestAnimationFrame(() => lessonRefs.current[normalized]?.focus());
  }

  function openCourseLesson(index: number) {
    const lesson = openCourseContent?.lessons[index];
    if (!lesson) return;
    setSelectedLessonIndex(index);
    setLessonOpenId(lesson.id);
    setApplicationOpen(false);
    commit({ type: "lesson.open", lessonId: lesson.id, occurredAt: new Date().toISOString() });
    setNotice(`${lesson.title.toUpperCase()} — CANONICAL LEARN CONTENT. APPLY IT TO YOUR STORY OR MARK COMPLETE WHEN YOU DECIDE YOU ARE DONE.`);
  }

  function handleLessonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const count = openCourseContent?.lessons.length ?? 0;
    if (event.key.length === 1 && /^[1-9]$/u.test(event.key)) {
      const shortcutIndex = Number(event.key) - 1;
      if (shortcutIndex < count) { event.preventDefault(); selectLesson(shortcutIndex); openCourseLesson(shortcutIndex); }
      return;
    }
    if (event.key === "ArrowDown") { event.preventDefault(); selectLesson(index + 1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); selectLesson(index - 1); return; }
    if (event.key === "Home") { event.preventDefault(); selectLesson(0); return; }
    if (event.key === "End") { event.preventDefault(); selectLesson(Math.max(0, count - 1)); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCourseLesson(index); }
  }

  function toggleLessonCompletion(lesson: CurriculumLesson) {
    const isCompleted = completedLessonIds.has(lesson.id);
    commit({
      type: isCompleted ? "lesson.uncomplete" : "lesson.complete",
      lessonId: lesson.id,
      occurredAt: new Date().toISOString(),
    });
    setNotice(`${lesson.title.toUpperCase()} — ${isCompleted ? "MARKED INCOMPLETE" : "MARKED COMPLETE"}. PROGRESS FOLLOWS ACTUAL LESSON HISTORY, NOT CRAFT MODULE ORDER.`);
  }

  if (exploreOpen) {
    return (
      <LearnExplore
        completedLessonIds={completedLessonIds}
        onBack={() => setExploreOpen(false)}
        onLessonOpen={(lessonId) => commit({ type: "lesson.open", lessonId, occurredAt: new Date().toISOString() })}
        onToggleLessonCompletion={toggleLessonCompletion}
      />
    );
  }

  if (!preview) {
    return (
      <section className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`} aria-label="LEARN Journey loading">
        <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner"><h1>LEARN JOURNEY</h1><button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Writer&apos;s Craft</button></div>
          <div className="pp-skin-v1-dashboard-title">OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES</div>
          <p className={`pp-skin-v1-bbs-help ${styles.help}`} role={loadError ? "alert" : "status"}>{loadError ? `JOURNEY UNAVAILABLE — ${loadError}` : "LOADING THE CANONICAL JOURNEY MAP…"}</p>
        </div>
      </section>
    );
  }

  if (applicationOpen && openLesson && openCourseContent && project) {
    return (
      <LearnApplicationReflection
        lesson={openLesson}
        course={openCourseContent}
        project={project}
        onBack={() => setApplicationOpen(false)}
        onContinue={() => {
          setApplicationOpen(false);
          setLessonOpenId(null);
          setNotice(`${openLesson.title.toUpperCase()} — CONTINUED WITHOUT A GATE. THE HUMAN DECIDES WHAT TO REVISE, RETAIN, OR REVISIT.`);
        }}
      />
    );
  }

  if (openLesson && openCourseContent) {
    const isCompleted = completedLessonIds.has(openLesson.id);
    return (
      <section className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`} aria-label="LEARN Journey lesson" data-learn-journey-phase="5" data-learn-lesson-content="available" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setLessonOpenId(null); } }}>
        <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner"><h1>LEARN JOURNEY</h1><button type="button" className="pp-skin-v1-return" onClick={() => setLessonOpenId(null)}>Back to {openCourseContent.title}</button></div>
          <article className={styles.lesson} data-learn-canonical-lesson={openLesson.id}>
            <header><span>CRAFT MODULE {craftModuleNumber(openCourseContent.id)} · LESSON {selectedLessonIndex + 1} OF {openCourseContent.lessons.length}</span><h2>{openLesson.title}</h2><p>{openLesson.overview}</p></header>
            <section><h3>Objectives</h3><ul>{openLesson.objectives.map((item) => <li key={item}>{item}</li>)}</ul></section>
            {openLesson.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points?.length ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</section>)}
            {openLesson.definitions.length ? <section><h3>Definitions</h3><dl>{openLesson.definitions.map((definition) => <div key={definition.term}><dt>{definition.term}</dt><dd>{definition.meaning}</dd></div>)}</dl></section> : null}
            <section><h3>{openLesson.example.title}</h3><p>{openLesson.example.text}</p></section>
            <section><h3>Checklist</h3><ul>{openLesson.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3>Common mistakes</h3><ul>{openLesson.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3>Exercise</h3><p>{openLesson.exercise}</p><h3>Apply in PlotPickle</h3><p>{openLesson.apply}</p></section>
            {openLesson.sources.map((source) => <details className={styles.source} key={source.id}><summary>{source.title} · canonical bundled source</summary><p>{source.scopeNote}</p><pre>{source.content}</pre></details>)}
            <button className={styles.applicationButton} type="button" data-learn-application-open="true" onClick={() => setApplicationOpen(true)}>Apply → deterministic view → EA reflection</button>
            <button className={styles.completeButton} type="button" data-learn-progress-owner="PPFProject.learning.completedLessonIds" data-learn-lesson-completed={isCompleted ? "true" : "false"} onClick={() => toggleLessonCompletion(openLesson)}>{isCompleted ? "Mark lesson incomplete" : "Mark lesson complete"}</button>
          </article>
          <p className={`pp-skin-v1-bbs-help ${styles.help}`} role="status">{notice}</p>
        </div>
      </section>
    );
  }

  if (openCourseContent) {
    const completedCount = openCourseContent.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
    return (
      <section className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`} aria-label="LEARN Journey Craft Module" data-skin-menu="learn-journey-lessons" data-learn-journey-phase="5" data-learn-lesson-content="available" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setCourseOpenId(null); } }}>
        <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner"><h1>{openCourseContent.title.toUpperCase()}</h1><button type="button" className="pp-skin-v1-return" onClick={() => setCourseOpenId(null)}>Back to {visiblePathLabel(openCourseContent.semester)}</button></div>
          <div className="pp-skin-v1-dashboard-title">CRAFT MODULE {craftModuleNumber(openCourseContent.id)} · {completedCount}/{openCourseContent.lessons.length} LESSONS COMPLETE · ORDER IS ADVISORY ONLY</div>
          <div className={`pp-skin-v1-menu pp-skin-v1-dashboard-menu ${styles.menu}`} role="listbox" aria-label={`${openCourseContent.title} lessons`}>
            {openCourseContent.lessons.map((lesson, index) => {
              const selected = index === selectedLessonIndex;
              const completed = completedLessonIds.has(lesson.id);
              const shortcut = String(index + 1);
              return <button ref={(node) => { lessonRefs.current[index] = node; }} key={lesson.id} type="button" role="option" aria-selected={selected} tabIndex={selected ? 0 : -1} autoFocus={index === 0} className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item ${styles.row}${selected ? " is-selected" : ""}`} data-skin-menu-row={lesson.id} data-skin-menu-shortcut={shortcut} data-skin-menu-connected="true" data-learn-lesson-completed={completed ? "true" : "false"} onClick={() => openCourseLesson(index)} onKeyDown={(event) => handleLessonKeyDown(event, index)}><span className="pp-skin-v1-dashboard-command-line">[{shortcut}] {lesson.title} · {lesson.duration} · {completed ? "COMPLETE" : "OPEN"}</span><span className="pp-skin-v1-dashboard-status-box is-active" aria-label={completed ? "Lesson complete and available" : "Lesson available"} data-dashboard-status="active" data-skin-menu-indicator="connected" /></button>;
            })}
          </div>
          <p className={`pp-skin-v1-bbs-help ${styles.help}`} role="status">{notice}</p>
        </div>
      </section>
    );
  }

  const semester = preview.semesters[selectedSemesterIndex];
  if (semesterOpen && semester) {
    const pathLabel = visiblePathLabel(semester.semester);
    return (
      <section className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`} aria-label="LEARN Journey Path" data-skin-menu="learn-journey-courses" data-learn-journey-phase="5" data-learn-lesson-content="available" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setSemesterOpen(false); setNotice("CHOOSE ANY PATH. MOVE AT YOUR OWN PACE. THE ORDER IS A GUIDE, NOT A GATE."); } }}>
        <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner"><h1>LEARN JOURNEY</h1><button type="button" className="pp-skin-v1-return" onClick={() => setSemesterOpen(false)}>Back to Paths</button></div>
          <div className="pp-skin-v1-dashboard-title">{pathLabel} — FOUR CRAFT MODULES</div>
          <div className={`pp-skin-v1-menu pp-skin-v1-dashboard-menu ${styles.menu}`} role="listbox" aria-label={`${pathLabel} Craft Modules`} aria-describedby="learn-journey-course-status">
            {semester.courses.map((course, index) => {
              const selected = index === selectedCourseIndex;
              const shortcut = String(index + 1);
              const wiredContent = journeyContent?.courses.find((candidate) => candidate.id === course.id);
              const completedCount = wiredContent?.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length ?? 0;
              const progress = wiredContent ? `${completedCount}/${wiredContent.lessons.length} complete` : `${course.lessonCount} mapped lessons`;
              const command = `[${shortcut}] CRAFT MODULE ${craftModuleNumber(course.id)} · ${course.title}`.padEnd(58, " ");
              return <button ref={(node) => { courseRefs.current[index] = node; }} key={course.id} type="button" role="option" aria-selected={selected} tabIndex={selected ? 0 : -1} autoFocus={index === 0} className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item ${styles.row}${selected ? " is-selected" : ""}`} data-skin-menu-row={course.id} data-skin-menu-shortcut={shortcut} data-skin-menu-connected="true" data-learn-course-status="wired" data-learn-course-content="available" data-learn-course-progress={progress} onClick={() => void openCourse(index)} onKeyDown={(event) => handleCourseKeyDown(event, index)}><span className="pp-skin-v1-dashboard-command-line">{command} - {course.purpose} · {progress} [AVAILABLE]</span><span className="pp-skin-v1-dashboard-status-box is-active" aria-label="Craft Module lesson content available" data-dashboard-status="active" data-skin-menu-indicator="connected" /></button>;
            })}
          </div>
          <p className={`pp-skin-v1-bbs-help ${styles.help}`} id="learn-journey-course-status" role={contentError ? "alert" : "status"}>{notice}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.directory}`}
      aria-label="LEARN Journey menu"
      data-skin-menu="learn-journey"
      data-learn-journey-phase="5"
      data-learn-all-path-content="available"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBack();
          return;
        }
        if (event.key.toLowerCase() === "e") {
          event.preventDefault();
          setExploreOpen(true);
        }
      }}
    >
      <div className={`pp-skin-v1-bbs ${styles.panel}`} data-skin-reference-panel="standard">
        <div className="pp-skin-v1-bbs-banner"><h1>LEARN JOURNEY</h1><button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Writer&apos;s Craft</button></div>
        <div className="pp-skin-v1-dashboard-title">OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES</div>
        <div className={styles.exploreEntry}>
          <button type="button" className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item ${styles.row}`} data-learn-explore-open="true" data-skin-menu-connected="true" onClick={() => setExploreOpen(true)}>
            <span className="pp-skin-v1-dashboard-command-line">[E] EXPLORE / ALL CURRICULUM - 12 TOPICS · 88 PRESENTATION LESSONS · UNRESTRICTED SEARCH / BROWSE</span>
            <span className="pp-skin-v1-dashboard-status-box is-active" aria-label="Explore all curriculum available" data-dashboard-status="active" data-skin-menu-indicator="connected" />
          </button>
        </div>
        <div className={`pp-skin-v1-menu pp-skin-v1-dashboard-menu ${styles.menu}`} role="listbox" aria-label="LEARN Journey Paths" aria-describedby="learn-journey-status">
          {preview.semesters.map((item, index) => {
            const selected = index === selectedSemesterIndex;
            const shortcut = String(index + 1);
            const firstModule = craftModuleNumber(item.courses[0]?.id ?? "course-00");
            const lastModule = craftModuleNumber(item.courses[item.courses.length - 1]?.id ?? "course-00");
            const command = `[${shortcut}] ${visiblePathLabel(item.semester)}`.padEnd(58, " ");
            return <button ref={(node) => { semesterRefs.current[index] = node; }} key={item.id} type="button" role="option" aria-selected={selected} tabIndex={selected ? 0 : -1} autoFocus={index === 0} className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item ${styles.row}${selected ? " is-selected" : ""}`} data-skin-menu-row={item.id} data-skin-menu-shortcut={shortcut} data-skin-menu-connected="true" data-learn-semester-open="true" data-learn-semester-content="wired" onClick={() => openSemester(index)} onKeyDown={(event) => handleSemesterKeyDown(event, index)}><span className="pp-skin-v1-dashboard-command-line">{command} - CRAFT MODULES {firstModule}–{lastModule} · 4 modules · lesson content available</span><span className="pp-skin-v1-dashboard-status-box is-active" aria-label="Path destination available" data-dashboard-status="active" data-skin-menu-indicator="connected" /></button>;
          })}
        </div>
        <p className={`pp-skin-v1-bbs-help ${styles.help}`} id="learn-journey-status" role="status">{notice} PRESS E TO EXPLORE ALL CURRICULUM.</p>
      </div>
    </section>
  );
}
