import type { LearningModule } from "./learning-library";
import { pageToProductionStages, plotPicklePrinciples, plotPickleTimeline } from "./about/about-content";

export const whyPlotPickleWorksInLayers: LearningModule = {
  id: "why-plotpickle-works-in-layers",
  number: 70,
  path: "Foundations",
  title: "Why PlotPickle Works in Layers",
  duration: "20–30 min",
  overview: "Use several story resolutions—from whole concept to shot—without splitting the movie into disconnected versions or treating one structure as a creative cage.",
  objectives: [
    "Understand why one canonical project matters.",
    "Choose the useful resolution for the current story question.",
    "Keep writer approval, rights and provenance visible across the page-to-production path.",
  ],
  sections: [
    {
      heading: "One story, several useful resolutions",
      paragraphs: [
        "A concept, Act, Sequence, Block, Scene, mini-block, beat and shot do not compete for authority. They are different lenses on the same movie. The writer can work on one manageable unit while seeing how it serves the whole.",
        "The 24 Blocks provide a shared vocabulary across human writers, collaborators, screenplay elements, visual planning and optional AI. They remain flexible and do not require an exact two-hour runtime or five minutes per Block.",
      ],
      points: ["Whole concept: the audience promise.", "Acts and Sequences: major movements and turns.", "Blocks: causal dramatic units.", "Scenes and mini-blocks: playable objectives, resistance and change.", "Beats and shots: performance and visible evidence."],
    },
    {
      heading: "One canonical project",
      paragraphs: [
        "Planning, treatment, screenplay, visuals, review, production and provenance read and write the same portable project. A suggestion, import interpretation, collaborator proposal or AI output remains separate until an authorized person accepts it.",
        "Local-first does not mean isolated. Writers may exchange files, use owner-controlled GitHub proposals, invite reviewers or work with production contributors. The collaboration model is deliberate rather than assumed.",
      ],
      points: plotPicklePrinciples.slice(0, 8).map((principle) => `${principle.title}: ${principle.text}`),
    },
    {
      heading: "From page to production",
      paragraphs: [
        "The page-to-production path helps the writer carry intention, continuity and feasibility forward. It does not promise automatic filmmaking, production, discovery, employment or revenue.",
        "Each later workspace should be able to trace its decision back to story evidence, source, rights and approval history.",
      ],
      points: pageToProductionStages.map((stage, index) => `${index + 1}. ${stage}`),
    },
    {
      heading: "How the method evolved",
      paragraphs: [
        "Afterglow, the 24 Blocks learning archive, separate OpenStory GPTs, public-sharing experiments and visual-development repositories were consolidated into one local application. Historical names remain searchable, but they are not separate current products.",
        "Web3, tokens, DAOs, revenue promises, required GPT subscriptions, open-ended public editing and autonomous-agent core architecture were experiments, not current commitments.",
      ],
      points: plotPickleTimeline.map((item) => `${item.stage} — ${item.title}`),
    },
  ],
  definitions: [
    { term: "Canonical project", meaning: "The current approved source of truth for story, screenplay, visuals, review, production, rights and provenance." },
    { term: "Story resolution", meaning: "The scale used to examine the story, such as Act, Block, Scene, mini-block, beat or shot." },
    { term: "Proposal", meaning: "A reviewable interpretation or change that has not yet become canon." },
  ],
  example: {
    title: "One change across several layers",
    text: "A Block's ending choice changes. The writer updates the Block consequence, checks the next Scene objective, revises the mini-block exit state, adjusts the screenplay action, reviews the storyboard turn and records the accepted revision—all inside the same project.",
  },
  checklist: [
    "The current question is being answered at the right story resolution.",
    "The change links back to approved story evidence.",
    "Suggestions and canon remain visibly separate.",
    "Rights and source records remain connected.",
    "A smaller unit still serves the complete audience experience.",
  ],
  mistakes: [
    "Treating every story as an exact 120-minute formula.",
    "Creating separate planning, screenplay and visual versions with no source of truth.",
    "Assuming public visibility grants contribution or reuse rights.",
    "Describing optional AI or GitHub as required for writing.",
    "Promising that visualization automatically produces or monetizes a film.",
  ],
  exercise: "Choose one current story question. Name the whole-story promise it affects, the Block or Scene where it becomes active, the mini-block or beat where it turns and the screenplay or visual evidence that would prove the decision.",
  apply: "Block plan",
  tags: [
    "About PlotPickle",
    "OpenStory",
    "OpenStory Studio",
    "Afterglow",
    "Architect",
    "Plus",
    "Visualizer",
    "24 Blocks common language",
    "page to production",
    "canonical project",
    "local first",
    "writer control",
    "no AI",
  ],
};

export function whyPlotPickleSearchText() {
  return [whyPlotPickleWorksInLayers.title, whyPlotPickleWorksInLayers.overview, whyPlotPickleWorksInLayers.tags.join(" "), plotPicklePrinciples.map((item) => `${item.title} ${item.text}`).join(" "), plotPickleTimeline.map((item) => `${item.title} ${item.text}`).join(" "), pageToProductionStages.join(" "), "Bryan Harris A I Human Manifesto Your Actions Define You GPT web3 NFT token DAO CrewAI historical retired archived revised retained"].join(" ").toLowerCase();
}
