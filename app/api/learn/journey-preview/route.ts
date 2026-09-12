import { LEARN_PROGRAM_COURSE_SPECS, LEARN_PROGRAM_SHELL_SPEC } from "../../../../learn/program-map-spec.mjs";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const coursesById = new Map(LEARN_PROGRAM_COURSE_SPECS.map((course) => [course.id, course]));
  const semesters = LEARN_PROGRAM_SHELL_SPEC.semesters.map((semester) => ({
    id: semester.id,
    year: semester.year,
    semester: semester.semester,
    courses: semester.courseIds.map((courseId) => {
      const course = coursesById.get(courseId);
      if (!course) throw new Error(`LEARN Journey preview could not resolve ${courseId}.`);
      return {
        id: course.id,
        year: course.year,
        semester: course.semester,
        orderInSemester: course.orderInSemester,
        title: course.title,
        purpose: course.purpose,
        lessonCount: course.lessonRefs.reduce((total, reference) => total + reference.positions.length, 0),
        advisoryPrerequisites: course.advisoryPrerequisites,
        applicationTargets: course.applicationTargets,
        access: "open",
        prerequisiteMode: "advisory-only",
        status: "wired",
        contentAvailable: true,
      };
    }),
  }));

  return Response.json({
    schemaVersion: "1.0",
    issue: 1918,
    phase: "phase-5-all-paths",
    yearCount: LEARN_PROGRAM_SHELL_SPEC.yearCount,
    semesterCount: LEARN_PROGRAM_SHELL_SPEC.semesterCount,
    coursesPerSemester: LEARN_PROGRAM_SHELL_SPEC.coursesPerSemester,
    courseCount: LEARN_PROGRAM_SHELL_SPEC.courseCount,
    authority: {
      recommendedSequenceIsAccessControl: LEARN_PROGRAM_SHELL_SPEC.authority.recommendedSequenceIsAccessControl,
      humanMayLearnOutOfOrder: LEARN_PROGRAM_SHELL_SPEC.authority.humanMayLearnOutOfOrder,
      semesterOneLessonContentExposed: true,
      laterSemesterLessonContentExposed: true,
      allPathLessonContentExposed: true,
    },
    semesters,
  });
}
