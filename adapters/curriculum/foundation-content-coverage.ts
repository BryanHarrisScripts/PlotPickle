import type { FoundationLessonTitle } from "./foundation-course-material";

type TeachingDestination = {
  readonly lesson: FoundationLessonTitle;
  readonly concepts: readonly string[];
};

type SourceCoverage = {
  readonly archiveLesson: FoundationLessonTitle;
  readonly taughtIn: readonly TeachingDestination[];
  readonly historicalOnly: readonly string[];
};

export type FoundationSourceCorrection = {
  readonly id: string;
  readonly sourceIds: readonly string[];
  readonly matchPhrases: readonly string[];
  readonly historicalClaim: string;
  readonly currentLesson: FoundationLessonTitle;
  readonly currentCorrection: string;
};

// These records are the guard against a mechanical "put the old document back"
// restoration. The canonical Markdown stays attached to archiveLesson exactly as
// received, while each useful concept is taught where a beginner needs it. Older
// navigation residue and claims that conflict with the current course remain
// visible in the archive but are not repeated as PlotPickle instruction.
export const FOUNDATION_SOURCE_COVERAGE: Readonly<Record<string, SourceCoverage>> = {
  "24-blocks-general-general-the-pitch-md": {
    archiveLesson: "Pitch Components and Project Positioning",
    taughtIn: [
      {
        lesson: "The Pitch",
        concepts: [
          "story promise and dramatic engine",
          "premise, logline, short pitch and synopsis",
          "protagonist, objective, opposition and stakes",
        ],
      },
      {
        lesson: "Pitch Components and Project Positioning",
        concepts: [
          "audience and format",
          "comparables and production scope",
          "project status, rights and call to action",
        ],
      },
    ],
    historicalOnly: [
      "marketability claims without evidence",
      "a universal component checklist for every pitch",
      "time-sensitive industry facts that require current official verification",
    ],
  },
  "24-blocks-general-readme-md": {
    archiveLesson: "The Anatomy of a Screenplay",
    taughtIn: [
      {
        lesson: "The Anatomy of a Screenplay",
        concepts: [
          "interacting screenplay craft systems",
          "structure, character, dialogue, world, theme, pacing, tone and motif",
          "screen evidence and causality",
        ],
      },
      {
        lesson: "Story Essentials: Theme, Plot, Character and Stakes",
        concepts: ["theme as a contested question", "choice, consequence and character strategy"],
      },
      {
        lesson: "Screenplay Essentials: Structure, Dialogue and Visuals",
        concepts: ["scene function", "dialogue as action", "visible and audible evidence"],
      },
      {
        lesson: "Pacing and Tone: Storytelling Dynamics",
        concepts: ["meaningful change", "tonal attitude", "audience rhythm"],
      },
    ],
    historicalOnly: [
      "repository navigation and Home links",
      "three-act structure as the required architecture",
      "theme as a single underlying message",
    ],
  },
  "24-blocks-loglines-loglines-md": {
    archiveLesson: "Crafting and Testing Loglines",
    taughtIn: [
      {
        lesson: "Loglines That Carry the Movie",
        concepts: [
          "the development logline's diagnostic job",
          "protagonist, disruption, objective, opposition and stakes",
          "sentence evidence and deliberate omission",
        ],
      },
      {
        lesson: "Crafting and Testing Loglines",
        concepts: [
          "the legacy twenty-step concerns reframed as questions",
          "purpose variants, sentence shapes, feedback and revision",
          "recorded approval without erasing alternatives",
        ],
      },
      {
        lesson: "Why PlotPickle Works in Layers",
        concepts: ["canonical values, proposals and downstream synchronization"],
      },
    ],
    historicalOnly: [
      "a perfect logline or universal word count",
      "irony, active voice, omitted names or hidden endings as absolute rules",
      "unverified blockbuster examples presented as authoritative studio copy",
      "Prompt 1, Prompt 2 and generated-answer fragments",
    ],
  },
  "24-blocks-essentials-essential-aspects-1-md": {
    archiveLesson: "Screenplay Essentials: Structure, Dialogue and Visuals",
    taughtIn: [
      {
        lesson: "Story Essentials: Theme, Plot, Character and Stakes",
        concepts: ["escalation, conflict, character pressure and changing stakes"],
      },
      {
        lesson: "Screenplay Essentials: Structure, Dialogue and Visuals",
        concepts: [
          "whole-story and scene movement",
          "dialogue, subtext and physical behavior",
          "screenplay elements, readable action and selected visual detail",
        ],
      },
      {
        lesson: "Build the Story Experience",
        concepts: ["setup, payoff, ending consequence and coherence audit"],
      },
    ],
    historicalOnly: [
      "the climax as necessarily the loudest moment",
      "resolution as tying every loose end",
      "routine camera direction and detailed inventory as visual storytelling",
      "one page per minute as a law",
    ],
  },
  "24-blocks-essentials-essential-aspects-2-md": {
    archiveLesson: "Story Essentials: Theme, Plot, Character and Stakes",
    taughtIn: [
      {
        lesson: "Story Essentials: Theme, Plot, Character and Stakes",
        concepts: [
          "concept, premise, plot, story and structure",
          "want, need, protective belief, objective and opposition",
          "external, internal and relationship movement",
          "transforming stakes and climax proof",
        ],
      },
      {
        lesson: "Screenplay Essentials: Structure, Dialogue and Visuals",
        concepts: ["character intention converted into playable scene evidence"],
      },
      {
        lesson: "Build the Story Experience",
        concepts: ["thematic answers, character choice and ending proof"],
      },
    ],
    historicalOnly: [
      "anti-theme as a simple villain opposite",
      "fatal flaw as an inherent moral defect",
      "gendered Man versus conflict labels",
      "every character arc as positive growth",
      "hook, backstory, pacing or point of view classified as types of stakes",
    ],
  },
  "24-blocks-essentials-readme-md": {
    archiveLesson: "The Screenwriting Essentials Roadmap",
    taughtIn: [
      {
        lesson: "The Screenwriting Essentials Roadmap",
        concepts: [
          "the legacy topic directory preserved as historical orientation",
          "problem-led learning routes",
          "symptom, evidence, root cause and revision experiment",
          "the eleven-lesson dependency path and final Foundations Brief",
        ],
      },
    ],
    historicalOnly: ["repository table-of-contents markup presented as if it were a complete lesson"],
  },
  "24-blocks-essentials-storytelling-dynamics-md": {
    archiveLesson: "Pacing and Tone: Storytelling Dynamics",
    taughtIn: [
      {
        lesson: "Screenplay Essentials: Structure, Dialogue and Visuals",
        concepts: ["anticipation, withholding, reveal, reversal and scene transition"],
      },
      {
        lesson: "Pacing and Tone: Storytelling Dynamics",
        concepts: [
          "pacing as patterns of meaningful change",
          "compression, expansion, release and processing time",
          "tone distinguished from mood",
          "contrast, tonal variation and audience mapping",
        ],
      },
      {
        lesson: "Build the Story Experience",
        concepts: ["tonal promise, emotional movement and ending after-effect"],
      },
    ],
    historicalOnly: [
      "genre stereotypes that prescribe fast or slow pacing",
      "tone and mood treated as synonyms",
      "rapid dialogue or detailed description treated as automatic pace controls",
      "ordinary action lines entering a character's unobservable thoughts",
    ],
  },
};

/**
 * Exact imported teaching is retained, but several older formulations are no
 * longer the governing Foundations instruction. These records pair the old
 * wording with the current lesson that corrects it. The local RAG layer uses
 * the pairs to label retrieved passages and to keep a historical sentence from
 * outranking the current course merely because it repeats the student's words.
 */
export const FOUNDATION_SOURCE_CORRECTIONS: readonly FoundationSourceCorrection[] = [
  {
    id: "three-act-is-optional",
    sourceIds: [
      "24-blocks-general-readme-md",
      "24-blocks-essentials-essential-aspects-1-md",
    ],
    matchPhrases: [
      "typically based on the three-act structure",
      "typically featuring a three-act setup",
    ],
    historicalClaim: "The imported wording presents a three-act setup as the typical screenplay architecture and can be read as a requirement.",
    currentLesson: "Screenplay Essentials: Structure, Dialogue and Visuals",
    currentCorrection: "Three-act structure is one optional diagnostic map, not a required architecture. Use any structural model that clarifies progressive pressure, meaningful turns, causality and consequence for this story.",
  },
  {
    id: "theme-is-tested-not-announced",
    sourceIds: [
      "24-blocks-general-readme-md",
      "24-blocks-essentials-essential-aspects-1-md",
      "24-blocks-essentials-essential-aspects-2-md",
    ],
    matchPhrases: [
      "theme reflects the underlying message",
      "theme: the core message or philosophical undertone",
      "theme: the underlying message or main idea",
    ],
    historicalClaim: "The imported wording reduces theme to an underlying message, main idea or philosophical statement communicated by the screenplay.",
    currentLesson: "Story Essentials: Theme, Plot, Character and Stakes",
    currentCorrection: "Theme is not merely an underlying message. PlotPickle treats it as a live human question or contested proposition tested through credible choices and consequences; the ending shows what this story's answer costs rather than announcing a universal moral.",
  },
  {
    id: "genre-does-not-set-speed",
    sourceIds: ["24-blocks-essentials-storytelling-dynamics-md"],
    matchPhrases: [
      "thrillers or action films tend to have a quick pace",
      "dramas may adopt a slower pace",
    ],
    historicalClaim: "The imported wording associates action and thriller genres with quick pacing and drama with slower pacing.",
    currentLesson: "Pacing and Tone: Storytelling Dynamics",
    currentCorrection: "Action films are not always fast and dramas are not always slow. Pace is the rhythm of meaningful change, anticipation and processing time; genre suggests an audience agreement but does not prescribe one speed.",
  },
] as const;

// Material from the former four-lesson Foundations path is also re-homed rather
// than blindly appended after the new course. This documents the destinations
// for concepts that were written directly into foundations.json, not a source.
export const FOUNDATION_FORMER_LESSON_COVERAGE = [
  {
    from: "The Pitch",
    destinations: [
      "The Anatomy of a Screenplay",
      "The Pitch",
      "Pitch Components and Project Positioning",
      "Build the Story Experience",
    ],
  },
  {
    from: "Loglines That Carry the Movie",
    destinations: [
      "Loglines That Carry the Movie",
      "Crafting and Testing Loglines",
      "Why PlotPickle Works in Layers",
    ],
  },
  {
    from: "Why PlotPickle Works in Layers",
    destinations: [
      "The Screenwriting Essentials Roadmap",
      "Why PlotPickle Works in Layers",
      "Screenplay Essentials: Structure, Dialogue and Visuals",
    ],
  },
  {
    from: "Build the Story Experience",
    destinations: ["Build the Story Experience"],
  },
] as const;
