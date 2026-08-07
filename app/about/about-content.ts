export const plotPickleTimeline = [
  { stage: "Stage 1", title: "Afterglow on the page", text: "Bryan Harris wrote the screenplay that became Afterglow in 2017, alongside beats, outlines, pitch materials and later visual experiments." },
  { stage: "Stage 2", title: "24 Blocks as a shared story language", text: "The screenplay was divided into manageable dramatic movements so structure, character, dialogue, visuals and optional AI could refer to the same story positions." },
  { stage: "Stage 3", title: "OpenStory Studio experiments", text: "GitHub learning resources, public sharing, mood boards, prompt collections and separate Architect, Plus and Visualizer GPTs explored ways to make screenplay development more visible." },
  { stage: "Stage 4", title: "One connected visual storyworld", text: "The separate experiments converged into PlotPickle: one local application where planning, screenplay material, Whole Film, Graphic Novel, Storyboard, Production and review use the same canonical project." },
  { stage: "Stage 5", title: "The interactive Storyworld Map", text: "PlotPickle unified the PPF relationship index, shared asset identity and the existing Whole Film wall into one interactive map of story logic, characters, locations, hooks, turns, arcs and continuity." },
] as const;

export const plotPicklePrinciples = [
  { title: "The writer's decisions define the work", text: "Tools may organize, diagnose, compare or propose. The writer or authorized project owner decides what becomes part of the story." },
  { title: "One story, one canonical project", text: "Planning, screenplay, visuals, review, production and provenance should not become disconnected versions of the same movie." },
  { title: "Make story logic visible", text: "Acts, sequences, Blocks, scenes, mini-blocks, hooks, turning points, arcs and shots provide useful views of causality and audience experience, not creative cages." },
  { title: "Local-first by default", text: "A writer can create, import, revise, visualize and export on their own computer without a PlotPickle account or required cloud service." },
  { title: "AI is optional and bounded", text: "PlotPickle supports no-AI work, manual prompt export, local models and connected providers. AI receives deliberate context and changes nothing without approval." },
  { title: "Suggestions are not canon", text: "Imported interpretations, diagnostics, collaborator proposals and AI outputs remain reviewable until an authorized person accepts them." },
  { title: "Collaboration is deliberate", text: "Private feedback, co-writing, production collaboration, public sharing and open licensing are different choices. GitHub is optional infrastructure." },
  { title: "Rights and provenance travel with the project", text: "Sources, collaborators, licences, generated assets, retained AI assistance and revision decisions remain visible and portable." },
  { title: "Story craft before software controls", text: "PlotPickle explains the screenplay concept before teaching the corresponding field, button, engine or report." },
  { title: "Previsualize before full production", text: "Visual and production tools should test story intention, continuity and feasibility before major production spending. PlotPickle is not a studio production or finishing pipeline." },
  { title: "Extend before duplicating", text: "The Storyworld Map extends Whole Film, while Graphic Novel, Storyboard, Production Shots, Animatic, Pitch and Reports keep their existing responsibilities. Parallel engines are a last resort." },
  { title: "Extensible core, optional integrations", text: "AI providers, GitHub, Google, image and video renderers, music, voice and future services remain optional connections rather than enlarging the required core." },
] as const;

export const pageToProductionStages = [
  "Story Logic",
  "Canon and Characters",
  "24 Blocks",
  "96 Mini-Blocks",
  "Screenplay",
  "Storyworld Map",
  "Graphic Novel and Storyboard",
  "Production Shots",
  "Retained Visual Assets",
  "Animatic Preview",
  "Pitch and Reports",
] as const;

export const convergenceMap = [
  ["OpenStory Architect", "Story Setup, World, Locations, Visual Bible and Research & Canon"],
  ["OpenStory Plus", "Story Planner, Screenplay, Read & Learn, Character, Dialogue and Engines"],
  ["OpenStory Visualizer", "Graphic Novel, Storyboard, visual references, Production Shots and Animatic"],
  ["GPT prompt front ends", "Provider-independent AI Setup, Prompt Lab and bounded context packs"],
  ["GitHub screenplay repository", "Optional .ppf project library, backups and owner-controlled proposals"],
  ["Story Education Menu", "Read & Learn, core curriculum and specialized learning paths"],
  ["Afterglow public experiment", "Persistent reference project for verifying the connected visual storyworld workflow"],
  ["CrewAI coordinator", "Possible future plugin or SDK experiment, not required core architecture"],
  ["Real-time collaborative editing", "Out of scope; PlotPickle focuses on storyworld coordination and reviewable proposals"],
] as const;

export const currentProductFacts = [
  "PlotPickle is a downloadable AI-native visual writing and creative direction studio for shaping, seeing, testing and presenting a movie before full production.",
  "PPF is the portable creative source of truth connecting story logic, canon, characters, screenplay material, visuals, shots, sound, approvals and provenance.",
  "The interactive Storyworld Map, Graphic Novel, Storyboard, Production Shots, Animatic, Pitch and Reports are available now as one connected visual core.",
  "The 24 Blocks are human-readable first and AI-compatible, not AI-dependent.",
  "Project owners can use connected AI, local models, manual prompts, future external renderers or no AI at all.",
  "User-created stories remain under the rights their creators hold unless they deliberately share or license them.",
  "Collaboration is proposal-based and owner-controlled rather than open public editing.",
  "Afterglow: Reflections of Sentience is the persistent reference project for verifying the complete visual storyworld workflow.",
  "PlotPickle does not aim to replace Final Draft or a studio production and finishing pipeline.",
] as const;
