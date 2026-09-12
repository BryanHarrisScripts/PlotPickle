"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

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
  status: "preview-only";
  contentAvailable: false;
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
  phase: string;
  yearCount: number;
  semesterCount: number;
  coursesPerSemester: number;
  courseCount: number;
  authority: Readonly<{
    recommendedSequenceIsAccessControl: false;
    humanMayLearnOutOfOrder: true;
    lessonContentExposed: false;
  }>;
  semesters: readonly JourneySemesterPreview[];
}>;

function assertJourneyPreview(value: JourneyPreview) {
  if (value.issue !== 1918 || value.phase !== "phase-3-journey-shell") {
    throw new Error("LEARN Journey preview returned the wrong program phase.");
  }
  if (value.yearCount !== 3 || value.semesterCount !== 6 || value.coursesPerSemester !== 4 || value.courseCount !== 24) {
    throw new Error("LEARN Journey preview did not return the canonical 3-year / 6-semester / 24-course structure.");
  }
  if (value.semesters.length !== 6 || value.semesters.some((semester) => semester.courses.length !== 4)) {
    throw new Error("LEARN Journey preview must expose exactly six semesters with four course shells each.");
  }
  if (value.authority.recommendedSequenceIsAccessControl || !value.authority.humanMayLearnOutOfOrder || value.authority.lessonContentExposed) {
    throw new Error("LEARN Journey preview violated guided-not-gated Phase 3 authority.");
  }
  if (value.semesters.some((semester) => semester.courses.some((course) => course.contentAvailable || course.status !== "preview-only"))) {
    throw new Error("LEARN Journey Phase 3 must not expose lesson-content destinations.");
  }
}

export default function LearnJourneyPreview({ onBack }: { readonly onBack: () => void }) {
  const [preview, setPreview] = useState<JourneyPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [semesterOpen, setSemesterOpen] = useState(false);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState(0);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);
  const [notice, setNotice] = useState("SELECT A SEMESTER TO VIEW ITS FOUR COURSE SHELLS. ALL SEMESTERS REMAIN OPEN.");
  const semesterRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const courseRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
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
        setLoadError(error instanceof Error ? error.message : "Unknown Journey preview error");
      });
    return () => controller.abort();
  }, []);

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
    setNotice(`YEAR ${semester.year} / SEMESTER ${semester.semester} — COURSE SHELL PREVIEW. LESSON CONTENT OPENS IN PHASE 4.`);
    setSemesterOpen(true);
  }

  function handleSemesterKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1 && /^[1-6]$/u.test(event.key)) {
      const shortcutIndex = Number(event.key) - 1;
      event.preventDefault();
      selectSemester(shortcutIndex);
      openSemester(shortcutIndex);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectSemester(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectSemester(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectSemester(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectSemester((preview?.semesters.length ?? 1) - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSemester(index);
    }
  }

  function selectCourse(index: number) {
    const courses = preview?.semesters[selectedSemesterIndex]?.courses ?? [];
    if (!courses.length) return;
    const normalized = (index + courses.length) % courses.length;
    setSelectedCourseIndex(normalized);
    window.requestAnimationFrame(() => courseRefs.current[normalized]?.focus());
  }

  function previewCourse(index: number) {
    const course = preview?.semesters[selectedSemesterIndex]?.courses[index];
    if (!course) return;
    setSelectedCourseIndex(index);
    setNotice(`${course.title.toUpperCase()} — PREVIEW ONLY. LESSON CONTENT IS INTENTIONALLY UNAVAILABLE UNTIL PHASE 4.`);
  }

  function handleCourseKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1 && /^[1-4]$/u.test(event.key)) {
      const shortcutIndex = Number(event.key) - 1;
      event.preventDefault();
      selectCourse(shortcutIndex);
      previewCourse(shortcutIndex);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectCourse(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectCourse(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectCourse(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectCourse(3);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      previewCourse(index);
    }
  }

  if (!preview) {
    return (
      <section className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs pp-skin-v1-journey-directory" aria-label="LEARN Journey loading">
        <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner">
            <h1>LEARN JOURNEY</h1>
            <button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Writer&apos;s Craft</button>
          </div>
          <div className="pp-skin-v1-dashboard-title">3 YEARS / 6 SEMESTERS / 24 COURSES</div>
          <p className="pp-skin-v1-bbs-help" role={loadError ? "alert" : "status"}>
            {loadError ? `JOURNEY PREVIEW UNAVAILABLE — ${loadError}` : "LOADING THE CANONICAL PROGRAM MAP…"}
          </p>
        </div>
      </section>
    );
  }

  const semester = preview.semesters[selectedSemesterIndex];

  if (semesterOpen && semester) {
    return (
      <section
        className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs pp-skin-v1-journey-directory"
        aria-label="LEARN Journey semester"
        data-skin-menu="learn-journey-courses"
        data-learn-journey-phase="3"
        data-learn-lesson-content="unavailable"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setSemesterOpen(false);
            setNotice("SELECT A SEMESTER TO VIEW ITS FOUR COURSE SHELLS. ALL SEMESTERS REMAIN OPEN.");
          }
        }}
      >
        <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
          <div className="pp-skin-v1-bbs-banner">
            <h1>LEARN JOURNEY</h1>
            <button type="button" className="pp-skin-v1-return" onClick={() => setSemesterOpen(false)}>Back to Semesters</button>
          </div>
          <div className="pp-skin-v1-dashboard-title">YEAR {semester.year} / SEMESTER {semester.semester} — FOUR COURSE SHELLS</div>
          <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label={`Year ${semester.year} Semester ${semester.semester} course shells`} aria-describedby="learn-journey-course-status">
            {semester.courses.map((course, index) => {
              const selected = index === selectedCourseIndex;
              const shortcut = String(index + 1);
              const command = `[${shortcut}] ${course.id.toUpperCase()} · ${course.title}`.padEnd(52, " ");
              return (
                <button
                  ref={(node) => { courseRefs.current[index] = node; }}
                  key={course.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  autoFocus={index === 0}
                  className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item${selected ? " is-selected" : ""}`}
                  data-skin-menu-row={course.id}
                  data-skin-menu-shortcut={shortcut}
                  data-skin-menu-connected="false"
                  data-learn-course-status="preview-only"
                  data-learn-course-content="unavailable"
                  onClick={() => previewCourse(index)}
                  onKeyDown={(event) => handleCourseKeyDown(event, index)}
                >
                  <span className="pp-skin-v1-dashboard-command-line">{command} - {course.purpose} · {course.lessonCount} mapped lessons [PREVIEW]</span>
                  <span
                    className="pp-skin-v1-dashboard-status-box"
                    aria-label="Course shell visible; lesson content not connected until Phase 4"
                    data-dashboard-status="inactive"
                    data-skin-menu-indicator="unwired"
                  />
                </button>
              );
            })}
          </div>
          <p className="pp-skin-v1-bbs-help" id="learn-journey-course-status" role="status">{notice}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs pp-skin-v1-journey-directory"
      aria-label="LEARN Journey menu"
      data-skin-menu="learn-journey"
      data-learn-journey-phase="3"
      data-learn-lesson-content="unavailable"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
        <div className="pp-skin-v1-bbs-banner">
          <h1>LEARN JOURNEY</h1>
          <button type="button" className="pp-skin-v1-return" onClick={onBack}>Back to Writer&apos;s Craft</button>
        </div>
        <div className="pp-skin-v1-dashboard-title">3 YEARS / 6 SEMESTERS / 24 COURSES</div>
        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="LEARN Journey semesters" aria-describedby="learn-journey-status">
          {preview.semesters.map((item, index) => {
            const selected = index === selectedSemesterIndex;
            const shortcut = String(index + 1);
            const firstCourse = item.courses[0]?.id.toUpperCase() ?? "COURSE";
            const lastCourse = item.courses[item.courses.length - 1]?.id.toUpperCase() ?? "COURSE";
            const command = `[${shortcut}] YEAR ${item.year} / SEMESTER ${item.semester}`.padEnd(30, " ");
            return (
              <button
                ref={(node) => { semesterRefs.current[index] = node; }}
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                autoFocus={index === 0}
                className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item${selected ? " is-selected" : ""}`}
                data-skin-menu-row={item.id}
                data-skin-menu-shortcut={shortcut}
                data-skin-menu-connected="true"
                data-learn-semester-open="true"
                onClick={() => openSemester(index)}
                onKeyDown={(event) => handleSemesterKeyDown(event, index)}
              >
                <span className="pp-skin-v1-dashboard-command-line">{command} - {firstCourse}–{lastCourse} · four course shells · open from day one</span>
                <span
                  className="pp-skin-v1-dashboard-status-box is-active"
                  aria-label="Semester course-shell preview connected"
                  data-dashboard-status="active"
                  data-skin-menu-indicator="connected"
                />
              </button>
            );
          })}
        </div>
        <p className="pp-skin-v1-bbs-help" id="learn-journey-status" role="status">{notice}</p>
      </div>
    </section>
  );
}
