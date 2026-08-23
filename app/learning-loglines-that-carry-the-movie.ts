import type { LearningModule } from "./learning-library";

export const loglinesThatCarryTheMovie: LearningModule = {
  id: "loglines-that-carry-the-movie",
  number: 15,
  path: "Foundations",
  title: "Loglines That Carry the Movie",
  duration: "35–50 min",
  overview: "Build the right one-sentence story statement for the right audience, compare purposeful alternatives and approve only the version and synchronization targets the writer intends.",
  objectives: [
    "Distinguish premise, logline, one-sentence pitch, tagline, teaser and synopsis.",
    "Choose a logline purpose and audience before deciding what to reveal or withhold.",
    "Compare multiple transparent sentence shapes without treating one formula or score as universally correct.",
    "Approve a primary logline and labelled variants without silently overwriting every pitch field.",
  ],
  sections: [
    {
      heading: "One sentence, different jobs",
      paragraphs: [
        "A development logline exposes the dramatic engine so the writer can test causality. A submission logline communicates the project quickly to an evaluator. A pitch-deck logline works beside title, visuals and supporting copy. A public teaser can withhold information deliberately. A collaborator brief may reveal more so another person understands the complete direction.",
        "PlotPickle keeps one approved primary logline while allowing purpose-labelled variants. The primary is the default story statement, not a command to make every one-sentence field identical.",
      ],
      points: [
        "Premise: the dramatic arrangement expressed in a little more room.",
        "Logline: one sentence carrying protagonist, pursuit, resistance and consequence as needed for its purpose.",
        "One-sentence pitch: a spoken or written invitation shaped for a specific conversation.",
        "Tagline: compact promotional language, often atmospheric rather than complete.",
        "Teaser: intentionally withholding public-facing curiosity copy.",
        "Synopsis: the causal movement of the story, often including the ending when evaluation requires it.",
      ],
    },
    {
      heading: "Core engine before optional enhancement",
      paragraphs: [
        "The six core jobs are an identifiable protagonist or central subject, a catalytic condition, an active objective, meaningful opposition, consequences and a causal relationship between those elements. These deserve more attention than optional irony, urgency, spectacle or a fixed word-count range.",
        "Promise and distinction can come from identity, relationship pressure, world rules, genre language, mystery, contradiction or a signature image. Not every strong logline needs every enhancement. The writer should record deliberate omissions instead of allowing a local detector to label every absence as failure.",
      ],
      points: [
        "Sentence-supported: the candidate clearly communicates the job.",
        "Project-only: the project contains the fact, but the sentence does not yet communicate it.",
        "Intentional omission: this purpose deliberately withholds the information.",
        "Review: the evidence is unclear or the project itself still needs a decision.",
      ],
    },
    {
      heading: "Transparent sentence shapes",
      paragraphs: [
        "A formula can reveal missing ingredients, but it should not dictate the final language. The Logline Lab offers causal engine, irony or contradiction, relationship pressure, world-rule pressure, mystery or thriller, dual-protagonist or ensemble and character-first shapes.",
        "Each alternative identifies the shape used, the project facts communicated, omitted information and any assumption introduced by scaffolding. Every candidate remains manually editable and no-AI creation stays complete.",
      ],
      points: [
        "Causal engine: disruption → pursuit → resistance → consequence.",
        "Irony or contradiction: the least-suited person faces the exact problem they resist.",
        "Relationship pressure: incompatible needs threaten the bond that forces cooperation.",
        "World-rule pressure: a rule or institution creates the conflict and restricts choices.",
        "Mystery or thriller: a discovery forces pursuit of truth before a cost arrives.",
        "Dual or ensemble: connected leads pursue intersecting objectives.",
        "Character first: a wound or protective strategy drives the external pursuit.",
      ],
    },
    {
      heading: "Approval is a recorded decision",
      paragraphs: [
        "Saving a candidate does not make it canonical. Imported screenplay suggestions and optional AI proposals remain labelled proposals with their evidence and uncertain interpretations. Feedback can be anchored to the candidate or the primary story logline.",
        "When approving, choose whether to update the primary story logline, one-sentence pitch, pitch package or only retain a purpose variant. Preserve the previous primary in a revision snapshot and keep other useful variants available.",
      ],
      points: [
        "Review the sentence aloud and simplify only where comprehension improves.",
        "Record audience, purpose, shape, rationale, evidence and deliberate omissions.",
        "Select synchronization targets explicitly.",
        "Keep previous primary values and review history.",
      ],
    },
  ],
  definitions: [
    { term: "Primary logline", meaning: "The approved default story-engine sentence, separate from purpose-specific variants." },
    { term: "Purpose variant", meaning: "A labelled logline shaped for a particular reader, setting or disclosure boundary." },
    { term: "Evidence state", meaning: "A distinction between information supported by the sentence, present only in the project, deliberately omitted or unclear." },
    { term: "Sentence shape", meaning: "A transparent structural approach used to create an alternative, not a mandatory formula." },
  ],
  example: {
    title: "One Afterglow project, three useful versions",
    text: "Development: After Amy discovers that her synthetic companion remembers a life the company erased, she must expose the memory program against the corporation that owns it before both identities are permanently reset. Pitch deck: A grieving engineer and the synthetic mind carrying her lost memories race to expose the company that owns them. Public teaser: When a machine remembers the life she lost, one engineer must decide whether memory makes a person—or a target.",
  },
  checklist: [
    "The purpose and intended audience are named.",
    "Core engine evidence is visible or deliberately withheld.",
    "Optional enhancements are treated as choices rather than universal requirements.",
    "The sentence shape is visible and manually editable.",
    "Imported and AI suggestions remain unapproved proposals.",
    "Synchronization targets are selected explicitly.",
    "The previous primary logline is preserved in approval history.",
  ],
  mistakes: [
    "Using one canonical sentence for development, submission, deck and public promotion without review.",
    "Treating a word range, proper-name count, irony or urgency as universal quality tests.",
    "Awarding sentence evidence because a project field is complete.",
    "Inserting theme as an abstract topic instead of expressing human pressure through action.",
    "Automatically approving an imported or generated suggestion.",
  ],
  exercise: "Open Pitch & Review Studio. Choose two different purposes for the active project, build at least three sentence shapes from the same confirmed evidence, record one deliberate omission for each purpose and approve only the synchronization targets you intend.",
  apply: "Block plan",
  tags: [
    "logline", "The Art of Crafting Loglines", "20-step logline guide", "perfect logline", "logline deconstruction", "avoid character names", "irony", "active voice", "purpose variant", "pitch deck", "public teaser", "submission", "collaborator brief",
  ],
};

export function loglineDeepDiveSearchText() {
  const lesson = loglinesThatCarryTheMovie;
  return [lesson.title, lesson.overview, ...lesson.objectives, ...lesson.tags, ...lesson.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]), ...lesson.definitions.flatMap((item) => [item.term, item.meaning]), lesson.example.title, lesson.example.text, ...lesson.checklist, ...lesson.mistakes, lesson.exercise].join(" ").toLowerCase();
}
