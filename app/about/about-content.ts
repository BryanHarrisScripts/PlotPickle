export const plotPickleTimeline = [
  { stage: "Stage 1", title: "Afterglow on the page", text: "Bryan Harris wrote the screenplay that became Afterglow in 2017, alongside beats, outlines, pitch materials and later visual experiments." },
  { stage: "Stage 2", title: "24 Blocks as a shared story language", text: "The screenplay was divided into manageable dramatic movements so structure, character, dialogue, visuals and optional AI could refer to the same story positions." },
  { stage: "Stage 3", title: "OpenStory Studio experiments", text: "GitHub learning resources, public sharing, mood boards, prompt collections and separate Architect, Plus and Visualizer GPTs explored ways to make screenplay development more visible." },
  { stage: "Stage 4", title: "One connected local application", text: "The separate experiments converged into PlotPickle: Story Planner, Screenplay, Visual Board, Engines, Specialist Labs, Production and Read & Learn using one canonical project." },
  { stage: "Stage 5", title: "Writer-controlled collaboration and extensibility", text: "Portable projects, revision history, rights records, owner-controlled proposals, provider-independent AI, plugins and the public SDK extend the application without making cloud services mandatory." },
] as const;

export const plotPicklePrinciples = [
  { title: "The writer's decisions define the work", text: "Tools may organize, diagnose, compare or propose. The writer or authorized project owner decides what becomes part of the story." },
  { title: "One story, one canonical project", text: "Planning, screenplay, visuals, review, production and provenance should not become disconnected versions of the same movie." },
  { title: "Work small while seeing the whole", text: "Acts, sequences, Blocks, scenes, mini-blocks, beats and shots provide useful resolutions. They are navigation and diagnostic tools, not creative cages." },
  { title: "Local-first by default", text: "A writer can create, import, revise, visualize and export on their own computer without a PlotPickle account or required cloud service." },
  { title: "AI is optional and bounded", text: "PlotPickle supports no-AI work, manual prompt export, local models and connected providers. AI receives deliberate context and changes nothing without approval." },
  { title: "Suggestions are not canon", text: "Imported interpretations, diagnostics, collaborator proposals and AI outputs remain reviewable until an authorized person accepts them." },
  { title: "Collaboration is deliberate", text: "Private feedback, co-writing, production collaboration, public sharing and open licensing are different choices. GitHub is optional infrastructure." },
  { title: "Rights and provenance travel with the project", text: "Sources, collaborators, licences, generated assets, retained AI assistance and revision decisions remain visible and portable." },
  { title: "Story craft before software controls", text: "PlotPickle explains the screenplay concept before teaching the corresponding field, button, engine or report." },
  { title: "Page to production remains connected", text: "Visual and production tools clarify story intention, continuity and feasibility. They do not promise automatic filmmaking or commercial success." },
  { title: "Extensible core, optional integrations", text: "AI providers, image systems, music, voice, PDF, Final Draft and future services connect through plugins and the SDK rather than enlarging the required core." },
] as const;

export const pageToProductionStages = [
  "Idea",
  "Story Setup",
  "Character and World",
  "24 Blocks",
  "Flexible Scenes",
  "96 Mini-Blocks",
  "Treatment",
  "Screenplay",
  "Review",
  "Visual Board",
  "Shots and Production",
  "Pitch and Export",
] as const;

export const convergenceMap = [
  ["OpenStory Architect", "Story Setup, World, Locations, Visual Bible and Research & Canon"],
  ["OpenStory Plus", "Story Planner, Screenplay, Read & Learn, Character, Dialogue and Engines"],
  ["OpenStory Visualizer", "Visual Board, reference images, storyboard frames, shots and Production"],
  ["GPT prompt front ends", "Provider-independent AI Setup, Prompt Lab and bounded context packs"],
  ["GitHub screenplay repository", "Optional .ppf project library, backups and owner-controlled proposals"],
  ["Story Education Menu", "Read & Learn, core curriculum and specialized learning paths"],
  ["Afterglow public experiment", "Built-in example, source history and legacy/current visual comparison"],
  ["CrewAI coordinator", "Possible future plugin or SDK experiment, not required core architecture"],
  ["Real-time collaborative editing", "Deferred; current collaboration uses local work and reviewable proposals"],
] as const;

export const currentProductFacts = [
  "PlotPickle is a downloadable local-server story-development and screenplay application.",
  "PlotPickle uses one portable canonical project in schema 1.7 to connect foundations, structure, treatment, screenplay, visuals, review, production and provenance.",
  "The 24 Blocks are human-readable first and AI-compatible, not AI-dependent.",
  "Writers can use connected AI, local models, manual prompts or no AI at all.",
  "User-created stories remain under the rights their creators hold unless they deliberately share or license them.",
  "Collaboration is proposal-based and owner-controlled rather than open public editing.",
] as const;
