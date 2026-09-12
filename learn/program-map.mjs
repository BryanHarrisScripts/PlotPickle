import { readFileSync } from "node:fs";

const TOPIC_FILES = [
  "foundations.json",
  "theme.json",
  "character.json",
  "world.json",
  "structure.json",
  "dialogue.json",
  "visual-storytelling.json",
  "drafting.json",
  "revision.json",
  "responsible-ai.json",
  "collaboration.json",
  "industry.json",
];

const topicDocuments = TOPIC_FILES.map((file) => JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8")));
const lessonsByTopic = new Map(topicDocuments.map((document) => [document.topic.id, document.lessons]));
const archiveLessons = topicDocuments.flatMap((document) =>
  document.lessons.map((lesson) => ({ ...lesson, canonicalTopic: document.topic.id })),
);

const refs = (topic, ...positions) => ({ topic, positions });
const course = (id, year, semester, orderInSemester, title, purpose, lessonRefs, advisoryPrerequisites, applicationTargets) => ({
  id,
  year,
  semester,
  orderInSemester,
  title,
  purpose,
  lessonRefs,
  advisoryPrerequisites,
  applicationTargets,
});

const COURSE_SPECS = [
  course("course-01", 1, 1, 1, "Story Promise & Foundations", "Establish the story promise and the Foundations brief before deeper craft work.", [refs("foundations", 1, 2, 3, 4)], [], ["foundation brief", "logline", "story experience"]),
  course("course-02", 1, 1, 2, "Theme, Tone & Motif", "Use theme, tone and motif to create a coherent audience experience.", [refs("theme", 1, 2, 3)], ["course-01"], ["theme question", "tone brief", "motif choices"]),
  course("course-03", 1, 1, 3, "Character Foundations", "Build characters around want, need, stakes, contradiction and agency.", [refs("character", 1, 2, 3, 4)], ["course-01"], ["character intent", "stakes", "agency"]),
  course("course-04", 1, 1, 4, "World & Genre Foundations", "Treat world and genre as active systems that shape conflict and expectation.", [refs("world", 1, 2, 3)], ["course-01"], ["world rules", "genre promise", "story constraints"]),

  course("course-05", 1, 2, 1, "Character Pressure, Stakes & Arc", "Connect character pressure, relationships, choices and change across the story.", [refs("character", 5, 6, 7)], ["course-03"], ["character arc", "relationship pressure", "turning choices"]),
  course("course-06", 1, 2, 2, "Genre, Tone & Story World", "Combine later world and theme material so story system and audience promise reinforce each other.", [refs("world", 4, 5), refs("theme", 4, 5)], ["course-02", "course-04"], ["genre pressure", "world continuity", "tone consistency"]),
  course("course-07", 1, 2, 3, "Structure Fundamentals", "Understand dramatic structure as escalating cause, choice and consequence.", [refs("structure", 1, 2, 3, 4)], ["course-01"], ["story movement", "turning points", "cause and consequence"]),
  course("course-08", 1, 2, 4, "Structure in Motion", "Move from broad structure into sequences, escalation and practical structural decisions.", [refs("structure", 5, 6, 7)], ["course-07"], ["sequence design", "escalation", "structural diagnosis"]),

  course("course-09", 2, 3, 1, "24/96 Story Architecture", "Apply deeper structure learning to PlotPickle's 24-block and 96-beat architecture without making it a formula.", [refs("structure", 8, 9, 10, 11)], ["course-08"], ["24-block board", "96-beat evidence", "turning-point placement"]),
  course("course-10", 2, 3, 2, "Advanced Character Design", "Test advanced character design against structural pressure and story evidence.", [refs("character", 8, 9, 10)], ["course-05", "course-09"], ["character system", "contradiction", "story-bible character evidence"]),
  course("course-11", 2, 3, 3, "Dialogue Intent & Subtext", "Build dialogue from objective, tactics, pressure and subtext rather than exposition.", [refs("dialogue", 1, 2, 3, 4)], ["course-03"], ["scene objective", "subtext", "dialogue tactics"]),
  course("course-12", 2, 3, 4, "Visual Storytelling", "Translate story intent into screen-visible evidence through image, behavior and staging.", [refs("visual-storytelling", 1, 2, 3)], ["course-04", "course-07"], ["visual evidence", "staging", "screen behavior"]),

  course("course-13", 2, 4, 1, "Dialogue Voice & Movement", "Develop distinctive speech, conversational movement and character-specific voice under pressure.", [refs("dialogue", 5, 6, 7)], ["course-11"], ["voiceprint", "status movement", "dialogue rhythm"]),
  course("course-14", 2, 4, 2, "Dialogue Revision & Polish", "Diagnose and revise dialogue against character intent, scene movement and audience experience.", [refs("dialogue", 8, 9, 10)], ["course-13"], ["dialogue revision", "scene pass", "voice consistency"]),
  course("course-15", 2, 4, 3, "Drafting Fundamentals", "Move from planning into pages with practical drafting habits and screenplay language.", [refs("drafting", 1, 2, 3, 4)], ["course-07", "course-11"], ["draft pages", "screenplay language", "scene execution"]),
  course("course-16", 2, 4, 4, "Drafting the Full Story", "Sustain causality, continuity and story intent across the full screenplay.", [refs("drafting", 5, 6, 7, 8)], ["course-09", "course-15"], ["full draft", "continuity", "draft completion"]),

  course("course-17", 3, 5, 1, "Revision Foundations", "Diagnose a completed draft using evidence, root causes and bounded revision goals.", [refs("revision", 1, 2, 3, 4)], ["course-16"], ["revision diagnosis", "reader evidence", "rewrite priorities"]),
  course("course-18", 3, 5, 2, "Revision Systems & Rewrite Strategy", "Use deeper rewrite systems and testing to converge on a stronger story experience.", [refs("revision", 5, 6, 7, 8)], ["course-17"], ["rewrite plan", "revision passes", "convergence evidence"]),
  course("course-19", 3, 5, 3, "Responsible AI & Provenance", "Use AI with explicit Human authority, provenance, approval and provider awareness.", [refs("responsible-ai", 1, 2, 3)], ["course-01"], ["AI provenance", "Human approval", "responsible assistance"]),
  course("course-20", 3, 5, 4, "Collaboration Foundations", "Introduce shared creative work, contribution boundaries and communication after substantial story work exists.", [refs("collaboration", 1, 2, 3, 4)], ["course-18", "course-19"], ["collaboration brief", "contribution boundary", "shared review"]),

  course("course-21", 3, 6, 1, "Collaboration Workflow & Handoff", "Deepen collaboration through practical workflows, handoffs, review and durable communication.", [refs("collaboration", 5, 6, 7, 8)], ["course-20"], ["handoff", "review workflow", "shared evidence"]),
  course("course-22", 3, 6, 2, "Ownership, Delivery & Shared Work", "Complete collaboration learning with ownership, delivery and professional sharing boundaries.", [refs("collaboration", 9, 10, 11, 12)], ["course-21"], ["ownership record", "delivery package", "shared-work boundaries"]),
  course("course-23", 3, 6, 3, "Film Industry Orientation", "Introduce professional film-industry context after the learner has built, drafted, revised and collaborated.", [refs("industry", 1)], ["course-18", "course-22"], ["industry orientation", "professional context", "verification habits"]),
  course("course-24", 3, 6, 4, "Professional Practice & Industry Context", "Connect story ownership, collaboration and professional decision-making without making Industry creative authority.", [refs("industry", 2)], ["course-23"], ["professional practice", "ownership context", "industry readiness"]),
];

function resolveLessonRefs(lessonRefs) {
  return lessonRefs.flatMap(({ topic, positions }) => {
    const lessons = lessonsByTopic.get(topic);
    if (!lessons) throw new Error(`LEARN program map references unknown canonical topic ${topic}.`);
    return positions.map((position) => {
      const lesson = lessons[position - 1];
      if (!lesson) throw new Error(`LEARN program map references missing canonical lesson position ${topic}:${position}.`);
      return lesson.id;
    });
  });
}

const courses = COURSE_SPECS.map((spec) => ({
  ...spec,
  access: "open",
  prerequisiteMode: "advisory-only",
  lessonIds: resolveLessonRefs(spec.lessonRefs),
}));

const semesters = Array.from({ length: 6 }, (_, index) => {
  const semester = index + 1;
  return {
    id: `semester-${semester}`,
    year: Math.ceil(semester / 2),
    semester,
    courseIds: courses.filter((item) => item.semester === semester).map((item) => item.id),
  };
});

export const LEARN_PROGRAM_MAP = Object.freeze({
  schemaVersion: "1.0",
  issue: 1918,
  phase: "phase-1-program-map",
  status: "deterministic-map",
  authority: {
    curriculumOwner: "existing LEARN archive",
    mapRole: "index-and-orchestration-only",
    recommendedSequenceIsAccessControl: false,
    humanMayLearnOutOfOrder: true,
    curriculumBodiesDuplicated: false,
  },
  yearCount: 3,
  semesterCount: 6,
  coursesPerSemester: 4,
  courseCount: 24,
  semesters,
  courses,
});

export const LEARN_PROGRAM_ARCHIVE_LESSONS = Object.freeze(
  archiveLessons.map((lesson) => ({
    id: lesson.id,
    number: lesson.number,
    topic: lesson.canonicalTopic,
    title: lesson.title,
  })),
);

export default LEARN_PROGRAM_MAP;
