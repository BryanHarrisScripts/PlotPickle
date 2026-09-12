import { LEARN_PROGRAM_MAP } from "../../../../learn/program-map.mjs";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const coursesById = new Map(LEARN_PROGRAM_MAP.courses.map((course) => [course.id, course]));
  const semesters = LEARN_PROGRAM_MAP.semesters.map((semester) => ({
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
        lessonCount: course.lessonIds.length,
        advisoryPrerequisites: course.advisoryPrerequisites,
        applicationTargets: course.applicationTargets,
        access: course.access,
        prerequisiteMode: course.prerequisiteMode,
        status: "preview-only",
        contentAvailable: false,
      };
    }),
  }));

  return Response.json({
    schemaVersion: "1.0",
    issue: 1918,
    phase: "phase-3-journey-shell",
    yearCount: LEARN_PROGRAM_MAP.yearCount,
    semesterCount: LEARN_PROGRAM_MAP.semesterCount,
    coursesPerSemester: LEARN_PROGRAM_MAP.coursesPerSemester,
    courseCount: LEARN_PROGRAM_MAP.courseCount,
    authority: {
      recommendedSequenceIsAccessControl: LEARN_PROGRAM_MAP.authority.recommendedSequenceIsAccessControl,
      humanMayLearnOutOfOrder: LEARN_PROGRAM_MAP.authority.humanMayLearnOutOfOrder,
      lessonContentExposed: false,
    },
    semesters,
  });
}
