import assert from "node:assert/strict";
import { LEARN_PROGRAM_ARCHIVE_LESSONS, LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";

const expectedCourseIds = Array.from({ length: 24 }, (_, index) => `course-${String(index + 1).padStart(2, "0")}`);
const actualCourseIds = LEARN_PROGRAM_MAP.courses.map((course) => course.id);
assert.deepEqual(actualCourseIds, expectedCourseIds, "LEARN program map must define stable course-01 through course-24 IDs.");

assert.equal(LEARN_PROGRAM_MAP.yearCount, 3, "LEARN program map must define three years.");
assert.equal(LEARN_PROGRAM_MAP.semesterCount, 6, "LEARN program map must define six semesters.");
assert.equal(LEARN_PROGRAM_MAP.coursesPerSemester, 4, "LEARN program map must define four courses per semester.");
assert.equal(LEARN_PROGRAM_MAP.courseCount, 24, "LEARN program map must define exactly 24 courses.");
assert.equal(LEARN_PROGRAM_MAP.semesters.length, 6, "LEARN program map must contain six semester records.");
assert.equal(LEARN_PROGRAM_MAP.courses.length, 24, "LEARN program map must contain 24 course records.");

for (const semester of LEARN_PROGRAM_MAP.semesters) {
  assert.equal(semester.courseIds.length, 4, `${semester.id} must contain four courses.`);
  const courses = semester.courseIds.map((id) => LEARN_PROGRAM_MAP.courses.find((course) => course.id === id));
  assert.ok(courses.every(Boolean), `${semester.id} references an unknown course.`);
  assert.ok(courses.every((course) => course.semester === semester.semester), `${semester.id} contains a course assigned to another semester.`);
  assert.ok(courses.every((course) => course.year === semester.year), `${semester.id} contains a course assigned to another year.`);
}

for (const course of LEARN_PROGRAM_MAP.courses) {
  assert.equal(course.access, "open", `${course.id} must remain directly accessible.`);
  assert.equal(course.prerequisiteMode, "advisory-only", `${course.id} prerequisites must remain advisory.`);
  assert.ok(course.title.length > 0, `${course.id} requires a title.`);
  assert.ok(course.purpose.length > 0, `${course.id} requires a purpose.`);
  assert.ok(course.lessonIds.length > 0, `${course.id} must map at least one canonical lesson.`);
  assert.ok(course.applicationTargets.length > 0, `${course.id} requires at least one PlotPickle application target.`);
  for (const prerequisite of course.advisoryPrerequisites) {
    assert.ok(actualCourseIds.includes(prerequisite), `${course.id} references unknown prerequisite ${prerequisite}.`);
    assert.notEqual(prerequisite, course.id, `${course.id} cannot require itself.`);
  }
}

const canonicalLessonIds = LEARN_PROGRAM_ARCHIVE_LESSONS.map((lesson) => lesson.id);
const mappedLessonIds = LEARN_PROGRAM_MAP.courses.flatMap((course) => course.lessonIds);
assert.equal(canonicalLessonIds.length, 81, "Phase 1 expects the frozen 81-lesson archive from Phase 0.");
assert.equal(new Set(canonicalLessonIds).size, canonicalLessonIds.length, "Canonical archive lesson IDs must remain unique.");
assert.equal(mappedLessonIds.length, canonicalLessonIds.length, "Every canonical archive lesson must be mapped exactly once across the 24 courses.");
assert.equal(new Set(mappedLessonIds).size, mappedLessonIds.length, "A canonical archive lesson cannot be owned by more than one Phase 1 course.");
assert.deepEqual([...mappedLessonIds].sort(), [...canonicalLessonIds].sort(), "The 24-course map must cover the complete canonical archive with no orphaned lesson IDs.");

const industryCourses = LEARN_PROGRAM_MAP.courses.filter((course) => course.lessonRefs.some((ref) => ref.topic === "industry"));
assert.deepEqual(industryCourses.map((course) => course.id), ["course-23", "course-24"], "Industry curriculum must remain primarily late in the recommended journey.");
assert.ok(industryCourses.every((course) => course.year === 3 && course.semester === 6), "Industry curriculum must be placed in the final semester for Phase 1.");

assert.equal(LEARN_PROGRAM_MAP.authority.mapRole, "index-and-orchestration-only");
assert.equal(LEARN_PROGRAM_MAP.authority.recommendedSequenceIsAccessControl, false);
assert.equal(LEARN_PROGRAM_MAP.authority.humanMayLearnOutOfOrder, true);
assert.equal(LEARN_PROGRAM_MAP.authority.curriculumBodiesDuplicated, false);

console.log("LEARN #1918 Phase 1 program map valid: 24 courses, 6 semesters, 4 courses per semester, all 81 archive lessons mapped exactly once, Industry in Semester 6, no access gating.");
