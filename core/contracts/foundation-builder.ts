export const FOUNDATION_BUILDER_STEPS = [
  {
    id: "storyPromise",
    number: 1,
    lessonTitle: "The Pitch",
    title: "Story Promise",
    prompt: "State the human problem, protagonist, disruption, objective, opposition and cost of failure in plain language.",
    placeholder: "What is the story really asking us to follow, and why does it matter?",
  },
  {
    id: "pitchPositioning",
    number: 2,
    lessonTitle: "Pitch Components and Project Positioning",
    title: "Pitch and Positioning",
    prompt: "Define format, audience, genre, tone, one useful comparable and the next step you would ask from a reader or collaborator.",
    placeholder: "Feature screenplay for... The experience should feel... Comparable because...",
  },
  {
    id: "screenplayAnatomy",
    number: 3,
    lessonTitle: "The Anatomy of a Screenplay",
    title: "Screenplay Anatomy",
    prompt: "Describe how structure, character, world, theme, dialogue, visual storytelling and symbolism must work together in this story.",
    placeholder: "The structure must force... The world pressures... Dialogue should... Visually...",
  },
  {
    id: "primaryLogline",
    number: 4,
    lessonTitle: "Loglines That Carry the Movie",
    title: "Primary Logline",
    prompt: "Write the clearest development logline for the movie you intend to build, not just the most marketable sentence.",
    placeholder: "After..., a ... must ... against ... before ...",
  },
  {
    id: "loglineTests",
    number: 5,
    lessonTitle: "Crafting and Testing Loglines",
    title: "Logline Tests",
    prompt: "Test alternate versions for development, pitch and public teaser purposes, recording what each version deliberately includes or withholds.",
    placeholder: "Development version:\nPitch version:\nPublic teaser:\nWhat changes and why:",
  },
  {
    id: "storyLayers",
    number: 6,
    lessonTitle: "Why PlotPickle Works in Layers",
    title: "Story Layers",
    prompt: "Describe the same story at whole-story, Act/Sequence, Block/Scene and beat/shot resolution so the layers remain one causal story.",
    placeholder: "Whole story promise... Major movements... Repeatable Block engine... Scene/beat evidence...",
  },
  {
    id: "structureDialogueVisuals",
    number: 7,
    lessonTitle: "Screenplay Essentials: Structure, Dialogue and Visuals",
    title: "Structure, Dialogue and Visual Rules",
    prompt: "Set the practical rules that will keep scenes purposeful, dialogue character-specific and visual description cinematic rather than decorative.",
    placeholder: "Every scene should... Dialogue should reveal... Visual description should emphasize...",
  },
  {
    id: "themeCharacterStakes",
    number: 8,
    lessonTitle: "Story Essentials: Theme, Plot, Character and Stakes",
    title: "Theme, Character and Stakes",
    prompt: "Connect the thematic question to the protagonist's want, need, protective strategy, opposition, escalation and final choice.",
    placeholder: "The story asks whether... The protagonist believes... The opposition proves... The final choice demonstrates...",
  },
  {
    id: "craftRoadmap",
    number: 9,
    lessonTitle: "The Screenwriting Essentials Roadmap",
    title: "Craft Roadmap",
    prompt: "Name the three craft areas that will need the most attention as this story moves into planning and drafting, and explain why.",
    placeholder: "1. ... because...\n2. ... because...\n3. ... because...",
  },
  {
    id: "pacingTone",
    number: 10,
    lessonTitle: "Pacing and Tone: Storytelling Dynamics",
    title: "Pacing, Tone and Audience Experience",
    prompt: "Define the emotional rhythm, tonal boundaries, contrast and after-effect you want the audience to experience.",
    placeholder: "The opening feels... The middle alternates... The darkest/lightest tonal boundary is... The audience should leave feeling...",
  },
  {
    id: "foundationsBrief",
    number: 11,
    lessonTitle: "Build the Story Experience",
    title: "Foundations Brief",
    prompt: "Synthesize the previous ten decisions into the compact story engine that PLAN, the 24 Blocks, screenplay, visuals and Creative Room should all use as their starting reference.",
    placeholder: "In one coherent brief, capture protagonist, objective, opposition, urgency, stakes, theme, transformation, tone, audience promise and ending proof.",
  },
] as const;

export type FoundationBuilderField = (typeof FOUNDATION_BUILDER_STEPS)[number]["id"];

export type FoundationBuilderState = Record<FoundationBuilderField, string>;

export function createEmptyFoundationBuilderState(): FoundationBuilderState {
  return Object.fromEntries(
    FOUNDATION_BUILDER_STEPS.map((step) => [step.id, ""]),
  ) as FoundationBuilderState;
}
