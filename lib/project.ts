import {
  createDefaultScenes,
  createDefaultStructure,
  normalizeScenes,
  normalizeStructure,
  type ProjectStructure,
  type StoryScene,
} from "./structure";

export type { ClockRow, MiniBlock, PacingProfile, ProjectStructure, StoryScene, StorySequence } from "./structure";

export type Relationship = {
  characterId: string;
  label: string;
  description: string;
};

export type CharacterVoiceprint = {
  originEnvironment: string;
  socialContext: string;
  educationExpertise: string;
  worldviewBoundaries: string;
  rhythmSentenceShape: string;
  vocabularyMetaphors: string;
  verbalFingerprints: string;
  emotionalAccess: string;
  statusShift: string;
  persuasionStrategy: string;
};

export type Character = {
  id: string;
  name: string;
  role: string;
  pronouns: string;
  description: string;
  want: string;
  need: string;
  ghost: string;
  fatalFlaw: string;
  strengths: string;
  arc: string;
  voice: string;
  originEnvironment?: string;
  socialContext?: string;
  educationExpertise?: string;
  worldviewBoundaries?: string;
  rhythmSentenceShape?: string;
  vocabularyMetaphors?: string;
  verbalFingerprints?: string;
  emotionalAccess?: string;
  statusShift?: string;
  persuasionStrategy?: string;
  image: string;
  relationships: Relationship[];
};

export type Location = {
  id: string;
  name: string;
  description: string;
  image: string;
};

export type VisualFrame = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  prompt: string;
  shot: string;
  continuity: string;
};

export type StoryBlock = {
  id: string;
  number: number;
  act: number;
  sequenceNumber: number;
  targetMinutes: number;
  title: string;
  purpose: string;
  summary: string;
  characterIds: string[];
  locationIds: string[];
  goal: string;
  conflict: string;
  choice: string;
  action: string;
  consequence: string;
  emotionalTurn: string;
  audienceExpectation: string;
  pickleTurn: string;
  setup: string;
  payoff: string;
  scriptExcerpt: string;
  storyboardDirection: string;
  notes: string;
  scenes: StoryScene[];
  visuals: VisualFrame[];
};

export type ProjectDevelopment = {
  storySetup: {
    audience: string;
    contentRating: string;
    language: string;
    scope: string;
    collaborators: string;
  };
  pitch: {
    oneSentence: string;
    shortPitch: string;
    audiencePromise: string;
    emotionalExperience: string;
    comparableTitles: string;
    visualVision: string;
  };
  ghost: {
    centralWound: string;
    origin: string;
    lie: string;
    trigger: string;
    presentPattern: string;
    truth: string;
  };
  catalyst: {
    event: string;
    timing: string;
    immediateImpact: string;
    choiceForced: string;
    resistance: string;
    doorway: string;
  };
  foundations: {
    protagonist: string;
    objective: string;
    opposition: string;
    urgency: string;
    storyEngine: string;
    transformation: string;
    endingProof: string;
  };
  pickle: {
    centralTension: string;
    audienceQuestion: string;
    storyPromise: string;
    expectedDestination: string;
    unpredictableRoute: string;
    liveAnswerA: string;
    liveAnswerB: string;
    escalationPattern: string;
    finalAnswer: string;
    signatureMove: string;
  };
  dialogue: {
    principles: string;
    voiceContrast: string;
    subtext: string;
    expositionRules: string;
    recurringLanguage: string;
    notes: string;
    worldVernacular?: string;
    monologueRules?: string;
    subtextSeeds?: string;
    fieldworkNotes?: string;
  };
  notes: {
    general: string;
    research: string;
    openQuestions: string;
    continuity: string;
    revisions: string;
    sources: string;
  };
};

export type PlotPickleProject = {
  schemaVersion: "1.4.0";
  id: string;
  metadata: {
    title: string;
    subtitle: string;
    format: string;
    targetMinutes: number;
    genre: string;
    tone: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  story: {
    premise: string;
    logline: string;
    theme: string;
    antiTheme: string;
    dramaticQuestion: string;
    hook: string;
    catalyst: string;
    stakes: string;
    ending: string;
    notes: string;
  };
  world: {
    ordinaryWorld: string;
    newWorld: string;
    period: string;
    history: string;
    cultures: string;
    rules: string;
    technology: string;
    visualLanguage: string;
    locations: Location[];
  };
  development: ProjectDevelopment;
  structure: ProjectStructure;
  characters: Character[];
  blocks: StoryBlock[];
};

export const beatTemplates = [
  ["Hook, Introduction & Catalyst", "Open with a compelling image, establish the protagonist's ordinary world, then disrupt it."],
  ["Problem, Stakes & Philosophy", "Define the problem caused by the catalyst, what can be lost, and the belief under pressure."],
  ["Anti-theme, Want & Choice", "Expose the opposing belief, clarify the protagonist's conscious want, and force a choice."],
  ["Initial Plan, Action & New Problem", "Turn the choice into a plan and action that creates a fresh complication."],
  ["Adaptation, Revised Plan & Raised Stakes", "Make the protagonist adapt while the cost of failure increases."],
  ["Choice, Action & Antagonist Hint", "Close Act One with commitment and a clearer glimpse of the opposing force."],
  ["New World & Exploration", "Enter the new situation and reveal its rules, opportunities, and dangers."],
  ["Action, Rising Tension & Problems", "Let the plan create movement, pressure, and additional obstacles."],
  ["Therefore, Choice & Adjusted Plan", "Connect consequence to a new decision and a more informed plan."],
  ["Raised Stakes, Deeper Question & Action", "Increase urgency and deepen the central dramatic question."],
  ["Revelation, Problem & Therefore", "Reveal new information that changes the meaning of the conflict."],
  ["Midpoint Choice & Action", "Force a defining choice, escalate the stakes, and change the direction of the story."],
  ["Consequences & Complications", "Make the protagonist live with earlier choices as the conflict tightens."],
  ["Therefore, Choice & Adjusted Plan", "Use the new complication to force another meaningful adaptation."],
  ["Major Crisis & All Is Lost", "Collapse the current plan and make the cost feel unavoidable."],
  ["Dark Night & Revelation", "Create reflection, doubt, and the insight needed to move forward differently."],
  ["New Choice, Plan & Preparation", "Turn internal change into a concrete plan for the final confrontation."],
  ["Action, Climax & Immediate Result", "Execute the plan and make the confrontation test the protagonist's growth."],
  ["Fallout & New Normal", "Show the immediate consequences and the first shape of the changed world."],
  ["Remaining Questions & Actions", "Resolve lingering plot or relationship questions through action."],
  ["Final Choice & Last Attempt", "Demand a final choice that proves who the protagonist has become."],
  ["Final Action & Ultimate Stakes", "Resolve the remaining external or internal climax."],
  ["Resolution & New Equilibrium", "Settle the central conflicts and reveal the lasting outcome."],
  ["Reflection & Closing Image", "Complete the theme with an image that mirrors or contrasts the opening."],
] as const;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBlankVoiceprint(): CharacterVoiceprint {
  return {
    originEnvironment: "",
    socialContext: "",
    educationExpertise: "",
    worldviewBoundaries: "",
    rhythmSentenceShape: "",
    vocabularyMetaphors: "",
    verbalFingerprints: "",
    emotionalAccess: "",
    statusShift: "",
    persuasionStrategy: "",
  };
}

export function createBlankDevelopment(): ProjectDevelopment {
  return {
    storySetup: { audience: "", contentRating: "", language: "", scope: "", collaborators: "" },
    pitch: { oneSentence: "", shortPitch: "", audiencePromise: "", emotionalExperience: "", comparableTitles: "", visualVision: "" },
    ghost: { centralWound: "", origin: "", lie: "", trigger: "", presentPattern: "", truth: "" },
    catalyst: { event: "", timing: "", immediateImpact: "", choiceForced: "", resistance: "", doorway: "" },
    foundations: { protagonist: "", objective: "", opposition: "", urgency: "", storyEngine: "", transformation: "", endingProof: "" },
    pickle: {
      centralTension: "",
      audienceQuestion: "",
      storyPromise: "",
      expectedDestination: "",
      unpredictableRoute: "",
      liveAnswerA: "",
      liveAnswerB: "",
      escalationPattern: "",
      finalAnswer: "",
      signatureMove: "",
    },
    dialogue: {
      principles: "",
      voiceContrast: "",
      subtext: "",
      expositionRules: "",
      recurringLanguage: "",
      notes: "",
      worldVernacular: "",
      monologueRules: "",
      subtextSeeds: "",
      fieldworkNotes: "",
    },
    notes: { general: "", research: "", openQuestions: "", continuity: "", revisions: "", sources: "" },
  };
}

export function createBlankProject(): PlotPickleProject {
  const now = new Date().toISOString();
  const targetMinutes = 120;
  return {
    schemaVersion: "1.4.0",
    id: makeId("project"),
    metadata: {
      title: "Untitled Story",
      subtitle: "A 24 Blocks project",
      format: "Feature screenplay",
      targetMinutes,
      genre: "",
      tone: "",
      status: "Planning",
      createdAt: now,
      updatedAt: now,
    },
    story: {
      premise: "",
      logline: "",
      theme: "",
      antiTheme: "",
      dramaticQuestion: "",
      hook: "",
      catalyst: "",
      stakes: "",
      ending: "",
      notes: "",
    },
    world: {
      ordinaryWorld: "",
      newWorld: "",
      period: "",
      history: "",
      cultures: "",
      rules: "",
      technology: "",
      visualLanguage: "",
      locations: [],
    },
    development: createBlankDevelopment(),
    structure: createDefaultStructure(targetMinutes),
    characters: [],
    blocks: beatTemplates.map(([title, purpose], index) => ({
      id: `block-${String(index + 1).padStart(2, "0")}`,
      number: index + 1,
      act: Math.floor(index / 6) + 1,
      sequenceNumber: Math.floor(index / 2) + 1,
      targetMinutes: targetMinutes / 24,
      title,
      purpose,
      summary: "",
      characterIds: [],
      locationIds: [],
      goal: "",
      conflict: "",
      choice: "",
      action: "",
      consequence: "",
      emotionalTurn: "",
      audienceExpectation: "",
      pickleTurn: "",
      setup: "",
      payoff: "",
      scriptExcerpt: "",
      storyboardDirection: "",
      notes: "",
      scenes: createDefaultScenes(index + 1, targetMinutes),
      visuals: [],
    })),
  };
}

export function cloneProject(project: PlotPickleProject): PlotPickleProject {
  return JSON.parse(JSON.stringify(project)) as PlotPickleProject;
}

export function isPlotPickleProject(value: unknown): value is PlotPickleProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlotPickleProject>;
  return (
    candidate.schemaVersion === "1.4.0" &&
    typeof candidate.id === "string" &&
    !!candidate.metadata &&
    !!candidate.story &&
    !!candidate.world &&
    !!candidate.development &&
    !!candidate.structure &&
    Array.isArray(candidate.structure.sequences) &&
    candidate.structure.sequences.length === 12 &&
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.blocks) &&
    candidate.blocks.length === 24 &&
    candidate.blocks.every((block) => Array.isArray(block.scenes) && block.scenes.length === 2 && block.scenes.every((scene) => scene.miniBlocks.length === 2))
  );
}

export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown> & {
    schemaVersion?: string;
    id?: string;
    metadata?: PlotPickleProject["metadata"];
    story?: PlotPickleProject["story"];
    world?: PlotPickleProject["world"];
    development?: Partial<ProjectDevelopment>;
    structure?: Partial<ProjectStructure>;
    characters?: Character[];
    blocks?: Array<Partial<StoryBlock>>;
  };
  if (
    !["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0"].includes(candidate.schemaVersion ?? "") ||
    typeof candidate.id !== "string" ||
    !candidate.metadata ||
    !candidate.story ||
    !candidate.world ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.blocks) ||
    candidate.blocks.length !== 24
  ) return null;

  const targetMinutes = Math.max(1, Number(candidate.metadata.targetMinutes) || 120);
  const blank = createBlankProject();
  const defaults = createBlankDevelopment();
  const voiceprintDefaults = createBlankVoiceprint();
  const development = candidate.development ?? {};
  return {
    schemaVersion: "1.4.0",
    id: candidate.id,
    metadata: { ...candidate.metadata, targetMinutes },
    story: candidate.story,
    world: candidate.world,
    development: {
      storySetup: { ...defaults.storySetup, ...development.storySetup },
      pitch: { ...defaults.pitch, ...development.pitch },
      ghost: { ...defaults.ghost, ...development.ghost },
      catalyst: { ...defaults.catalyst, ...development.catalyst },
      foundations: { ...defaults.foundations, ...development.foundations },
      pickle: { ...defaults.pickle, ...development.pickle },
      dialogue: { ...defaults.dialogue, ...development.dialogue },
      notes: { ...defaults.notes, ...development.notes },
    },
    structure: normalizeStructure(candidate.structure, targetMinutes),
    characters: candidate.characters.map((character) => ({ ...voiceprintDefaults, ...character })),
    blocks: candidate.blocks.map((block, index) => ({
      ...blank.blocks[index],
      ...block,
      number: index + 1,
      act: Math.floor(index / 6) + 1,
      sequenceNumber: Math.floor(index / 2) + 1,
      targetMinutes: Number(block.targetMinutes) > 0 ? Number(block.targetMinutes) : targetMinutes / 24,
      storyboardDirection: block.storyboardDirection ?? "",
      audienceExpectation: block.audienceExpectation ?? "",
      pickleTurn: block.pickleTurn ?? "",
      scenes: normalizeScenes(block.scenes, index + 1, targetMinutes),
      visuals: Array.isArray(block.visuals) ? block.visuals : [],
    })),
  };
}

export function completionFor(project: PlotPickleProject) {
  const foundation = [
    project.story.premise,
    project.story.logline,
    project.story.theme,
    project.story.dramaticQuestion,
    project.story.catalyst,
    project.story.stakes,
    project.development.pickle.centralTension,
    project.development.pickle.audienceQuestion,
    project.development.pickle.signatureMove,
  ];
  const world = [project.world.ordinaryWorld, project.world.newWorld, project.world.rules];
  const characterScore = project.characters.filter(
    (character) => character.name && character.want && character.need && character.ghost,
  ).length;
  const blockScore = project.blocks.filter(
    (block) => block.summary && block.conflict && (block.action || block.choice),
  ).length;
  const structureScore = project.structure.sequences.filter(
    (sequence) => sequence.promise && sequence.turningPoint,
  ).length;
  const completed = foundation.filter(Boolean).length + world.filter(Boolean).length + Math.min(characterScore, 4) + blockScore + structureScore;
  const total = foundation.length + world.length + 4 + 24 + 12;
  return Math.round((completed / total) * 100);
}

export function addBlankCharacter(project: PlotPickleProject): PlotPickleProject {
  const character: Character = {
    id: makeId("character"),
    name: "New Character",
    role: "Supporting character",
    pronouns: "",
    description: "",
    want: "",
    need: "",
    ghost: "",
    fatalFlaw: "",
    strengths: "",
    arc: "",
    voice: "",
    ...createBlankVoiceprint(),
    image: "",
    relationships: [],
  };
  return { ...project, characters: [...project.characters, character] };
}

export function addBlankLocation(project: PlotPickleProject): PlotPickleProject {
  const location: Location = {
    id: makeId("location"),
    name: "New Location",
    description: "",
    image: "",
  };
  return { ...project, world: { ...project.world, locations: [...project.world.locations, location] } };
}

export function addBlankFrame(block: StoryBlock): StoryBlock {
  return {
    ...block,
    visuals: [
      ...block.visuals,
      {
        id: makeId("frame"),
        src: "",
        alt: "",
        caption: "New storyboard frame",
        prompt: "",
        shot: "",
        continuity: "",
      },
    ],
  };
}
