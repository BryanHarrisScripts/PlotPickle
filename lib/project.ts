import {
  createDefaultScenes,
  createDefaultStructure,
  normalizeScenes,
  normalizeStructure,
  type ProjectStructure,
  type StoryScene,
} from "./structure";
import {
  createEmptyProjectAssetRegistry,
  migrateLegacyAssetReferences,
  normalizeProjectAssetReference,
  normalizeProjectAssetRegistry,
  type ProjectAssetReference,
  type ProjectAssetRegistry,
} from "./project-assets";

export type { ClockRow, MiniBlock, PacingProfile, ProjectStructure, StoryScene, StorySequence } from "./structure";
export type {
  ProjectAsset,
  ProjectAssetApproval,
  ProjectAssetKind,
  ProjectAssetReference,
  ProjectAssetRegistry,
  ProjectAssetTarget,
  ProjectAssetTargetKind,
  ProjectAssetVariation,
} from "./project-assets";

export type ScreenplayFormat = "plain-text" | "fountain" | "final-draft";

export type ScreenplayAnalysisStatus = "none" | "suggested" | "reviewed";

export type ScreenplayDraftElementType =
  | "scene-heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "section"
  | "synopsis"
  | "shot"
  | "lyrics"
  | "dual-dialogue"
  | "centered"
  | "page-break"
  | "title-page"
  | "note"
  | "boneyard";

export type RevisionColour = "none" | "blue" | "pink" | "yellow" | "green" | "goldenrod" | "buff" | "salmon" | "cherry" | "tan" | "gray";

export type ProductionDraftSceneNumber = {
  sceneId: string;
  elementId: string;
  number: string;
  omitted: boolean;
};

export type ProductionDraftPageAssignment = {
  elementId: string;
  pageLabel: string;
  basePage: number;
  lockedAt: string;
};

export type ProductionDraftRevisionSet = {
  id: string;
  label: string;
  colour: Exclude<RevisionColour, "none">;
  date: string;
  marks: string;
  notes: string;
  authorizedBy: string;
  changedElementIds: string[];
  changedPageLabels: string[];
  createdAt: string;
};

export type ProductionDraftAnnotation = {
  id: string;
  targetType: "screenplay-element" | "scene" | "page";
  targetId: string;
  department: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionDraftApproval = {
  id: string;
  action: "converted" | "pagination-locked" | "revision-started" | "revision-closed" | "direct-edit";
  summary: string;
  authorizedBy: string;
  createdAt: string;
};

export type ProductionDraftState = {
  mode: "writer" | "production";
  convertedAt: string;
  writerBaselineRevisionId: string;
  paginationLocked: boolean;
  paginationLockedAt: string;
  sceneNumbers: ProductionDraftSceneNumber[];
  pageAssignments: ProductionDraftPageAssignment[];
  revisionSets: ProductionDraftRevisionSet[];
  activeRevisionSetId: string;
  annotations: ProductionDraftAnnotation[];
  approvalHistory: ProductionDraftApproval[];
};

export type ScreenplayDraftElement = {
  id: string;
  type: ScreenplayDraftElementType;
  text: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneNumber: number;
  sceneId?: string;
  threadIds: string[];
  omitted: boolean;
  locked: boolean;
  revisionColour: RevisionColour;
  sourceAttributionIds: string[];
  aiProvenanceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ScreenplayDocument = {
  fileName: string;
  format: ScreenplayFormat;
  sourceText: string;
  importedAt: string;
  analysisStatus: ScreenplayAnalysisStatus;
  analyzedAt: string;
  suggestedFields: string[];
  draftElements: ScreenplayDraftElement[];
  productionDraft: ProductionDraftState;
};

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

export type ArcCheckpointKind = "opening" | "catalyst" | "threshold" | "midpoint" | "crisis" | "climax" | "ending" | "custom";

export type CharacterArcCheckpoint = {
  id: string;
  kind: ArcCheckpointKind;
  blockNumber: number | null;
  sceneId: string;
  belief: string;
  strategy: string;
  pressure: string;
  choice: string;
  consequence: string;
  evidence: string;
};

export type CharacterArcMatrix = {
  startingState: string;
  consciousWant: string;
  underlyingNeed: string;
  protectiveLie: string;
  emergingTruth: string;
  midpointShift: string;
  crisisChoice: string;
  climaxChoice: string;
  endingState: string;
  relationshipImpact: string;
  checkpoints: CharacterArcCheckpoint[];
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
  arcMatrix: CharacterArcMatrix;
  image: string;
  relationships: Relationship[];
};

export type Location = {
  id: string;
  name: string;
  description: string;
  image: string;
};

export type VisualMediaVersion = {
  id: string;
  kind: "image" | "video";
  src: string;
  prompt: string;
  sourceImageSrc?: string;
  status: "candidate" | "approved" | "archived";
  createdAt: string;
};

export type VisualFrame = {
  id: string;
  miniBlockNumber: number;
  src: string;
  assetRef?: ProjectAssetReference;
  alt: string;
  caption: string;
  prompt: string;
  shot: string;
  continuity: string;
  versions?: VisualMediaVersion[];
  approvedImageVersionId?: string;
  approvedVideoVersionId?: string;
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

export type StoryThreadKind = "main" | "subplot" | "relationship" | "mystery" | "theme" | "world";
export type StoryThreadStatus = "planned" | "active" | "paused" | "resolved" | "abandoned";
export type StoryThreadMilestoneKind = "setup" | "development" | "turn" | "reveal" | "payoff" | "resolution";

export type StoryThreadMilestone = {
  id: string;
  sceneId: string;
  blockNumber: number;
  kind: StoryThreadMilestoneKind;
  summary: string;
  resolved: boolean;
};

export type StoryThread = {
  id: string;
  name: string;
  kind: StoryThreadKind;
  status: StoryThreadStatus;
  summary: string;
  question: string;
  characterIds: string[];
  sceneIds: string[];
  introducedBlockNumber: number | null;
  resolvedBlockNumber: number | null;
  milestones: StoryThreadMilestone[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RightsCollaborator = {
  id: string;
  name: string;
  role: string;
  contribution: string;
  ownershipShare: string;
  agreementReference: string;
  creditedAs: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceAttribution = {
  id: string;
  title: string;
  creator: string;
  sourceType: "research" | "quotation" | "adaptation" | "public-domain" | "licensed-material" | "other";
  sourceUrl: string;
  licence: string;
  permissionReference: string;
  notes: string;
  attachedTo: string[];
  createdAt: string;
};

export type AiProvenanceRecord = {
  id: string;
  provider: string;
  model: string;
  operation: "brainstorm" | "rewrite" | "analysis" | "dialogue" | "image" | "audio" | "video" | "other";
  promptSummary: string;
  outputSummary: string;
  humanContribution: string;
  humanDecision: string;
  retained: boolean;
  attachedTo: string[];
  createdAt: string;
};

export type RightsAndProvenance = {
  projectOwner: string;
  copyrightNotice: string;
  rightsStatement: string;
  defaultCreativeLicence: string;
  sourceWorkTitle: string;
  sourceWorkAuthor: string;
  adaptationStatus: "original" | "adaptation" | "commissioned" | "collaboration" | "unknown";
  collaborators: RightsCollaborator[];
  attributions: SourceAttribution[];
  aiProvenance: AiProvenanceRecord[];
};

export type ReviewAnchorKind = "project" | "story-field" | "block" | "scene" | "screenplay-element" | "character";
export type ReviewThreadStatus = "open" | "in-review" | "resolved" | "deferred";
export type ReviewPriority = "low" | "normal" | "high" | "critical";

export type ReviewAnchor = {
  kind: ReviewAnchorKind;
  targetId: string;
  label: string;
};

export type ReviewComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type ReviewThread = {
  id: string;
  title: string;
  anchor: ReviewAnchor;
  status: ReviewThreadStatus;
  priority: ReviewPriority;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

export type LoglineCandidate = {
  id: string;
  text: string;
  source: string;
  selected: boolean;
  createdAt: string;
};

export type ComicPitchDialogue = {
  id: string;
  characterId: string;
  characterName: string;
  text: string;
  sourceElementId: string;
};

export type ComicPitchPanelStatus = "pending" | "generating" | "complete" | "error";

export type ComicPitchPanel = {
  id: string;
  pageNumber: number;
  panelNumber: number;
  blockNumber: number;
  miniBlockNumber: number;
  title: string;
  narration: string;
  narrationSource: "canonical" | "derived";
  dialogue: ComicPitchDialogue[];
  characterIds: string[];
  locationIds: string[];
  shotDirection: string;
  prompt: string;
  imageSrc: string;
  assetRef?: ProjectAssetReference;
  revisedPrompt: string;
  status: ComicPitchPanelStatus;
  error: string;
  provider: string;
  model: string;
  generatedAt: string;
};

export type ComicPitchDeck = {
  version: 1;
  style: "black-and-white-sketch";
  status: "not-started" | "planned" | "generating" | "paused" | "complete" | "complete-with-errors";
  panels: ComicPitchPanel[];
  createdAt: string;
  updatedAt: string;
  lastGeneratedAt: string;
};

export type PitchPackage = {
  title: string;
  subtitle: string;
  tagline: string;
  logline: string;
  synopsis: string;
  creatorStatement: string;
  audience: string;
  comparableTitles: string;
  visualStatement: string;
  contactLine: string;
  selectedCharacterIds: string[];
  selectedLocationIds: string[];
  includeSections: string[];
  comicDeck?: ComicPitchDeck;
  updatedAt: string;
};

export type ReviewWorkspace = {
  threads: ReviewThread[];
  loglineCandidates: LoglineCandidate[];
  pitchPackage: PitchPackage;
};


export type ProductionShotStatus = "planned" | "approved" | "captured" | "omitted";

export type ProductionShot = {
  id: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneId: string;
  screenplayElementIds: string[];
  frameId: string;
  shotNumber: number;
  shotSize: string;
  angle: string;
  movement: string;
  lens: string;
  composition: string;
  purpose: string;
  continuity: string;
  keyframeSrc: string;
  assetRef?: ProjectAssetReference;
  keyframeAlt: string;
  status: ProductionShotStatus;
  durationSeconds: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SonicCueType = "score" | "source" | "atmosphere" | "sfx" | "silence";
export type SonicCueStatus = "temp" | "original" | "approved" | "licensed" | "clearance-needed";

export type SonicCue = {
  id: string;
  cueNumber: string;
  blockNumber: number;
  sceneId: string;
  type: SonicCueType;
  title: string;
  motif: string;
  cueIn: string;
  cueOut: string;
  purpose: string;
  status: SonicCueStatus;
  rights: string;
  durationSeconds: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBreakdown = {
  id: string;
  blockNumber: number;
  sceneId: string;
  castIds: string[];
  locationIds: string[];
  props: string;
  wardrobe: string;
  vehicles: string;
  effects: string;
  stunts: string;
  extras: string;
  makeup: string;
  sound: string;
  estimatedHours: number;
  readiness: "draft" | "reviewed" | "ready" | "blocked";
  notes: string;
  updatedAt: string;
};

export type ProductionScheduleDay = {
  id: string;
  dayNumber: number;
  date: string;
  sceneIds: string[];
  locationId: string;
  callTime: string;
  estimatedHours: number;
  status: "planned" | "confirmed" | "completed" | "moved";
  notes: string;
  updatedAt: string;
};

export type ProductionShootGroupDecisionStatus = "proposed" | "accepted" | "rejected" | "adjusted";

export type ProductionLocationPlan = {
  locationId: string;
  realLocation: string;
  lighting: string;
  weather: string;
  permits: string;
  travel: string;
  accessibility: string;
  availability: string;
  setupMinutes: number;
  estimatedShootHours: number;
  notes: string;
  updatedAt: string;
};

export type ProductionActorPlan = {
  characterId: string;
  actorName: string;
  availableDates: string[];
  unavailableDates: string[];
  wardrobe: string;
  makeup: string;
  rehearsalHours: number;
  preferredCallTime: string;
  estimatedWrapTime: string;
  notes: string;
  updatedAt: string;
};

export type ProductionShootGroupDecision = {
  id: string;
  sceneIds: string[];
  status: ProductionShootGroupDecisionStatus;
  notes: string;
  updatedAt: string;
};

export type ProductionTimelinePlan = {
  hoursPerDay: number;
  pagesPerDay: number;
  prepDays: number;
  pickupDays: number;
  contingencyPercent: number;
  updatedAt: string;
};

export type ProductionReporting = {
  locations: ProductionLocationPlan[];
  actors: ProductionActorPlan[];
  shootGroups: ProductionShootGroupDecision[];
  timeline: ProductionTimelinePlan;
};

export type DistributionMilestone = {
  id: string;
  title: string;
  targetDate: string;
  status: "planned" | "active" | "complete" | "deferred";
  notes: string;
};

export type DistributionMarketingPlan = {
  audience: string;
  positioning: string;
  releasePath: string;
  festivalTargets: string;
  distributorTargets: string;
  salesMaterials: string;
  trailerPlan: string;
  posterPlan: string;
  socialCampaign: string;
  pressAngles: string;
  milestones: DistributionMilestone[];
  updatedAt: string;
};

export type ProductionWorkspace = {
  shots: ProductionShot[];
  cues: SonicCue[];
  breakdowns: ProductionBreakdown[];
  schedule: ProductionScheduleDay[];
  reporting?: ProductionReporting;
  animatic: {
    defaultFrameSeconds: number;
    includeDialogue: boolean;
    showCueLabels: boolean;
    updatedAt: string;
  };
  distribution: DistributionMarketingPlan;
};

export type ProjectCollaborationProvider = "none" | "github";

export type ProjectCollaboration = {
  provider: ProjectCollaborationProvider;
  repositoryUrl: string;
  sourceRepositoryUrl: string;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  syncEnabled: boolean;
  lastPulledCommit: string;
  lastPushedCommit: string;
  connectedAt: string;
  updatedAt: string;
};

export type RevisionSnapshot = {
  id: string;
  label: string;
  notes: string;
  createdAt: string;
  schemaVersion: "1.7.0";
  contentHash: string;
  payload: Record<string, unknown>;
};

export type ConceptCanvasTargetKind = "project" | "character" | "location" | "block" | "mini-block" | "scene";

export type ConceptCanvas = {
  conceptText: string;
  emotionalPurpose: string;
  audienceExperience: string;
  desiredVisualImpact: string;
  mustKeepConstraints: string;
  openExploration: string;
  targetKind: ConceptCanvasTargetKind;
  targetId: string;
  targetLabel: string;
  updatedAt: string;
};

export type VisualReferencePurpose = "inspiration" | "identity" | "continuity" | "composition";
export type VisualReferenceRightsStatus = "unknown" | "owned" | "licensed" | "public-domain" | "permission-needed";

export type VisualReference = {
  id: string;
  title: string;
  sourceUrl: string;
  importFileName: string;
  sourceType: "link" | "manual-import" | "note";
  purpose: VisualReferencePurpose;
  rightsStatus: VisualReferenceRightsStatus;
  ownershipNotes: string;
  permittedUse: string;
  attribution: string;
  targetKind: ConceptCanvasTargetKind;
  targetId: string;
  targetLabel: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDevelopment = {
  conceptCanvas: ConceptCanvas;
  visualReferences: VisualReference[];
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
  schemaVersion: "1.7.0";
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
  screenplay: ScreenplayDocument;
  structure: ProjectStructure;
  characters: Character[];
  blocks: StoryBlock[];
  storyThreads: StoryThread[];
  rights: RightsAndProvenance;
  revisions: RevisionSnapshot[];
  review: ReviewWorkspace;
  production: ProductionWorkspace;
  assets: ProjectAssetRegistry;
  collaboration: ProjectCollaboration;
  extensions?: Record<string, unknown>;
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

export function createBlankArcMatrix(character: Partial<Character> = {}): CharacterArcMatrix {
  return {
    startingState: typeof character.description === "string" ? character.description : "",
    consciousWant: typeof character.want === "string" ? character.want : "",
    underlyingNeed: typeof character.need === "string" ? character.need : "",
    protectiveLie: typeof character.ghost === "string" ? character.ghost : "",
    emergingTruth: typeof character.arc === "string" ? character.arc : "",
    midpointShift: "",
    crisisChoice: "",
    climaxChoice: "",
    endingState: "",
    relationshipImpact: "",
    checkpoints: [],
  };
}

export function createBlankRightsAndProvenance(projectTitle = "Untitled Story"): RightsAndProvenance {
  const year = new Date().getFullYear();
  return {
    projectOwner: "",
    copyrightNotice: `Copyright ${year}. All rights reserved by the project owner.`,
    rightsStatement: `The writer retains the rights they hold in ${projectTitle} and its original creative material.`,
    defaultCreativeLicence: "All rights reserved",
    sourceWorkTitle: "",
    sourceWorkAuthor: "",
    adaptationStatus: "original",
    collaborators: [],
    attributions: [],
    aiProvenance: [],
  };
}

export function createBlankComicPitchDeck(now = new Date().toISOString()): ComicPitchDeck {
  return {
    version: 1,
    style: "black-and-white-sketch",
    status: "not-started",
    panels: [],
    createdAt: now,
    updatedAt: now,
    lastGeneratedAt: "",
  };
}

export function createBlankReviewWorkspace(projectTitle = "Untitled Story"): ReviewWorkspace {
  const now = new Date().toISOString();
  return {
    threads: [],
    loglineCandidates: [],
    pitchPackage: {
      title: projectTitle,
      subtitle: "",
      tagline: "",
      logline: "",
      synopsis: "",
      creatorStatement: "",
      audience: "",
      comparableTitles: "",
      visualStatement: "",
      contactLine: "",
      selectedCharacterIds: [],
      selectedLocationIds: [],
      includeSections: ["cover", "logline", "synopsis", "characters", "world", "visuals", "creator", "rights"],
      comicDeck: createBlankComicPitchDeck(now),
      updatedAt: now,
    },
  };
}


export function createBlankProductionReporting(now = new Date().toISOString()): ProductionReporting {
  return {
    locations: [],
    actors: [],
    shootGroups: [],
    timeline: {
      hoursPerDay: 10,
      pagesPerDay: 5,
      prepDays: 1,
      pickupDays: 1,
      contingencyPercent: 20,
      updatedAt: now,
    },
  };
}

export function createBlankProductionWorkspace(): ProductionWorkspace {
  const now = new Date().toISOString();
  return {
    shots: [],
    cues: [],
    breakdowns: [],
    schedule: [],
    reporting: createBlankProductionReporting(now),
    animatic: {
      defaultFrameSeconds: 4,
      includeDialogue: true,
      showCueLabels: true,
      updatedAt: now,
    },
    distribution: {
      audience: "",
      positioning: "",
      releasePath: "",
      festivalTargets: "",
      distributorTargets: "",
      salesMaterials: "",
      trailerPlan: "",
      posterPlan: "",
      socialCampaign: "",
      pressAngles: "",
      milestones: [],
      updatedAt: now,
    },
  };
}

export function createBlankCollaboration(): ProjectCollaboration {
  return {
    provider: "none",
    repositoryUrl: "",
    sourceRepositoryUrl: "",
    owner: "",
    repo: "",
    branch: "main",
    projectPath: "",
    syncEnabled: false,
    lastPulledCommit: "",
    lastPushedCommit: "",
    connectedAt: "",
    updatedAt: new Date().toISOString(),
  };
}

export function createBlankDevelopment(): ProjectDevelopment {
  return {
    conceptCanvas: {
      conceptText: "",
      emotionalPurpose: "",
      audienceExperience: "",
      desiredVisualImpact: "",
      mustKeepConstraints: "",
      openExploration: "",
      targetKind: "project",
      targetId: "project",
      targetLabel: "Whole project",
      updatedAt: "",
    },
    visualReferences: [],
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

const conceptCanvasTargetKinds = new Set<ConceptCanvasTargetKind>(["project", "character", "location", "block", "mini-block", "scene"]);
const visualReferencePurposes = new Set<VisualReferencePurpose>(["inspiration", "identity", "continuity", "composition"]);
const visualReferenceRightsStatuses = new Set<VisualReferenceRightsStatus>(["unknown", "owned", "licensed", "public-domain", "permission-needed"]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeReferenceUrl(value: unknown) {
  const source = stringValue(value).trim();
  if (!source || /^(?:file|[a-z]):/i.test(source) || /^[/\\]/.test(source)) return "";
  try {
    const url = new URL(source);
    if (url.username || url.password) return "";
    return source;
  } catch {
    return source.includes("\\") ? "" : source;
  }
}

function safeImportFileName(value: unknown) {
  const source = stringValue(value).trim();
  if (!source || source.includes("/") || source.includes("\\") || /^file:/i.test(source)) return "";
  return source;
}

function normalizeConceptCanvas(value: unknown, defaults: ConceptCanvas): ConceptCanvas {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const canvas = value as Partial<Record<keyof ConceptCanvas, unknown>>;
  const targetKind = typeof canvas.targetKind === "string" && conceptCanvasTargetKinds.has(canvas.targetKind as ConceptCanvasTargetKind)
    ? canvas.targetKind as ConceptCanvasTargetKind
    : defaults.targetKind;
  return {
    conceptText: stringValue(canvas.conceptText),
    emotionalPurpose: stringValue(canvas.emotionalPurpose),
    audienceExperience: stringValue(canvas.audienceExperience),
    desiredVisualImpact: stringValue(canvas.desiredVisualImpact),
    mustKeepConstraints: stringValue(canvas.mustKeepConstraints),
    openExploration: stringValue(canvas.openExploration),
    targetKind,
    targetId: stringValue(canvas.targetId) || defaults.targetId,
    targetLabel: stringValue(canvas.targetLabel) || defaults.targetLabel,
    updatedAt: stringValue(canvas.updatedAt),
  };
}

function normalizeVisualReference(value: unknown): VisualReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reference = value as Partial<Record<keyof VisualReference, unknown>>;
  const purpose = typeof reference.purpose === "string" && visualReferencePurposes.has(reference.purpose as VisualReferencePurpose)
    ? reference.purpose as VisualReferencePurpose
    : "inspiration";
  const rightsStatus = typeof reference.rightsStatus === "string" && visualReferenceRightsStatuses.has(reference.rightsStatus as VisualReferenceRightsStatus)
    ? reference.rightsStatus as VisualReferenceRightsStatus
    : "unknown";
  const targetKind = typeof reference.targetKind === "string" && conceptCanvasTargetKinds.has(reference.targetKind as ConceptCanvasTargetKind)
    ? reference.targetKind as ConceptCanvasTargetKind
    : "project";
  return {
    id: stringValue(reference.id) || "reference-imported",
    title: stringValue(reference.title),
    sourceUrl: safeReferenceUrl(reference.sourceUrl),
    importFileName: safeImportFileName(reference.importFileName),
    sourceType: reference.sourceType === "manual-import" || reference.sourceType === "note" ? reference.sourceType : "link",
    purpose,
    rightsStatus,
    ownershipNotes: stringValue(reference.ownershipNotes),
    permittedUse: stringValue(reference.permittedUse),
    attribution: stringValue(reference.attribution),
    targetKind,
    targetId: stringValue(reference.targetId) || "project",
    targetLabel: stringValue(reference.targetLabel) || "Whole project",
    notes: stringValue(reference.notes),
    createdAt: stringValue(reference.createdAt),
    updatedAt: stringValue(reference.updatedAt),
  };
}

export function createBlankScreenplay(): ScreenplayDocument {
  return {
    fileName: "",
    format: "plain-text",
    sourceText: "",
    importedAt: "",
    analysisStatus: "none",
    analyzedAt: "",
    suggestedFields: [],
    draftElements: [],
    productionDraft: createBlankProductionDraftState(),
  };
}

export function createBlankProductionDraftState(): ProductionDraftState {
  return {
    mode: "writer",
    convertedAt: "",
    writerBaselineRevisionId: "",
    paginationLocked: false,
    paginationLockedAt: "",
    sceneNumbers: [],
    pageAssignments: [],
    revisionSets: [],
    activeRevisionSetId: "",
    annotations: [],
    approvalHistory: [],
  };
}

export function createStoryboardFrame(blockNumber: number, miniBlockNumber: number, suffix = "primary"): VisualFrame {
  const safeMiniBlockNumber = Math.min(4, Math.max(1, Number(miniBlockNumber) || 1));
  return {
    id: `block-${String(blockNumber).padStart(2, "0")}-mini-${safeMiniBlockNumber}-${suffix}`,
    miniBlockNumber: safeMiniBlockNumber,
    src: "",
    alt: "",
    caption: "",
    prompt: "",
    shot: "",
    continuity: "",
    versions: [],
    approvedImageVersionId: "",
    approvedVideoVersionId: "",
  };
}

export function createDefaultStoryboardFrames(blockNumber: number): VisualFrame[] {
  return [1, 2, 3, 4].map((miniBlockNumber) => createStoryboardFrame(blockNumber, miniBlockNumber));
}

function normalizeStoryboardFrames(value: unknown, blockNumber: number): VisualFrame[] {
  const incoming = Array.isArray(value) ? value : [];
  const normalized = incoming.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const frame = item as Partial<VisualFrame>;
    const miniBlockNumber = Math.min(4, Math.max(1, Number(frame.miniBlockNumber) || Math.min(index + 1, 4)));
    return [{
      id: typeof frame.id === "string" && frame.id ? frame.id : `block-${String(blockNumber).padStart(2, "0")}-mini-${miniBlockNumber}-legacy-${index + 1}`,
      miniBlockNumber,
      src: typeof frame.src === "string" ? frame.src : "",
      assetRef: normalizeProjectAssetReference(frame.assetRef),
      alt: typeof frame.alt === "string" ? frame.alt : "",
      caption: typeof frame.caption === "string" ? frame.caption : "",
      prompt: typeof frame.prompt === "string" ? frame.prompt : "",
      shot: typeof frame.shot === "string" ? frame.shot : "",
      continuity: typeof frame.continuity === "string" ? frame.continuity : "",
      versions: Array.isArray(frame.versions) ? frame.versions.flatMap((item, versionIndex) => {
        if (!item || typeof item !== "object") return [];
        const version = item as Partial<VisualMediaVersion>;
        const kind = version.kind === "video" ? "video" : "image";
        const src = typeof version.src === "string" ? version.src : "";
        if (!src) return [];
        return [{
          id: typeof version.id === "string" && version.id ? version.id : `${frame.id || `frame-${index + 1}`}-${kind}-${versionIndex + 1}`,
          kind,
          src,
          prompt: typeof version.prompt === "string" ? version.prompt : "",
          sourceImageSrc: typeof version.sourceImageSrc === "string" ? version.sourceImageSrc : undefined,
          status: version.status === "approved" || version.status === "archived" ? version.status : "candidate",
          createdAt: typeof version.createdAt === "string" ? version.createdAt : "",
        }];
      }) : [],
      approvedImageVersionId: typeof frame.approvedImageVersionId === "string" ? frame.approvedImageVersionId : "",
      approvedVideoVersionId: typeof frame.approvedVideoVersionId === "string" ? frame.approvedVideoVersionId : "",
    }];
  });
  const missing = [1, 2, 3, 4]
    .filter((miniBlockNumber) => !normalized.some((frame) => frame.miniBlockNumber === miniBlockNumber))
    .map((miniBlockNumber) => createStoryboardFrame(blockNumber, miniBlockNumber));
  return [...normalized, ...missing].sort((left, right) => left.miniBlockNumber - right.miniBlockNumber);
}

export function createBlankProject(): PlotPickleProject {
  const now = new Date().toISOString();
  const targetMinutes = 120;
  return {
    schemaVersion: "1.7.0",
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
    screenplay: createBlankScreenplay(),
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
      visuals: createDefaultStoryboardFrames(index + 1),
    })),
    storyThreads: [],
    rights: createBlankRightsAndProvenance("Untitled Story"),
    revisions: [],
    review: createBlankReviewWorkspace("Untitled Story"),
    production: createBlankProductionWorkspace(),
    assets: createEmptyProjectAssetRegistry(),
    collaboration: createBlankCollaboration(),
    extensions: {},
  };
}

export function cloneProject(project: PlotPickleProject): PlotPickleProject {
  return JSON.parse(JSON.stringify(project)) as PlotPickleProject;
}

export function isPlotPickleProject(value: unknown): value is PlotPickleProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlotPickleProject>;
  return (
    candidate.schemaVersion === "1.7.0" &&
    typeof candidate.id === "string" &&
    !!candidate.metadata &&
    !!candidate.story &&
    !!candidate.world &&
    !!candidate.development &&
    !!candidate.screenplay &&
    !!candidate.structure &&
    Array.isArray(candidate.structure.sequences) &&
    candidate.structure.sequences.length === 12 &&
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.blocks) &&
    candidate.blocks.length === 24 &&
    Array.isArray(candidate.storyThreads) &&
    Boolean(candidate.rights) &&
    Array.isArray(candidate.revisions) &&
    Boolean(candidate.review) &&
    Boolean(candidate.production) &&
    Boolean(candidate.collaboration) &&
    candidate.blocks.every((block) => {
      if (!Array.isArray(block.scenes) || block.scenes.length < 1) return false;
      const miniNumbers = block.scenes.flatMap((scene) => Array.isArray(scene.miniBlocks)
        ? scene.miniBlocks.map((mini) => mini.number)
        : []);
      return miniNumbers.length === 4
        && new Set(miniNumbers).size === 4
        && [1, 2, 3, 4].every((number) => miniNumbers.includes(number))
        && block.scenes.every((scene) => Array.isArray(scene.miniBlocks) && scene.miniBlocks.length <= 4);
    })
  );
}

export function normalizeScreenplay(value: unknown): ScreenplayDocument {
  if (!value || typeof value !== "object") return createBlankScreenplay();
  const candidate = value as Partial<ScreenplayDocument>;
  const formats: ScreenplayFormat[] = ["plain-text", "fountain", "final-draft"];
  const statuses: ScreenplayAnalysisStatus[] = ["none", "suggested", "reviewed"];
  const productionDefaults = createBlankProductionDraftState();
  const productionCandidate = candidate.productionDraft && typeof candidate.productionDraft === "object"
    ? candidate.productionDraft
    : productionDefaults;
  const revisionColours: Array<Exclude<RevisionColour, "none">> = ["blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"];
  const approvalActions: ProductionDraftApproval["action"][] = ["converted", "pagination-locked", "revision-started", "revision-closed", "direct-edit"];
  const annotationTargets: ProductionDraftAnnotation["targetType"][] = ["screenplay-element", "scene", "page"];
  return {
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : "",
    format: formats.includes(candidate.format as ScreenplayFormat) ? candidate.format as ScreenplayFormat : "plain-text",
    sourceText: typeof candidate.sourceText === "string" ? candidate.sourceText : "",
    importedAt: typeof candidate.importedAt === "string" ? candidate.importedAt : "",
    analysisStatus: statuses.includes(candidate.analysisStatus as ScreenplayAnalysisStatus)
      ? candidate.analysisStatus as ScreenplayAnalysisStatus
      : "none",
    analyzedAt: typeof candidate.analyzedAt === "string" ? candidate.analyzedAt : "",
    suggestedFields: Array.isArray(candidate.suggestedFields)
      ? candidate.suggestedFields.filter((item): item is string => typeof item === "string")
      : [],
    draftElements: Array.isArray(candidate.draftElements)
      ? candidate.draftElements.flatMap((item, index) => {
          if (!item || typeof item !== "object") return [];
          const draft = item as Partial<ScreenplayDraftElement>;
          const types: ScreenplayDraftElementType[] = ["scene-heading", "action", "character", "parenthetical", "dialogue", "transition", "section", "synopsis", "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard"];
          if (!types.includes(draft.type as ScreenplayDraftElementType)) return [];
          const now = new Date().toISOString();
          return [{
            id: typeof draft.id === "string" && draft.id ? draft.id : `screenplay-draft-${index + 1}`,
            type: draft.type as ScreenplayDraftElementType,
            text: typeof draft.text === "string" ? draft.text : "",
            blockNumber: Math.min(24, Math.max(1, Number(draft.blockNumber) || 1)),
            miniBlockNumber: Math.min(4, Math.max(1, Number(draft.miniBlockNumber) || 1)),
            sceneNumber: Math.max(1, Number(draft.sceneNumber) || 1),
            sceneId: typeof draft.sceneId === "string" ? draft.sceneId : "",
            threadIds: Array.isArray(draft.threadIds) ? draft.threadIds.filter((item): item is string => typeof item === "string") : [],
            omitted: Boolean(draft.omitted),
            locked: Boolean(draft.locked),
            revisionColour: (["none", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"] as RevisionColour[]).includes(draft.revisionColour as RevisionColour) ? draft.revisionColour as RevisionColour : "none",
            sourceAttributionIds: Array.isArray(draft.sourceAttributionIds) ? draft.sourceAttributionIds.filter((item): item is string => typeof item === "string") : [],
            aiProvenanceIds: Array.isArray(draft.aiProvenanceIds) ? draft.aiProvenanceIds.filter((item): item is string => typeof item === "string") : [],
            createdAt: typeof draft.createdAt === "string" ? draft.createdAt : now,
            updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : now,
          }];
        })
      : [],
    productionDraft: {
      mode: productionCandidate.mode === "production" ? "production" : "writer",
      convertedAt: typeof productionCandidate.convertedAt === "string" ? productionCandidate.convertedAt : "",
      writerBaselineRevisionId: typeof productionCandidate.writerBaselineRevisionId === "string" ? productionCandidate.writerBaselineRevisionId : "",
      paginationLocked: Boolean(productionCandidate.paginationLocked),
      paginationLockedAt: typeof productionCandidate.paginationLockedAt === "string" ? productionCandidate.paginationLockedAt : "",
      sceneNumbers: Array.isArray(productionCandidate.sceneNumbers) ? productionCandidate.sceneNumbers.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const scene = item as Partial<ProductionDraftSceneNumber>;
        return [{
          sceneId: typeof scene.sceneId === "string" ? scene.sceneId : "",
          elementId: typeof scene.elementId === "string" ? scene.elementId : "",
          number: typeof scene.number === "string" && scene.number ? scene.number : "1",
          omitted: Boolean(scene.omitted),
        }];
      }) : [],
      pageAssignments: Array.isArray(productionCandidate.pageAssignments) ? productionCandidate.pageAssignments.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const page = item as Partial<ProductionDraftPageAssignment>;
        return [{
          elementId: typeof page.elementId === "string" ? page.elementId : "",
          pageLabel: typeof page.pageLabel === "string" && page.pageLabel ? page.pageLabel : "1",
          basePage: Math.max(1, Number(page.basePage) || 1),
          lockedAt: typeof page.lockedAt === "string" ? page.lockedAt : "",
        }];
      }) : [],
      revisionSets: Array.isArray(productionCandidate.revisionSets) ? productionCandidate.revisionSets.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const revision = item as Partial<ProductionDraftRevisionSet>;
        return [{
          id: typeof revision.id === "string" && revision.id ? revision.id : `production-revision-${index + 1}`,
          label: typeof revision.label === "string" ? revision.label : `Revision ${index + 1}`,
          colour: revisionColours.includes(revision.colour as Exclude<RevisionColour, "none">) ? revision.colour as Exclude<RevisionColour, "none"> : "blue",
          date: typeof revision.date === "string" ? revision.date : "",
          marks: typeof revision.marks === "string" ? revision.marks : "",
          notes: typeof revision.notes === "string" ? revision.notes : "",
          authorizedBy: typeof revision.authorizedBy === "string" ? revision.authorizedBy : "",
          changedElementIds: stringArray(revision.changedElementIds),
          changedPageLabels: stringArray(revision.changedPageLabels),
          createdAt: typeof revision.createdAt === "string" ? revision.createdAt : "",
        }];
      }) : [],
      activeRevisionSetId: typeof productionCandidate.activeRevisionSetId === "string" ? productionCandidate.activeRevisionSetId : "",
      annotations: Array.isArray(productionCandidate.annotations) ? productionCandidate.annotations.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const annotation = item as Partial<ProductionDraftAnnotation>;
        const now = new Date().toISOString();
        return [{
          id: typeof annotation.id === "string" && annotation.id ? annotation.id : `production-annotation-${index + 1}`,
          targetType: annotationTargets.includes(annotation.targetType as ProductionDraftAnnotation["targetType"]) ? annotation.targetType as ProductionDraftAnnotation["targetType"] : "screenplay-element",
          targetId: typeof annotation.targetId === "string" ? annotation.targetId : "",
          department: typeof annotation.department === "string" ? annotation.department : "",
          body: typeof annotation.body === "string" ? annotation.body : "",
          author: typeof annotation.author === "string" ? annotation.author : "",
          createdAt: typeof annotation.createdAt === "string" ? annotation.createdAt : now,
          updatedAt: typeof annotation.updatedAt === "string" ? annotation.updatedAt : now,
        }];
      }) : [],
      approvalHistory: Array.isArray(productionCandidate.approvalHistory) ? productionCandidate.approvalHistory.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const approval = item as Partial<ProductionDraftApproval>;
        return [{
          id: typeof approval.id === "string" && approval.id ? approval.id : `production-approval-${index + 1}`,
          action: approvalActions.includes(approval.action as ProductionDraftApproval["action"]) ? approval.action as ProductionDraftApproval["action"] : "direct-edit",
          summary: typeof approval.summary === "string" ? approval.summary : "",
          authorizedBy: typeof approval.authorizedBy === "string" ? approval.authorizedBy : "",
          createdAt: typeof approval.createdAt === "string" ? approval.createdAt : "",
        }];
      }) : [],
    },
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

function normalizeArcMatrix(value: unknown, character: Partial<Character>): CharacterArcMatrix {
  const defaults = createBlankArcMatrix(character);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<CharacterArcMatrix>;
  const checkpointKinds: ArcCheckpointKind[] = ["opening", "catalyst", "threshold", "midpoint", "crisis", "climax", "ending", "custom"];
  return {
    ...defaults,
    ...candidate,
    checkpoints: Array.isArray(candidate.checkpoints) ? candidate.checkpoints.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const checkpoint = item as Partial<CharacterArcCheckpoint>;
      return [{
        id: typeof checkpoint.id === "string" && checkpoint.id ? checkpoint.id : `arc-checkpoint-${index + 1}`,
        kind: checkpointKinds.includes(checkpoint.kind as ArcCheckpointKind) ? checkpoint.kind as ArcCheckpointKind : "custom",
        blockNumber: checkpoint.blockNumber === null ? null : Math.min(24, Math.max(1, Number(checkpoint.blockNumber) || 1)),
        sceneId: typeof checkpoint.sceneId === "string" ? checkpoint.sceneId : "",
        belief: typeof checkpoint.belief === "string" ? checkpoint.belief : "",
        strategy: typeof checkpoint.strategy === "string" ? checkpoint.strategy : "",
        pressure: typeof checkpoint.pressure === "string" ? checkpoint.pressure : "",
        choice: typeof checkpoint.choice === "string" ? checkpoint.choice : "",
        consequence: typeof checkpoint.consequence === "string" ? checkpoint.consequence : "",
        evidence: typeof checkpoint.evidence === "string" ? checkpoint.evidence : "",
      }];
    }) : [],
  };
}

function normalizeStoryThreads(value: unknown): StoryThread[] {
  if (!Array.isArray(value)) return [];
  const kinds: StoryThreadKind[] = ["main", "subplot", "relationship", "mystery", "theme", "world"];
  const statuses: StoryThreadStatus[] = ["planned", "active", "paused", "resolved", "abandoned"];
  const milestoneKinds: StoryThreadMilestoneKind[] = ["setup", "development", "turn", "reveal", "payoff", "resolution"];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const thread = item as Partial<StoryThread>;
    const now = new Date().toISOString();
    return [{
      id: typeof thread.id === "string" && thread.id ? thread.id : `thread-${index + 1}`,
      name: typeof thread.name === "string" ? thread.name : `Story Thread ${index + 1}`,
      kind: kinds.includes(thread.kind as StoryThreadKind) ? thread.kind as StoryThreadKind : "subplot",
      status: statuses.includes(thread.status as StoryThreadStatus) ? thread.status as StoryThreadStatus : "planned",
      summary: typeof thread.summary === "string" ? thread.summary : "",
      question: typeof thread.question === "string" ? thread.question : "",
      characterIds: stringArray(thread.characterIds),
      sceneIds: stringArray(thread.sceneIds),
      introducedBlockNumber: thread.introducedBlockNumber === null || thread.introducedBlockNumber === undefined ? null : Math.min(24, Math.max(1, Number(thread.introducedBlockNumber) || 1)),
      resolvedBlockNumber: thread.resolvedBlockNumber === null || thread.resolvedBlockNumber === undefined ? null : Math.min(24, Math.max(1, Number(thread.resolvedBlockNumber) || 1)),
      milestones: Array.isArray(thread.milestones) ? thread.milestones.flatMap((entry, milestoneIndex) => {
        if (!entry || typeof entry !== "object") return [];
        const milestone = entry as Partial<StoryThreadMilestone>;
        return [{
          id: typeof milestone.id === "string" && milestone.id ? milestone.id : `thread-milestone-${index + 1}-${milestoneIndex + 1}`,
          sceneId: typeof milestone.sceneId === "string" ? milestone.sceneId : "",
          blockNumber: Math.min(24, Math.max(1, Number(milestone.blockNumber) || 1)),
          kind: milestoneKinds.includes(milestone.kind as StoryThreadMilestoneKind) ? milestone.kind as StoryThreadMilestoneKind : "development",
          summary: typeof milestone.summary === "string" ? milestone.summary : "",
          resolved: Boolean(milestone.resolved),
        }];
      }) : [],
      notes: typeof thread.notes === "string" ? thread.notes : "",
      createdAt: typeof thread.createdAt === "string" ? thread.createdAt : now,
      updatedAt: typeof thread.updatedAt === "string" ? thread.updatedAt : now,
    }];
  });
}

function normalizeRights(value: unknown, projectTitle: string): RightsAndProvenance {
  const defaults = createBlankRightsAndProvenance(projectTitle);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<RightsAndProvenance>;
  const adaptations: RightsAndProvenance["adaptationStatus"][] = ["original", "adaptation", "commissioned", "collaboration", "unknown"];
  return {
    ...defaults,
    ...candidate,
    adaptationStatus: adaptations.includes(candidate.adaptationStatus as RightsAndProvenance["adaptationStatus"]) ? candidate.adaptationStatus as RightsAndProvenance["adaptationStatus"] : "unknown",
    collaborators: Array.isArray(candidate.collaborators) ? candidate.collaborators.filter((item): item is RightsCollaborator => Boolean(item && typeof item === "object")) : [],
    attributions: Array.isArray(candidate.attributions) ? candidate.attributions.filter((item): item is SourceAttribution => Boolean(item && typeof item === "object")) : [],
    aiProvenance: Array.isArray(candidate.aiProvenance) ? candidate.aiProvenance.filter((item): item is AiProvenanceRecord => Boolean(item && typeof item === "object")) : [],
  };
}

function normalizeRevisions(value: unknown): RevisionSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const revision = item as Partial<RevisionSnapshot>;
    return [{
      id: typeof revision.id === "string" && revision.id ? revision.id : `revision-${index + 1}`,
      label: typeof revision.label === "string" ? revision.label : `Revision ${index + 1}`,
      notes: typeof revision.notes === "string" ? revision.notes : "",
      createdAt: typeof revision.createdAt === "string" ? revision.createdAt : new Date().toISOString(),
      schemaVersion: "1.7.0",
      contentHash: typeof revision.contentHash === "string" ? revision.contentHash : "",
      payload: revision.payload && typeof revision.payload === "object" ? revision.payload as Record<string, unknown> : {},
    }];
  });
}

function normalizeComicPitchDeck(value: unknown, now: string): ComicPitchDeck {
  const defaults = createBlankComicPitchDeck(now);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ComicPitchDeck>;
  const panelStatuses: ComicPitchPanelStatus[] = ["pending", "generating", "complete", "error"];
  const deckStatuses: ComicPitchDeck["status"][] = ["not-started", "planned", "generating", "paused", "complete", "complete-with-errors"];
  const panels = Array.isArray(candidate.panels) ? candidate.panels.slice(0, 96).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const panel = item as Partial<ComicPitchPanel>;
    const pageNumber = Math.min(24, Math.max(1, Number(panel.pageNumber) || Math.floor(index / 4) + 1));
    const panelNumber = Math.min(4, Math.max(1, Number(panel.panelNumber) || (index % 4) + 1));
    const status = panelStatuses.includes(panel.status as ComicPitchPanelStatus) ? panel.status as ComicPitchPanelStatus : "pending";
    return [{
      id: typeof panel.id === "string" && panel.id ? panel.id : `comic-pitch-${pageNumber}-${panelNumber}`,
      pageNumber,
      panelNumber,
      blockNumber: Math.min(24, Math.max(1, Number(panel.blockNumber) || pageNumber)),
      miniBlockNumber: Math.min(4, Math.max(1, Number(panel.miniBlockNumber) || panelNumber)),
      title: typeof panel.title === "string" ? panel.title : `Page ${pageNumber}, panel ${panelNumber}`,
      narration: typeof panel.narration === "string" ? panel.narration : "",
      narrationSource: panel.narrationSource === "derived" ? "derived" as const : "canonical" as const,
      dialogue: Array.isArray(panel.dialogue) ? panel.dialogue.flatMap((item, dialogueIndex) => {
        if (!item || typeof item !== "object") return [];
        const dialogue = item as Partial<ComicPitchDialogue>;
        return [{
          id: typeof dialogue.id === "string" && dialogue.id ? dialogue.id : `comic-dialogue-${pageNumber}-${panelNumber}-${dialogueIndex + 1}`,
          characterId: typeof dialogue.characterId === "string" ? dialogue.characterId : "",
          characterName: typeof dialogue.characterName === "string" ? dialogue.characterName : "Speaker",
          text: typeof dialogue.text === "string" ? dialogue.text : "",
          sourceElementId: typeof dialogue.sourceElementId === "string" ? dialogue.sourceElementId : "",
        }];
      }) : [],
      characterIds: stringArray(panel.characterIds),
      locationIds: stringArray(panel.locationIds),
      shotDirection: typeof panel.shotDirection === "string" ? panel.shotDirection : "",
      prompt: typeof panel.prompt === "string" ? panel.prompt : "",
      imageSrc: typeof panel.imageSrc === "string" ? panel.imageSrc : "",
      assetRef: normalizeProjectAssetReference(panel.assetRef),
      revisedPrompt: typeof panel.revisedPrompt === "string" ? panel.revisedPrompt : "",
      status: status === "generating" ? "pending" : status,
      error: typeof panel.error === "string" ? panel.error : "",
      provider: typeof panel.provider === "string" ? panel.provider : "",
      model: typeof panel.model === "string" ? panel.model : "",
      generatedAt: typeof panel.generatedAt === "string" ? panel.generatedAt : "",
    }];
  }) : [];
  const status = deckStatuses.includes(candidate.status as ComicPitchDeck["status"]) ? candidate.status as ComicPitchDeck["status"] : "not-started";
  return {
    version: 1,
    style: "black-and-white-sketch",
    status: status === "generating" ? "paused" : status,
    panels,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
    lastGeneratedAt: typeof candidate.lastGeneratedAt === "string" ? candidate.lastGeneratedAt : "",
  };
}

function normalizeReviewWorkspace(value: unknown, projectTitle: string): ReviewWorkspace {
  const defaults = createBlankReviewWorkspace(projectTitle);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ReviewWorkspace>;
  const statuses: ReviewThreadStatus[] = ["open", "in-review", "resolved", "deferred"];
  const priorities: ReviewPriority[] = ["low", "normal", "high", "critical"];
  const anchorKinds: ReviewAnchorKind[] = ["project", "story-field", "block", "scene", "screenplay-element", "character"];
  const now = new Date().toISOString();
  const threads = Array.isArray(candidate.threads) ? candidate.threads.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const thread = item as Partial<ReviewThread>;
    const anchor = thread.anchor && typeof thread.anchor === "object" ? thread.anchor as Partial<ReviewAnchor> : {};
    return [{
      id: typeof thread.id === "string" && thread.id ? thread.id : `review-thread-${index + 1}`,
      title: typeof thread.title === "string" ? thread.title : `Review thread ${index + 1}`,
      anchor: {
        kind: anchorKinds.includes(anchor.kind as ReviewAnchorKind) ? anchor.kind as ReviewAnchorKind : "project",
        targetId: typeof anchor.targetId === "string" ? anchor.targetId : "",
        label: typeof anchor.label === "string" ? anchor.label : "Whole project",
      },
      status: statuses.includes(thread.status as ReviewThreadStatus) ? thread.status as ReviewThreadStatus : "open",
      priority: priorities.includes(thread.priority as ReviewPriority) ? thread.priority as ReviewPriority : "normal",
      comments: Array.isArray(thread.comments) ? thread.comments.flatMap((commentItem, commentIndex) => {
        if (!commentItem || typeof commentItem !== "object") return [];
        const comment = commentItem as Partial<ReviewComment>;
        return [{
          id: typeof comment.id === "string" && comment.id ? comment.id : `review-comment-${index + 1}-${commentIndex + 1}`,
          author: typeof comment.author === "string" ? comment.author : "Local reviewer",
          body: typeof comment.body === "string" ? comment.body : "",
          createdAt: typeof comment.createdAt === "string" ? comment.createdAt : now,
        }];
      }) : [],
      createdAt: typeof thread.createdAt === "string" ? thread.createdAt : now,
      updatedAt: typeof thread.updatedAt === "string" ? thread.updatedAt : now,
      resolvedAt: typeof thread.resolvedAt === "string" ? thread.resolvedAt : "",
    }];
  }) : [];
  const loglineCandidates = Array.isArray(candidate.loglineCandidates) ? candidate.loglineCandidates.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Partial<LoglineCandidate>;
    return [{
      id: typeof entry.id === "string" && entry.id ? entry.id : `logline-${index + 1}`,
      text: typeof entry.text === "string" ? entry.text : "",
      source: typeof entry.source === "string" ? entry.source : "Guided workshop",
      selected: Boolean(entry.selected),
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now,
    }];
  }) : [];
  const pitch = candidate.pitchPackage && typeof candidate.pitchPackage === "object" ? candidate.pitchPackage as Partial<PitchPackage> : {};
  return {
    threads,
    loglineCandidates,
    pitchPackage: {
      ...defaults.pitchPackage,
      ...pitch,
      selectedCharacterIds: stringArray(pitch.selectedCharacterIds),
      selectedLocationIds: stringArray(pitch.selectedLocationIds),
      includeSections: stringArray(pitch.includeSections).length ? stringArray(pitch.includeSections) : defaults.pitchPackage.includeSections,
      comicDeck: normalizeComicPitchDeck(pitch.comicDeck, now),
      updatedAt: typeof pitch.updatedAt === "string" ? pitch.updatedAt : now,
    },
  };
}


function normalizeProductionReporting(value: unknown, now: string): ProductionReporting {
  const defaults = createBlankProductionReporting(now);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProductionReporting>;
  const statuses: ProductionShootGroupDecisionStatus[] = ["proposed", "accepted", "rejected", "adjusted"];
  const timeline = candidate.timeline && typeof candidate.timeline === "object" ? candidate.timeline : defaults.timeline;
  return {
    locations: Array.isArray(candidate.locations) ? candidate.locations.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const plan = item as Partial<ProductionLocationPlan>;
      if (typeof plan.locationId !== "string" || !plan.locationId) return [];
      return [{
        locationId: plan.locationId,
        realLocation: typeof plan.realLocation === "string" ? plan.realLocation : "",
        lighting: typeof plan.lighting === "string" ? plan.lighting : "",
        weather: typeof plan.weather === "string" ? plan.weather : "",
        permits: typeof plan.permits === "string" ? plan.permits : "",
        travel: typeof plan.travel === "string" ? plan.travel : "",
        accessibility: typeof plan.accessibility === "string" ? plan.accessibility : "",
        availability: typeof plan.availability === "string" ? plan.availability : "",
        setupMinutes: Math.max(0, Number(plan.setupMinutes) || 0),
        estimatedShootHours: Math.max(0, Number(plan.estimatedShootHours) || 0),
        notes: typeof plan.notes === "string" ? plan.notes : "",
        updatedAt: typeof plan.updatedAt === "string" ? plan.updatedAt : now,
      }];
    }) : [],
    actors: Array.isArray(candidate.actors) ? candidate.actors.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const plan = item as Partial<ProductionActorPlan>;
      if (typeof plan.characterId !== "string" || !plan.characterId) return [];
      return [{
        characterId: plan.characterId,
        actorName: typeof plan.actorName === "string" ? plan.actorName : "",
        availableDates: stringArray(plan.availableDates),
        unavailableDates: stringArray(plan.unavailableDates),
        wardrobe: typeof plan.wardrobe === "string" ? plan.wardrobe : "",
        makeup: typeof plan.makeup === "string" ? plan.makeup : "",
        rehearsalHours: Math.max(0, Number(plan.rehearsalHours) || 0),
        preferredCallTime: typeof plan.preferredCallTime === "string" ? plan.preferredCallTime : "",
        estimatedWrapTime: typeof plan.estimatedWrapTime === "string" ? plan.estimatedWrapTime : "",
        notes: typeof plan.notes === "string" ? plan.notes : "",
        updatedAt: typeof plan.updatedAt === "string" ? plan.updatedAt : now,
      }];
    }) : [],
    shootGroups: Array.isArray(candidate.shootGroups) ? candidate.shootGroups.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const decision = item as Partial<ProductionShootGroupDecision>;
      return [{
        id: typeof decision.id === "string" && decision.id ? decision.id : `shoot-group-${index + 1}`,
        sceneIds: stringArray(decision.sceneIds),
        status: statuses.includes(decision.status as ProductionShootGroupDecisionStatus) ? decision.status as ProductionShootGroupDecisionStatus : "proposed",
        notes: typeof decision.notes === "string" ? decision.notes : "",
        updatedAt: typeof decision.updatedAt === "string" ? decision.updatedAt : now,
      }];
    }) : [],
    timeline: {
      hoursPerDay: Math.max(1, Number(timeline.hoursPerDay) || defaults.timeline.hoursPerDay),
      pagesPerDay: Math.max(0.1, Number(timeline.pagesPerDay) || defaults.timeline.pagesPerDay),
      prepDays: Math.max(0, Number(timeline.prepDays) || 0),
      pickupDays: Math.max(0, Number(timeline.pickupDays) || 0),
      contingencyPercent: Math.min(100, Math.max(0, Number(timeline.contingencyPercent) || 0)),
      updatedAt: typeof timeline.updatedAt === "string" ? timeline.updatedAt : now,
    },
  };
}

function normalizeProductionWorkspace(value: unknown): ProductionWorkspace {
  const defaults = createBlankProductionWorkspace();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProductionWorkspace>;
  const now = new Date().toISOString();
  const shotStatuses: ProductionShotStatus[] = ["planned", "approved", "captured", "omitted"];
  const cueTypes: SonicCueType[] = ["score", "source", "atmosphere", "sfx", "silence"];
  const cueStatuses: SonicCueStatus[] = ["temp", "original", "approved", "licensed", "clearance-needed"];
  const readinessValues: ProductionBreakdown["readiness"][] = ["draft", "reviewed", "ready", "blocked"];
  const dayStatuses: ProductionScheduleDay["status"][] = ["planned", "confirmed", "completed", "moved"];
  return {
    shots: Array.isArray(candidate.shots) ? candidate.shots.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const shot = item as Partial<ProductionShot>;
      return [{
        id: typeof shot.id === "string" && shot.id ? shot.id : `shot-${index + 1}`,
        blockNumber: Math.min(24, Math.max(1, Number(shot.blockNumber) || 1)),
        miniBlockNumber: Math.min(4, Math.max(1, Number(shot.miniBlockNumber) || 1)),
        sceneId: typeof shot.sceneId === "string" ? shot.sceneId : "",
        screenplayElementIds: stringArray(shot.screenplayElementIds),
        frameId: typeof shot.frameId === "string" ? shot.frameId : "",
        shotNumber: Math.max(1, Number(shot.shotNumber) || index + 1),
        shotSize: typeof shot.shotSize === "string" ? shot.shotSize : "Wide",
        angle: typeof shot.angle === "string" ? shot.angle : "Eye level",
        movement: typeof shot.movement === "string" ? shot.movement : "Locked",
        lens: typeof shot.lens === "string" ? shot.lens : "Natural perspective",
        composition: typeof shot.composition === "string" ? shot.composition : "",
        purpose: typeof shot.purpose === "string" ? shot.purpose : "",
        continuity: typeof shot.continuity === "string" ? shot.continuity : "",
        keyframeSrc: typeof shot.keyframeSrc === "string" ? shot.keyframeSrc : "",
        assetRef: normalizeProjectAssetReference(shot.assetRef),
        keyframeAlt: typeof shot.keyframeAlt === "string" ? shot.keyframeAlt : "",
        status: shotStatuses.includes(shot.status as ProductionShotStatus) ? shot.status as ProductionShotStatus : "planned",
        durationSeconds: Math.max(1, Number(shot.durationSeconds) || 4),
        notes: typeof shot.notes === "string" ? shot.notes : "",
        createdAt: typeof shot.createdAt === "string" ? shot.createdAt : now,
        updatedAt: typeof shot.updatedAt === "string" ? shot.updatedAt : now,
      }];
    }) : [],
    cues: Array.isArray(candidate.cues) ? candidate.cues.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const cue = item as Partial<SonicCue>;
      return [{
        id: typeof cue.id === "string" && cue.id ? cue.id : `cue-${index + 1}`,
        cueNumber: typeof cue.cueNumber === "string" ? cue.cueNumber : `M${index + 1}`,
        blockNumber: Math.min(24, Math.max(1, Number(cue.blockNumber) || 1)),
        sceneId: typeof cue.sceneId === "string" ? cue.sceneId : "",
        type: cueTypes.includes(cue.type as SonicCueType) ? cue.type as SonicCueType : "score",
        title: typeof cue.title === "string" ? cue.title : `Cue ${index + 1}`,
        motif: typeof cue.motif === "string" ? cue.motif : "",
        cueIn: typeof cue.cueIn === "string" ? cue.cueIn : "",
        cueOut: typeof cue.cueOut === "string" ? cue.cueOut : "",
        purpose: typeof cue.purpose === "string" ? cue.purpose : "",
        status: cueStatuses.includes(cue.status as SonicCueStatus) ? cue.status as SonicCueStatus : "temp",
        rights: typeof cue.rights === "string" ? cue.rights : "",
        durationSeconds: Math.max(0, Number(cue.durationSeconds) || 0),
        notes: typeof cue.notes === "string" ? cue.notes : "",
        createdAt: typeof cue.createdAt === "string" ? cue.createdAt : now,
        updatedAt: typeof cue.updatedAt === "string" ? cue.updatedAt : now,
      }];
    }) : [],
    breakdowns: Array.isArray(candidate.breakdowns) ? candidate.breakdowns.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const breakdown = item as Partial<ProductionBreakdown>;
      return [{
        id: typeof breakdown.id === "string" && breakdown.id ? breakdown.id : `breakdown-${index + 1}`,
        blockNumber: Math.min(24, Math.max(1, Number(breakdown.blockNumber) || 1)),
        sceneId: typeof breakdown.sceneId === "string" ? breakdown.sceneId : "",
        castIds: stringArray(breakdown.castIds),
        locationIds: stringArray(breakdown.locationIds),
        props: typeof breakdown.props === "string" ? breakdown.props : "",
        wardrobe: typeof breakdown.wardrobe === "string" ? breakdown.wardrobe : "",
        vehicles: typeof breakdown.vehicles === "string" ? breakdown.vehicles : "",
        effects: typeof breakdown.effects === "string" ? breakdown.effects : "",
        stunts: typeof breakdown.stunts === "string" ? breakdown.stunts : "",
        extras: typeof breakdown.extras === "string" ? breakdown.extras : "",
        makeup: typeof breakdown.makeup === "string" ? breakdown.makeup : "",
        sound: typeof breakdown.sound === "string" ? breakdown.sound : "",
        estimatedHours: Math.max(1, Number(breakdown.estimatedHours) || 1),
        readiness: readinessValues.includes(breakdown.readiness as ProductionBreakdown["readiness"]) ? breakdown.readiness as ProductionBreakdown["readiness"] : "draft",
        notes: typeof breakdown.notes === "string" ? breakdown.notes : "",
        updatedAt: typeof breakdown.updatedAt === "string" ? breakdown.updatedAt : now,
      }];
    }) : [],
    schedule: Array.isArray(candidate.schedule) ? candidate.schedule.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const day = item as Partial<ProductionScheduleDay>;
      return [{
        id: typeof day.id === "string" && day.id ? day.id : `shoot-day-${index + 1}`,
        dayNumber: Math.max(1, Number(day.dayNumber) || index + 1),
        date: typeof day.date === "string" ? day.date : "",
        sceneIds: stringArray(day.sceneIds),
        locationId: typeof day.locationId === "string" ? day.locationId : "location-tbd",
        callTime: typeof day.callTime === "string" ? day.callTime : "08:00",
        estimatedHours: Math.max(0, Number(day.estimatedHours) || 0),
        status: dayStatuses.includes(day.status as ProductionScheduleDay["status"]) ? day.status as ProductionScheduleDay["status"] : "planned",
        notes: typeof day.notes === "string" ? day.notes : "",
        updatedAt: typeof day.updatedAt === "string" ? day.updatedAt : now,
      }];
    }) : [],
    reporting: normalizeProductionReporting(candidate.reporting, now),
    animatic: {
      ...defaults.animatic,
      ...(candidate.animatic && typeof candidate.animatic === "object" ? candidate.animatic : {}),
      defaultFrameSeconds: Math.max(1, Number(candidate.animatic?.defaultFrameSeconds) || defaults.animatic.defaultFrameSeconds),
      includeDialogue: candidate.animatic?.includeDialogue !== false,
      showCueLabels: candidate.animatic?.showCueLabels !== false,
      updatedAt: typeof candidate.animatic?.updatedAt === "string" ? candidate.animatic.updatedAt : now,
    },
    distribution: {
      ...defaults.distribution,
      ...(candidate.distribution && typeof candidate.distribution === "object" ? candidate.distribution : {}),
      milestones: Array.isArray(candidate.distribution?.milestones) ? candidate.distribution.milestones.filter((item): item is DistributionMilestone => Boolean(item && typeof item === "object")) : [],
      updatedAt: typeof candidate.distribution?.updatedAt === "string" ? candidate.distribution.updatedAt : now,
    },
  };
}

function normalizeCollaboration(value: unknown): ProjectCollaboration {
  const defaults = createBlankCollaboration();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProjectCollaboration>;
  return {
    provider: candidate.provider === "github" ? "github" : "none",
    repositoryUrl: typeof candidate.repositoryUrl === "string" ? candidate.repositoryUrl : "",
    sourceRepositoryUrl: typeof candidate.sourceRepositoryUrl === "string" ? candidate.sourceRepositoryUrl : "",
    owner: typeof candidate.owner === "string" ? candidate.owner : "",
    repo: typeof candidate.repo === "string" ? candidate.repo : "",
    branch: typeof candidate.branch === "string" && candidate.branch ? candidate.branch : "main",
    projectPath: typeof candidate.projectPath === "string" ? candidate.projectPath : "",
    syncEnabled: Boolean(candidate.syncEnabled),
    lastPulledCommit: typeof candidate.lastPulledCommit === "string" ? candidate.lastPulledCommit : "",
    lastPushedCommit: typeof candidate.lastPushedCommit === "string" ? candidate.lastPushedCommit : "",
    connectedAt: typeof candidate.connectedAt === "string" ? candidate.connectedAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : defaults.updatedAt,
  };
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
    screenplay?: Partial<ScreenplayDocument>;
    structure?: Partial<ProjectStructure>;
    characters?: Character[];
    blocks?: Array<Partial<StoryBlock>>;
    storyThreads?: StoryThread[];
    rights?: RightsAndProvenance;
    revisions?: RevisionSnapshot[];
    review?: ReviewWorkspace;
    production?: ProductionWorkspace;
    assets?: ProjectAssetRegistry;
    collaboration?: ProjectCollaboration;
    extensions?: Record<string, unknown>;
  };
  if (
    !["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0", "1.6.0", "1.7.0"].includes(candidate.schemaVersion ?? "") ||
    typeof candidate.id !== "string" ||
    !candidate.metadata ||
    !candidate.story ||
    !candidate.world ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.blocks) ||
    candidate.blocks.length !== 24
  ) return null;

  const metadata = candidate.metadata;
  const targetMinutes = Math.max(1, Number(metadata.targetMinutes) || 120);
  const blank = createBlankProject();
  const defaults = createBlankDevelopment();
  const voiceprintDefaults = createBlankVoiceprint();
  const development = candidate.development ?? {};
  const normalized: PlotPickleProject = {
    schemaVersion: "1.7.0",
    id: candidate.id,
    metadata: { ...metadata, targetMinutes },
    story: candidate.story,
    world: candidate.world,
    screenplay: normalizeScreenplay(candidate.screenplay),
    development: {
      conceptCanvas: normalizeConceptCanvas(development.conceptCanvas, defaults.conceptCanvas),
      visualReferences: Array.isArray(development.visualReferences)
        ? development.visualReferences.map(normalizeVisualReference).filter((reference): reference is VisualReference => Boolean(reference))
        : defaults.visualReferences,
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
    characters: candidate.characters.map((character) => ({ ...voiceprintDefaults, ...character, arcMatrix: normalizeArcMatrix(character.arcMatrix, character) })),
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
      visuals: normalizeStoryboardFrames(block.visuals, index + 1).map((frame) => {
        const number = index + 1;
        const isAfterglowClosingFrame = metadata.title.toLowerCase().includes("afterglow") && number >= 22 && number <= 24 && !frame.src;
        if (!isAfterglowClosingFrame) return frame;
        return {
          ...frame,
          src: `/afterglow/storyboard/block-${String(number).padStart(2, "0")}-mini-${frame.miniBlockNumber}.svg`,
          alt: `Afterglow replacement concept keyframe — Block ${number}.${frame.miniBlockNumber}`,
          caption: `PlotPickle replacement concept keyframe for the complete Afterglow ending, Block ${number}.${frame.miniBlockNumber}.`,
          shot: "Use this new closing-movement concept as the keyframe anchor, then refine it through Shot Designer.",
          continuity: "Preserve the established Afterglow chosen-family, coastal light, sentient-machine design language and emotional movement toward release and connection.",
        };
      }),
    })),
    storyThreads: normalizeStoryThreads(candidate.storyThreads),
    rights: normalizeRights(candidate.rights, metadata.title),
    revisions: normalizeRevisions(candidate.revisions),
    review: normalizeReviewWorkspace(candidate.review, metadata.title),
    production: normalizeProductionWorkspace(candidate.production),
    assets: normalizeProjectAssetRegistry(candidate.assets),
    collaboration: normalizeCollaboration(candidate.collaboration),
    extensions: candidate.extensions && typeof candidate.extensions === "object" && !Array.isArray(candidate.extensions)
      ? { ...candidate.extensions }
      : {},
  };
  return migrateLegacyAssetReferences(normalized);
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
    arcMatrix: createBlankArcMatrix(),
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

export function addBlankFrame(block: StoryBlock, miniBlockNumber = 1): StoryBlock {
  return {
    ...block,
    visuals: [
      ...block.visuals,
      { ...createStoryboardFrame(block.number, miniBlockNumber, makeId("frame")), caption: "Additional storyboard frame" },
    ],
  };
}
