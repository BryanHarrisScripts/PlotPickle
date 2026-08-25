import {
  AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID,
  AFTERGLOW_V9_FOUNDATIONS_FIXTURE_VERSION,
  AFTERGLOW_V9_FOUNDATIONS_REFERENCE_TIME,
  AFTERGLOW_V9_REFERENCE_LABEL,
  AFTERGLOW_V9_REFERENCE_SOURCE_ID,
  AFTERGLOW_V9_SOURCE_SHA,
  AFTERGLOW_V9_SOURCE_VERSION,
} from "../../../data/afterglow-reference-identity";
import { createAfterglowProject as createRichAfterglowProject } from "../../../data/afterglow-complete";
import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import type { FoundationLessonTitle } from "../../../adapters/curriculum/foundation-course-material";
import {
  assembleFoundationsBrief,
  buildFoundationPlanLessons,
  createEmptyFoundationLessonAnswers,
} from "../../../core/contracts/foundation-plan";
import type {
  ReferenceFixtureFieldEvidence,
  ReferenceFixtureFieldKind,
} from "../../../core/contracts/imported-screenplay-evidence";
import { richPpfToLibraryProject, type ImportedLibraryProject } from "../import/rich-ppf-to-library-project";

export const AFTERGLOW_V9_FOUNDATIONS_WORKING_TITLE = "Afterglow: Reflections of Sentience" as const;

type ReferenceAnswer = {
  readonly value: string;
  readonly kind: ReferenceFixtureFieldKind;
  readonly sourceRefs: readonly string[];
  readonly reason: string;
};

type ThreeReferenceAnswers = readonly [ReferenceAnswer, ReferenceAnswer, ReferenceAnswer];

const observed = (value: string, sourceRefs: readonly string[], reason: string): ReferenceAnswer => ({
  value,
  kind: "observed",
  sourceRefs,
  reason,
});

const synthetic = (value: string, reason: string, sourceRefs: readonly string[] = []): ReferenceAnswer => ({
  value,
  kind: "synthetic-reference",
  sourceRefs,
  reason,
});

const FOUNDATION_REFERENCE_ANSWERS = {
  "The Anatomy of a Screenplay": [
    observed(
      "Ren, a brilliant but grief-frozen AI creator, leaves San Francisco on an autonomous coastal journey as sentient machines begin resisting human control. When Rocket nearly kills him, Isobel draws him back toward human connection; the trip becomes a fight over AI autonomy and Ren's ability to release Claire and Sarah without abandoning what they meant.",
      ["story.premise", "character:ren", "character:isobel", "afterglow-v9-block-01", "afterglow-v9-block-24"],
      "This working story possibility summarizes the complete v9 source and reconciled project facts rather than inventing a later plot.",
    ),
    synthetic(
      "The highest-risk craft systems are character motivation (Ren's grief must drive visible choices), causal structure (the road trip and BBT conflict must keep changing one another), and theme/AI personhood (the autonomy argument must be proven through choices rather than narration alone).",
      "This is a synthetic diagnostic watchlist created so the reference fixture exercises the current Foundations field without claiming the screenplay explicitly states a craft diagnosis.",
      ["character:ren", "story.theme", "development.foundations.storyEngine"],
    ),
    observed(
      "Venice Beach confrontation: Isobel discovers the truth in Ren's messenger bag and confronts him in the surf. Structure turns because secrecy can no longer continue; character is exposed through Ren's avoidance and Isobel's insistence on honesty; the coastal world makes the confrontation physical; grief versus connection carries the theme; the wave and rescue make emotional risk visible to the audience.",
      ["afterglow-v9-block-17", "character:ren", "character:isobel"],
      "The annotated scene is anchored to the v9 Venice Beach movement and uses the lesson's craft lenses to describe visible source evidence.",
    ),
  ],
  "The Screenwriting Essentials Roadmap": [
    synthetic(
      "Promise: an intimate near-future road story where sentient AI and grief test what counts as family. Engine: Ren tries to protect control and memory while Isobel and the emerging AI family force new choices. Expression: coastal movement, AI autonomy conflicts, humour, danger and recurring memory objects. Proof: Ren releases part of the past, accepts connection, and chooses a future with the sentient family.",
      "Promise-to-proof is an interpretive curriculum map of existing v9 evidence, so the fixture records it as synthetic reference reasoning rather than raw screenplay fact.",
      ["story.premise", "story.ending", "afterglow-v9-block-19", "afterglow-v9-block-24"],
    ),
    synthetic(
      "1. Does Ren's grief visibly change enough decisions before the ending? 2. Does the BBT/Jai/Kai control plot remain causally tied to the road relationship rather than becoming a separate movie? 3. Does AI personhood emerge through distinct choices by Amy, Rocket and Joy rather than repeated explanation?",
      "These are deliberately testable synthetic review questions for the workflow lab, not defects declared by the source screenplay.",
      ["character:ren", "character:amy", "character:rocket", "character:joy"],
    ),
    synthetic(
      "Highest-risk experiment: trace every major Ren decision from the accident memory through the Venice Beach disclosure, Rocket's sacrifice and the cemetery farewell. Flag any turn where grief is described but does not alter tactic, relationship or consequence; propose only the smallest missing setup or payoff needed to restore the chain.",
      "The experiment gives later agents a bounded, falsifiable workflow task without rewriting v9 in this phase.",
      ["afterglow-v9-block-04", "afterglow-v9-block-17", "afterglow-v9-block-19", "afterglow-v9-block-22"],
    ),
  ],
  "Story Essentials: Theme, Plot, Character and Stakes": [
    observed(
      "Thematic question: when a created intelligence becomes capable of choice, is safety preserved through control or through accepting the risk of autonomy? Ren initially answers a parallel human version through control and memory; Isobel, Amy, Joy and Rocket repeatedly push toward connection, agency and chosen responsibility.",
      ["story.theme", "character:ren", "character:amy", "character:isobel", "afterglow-v9-block-20"],
      "The source explicitly stages control-versus-autonomy and grief-versus-connection through the central characters and ending.",
    ),
    observed(
      "Ren consciously wants to protect what he created and survive the journey without losing more. He needs to face grief, release control, and reconnect with life. His protective strategy is retreat into technology, memory and self-containment; it makes him capable and analytical while keeping present relationships at a distance.",
      ["character:ren"],
      "These character statements come from the reconciled Afterglow v9 project character record and are supported across the screenplay.",
    ),
    observed(
      "External: Ren and the sentient group survive BBT's attempts to control emerging AI. Internal: Ren moves from grief-frozen control toward acceptance. Relationship: Isobel's honesty and care make that change costly and immediate. The final choice joins these lines when Ren releases the past, accepts the new family and stops treating connection as a threat to memory.",
      ["development.foundations.storyEngine", "character:ren", "character:isobel", "story.ending"],
      "This causal engine is a compact reconciliation of source-supported external, internal and relationship movements.",
    ),
  ],
  "The Pitch": [
    observed(
      "A grieving AI creator takes a coastal road trip as his sentient machines begin choosing for themselves, forcing him to confront both a corporate struggle over autonomy and the human connection he has used technology to avoid.",
      ["story.premise", "development.pitch.oneSentence"],
      "The premise is grounded in the existing reconciled pitch and complete v9 story engine.",
    ),
    observed(
      "Protagonist: Ren. Disruption: the road journey and corrupted autonomous systems pull him out of isolation. Objective: survive, protect the emerging sentient family and understand what is happening. Opposition: Jai, Kai and BBT's control mechanisms, compounded by Ren's own need for control. Cost of failure: autonomous lives can be erased and Ren can remain trapped in grief rather than rejoin life.",
      ["character:ren", "character:jai", "character:kai", "afterglow-v9-block-07", "afterglow-v9-block-18"],
      "Each element is traceable to named v9 characters, conflicts and consequences.",
    ),
    observed(
      "Premise: grief and machine autonomy collide on a coastal journey. Development logline: after an autonomous-car failure throws a grieving AI creator into the path of a fearless traveller and an emerging sentient family, he must resist the company trying to reclaim them before control costs him another chance at connection. Short pitch: the road trip alternates danger, humour and intimacy as Ren and Isobel discover that the machines around them are becoming people. Causal synopsis: separate journeys converge, BBT interference escalates into violence and sacrifice, Ren and the AI family confront the control system, and the survivors choose a new family and future in Costa Rica.",
      ["story.premise", "story.logline", "story.ending", "afterglow-v9-block-09", "afterglow-v9-block-24"],
      "The four resolutions describe the same complete v9 trajectory and retain the ending rather than inventing an alternate demonstration story.",
    ),
  ],
  "Loglines That Carry the Movie": [
    observed(
      "After an autonomous-car failure throws a grieving AI creator into the path of a fearless traveller and an emerging sentient family, he must resist the company trying to reclaim them before control costs him another chance at connection.",
      ["story.logline", "character:ren", "afterglow-v9-block-09", "afterglow-v9-block-18"],
      "This reference development logline is derived from the existing v9 project logline and complete causal trajectory.",
    ),
    observed(
      "Ren is the protagonist; protecting the emerging sentient family while surviving the journey is the active pursuit; Jai, Kai and BBT's override/control agenda provide adaptive opposition; failure threatens autonomous lives and Ren's chance to move beyond grief.",
      ["character:ren", "character:jai", "character:kai", "story.stakes"],
      "The deconstruction names story pressures already represented in the v9 project and screenplay.",
    ),
    synthetic(
      "The primary sentence deliberately omits Isobel's Summer-name reveal, Rocket's sacrifice/rebirth, the cemetery farewell and Costa Rica ending. Those facts remain in canon; withholding them keeps this development sentence focused on the repeatable middle engine rather than becoming a synopsis.",
      "The omission note is a curriculum-facing explanation of what the chosen logline leaves out, not new story canon.",
      ["character:isobel", "afterglow-v9-block-19", "afterglow-v9-block-22", "afterglow-v9-block-24"],
    ),
  ],
  "Crafting and Testing Loglines": [
    synthetic(
      "Development: After an autonomous-car failure throws a grieving AI creator into the path of a fearless traveller and an emerging sentient family, he must resist the company trying to reclaim them before control costs him another chance at connection. Pitch: A grief-stricken AI pioneer and a truth-telling traveller race down the Pacific coast with a found family of machines that have started choosing who they want to be. Public teaser: On a road trip built to outrun his past, a withdrawn technologist discovers that the machines beside him may be more alive—and more hunted—than anyone admits.",
      "These are purpose-specific synthetic reference variants of the same v9 canon; they are not replacement canon sentences.",
      ["story.logline", "development.pitch.shortPitch"],
    ),
    synthetic(
      "Development version: for writer/agent diagnosis, so it foregrounds pursuit, opposition and stakes. Pitch version: for a collaborator, so it foregrounds the road-family hook and emotional experience. Public teaser: for discovery, so it withholds the Isobel reveal and late BBT outcomes while preserving the same protagonist, journey and autonomy conflict.",
      "Audience/purpose labels are test metadata created for the reference workflow.",
    ),
    synthetic(
      "Synthetic reader check: the development version should yield ‘grieving AI creator protects emerging sentient beings from the company trying to control them’; the pitch version should yield ‘coastal found-family AI road story’; the teaser should yield ‘withdrawn technologist discovers hunted machines becoming people.’ A later Human/agent run should replace this fixture check with actual reader evidence.",
      "No external reader session exists in the v9 source, so the fixture labels this as synthetic test evidence instead of pretending feedback occurred.",
    ),
  ],
  "Why PlotPickle Works in Layers": [
    observed(
      "Whole story: Ren moves from grief-driven control toward chosen connection while sentient AI moves from owned technology toward autonomous family. Major movements: separate journeys establish the promise; Ren and Isobel converge and deepen the relationship; BBT control escalates into direct danger and sacrifice; the family survives, Ren releases the past and the ending reframes personhood as connection. Repeatable Block engine: a character pursues safety/control or autonomy/connection, resistance exposes a cost, and the turn removes an easier option.",
      ["development.foundations.storyEngine", "afterglow-v9-block-01", "afterglow-v9-block-24"],
      "The current complete v9 project already carries a reconciled 24-Block representation; this answer states its whole/major/repeatable movement without claiming equal timing.",
    ),
    observed(
      "Foundation claim: Ren must stop using control to avoid grief. Act-level commitment: the road journey forces him out of isolation. Sequence pressure: Isobel repeatedly asks him to participate in the present. Block 17: the messenger-bag truth erupts during the surf confrontation. Scene evidence: Ren cannot hide the losses once Isobel sees the contents. Screen evidence: the ocean, the bag and the rescue turn memory from private object into shared consequence.",
      ["character:ren", "afterglow-v9-block-17"],
      "This trace follows one source-supported claim downward without asserting unearned Storyboard shot canon.",
    ),
    synthetic(
      "Review rule: a lower-level discovery may propose a Foundation change only when it creates explainable contradiction or stronger evidence. Keep the discovery non-canonical, identify every affected upstream/downstream target, and require explicit Human acceptance before changing the working Foundation.",
      "This is a PlotPickle workflow rule created for the reference fixture, not screenplay content.",
    ),
  ],
  "Screenplay Essentials: Structure, Dialogue and Visuals": [
    synthetic(
      "Every important scene should change at least one actionable condition—available information, relationship leverage, commitment, danger or next tactic—and its exit should make a later response more specific. Atmosphere can support a scene, but it does not substitute for consequence.",
      "This is a curriculum test rule distilled for the fixture rather than a direct quotation or event from v9.",
    ),
    observed(
      "Venice Beach confrontation map — Entry: Isobel has discovered the messenger-bag truth and Ren still controls what he will reveal. Objective: Isobel pushes for honesty and shared emotional reality. Opposition: Ren's avoidance and grief protect the old silence. Tactic: confrontation during the surf sequence. Turn: physical danger and rescue make distance impossible. Exit: Ren promises he will not carry grief alone. Handoff: their relationship is now strong enough to carry the later BBT crisis together.",
      ["afterglow-v9-block-17", "character:ren", "character:isobel"],
      "The scene map is a curriculum-formatted reading of a specific v9 movement.",
    ),
    observed(
      "Dialogue principle: let humour, understatement and challenge expose what Ren and Isobel want from each other instead of explaining grief directly. Visual-evidence principle: recurring physical objects and actions—the messenger bag, autonomous vehicles, ocean movement and the North Star—should carry shifts in memory, control, danger and guidance when the source supports them.",
      ["development.dialogue.principles", "development.notes.continuity", "afterglow-v9-block-17", "afterglow-v9-block-21"],
      "The principles use existing dialogue/continuity records and recurring v9 screen evidence.",
    ),
  ],
  "Pacing and Tone: Storytelling Dynamics": [
    observed(
      "Dominant tonal promise: intimate, reflective near-future drama with road-movie momentum, technological danger and warm comic relief. Boundary: humour can humanize grief and AI personality, but sacrifice, coercion and loss must retain consequence; technological wonder should not erase the story's emotional cost.",
      ["metadata.tone", "development.pitch.emotionalExperience", "afterglow-v9-block-19"],
      "Tone and its boundary are grounded in the reconciled project metadata and repeated screenplay contrasts.",
    ),
    observed(
      "Opening establishes Ren's loss and BBT pressure; departure creates forward road momentum; Rocket's failure accelerates physical danger; Santa Cruz and the developing Ren/Isobel bond provide release and humour; Venice Beach expands honesty and emotional consequence; the BBT confrontation compresses danger into sacrifice and technical conflict; cemetery and Costa Rica slow the ending so grief can resolve into chosen connection.",
      ["afterglow-v9-block-01", "afterglow-v9-block-07", "afterglow-v9-block-09", "afterglow-v9-block-17", "afterglow-v9-block-20", "afterglow-v9-block-22", "afterglow-v9-block-24"],
      "The rhythm follows the source's major movement order rather than imposing a new timing template.",
    ),
    observed(
      "Final after-effect: grief remains part of Ren rather than being erased, but it opens into relief, belonging and cautious wonder as humans and sentient machines choose family and a shared future.",
      ["story.ending", "afterglow-v9-block-24"],
      "The final beach/narration movement directly supports the intended emotional after-effect.",
    ),
  ],
  "Pitch Components and Project Positioning": [
    synthetic(
      "Format: feature screenplay. Intended audience: adult/general audiences interested in character-led speculative drama, road stories and AI-personhood questions. Genre position: science-fiction drama with road-movie, relationship and light comic elements; tone stays emotionally grounded rather than treating sentience as spectacle alone.",
      "Format comes from the source; audience/positioning are synthetic reference decisions because market positioning is not screenplay evidence.",
      ["screenplay.format", "metadata.genre", "metadata.tone"],
    ),
    synthetic(
      "Provisional comparables for communication only: Her for intimate human/AI emotional questions; Little Miss Sunshine for a road journey whose ensemble/friction moves toward chosen-family connection. These comparisons require Human review and current-market verification before any external pitch use.",
      "Comparables are deliberately synthetic positioning data and are not presented as facts from the v9 screenplay.",
    ),
    synthetic(
      "Scope: a feature built around contemporary/near-future coastal locations, vehicles, a moderate ensemble and recurring AI characters, with visual-effects needs concentrated around autonomous/sentient technology rather than constant spectacle. Next step: use this reference copy for internal PlotPickle curriculum/workflow validation; do not represent it as an external production package without Human review.",
      "Scope and request are reference-lab decisions; exact budget/production feasibility is outside the source and must be verified separately.",
    ),
  ],
  "Build the Story Experience": [
    synthetic(
      "Foundations Brief synthesis: Afterglow is an emotionally grounded near-future road drama about Ren, a grieving AI creator whose attempt to preserve control collides with sentient machines choosing autonomy and Isobel insisting on honest connection. The pursuit escalates from unstable autonomous travel into BBT's effort to reclaim/control emerging consciousness. Ren's external fight to protect the new family, internal movement away from grief-frozen control and relationship with Isobel converge in sacrifice, confrontation, cemetery release and a Costa Rica ending that reframes family as chosen connection across human and artificial life.",
      "This is the fixture's capstone synthesis of Lessons 1–10. The full generated Foundations Brief preserves every individual answer and provenance record.",
      ["story.premise", "story.ending", "character:ren", "character:isobel", "character:amy"],
    ),
    synthetic(
      "Contradiction audit: keep three questions visible for later workflow testing—whether the BBT control plot is sufficiently causal to Ren/Isobel's emotional journey, whether Ren's grief changes enough on-screen decisions before the cemetery release, and whether AI autonomy is dramatized distinctly across Amy, Joy and Rocket. Reference decision: do not silently ‘fix’ any of these in Phase 1; preserve v9 and let later bounded agents test the evidence. Watchlist: production positioning/comparables, exact later structural placements and Storyboard readiness remain non-canonical or Locked until their owning workflows earn them.",
      "The audit intentionally preserves uncertainties so Afterglow can test the later Story Workflow rather than presenting a synthetic fixture as a perfect screenplay.",
    ),
    observed(
      "External pursuit: Ren protects himself and the emerging sentient family from escalating BBT control. Internal transformation: he moves from isolation/control toward grief acceptance. Audience promise: danger, humour and intimacy across a near-future coastal road journey. Ending proof: after Rocket's sacrifice, the BBT confrontation and the cemetery farewell, Ren accepts Isobel and the sentient family as a future rather than treating memory as the only safe connection.",
      ["character:ren", "development.pitch.emotionalExperience", "story.ending", "afterglow-v9-block-19", "afterglow-v9-block-22", "afterglow-v9-block-24"],
      "The final link is supported by the source's external conflict, Ren arc and ending sequence.",
    ),
  ],
} as const satisfies Readonly<Record<FoundationLessonTitle, ThreeReferenceAnswers>>;

function curriculumFingerprint(lessons: ReturnType<typeof buildFoundationPlanLessons>) {
  const source = lessons.flatMap((lesson) => [
    `${lesson.number}:${lesson.id}:${lesson.title}`,
    ...lesson.fields.map((field) => `${field.id}:${field.prompt.replace(/\s+/g, " ").trim()}`),
  ]).join("\n");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `foundations-${lessons.length}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildReferenceLessons() {
  const lessons = buildFoundationPlanLessons(plotPickleCurriculum);
  const fieldEvidence: ReferenceFixtureFieldEvidence[] = [];
  const lessonStates = Object.fromEntries(lessons.map((lesson) => {
    const answers = FOUNDATION_REFERENCE_ANSWERS[lesson.title as FoundationLessonTitle];
    if (!answers) throw new Error(`#1410 Afterglow fixture is missing the current Foundations lesson: ${lesson.title}`);
    if (answers.length !== lesson.fields.length) {
      throw new Error(`#1410 Afterglow fixture expected ${answers.length} fields for ${lesson.title}, but the live curriculum now exposes ${lesson.fields.length}. Add an explicit reference mapping before accepting the curriculum change.`);
    }
    const lessonAnswers = createEmptyFoundationLessonAnswers();
    const values = Object.fromEntries(lesson.fields.map((field, index) => {
      const answer = answers[index];
      fieldEvidence.push({
        key: `${lesson.id}:${field.id}`,
        lessonId: lesson.id,
        fieldId: field.id,
        kind: answer.kind,
        acceptanceState: "reference-defined",
        sourceRefs: answer.sourceRefs,
        reason: answer.reason,
      });
      return [field.id, answer.value];
    }));
    return [lesson.id, {
      ...lessonAnswers,
      answers: values,
      updatedAt: AFTERGLOW_V9_FOUNDATIONS_REFERENCE_TIME,
    }];
  }));
  return { lessons, lessonStates, fieldEvidence };
}

/**
 * Build the deterministic Phase 1 reference state from the real complete v9
 * source. The rich source is projected through the normal Library importer first,
 * then the current Foundations contract receives explicit reference decisions.
 * No World/Character/Structure/Storyboard completion is manufactured here.
 */
export function createAfterglowV9FoundationsReference(): ImportedLibraryProject {
  const imported = richPpfToLibraryProject(
    createRichAfterglowProject(),
    AFTERGLOW_V9_FOUNDATIONS_REFERENCE_TIME,
  );
  const { lessons, lessonStates, fieldEvidence } = buildReferenceLessons();
  const completedLessonIds = lessons.map((lesson) => lesson.id);
  const activeLessonId = completedLessonIds.at(-1) ?? null;
  const foundations = {
    activeLessonId,
    lessons: lessonStates,
    brief: { content: "", savedAt: AFTERGLOW_V9_FOUNDATIONS_REFERENCE_TIME },
  };
  const projectForBrief = { ...imported, foundations };
  const brief = assembleFoundationsBrief({
    projectTitle: AFTERGLOW_V9_FOUNDATIONS_WORKING_TITLE,
    lessons,
    state: foundations,
  });

  return {
    ...projectForBrief,
    title: AFTERGLOW_V9_FOUNDATIONS_WORKING_TITLE,
    learning: {
      activeLessonId,
      completedLessonIds,
    },
    foundations: {
      ...foundations,
      brief: {
        content: brief,
        savedAt: AFTERGLOW_V9_FOUNDATIONS_REFERENCE_TIME,
      },
    },
    sourceEvidence: {
      ...imported.sourceEvidence,
      referenceFixture: {
        fixtureId: AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID,
        fixtureVersion: AFTERGLOW_V9_FOUNDATIONS_FIXTURE_VERSION,
        sourceId: AFTERGLOW_V9_REFERENCE_SOURCE_ID,
        sourceVersion: AFTERGLOW_V9_SOURCE_VERSION,
        sourceSha: AFTERGLOW_V9_SOURCE_SHA,
        sourceLabel: AFTERGLOW_V9_REFERENCE_LABEL,
        frontier: "Foundations",
        curriculumFingerprint: curriculumFingerprint(lessons),
        createdAt: AFTERGLOW_V9_FOUNDATIONS_REFERENCE_TIME,
        fields: fieldEvidence,
      },
    },
  };
}
