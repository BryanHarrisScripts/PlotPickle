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
    duration: "30–40 min",
    overview: "Trace the relationships among theme and anti-theme, escalating plot, internal and relationship subplots, character wounds and objectives, world pressure and transforming stakes.",
    objectives: [
      "Connect theme to character choices and opposing belief systems.",
      "Build plot escalation through action, reaction, turns and subplots.",
      "Track how character desire, flaw, history, relationships and world conditions change the stakes.",
    ],
    example: {
      title: "Theme becomes pressure",
      text: "If the theme asks whether security is worth surrendering freedom, the antagonist can embody the anti-theme, the protagonist's wound can make security tempting, and each plot turn can increase the personal cost of choosing either value.",
    },
    checklist: [
      "Theme appears through choices and consequences rather than speeches alone.",
      "Plot turns force reassessment or escalation instead of simply adding events.",
      "Internal and relationship stories affect the external objective.",
      "Stakes evolve as the character learns more and has more to lose.",
    ],
    mistakes: [
      "Treating theme as a slogan placed on top of the plot.",
      "Building subplots that never change the main dramatic line.",
      "Increasing stakes only by making the external threat larger.",
    ],
    exercise: "Map one protagonist across four columns: external objective, internal pressure, relationship pressure and thematic choice. Add the plot turn that changes each column in every Act.",
    tags: ["theme", "anti-theme", "plot", "character", "subplots", "stakes", "world-building"],
  },
  {
    sourceId: "24-blocks-essentials-readme-md",
    number: 18.3,
    title: "The Screenwriting Essentials Roadmap",
    duration: "10–15 min",
    overview: "Use the Essentials collection as a learning map that connects storytelling dynamics, thematic components, screenplay fundamentals, scene writing, symbolic technique and advanced visual writing.",
    objectives: [
      "See how the Essentials material progresses from foundational craft to advanced technique.",
      "Choose the next craft area based on the story problem you are solving.",
      "Avoid treating a table of contents as a mandatory writing sequence.",
    ],
    example: {
      title: "Choose the lesson from the problem",
      text: "A flat midpoint may need Storytelling Dynamics or structure work; an unclear moral argument may need Thematic Components; a visually repetitive draft may benefit from Symbolic Techniques or Beyond Sluglines.",
    },
    checklist: [
      "The current story problem is named before choosing a craft lesson.",
      "Related craft areas are considered when one fix affects another system.",
      "The roadmap supports iteration rather than a single required order.",
    ],
    mistakes: [
      "Reading every craft topic before returning to the actual screenplay.",
      "Assuming advanced terminology automatically produces stronger storytelling.",
      "Fixing one craft category without checking its effect on the rest of the story.",
    ],
    exercise: "Name the three biggest problems in your current project and match each one to the most relevant Essentials area. Work on the highest-impact problem first.",
    tags: ["essentials", "learning path", "craft", "scene writing", "theme", "symbolism"],
  },
  {
    sourceId: "24-blocks-essentials-storytelling-dynamics-md",
    number: 19.1,
    title: "Pacing and Tone: Storytelling Dynamics",
    duration: "25–35 min",
    overview: "Control the audience's emotional journey by varying narrative speed, intensity and tonal attitude while using dialogue, description, genre expectations and scene transitions deliberately.",
    objectives: [
      "Recognize pacing as variation in narrative rhythm rather than constant speed.",
      "Maintain tonal coherence while allowing meaningful shifts and contrast.",
      "Use pacing and tone together to shape suspense, relief, intimacy, surprise and emphasis.",
    ],
    example: {
      title: "Contrast creates rhythm",
      text: "A thriller can follow rapid cross-cut action with a quiet, visually sparse scene. The slower pace gives the audience time to absorb the cost of the action while a darker tone prepares the next escalation.",
    },
    checklist: [
      "Fast and slow passages are chosen for audience effect rather than habit.",
      "Tone is recognizable across dialogue, action, setting and visual language.",
      "Tonal shifts are motivated by story or character change.",
      "The pace creates room for both tension and emotional processing.",
    ],
    mistakes: [
      "Equating good pacing with making every scene faster.",
      "Keeping tone so uniform that the story becomes emotionally flat.",
      "Using an abrupt tonal shift that has no character, plot or thematic motivation.",
    ],
    exercise: "Chart the pace and tone of eight consecutive scenes using one word for speed and one for mood. Revise the sequence if the emotional rhythm never changes or changes without a dramatic reason.",
    tags: ["pacing", "tone", "mood", "rhythm", "genre", "dialogue", "audience"],
  },
] as const;

export const FOUNDATION_PROMOTED_SOURCE_IDS = FOUNDATION_REFERENCE_LESSON_PLANS.map((plan) => plan.sourceId);

function cleanInline(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`~]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceContentToSections(source: CurriculumSource) {
  const sections: { heading: string; paragraphs: string[]; points: string[] }[] = [];
  let current = { heading: "Source lesson", paragraphs: [] as string[], points: [] as string[] };
  let paragraphParts: string[] = [];
  let skippedDocumentTitle = false;

  const flushParagraph = () => {
    if (!paragraphParts.length) return;
    const paragraph = cleanInline(paragraphParts.join(" "));
    if (paragraph) current.paragraphs.push(paragraph);
    paragraphParts = [];
  };

  const flushSection = () => {
    flushParagraph();
    if (current.paragraphs.length || current.points.length) sections.push(current);
  };

  for (const rawLine of source.content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^---+$/.test(line)) continue;

    const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
    const emphasizedHeading = line.match(/^\*\*([^*]+)\*\*$/);
    if (markdownHeading || emphasizedHeading) {
      const heading = cleanInline(markdownHeading?.[2] ?? emphasizedHeading?.[1] ?? "");
      if (!skippedDocumentTitle && markdownHeading?.[1] === "#") {
        skippedDocumentTitle = true;
        continue;
      }
      flushSection();
      current = { heading: heading || "Lesson notes", paragraphs: [], points: [] };
      continue;
    }

    const listItem = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    const htmlListItem = line.match(/<li[^>]*>(.*?)<\/li>/i);
    if (listItem || htmlListItem) {
      flushParagraph();
      const point = cleanInline(listItem?.[1] ?? htmlListItem?.[1] ?? "");
      if (point) current.points.push(point);
      continue;
    }

    if (line.includes("|") && !/^\|?\s*:?-{3,}/.test(line)) {
      flushParagraph();
      const cells = line.split("|").map(cleanInline).filter(Boolean);
      if (cells.length) current.points.push(cells.join(" — "));
      continue;
    }

    const cleaned = cleanInline(line.replace(/^>\s?/, ""));
    if (cleaned) paragraphParts.push(cleaned);
  }

  flushSection();
  return sections.length ? sections : [{ heading: "Lesson notes", paragraphs: [source.scopeNote], points: [] }];
}

function promoteSource(source: CurriculumSource, plan: FoundationReferenceLessonPlan): CurriculumLesson {
  return {
    id: `foundations-${source.id.replace(/^24-blocks-/, "")}`,
    number: plan.number,
    topic: "foundations",
    title: plan.title,
    duration: plan.duration,
    overview: plan.overview,
    objectives: plan.objectives,
    sections: sourceContentToSections(source),
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
    sources: [],
  };
}

function replaceFoundationsTableOfContents(lessons: readonly CurriculumLesson[]) {
  const points = lessons.map((lesson, index) => (
    `${String(index + 1).padStart(2, "0")} — ${lesson.title}`
  ));

  return lessons.map((lesson) => {
    if (lesson.id !== "pitch") return lesson;
    return {
      ...lesson,
      sections: lesson.sections.map((section) => (
        section.heading === "Foundations table of contents"
          ? {
              ...section,
              paragraphs: [
                "Foundations now contains eleven standalone lessons. The former embedded references have been promoted into the curriculum so you can read, complete and revisit each craft topic like any other lesson.",
              ],
              points,
            }
          : section
      )),
    };
  });
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
  const combined = [...standaloneBaseLessons, ...promotedLessons].sort((left, right) => left.number - right.number);
  return replaceFoundationsTableOfContents(combined);
}
