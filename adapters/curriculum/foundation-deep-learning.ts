import type { CurriculumLesson } from "../../core/contracts/curriculum";
import { buildFoundationCurriculum } from "./foundation-reference-lessons";

type TeachingSection = CurriculumLesson["sections"][number];

type LessonEnrichment = {
  readonly sections: readonly TeachingSection[];
  readonly storyOutputs: readonly string[];
  readonly exercise?: string;
};

const FOUNDATION_SEQUENCE = [
  "The Anatomy of a Screenplay",
  "The Screenwriting Essentials Roadmap",
  "Story Essentials: Theme, Plot, Character and Stakes",
  "The Pitch",
  "Loglines That Carry the Movie",
  "Crafting and Testing Loglines",
  "Why PlotPickle Works in Layers",
  "Screenplay Essentials: Structure, Dialogue and Visuals",
  "Pacing and Tone: Storytelling Dynamics",
  "Pitch Components and Project Positioning",
  "Build the Story Experience",
] as const;

const ENRICHMENTS: Record<(typeof FOUNDATION_SEQUENCE)[number], LessonEnrichment> = {
  "The Pitch": {
    sections: [
      {
        heading: "The pitch is the first model of the movie",
        paragraphs: [
          "A useful pitch is not advertising copy and it is not a miniature screenplay. It is the smallest model of the story that still exposes the dramatic engine. A reader should be able to identify who we follow, what changes their ordinary situation, what they actively pursue, what resists them and what failure costs.",
          "The pitch becomes a diagnostic tool. If you cannot describe the central pursuit without listing disconnected events, the middle of the story may not yet have a repeatable source of conflict. If the protagonist disappears from the sentence, the story may be organized around events rather than choices. If the stakes are generic, the audience may understand the danger without feeling why it matters to this person.",
        ],
        points: [
          "Protagonist: the person whose choices organize the audience's experience.",
          "Disruption: the change that makes the old normal impossible or unstable.",
          "Objective: the visible thing the protagonist must now do, obtain, stop, escape or prove.",
          "Opposition: the person, system, environment, belief or relationship capable of stopping progress.",
          "Stakes: the specific cost of failure, including personal and relational cost rather than scale alone.",
        ],
      },
      {
        heading: "Premise, logline, pitch and synopsis do different jobs",
        paragraphs: [
          "Writers often weaken a pitch by asking one paragraph to perform every communication job. A premise names the central dramatic possibility. A logline exposes the engine. A short pitch adds world, escalation, character pressure and tone. A synopsis explains the causal movement of the complete story and may reveal the ending when the reader is evaluating the work.",
          "The same underlying story should survive all four forms. If each version describes a different movie, the Foundation is not yet stable enough to support planning.",
        ],
      },
    ],
    storyOutputs: [
      "A plain-language story promise.",
      "A named protagonist, disruption, objective, opposition and cost of failure.",
      "The central dramatic question the movie will keep testing.",
    ],
    exercise: "Write the story in four resolutions: one-sentence premise, 35-word development logline, 150-word short pitch and a one-paragraph causal synopsis. Circle the story facts that survive all four versions.",
  },
  "Pitch Components and Project Positioning": {
    sections: [
      {
        heading: "Story first, project information second",
        paragraphs: [
          "A complete project pitch can contain title, format, audience, comparable titles, market context, production scale, creator background, distribution thinking and a call to action. Those details matter, but they should support the story promise rather than bury it.",
          "The useful question is not 'What belongs in a pitch?' but 'What does this listener need in order to understand the work and decide the next step?' A creative collaborator may need world, character and tone. A producer may also need scope and audience. A development conversation may need no market language at all until the dramatic engine is clear.",
        ],
      },
      {
        heading: "Comparables are coordinates, not claims of quality",
        paragraphs: [
          "Comparable titles are strongest when each comparison has a job: audience, tone, narrative shape, visual language or production scale. 'It is the next blockbuster' communicates aspiration, not useful positioning. 'It combines the intimate grief structure of one drama with the contained-location pressure of a thriller' tells the reader how to imagine the experience.",
        ],
        points: [
          "Audience comparison: who is likely to want this experience?",
          "Tone comparison: how dark, playful, grounded, heightened or emotionally intense is it?",
          "Structure comparison: what kind of narrative movement helps explain the form?",
          "Scale comparison: is this intimate, contained, ensemble, location-heavy or effects-heavy?",
        ],
      },
    ],
    storyOutputs: [
      "Format, intended audience, genre and tonal position.",
      "One or two comparables with an explicit reason for each comparison.",
      "The next-step request you would make of a reader, collaborator or producer.",
    ],
  },
  "The Anatomy of a Screenplay": {
    sections: [
      {
        heading: "A screenplay is a system, not a pile of categories",
        paragraphs: [
          "Structure, character, dialogue, theme, world, pacing, visual storytelling and symbolism are useful categories for study, but the audience experiences them simultaneously. A single scene can change the plot, expose a wound, pressure a relationship, express the theme through a choice, alter the pace and establish a visual motif at the same time.",
          "The Foundation therefore needs more than plot facts. It needs a working theory of how the story will create meaning and emotion. When you know the protagonist's strategy, the world can challenge it. When you know the thematic question, the opposition can embody a credible competing answer. When you know the audience promise, pacing and visual language can reinforce it instead of being invented scene by scene.",
        ],
      },
      {
        heading: "Look for choices that do more than one job",
        paragraphs: [
          "Economy in screenwriting is not simply fewer words. It is dramatic choices carrying several kinds of information at once. A location can establish world rules and trap a character. A line of dialogue can reveal status and conceal a motive. A prop can solve an immediate problem while becoming a motif that changes meaning at the climax.",
        ],
      },
    ],
    storyOutputs: [
      "The craft systems that matter most to this particular story.",
      "At least one example of structure, character, world, theme and visual language reinforcing each other.",
      "A short list of craft contradictions or risks to watch while planning.",
    ],
  },
  "Loglines That Carry the Movie": {
    sections: [
      {
        heading: "A development logline must carry the middle",
        paragraphs: [
          "A logline is useful inside PlotPickle when it describes a conflict that can generate many escalating choices, not merely an attractive setup. The first act can be unusual and the ending can be powerful, but the sentence must also imply what the protagonist will repeatedly have to do in the middle and why the opposition can keep making that harder.",
          "That is why an objective matters. 'A woman discovers a secret' is a situation. 'A woman must prove the secret before the institution erases the evidence' creates a continuing action. The second version suggests scenes, reversals and decisions.",
        ],
      },
      {
        heading: "Separate sentence evidence from project knowledge",
        paragraphs: [
          "When testing a logline, ask what the sentence itself communicates. Do not award it clarity because you already know the screenplay. A reader should not need your private notes to identify the protagonist, pursuit, resistance and stakes. At the same time, not every Foundation detail belongs in one sentence. Deliberate omission is different from accidental vagueness.",
        ],
      },
    ],
    storyOutputs: [
      "One primary development logline that accurately represents the movie being built.",
      "A clear protagonist, active objective, opposition and stakes visible in the sentence.",
      "A note identifying important Foundation information deliberately omitted from the logline.",
    ],
    exercise: "Write the development logline, then hide every other project note and deconstruct only the sentence. Mark protagonist, disruption, objective, opposition, stakes, distinctive world pressure and tone. Rewrite anything you were supplying from memory rather than from the words on the page.",
  },
  "Crafting and Testing Loglines": {
    sections: [
      {
        heading: "Rules are tests, not commandments",
        paragraphs: [
          "Logline advice often arrives as universal rules: keep to a particular word count, avoid names, include irony, state the setting, signal genre, never reveal too much. Each can be useful, but none should distort the story merely to satisfy a formula.",
          "Use these ideas as tests. Specificity usually improves a sentence; unnecessary names often consume attention; active verbs clarify agency; tone can help a reader imagine the movie. But the correct version is the sentence that communicates the intended story for a defined purpose.",
        ],
      },
      {
        heading: "One project can need several truthful loglines",
        paragraphs: [
          "A development logline can expose the engine so the writer can diagnose structure. A pitch-deck logline may foreground the hook and audience promise. A public teaser may deliberately withhold a reveal. These are variants of one canonical story, not competing canons.",
        ],
      },
    ],
    storyOutputs: [
      "Development, pitch and public-teaser versions of the logline.",
      "The purpose and intended audience for each version.",
      "A record of what each version includes, withholds and emphasizes.",
    ],
  },
  "Why PlotPickle Works in Layers": {
    sections: [
      {
        heading: "The layers are different resolutions of one causal story",
        paragraphs: [
          "Concept, Acts, Sequences, Blocks, Scenes, mini-blocks, beats and shots should not become separate versions of the movie. Each level answers a different question about the same chain of cause and effect. The whole-story view protects the promise; Acts and Sequences expose major movement; Blocks make escalation manageable; scenes make objectives playable; beats and shots provide visible evidence.",
          "When a small change is approved, you should be able to ask what it changes above and below that level. A new scene that has no effect on its Block may be ornamental. A Block turn that cannot be expressed through scenes may still be abstract. A shot idea that contradicts the scene's emotional purpose may look impressive while weakening the story.",
        ],
      },
      {
        heading: "Canon and proposals must remain distinct",
        paragraphs: [
          "A layer is useful only if the project remains coherent. Imported interpretation, collaborator feedback and AI output can all propose changes, but the authorized writer decides what becomes canonical. This is how the same story can move from planning to screenplay to visual development without invisible decisions accumulating in different tools.",
        ],
      },
    ],
    storyOutputs: [
      "A whole-story statement, major movement statement and repeatable Block-level engine.",
      "The evidence you expect scenes and visuals to provide for those higher-level decisions.",
      "A rule for what must be reviewed when a lower-level change affects the Foundation.",
    ],
  },
  "Screenplay Essentials: Structure, Dialogue and Visuals": {
    sections: [
      {
        heading: "Structure is pressure organized through time",
        paragraphs: [
          "Structure is not the presence of named plot points. It is the arrangement of decisions and consequences so the protagonist loses easy options and the story becomes more specific. Inciting events, midpoints, crises and climaxes are useful because they describe changes in available action, knowledge, cost or commitment.",
          "A scene belongs when something becomes different because the scene happened. That difference may be external, relational, informational or internal, but it must affect what can happen next.",
        ],
      },
      {
        heading: "Dialogue and visuals should carry dramatic work",
        paragraphs: [
          "Dialogue is strongest when characters use language to pursue something: control status, avoid exposure, persuade, seduce, threaten, test, deflect or connect. Visual description is strongest when the audience can infer pressure, relationship or change from what is observable rather than from explanation.",
        ],
        points: [
          "Ask what each speaker wants from the exchange.",
          "Prefer behavior that reveals emotion over labels that announce emotion.",
          "Use setting and objects as constraints, opportunities or evidence.",
          "Let pacing vary according to pressure rather than keeping every scene equally dense.",
        ],
      },
    ],
    storyOutputs: [
      "A rule for what every important scene must change.",
      "A dialogue principle tied to character strategy and relationship pressure.",
      "A visual-description principle tied to observable action, world and emotion.",
    ],
  },
  "Story Essentials: Theme, Plot, Character and Stakes": {
    sections: [
      {
        heading: "Theme becomes dramatic when credible answers collide",
        paragraphs: [
          "Theme should not sit above the screenplay as a message. Turn it into a question that reasonable characters can answer differently. The protagonist begins with a strategy or belief that has helped them survive. The opposition pressures that belief. Relationships reveal its cost. Plot escalation removes the possibility of staying neutral. The ending becomes thematic proof because the protagonist finally chooses under maximum pressure.",
        ],
      },
      {
        heading: "External, internal and relationship stories should affect one another",
        paragraphs: [
          "The external objective supplies visible movement. The internal story tracks the belief or protective strategy that shapes choices. The relationship story makes change costly because another person can reward, expose or challenge the old strategy. If these lines never affect one another, the screenplay can feel like parallel plots instead of one dramatic system.",
          "Stakes become stronger when they transform. Early failure may cost an opportunity. Later it may cost identity, trust, belonging or the ability to repair harm. Increasing scale is only one form of escalation.",
        ],
      },
    ],
    storyOutputs: [
      "A thematic question and a credible opposing answer.",
      "The protagonist's conscious want, deeper need or truth, and protective strategy.",
      "External, internal and relationship stakes that escalate toward the final choice.",
    ],
  },
  "The Screenwriting Essentials Roadmap": {
    sections: [
      {
        heading: "Use craft study to solve story problems",
        paragraphs: [
          "A curriculum becomes useful when it helps you diagnose the active project. You do not need to master every technique before writing. Identify the problem first, then choose the craft lens that can reveal why the story is not producing the intended audience experience.",
          "A flat midpoint may be a structure problem, but it may also reveal that the objective never changed, the opposition lacks leverage or the relationship story has stopped affecting choices. A dialogue problem may really be a character-strategy problem. A pacing problem may come from scenes repeating the same information.",
        ],
      },
      {
        heading: "Prioritize the Foundation risks before planning 24 Blocks",
        paragraphs: [
          "Before expanding into detailed structure, identify the three craft risks most likely to produce rework. This gives the active story and the Creative Room a useful watchlist. The goal is not to eliminate uncertainty; it is to know where the story still needs proof.",
        ],
      },
    ],
    storyOutputs: [
      "Three prioritized craft risks or questions.",
      "The curriculum area most likely to help with each risk.",
      "The kind of story evidence that would prove the issue is improving.",
    ],
  },
  "Pacing and Tone: Storytelling Dynamics": {
    sections: [
      {
        heading: "Pacing is rhythm, not speed",
        paragraphs: [
          "Fast pacing is not automatically engaging and slow pacing is not automatically boring. Pacing is the audience's experience of information, action, decision and emotional processing over time. Suspense can come from acceleration, but it can also come from delaying an expected event while pressure grows.",
          "A useful Foundation describes contrast. Where does the audience get to breathe? Where does the movie compress time? Where does it linger because emotional recognition matters more than plot movement? A story with no rhythmic variation can become exhausting or flat regardless of genre.",
        ],
      },
      {
        heading: "Tone is a boundary around how the story treats its material",
        paragraphs: [
          "Tone emerges from character behavior, dialogue, consequence, visual language, music assumptions, pacing and what the story treats as serious or absurd. A coherent tone can contain contrast, but shifts should feel motivated by story and character rather than by a scene suddenly belonging to another movie.",
        ],
      },
    ],
    storyOutputs: [
      "The dominant tonal promise and the boundaries you do not want to cross accidentally.",
      "A rough emotional rhythm from opening through ending, including intentional contrast.",
      "The final emotional after-effect you want the audience to carry out of the story.",
    ],
  },
  "Build the Story Experience": {
    sections: [
      {
        heading: "A Foundation is a decision system for the rest of the project",
        paragraphs: [
          "The final Foundation is not a collection of answers copied from the previous lessons. It is a coherent model that later work can test. Protagonist, objective, opposition, urgency, stakes, theme, transformation, tone and audience promise should reinforce rather than contradict one another.",
          "The strongest test is the ending. If the Foundation says the story is about a character learning to value connection over control, the climax should force a visible choice between those values. If the pitch promises dread and moral uncertainty, the visual and pacing strategy should not accidentally turn the story into effortless wish fulfillment.",
        ],
      },
      {
        heading: "Keep the brief alive while the story earns its answers",
        paragraphs: [
          "Treat the Foundations Brief as canonical but revisable. New scene evidence may reveal that the objective is wrong, the opposition is too weak or the theme is being stated rather than dramatized. Revise the Foundation deliberately, then let downstream structure and visuals inherit the approved change.",
        ],
      },
    ],
    storyOutputs: [
      "A compact story engine that another writer could understand without reading all of your notes.",
      "A visible link between the protagonist's external pursuit and internal transformation.",
      "The audience promise, tonal strategy and ending proof that every later workspace can test.",
    ],
    exercise: "Use your answers from Lessons 1–10 to write a one-page Foundations Brief. Then test every sentence against the ending: what visible choice or consequence will prove that claim on screen?",
  },
};

function replaceTableOfContents(lesson: CurriculumLesson, lessons: readonly CurriculumLesson[]): CurriculumLesson {
  if (lesson.title !== "The Pitch") return lesson;
  const points = lessons.map((item) => `${String(item.number).padStart(2, "0")} — ${item.title}`);
  return {
    ...lesson,
    sections: lesson.sections.map((section) => (
      section.heading === "Foundations table of contents"
        ? {
            ...section,
            paragraphs: [
              "Foundations is an eleven-lesson learning path. Read the lessons in order when you are new to the method, then revisit individual lessons when your story exposes a weak part of its engine.",
            ],
            points,
          }
        : section
    )),
  };
}

export function buildDeepFoundationCurriculum(baseLessons: readonly CurriculumLesson[]): readonly CurriculumLesson[] {
  const standalone = buildFoundationCurriculum(baseLessons);
  const byTitle = new Map(standalone.map((lesson) => [lesson.title, lesson]));

  const sequenced = FOUNDATION_SEQUENCE.map((title, index) => {
    const lesson = byTitle.get(title);
    if (!lesson) throw new Error(`Foundations learning-path lesson ${title} is missing.`);
    const enrichment = ENRICHMENTS[title];
    return {
      ...lesson,
      number: index + 1,
      sections: [
        ...enrichment.sections,
        ...lesson.sections,
        {
          heading: "Apply this to your story",
          paragraphs: [
            "Do not try to make this perfect before moving on. Capture a defensible working answer, mark what remains uncertain, and let the next lessons test it. Keep this output beside the rest of the Foundation so the pieces can be revised together.",
          ],
          points: [...enrichment.storyOutputs],
        },
      ],
      exercise: enrichment.exercise ?? lesson.exercise,
      apply: "Active story · Foundations",
    } satisfies CurriculumLesson;
  });

  return sequenced.map((lesson) => replaceTableOfContents(lesson, sequenced));
}
