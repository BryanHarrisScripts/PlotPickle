import type { CurriculumLesson, CurriculumSource } from "../../core/contracts/curriculum";

type FoundationReferenceLessonPlan = {
  readonly sourceId: string;
  readonly number: number;
  readonly title: string;
  readonly duration: string;
  readonly overview: string;
  readonly objectives: readonly string[];
  readonly example: { readonly title: string; readonly text: string };
  readonly checklist: readonly string[];
  readonly mistakes: readonly string[];
  readonly exercise: string;
  readonly tags: readonly string[];
};

const FOUNDATION_REFERENCE_LESSON_PLANS: readonly FoundationReferenceLessonPlan[] = [
  {
    sourceId: "24-blocks-general-general-the-pitch-md",
    number: 1.1,
    title: "Pitch Components and Project Positioning",
    duration: "20–30 min",
    overview: "Expand a strong story promise into the practical information a producer, collaborator, publisher or investor may need without burying the story under business detail.",
    objectives: [
      "Separate the dramatic pitch from project, market and production information.",
      "Choose pitch components that match the audience and purpose of the conversation.",
      "End a pitch with a specific next-step request instead of a vague appeal for interest.",
    ],
    example: {
      title: "One story, two pitch layers",
      text: "Lead with the protagonist, objective, opposition and stakes. Add format, audience, comparable titles, production scope and the requested next step only when those details help this particular listener decide what to do next.",
    },
    checklist: [
      "The story promise appears before market or production detail.",
      "Audience and format are named only when they help the listener evaluate the project.",
      "Comparable titles communicate tone, audience or scale rather than borrowed prestige.",
      "The pitch ends with one clear call to action.",
    ],
    mistakes: [
      "Trying to include every possible pitch component in every conversation.",
      "Replacing story evidence with claims that the project is unique or marketable.",
      "Ending without telling the listener what response or action is being requested.",
    ],
    exercise: "Take your current short pitch and create a second project-facing version that adds only the audience, format, one useful comparable, production scope and a precise next-step request.",
    tags: ["pitch", "audience", "comparables", "market", "production", "call to action"],
  },
  {
    sourceId: "24-blocks-general-readme-md",
    number: 1.2,
    title: "The Anatomy of a Screenplay",
    duration: "25–35 min",
    overview: "See screenplay craft as an interconnected system of structure, dialogue, character, theme, world, storytelling dynamics and symbolic technique rather than seven isolated checklists.",
    objectives: [
      "Recognize the major craft systems working together inside a screenplay.",
      "Connect visible story choices to structure, character, theme and world pressure.",
      "Use craft categories as diagnostic lenses instead of rigid drafting order.",
    ],
    example: {
      title: "One scene, several craft systems",
      text: "A breakup scene can simultaneously turn the plot, reveal a character wound, express the theme through a choice, change the pacing, use the room as visual pressure and plant a recurring object as a motif.",
    },
    checklist: [
      "A scene has a structural purpose beyond delivering information.",
      "Dialogue reflects character pressure and changes the dramatic situation.",
      "World details affect choices rather than decorate the page.",
      "Theme is expressed through conflict, action and consequence.",
    ],
    mistakes: [
      "Treating structure, dialogue, character and theme as separate passes that never interact.",
      "Using screenplay terminology as a substitute for asking what the audience experiences.",
      "Adding visual or symbolic detail that does not affect meaning, tension or character.",
    ],
    exercise: "Choose one important scene and annotate it seven times: structure, dialogue, character, theme, world, pacing/tone and symbolism. Note where one choice is doing more than one job.",
    tags: ["screenplay", "structure", "dialogue", "character", "theme", "world", "symbolism"],
  },
  {
    sourceId: "24-blocks-loglines-loglines-md",
    number: 15.1,
    title: "Crafting and Testing Loglines",
    duration: "25–35 min",
    overview: "Develop and compare logline versions using protagonist, conflict, stakes, setting, genre, specificity, tone and audience while treating every formula as a tool rather than a law.",
    objectives: [
      "Build loglines from confirmed story evidence instead of abstract praise.",
      "Test alternative sentence shapes for clarity, specificity, stakes and tone.",
      "Use feedback and revision to improve the sentence without allowing the logline to distort the movie.",
    ],
    example: {
      title: "Deconstruct before polishing",
      text: "Before shortening a logline, label the protagonist, disruption, objective, opposition, stakes, distinctive setting or rule and tone. A shorter sentence is useful only when those essential pressures remain understandable.",
    },
    checklist: [
      "The protagonist and active objective are understandable on first read.",
      "The central opposition or problem can sustain more than one scene.",
      "The stakes explain why failure matters.",
      "Specific language communicates genre and tone without extra explanation.",
    ],
    mistakes: [
      "Forcing every suggested logline rule into the same sentence.",
      "Removing important story evidence merely to hit an arbitrary word count.",
      "Using intrigue as an excuse to make the central conflict incomprehensible.",
    ],
    exercise: "Write three loglines for the same project: one development version, one pitch-deck version and one public teaser. Deconstruct each sentence and record what it deliberately includes or withholds.",
    tags: ["logline", "conflict", "stakes", "tone", "audience", "revision", "specificity"],
  },
  {
    sourceId: "24-blocks-essentials-essential-aspects-1-md",
    number: 18.1,
    title: "Screenplay Essentials: Structure, Dialogue and Visuals",
    duration: "25–35 min",
    overview: "Connect screenplay structure, scene function, pacing, climax, dialogue, visual description, conflict, formatting, characterization, genre, audience and revision into one practical craft map.",
    objectives: [
      "Identify the structural and scene-level functions that keep a screenplay moving.",
      "Use dialogue and visual description to reveal character and advance conflict.",
      "Balance genre expectations, audience experience and revision without writing by checklist alone.",
    ],
    example: {
      title: "Build pressure across systems",
      text: "A climax works because earlier scenes escalated conflict, dialogue exposed competing motives, visual details made the danger concrete and pacing narrowed the character's available choices before the decisive confrontation.",
    },
    checklist: [
      "Scenes change the situation instead of repeating the same dramatic information.",
      "Dialogue reveals motive, relationship or conflict while moving the scene.",
      "Visual description focuses on what can be experienced on screen.",
      "Pacing and revision support the intended audience experience.",
    ],
    mistakes: [
      "Treating climax and resolution as isolated moments with no setup.",
      "Using camera or visual detail without a storytelling reason.",
      "Formatting correctly while leaving scene purpose and conflict unclear.",
    ],
    exercise: "Audit one sequence for scene purpose, conflict, pacing, dialogue function, visual evidence and the turn that carries the audience into the next sequence.",
    tags: ["structure", "scene", "dialogue", "visuals", "pacing", "formatting", "revision"],
  },
  {
    sourceId: "24-blocks-essentials-essential-aspects-2-md",
    number: 18.2,
    title: "Story Essentials: Theme, Plot, Character and Stakes",
    duration: "35–45 min",
    overview: "Build one connected story engine from a contested thematic question, character strategy, external pursuit, active opposition, relationship pressure, transforming stakes and ending proof.",
    objectives: [
      "Distinguish concept, premise, plot, story, structure and theme without separating them into unrelated checklists.",
      "Build external, internal and relationship movement around choices and consequences.",
      "Escalate by transforming leverage, options and personal cost rather than only making the threat louder.",
    ],
    example: {
      title: "A thematic question creates competing strategies",
      text: "If the story asks whether safety purchased through concealment can remain moral, Mara protects people by controlling information, the police chief protects his institution through managed truth and Dev argues that trust requires chosen vulnerability. Plot pressure makes each answer costly enough to test.",
    },
    checklist: [
      "Theme appears through choices and consequences rather than speeches alone.",
      "Plot turns force reassessment or escalation instead of simply adding events.",
      "Internal and relationship stories affect the external objective.",
      "Stakes evolve as the character learns more and has more to lose.",
    ],
    mistakes: [
      "Treating theme as a message the story merely announces or assigning one simple opposite answer to the villain.",
      "Building subplots that never change the main dramatic line.",
      "Increasing stakes only by making the external threat larger.",
    ],
    exercise: "Map one protagonist across four columns: external objective, protective strategy, relationship pressure and thematic choice. Add the action, reaction and consequence that transform each column at three major turns.",
    tags: ["theme", "anti-theme", "plot", "character", "subplots", "stakes", "world-building"],
  },
  {
    sourceId: "24-blocks-essentials-readme-md",
    number: 18.3,
    title: "The Screenwriting Essentials Roadmap",
    duration: "25–35 min",
    overview: "See how the eleven Foundations lessons build one usable brief, then choose a learning route from the story evidence and root problem instead of following a table of contents mechanically.",
    objectives: [
      "Understand what each Foundations lesson contributes to the final brief.",
      "Distinguish a reader-experience symptom from its likely craft cause.",
      "Design a small revision experiment and a three-risk learning route for the active story.",
    ],
    example: {
      title: "Move from symptom to experiment",
      text: "If Block 14 feels slow and three scenes repeat that a key is missing, the root problem may be unchanged strategy rather than pace. Let each search change leverage, trust or cost, then compare the audience experience.",
    },
    checklist: [
      "The observed audience or reader experience is stated before a solution is chosen.",
      "Evidence, likely root cause and a small revision experiment are recorded separately.",
      "The learning route names three project risks without turning the course into locked prerequisites.",
    ],
    mistakes: [
      "Reading every craft topic before returning to the actual screenplay.",
      "Treating the first visible symptom as the root cause.",
      "Changing several craft systems at once so the experiment teaches nothing.",
    ],
    exercise: "Name the three highest-risk uncertainties in your current project. For each, record the observed evidence, the likely root cause, the Foundations lesson that can help and the smallest experiment that could teach you something.",
    tags: ["essentials", "learning path", "craft", "scene writing", "theme", "symbolism"],
  },
  {
    sourceId: "24-blocks-essentials-storytelling-dynamics-md",
    number: 19.1,
    title: "Pacing and Tone: Storytelling Dynamics",
    duration: "30–40 min",
    overview: "Shape the audience's emotional journey through patterns of meaningful change, processing time and a coherent attitude toward people and consequences—not genre speed rules or a single unchanging mood.",
    objectives: [
      "Recognize pacing as the rhythm of meaningful change rather than raw speed.",
      "Distinguish the story's tonal attitude from the local mood of a scene.",
      "Use compression, expansion, contrast and processing time to shape anticipation and consequence.",
    ],
    example: {
      title: "Quiet can move quickly",
      text: "A mother silently signs away guardianship. Almost no physical action occurs, yet status, relationship, options and future consequence change within seconds. The scene is quiet in volume and fast in meaningful change.",
    },
    checklist: [
      "Each sequence changes pressure, information, tactic, status, relationship, cost or anticipation.",
      "Compression and expansion are chosen for audience effect rather than genre stereotype.",
      "Tone remains legible through behavior, language, image, sound, rhythm and consequence.",
      "Tonal variation changes the emotional register without violating the story's attitude.",
    ],
    mistakes: [
      "Calling action automatically fast and drama automatically slow.",
      "Using tone and mood as interchangeable words.",
      "Mistaking tonal consistency for one emotional register or using rupture without consequence.",
    ],
    exercise: "Chart eight consecutive scenes by meaningful change, compression or expansion, local mood, tonal attitude and audience question. Revise one transition where nothing changes or where a tonal turn lacks story evidence.",
    tags: ["pacing", "tone", "mood", "rhythm", "genre", "dialogue", "audience"],
  },
] as const;

export const FOUNDATION_PROMOTED_SOURCE_IDS = FOUNDATION_REFERENCE_LESSON_PLANS.map((plan) => plan.sourceId);

function promoteSource(source: CurriculumSource, plan: FoundationReferenceLessonPlan): CurriculumLesson {
  return {
    id: `foundations-${source.id.replace(/^24-blocks-/, "")}`,
    number: plan.number,
    topic: "foundations",
    title: plan.title,
    duration: plan.duration,
    overview: plan.overview,
    objectives: plan.objectives,
    // The beginner-facing teaching is curated in foundation-course-material.ts.
    // Keep the canonical Markdown intact as provenance instead of flattening its
    // headings, ordered steps, links, tables and quotations into generic points.
    sections: [],
    definitions: [],
    example: plan.example,
    checklist: plan.checklist,
    mistakes: plan.mistakes,
    exercise: plan.exercise,
    apply: "Foundations brief",
    tags: plan.tags,
    original: {
      number: plan.number,
      path: `Foundations / ${source.path}`,
    },
    sources: [source],
  };
}

export function buildFoundationCurriculum(baseLessons: readonly CurriculumLesson[]): readonly CurriculumLesson[] {
  const uniqueSources = new Map<string, CurriculumSource>();
  for (const lesson of baseLessons) {
    for (const source of lesson.sources) uniqueSources.set(source.id, source);
  }

  if (uniqueSources.size !== FOUNDATION_REFERENCE_LESSON_PLANS.length) {
    throw new Error(`Expected ${FOUNDATION_REFERENCE_LESSON_PLANS.length} Foundations references, found ${uniqueSources.size}.`);
  }

  const promotedLessons = FOUNDATION_REFERENCE_LESSON_PLANS.map((plan) => {
    const source = uniqueSources.get(plan.sourceId);
    if (!source) throw new Error(`Foundations reference ${plan.sourceId} is missing.`);
    return promoteSource(source, plan);
  });

  const standaloneBaseLessons = baseLessons.map((lesson) => ({ ...lesson, sources: [] }));
  return [...standaloneBaseLessons, ...promotedLessons].sort((left, right) => left.number - right.number);
}
