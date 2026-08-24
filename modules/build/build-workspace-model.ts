import type {
  PlotPickleProject,
  ScreenplayAnalysisStatus,
  ScreenplayDraftElement,
  StoryBlock,
} from "../../lib/projects/project";

export type BuildWorkspaceView = "whole-film" | "act" | "sequence" | "blocks";
export type BuildBlockStatus = "empty" | "developing" | "ready" | "locked";
export type BuildEvidenceStatus = "defined" | "observed" | "emerging" | "missing" | "locked";
export type BuildEvidenceReviewStatus = ScreenplayAnalysisStatus | "not-imported";

export type BuildEvidenceSource = {
  id: string;
  kind: string;
  label: string;
  excerpt: string;
};

export type BuildEvidenceSummary = {
  status: BuildEvidenceStatus;
  reason: string;
  directEvidenceCount: number;
  sourceIds: string[];
  sources: BuildEvidenceSource[];
  reviewStatus: BuildEvidenceReviewStatus;
  supportedRequirements: number;
  expectedRequirements: number;
  supportedRequirementLabels: string[];
  missingRequirementLabels: string[];
};

export type BuildStoryCoverage = {
  supportedRequirements: number;
  expectedRequirements: number;
  percent: number;
  evidenceCounts: Record<BuildEvidenceStatus, number>;
};

export type BuildWorkspaceFilter = {
  query?: string;
  acts?: number[];
  sequences?: number[];
  statuses?: BuildBlockStatus[];
  labels?: string[];
};

export type BuildBlockCard = {
  id: string;
  number: number;
  act: number;
  sequenceNumber: number;
  title: string;
  purpose: string;
  conflict: string;
  characterFocus: string[];
  emotionalMovement: string;
  setup: string;
  payoff: string;
  notes: string;
  status: BuildBlockStatus;
  evidence: BuildEvidenceSummary;
  labels: string[];
  sceneIds: string[];
  sceneCount: number;
  miniBlockCount: number;
};

export type BuildSequenceLane = {
  id: string;
  number: number;
  act: number;
  title: string;
  purpose: string;
  cards: BuildBlockCard[];
};

export type BuildActLane = {
  number: number;
  cards: BuildBlockCard[];
  sequences: BuildSequenceLane[];
};

export type BuildWorkspaceModel = {
  cards: BuildBlockCard[];
  visibleCards: BuildBlockCard[];
  sequences: BuildSequenceLane[];
  acts: BuildActLane[];
  coverage: BuildStoryCoverage;
  totals: {
    blocks: number;
    scenes: number;
    miniBlocks: number;
  };
};

export type BuildBlockPatch = Partial<Pick<StoryBlock,
  | "title"
  | "purpose"
  | "summary"
  | "characterIds"
  | "locationIds"
  | "goal"
  | "conflict"
  | "choice"
  | "action"
  | "consequence"
  | "emotionalTurn"
  | "audienceExpectation"
  | "pickleTurn"
  | "setup"
  | "payoff"
  | "storyboardDirection"
  | "notes"
>>;

const GUIDANCE_PREFIX = /^(?:suggested\b|review\b|identify\b|confirm\b|record\b|define\b|state\b|compare\b|collect\b|locate\b|track\b|add\b|select\b|build\b)/i;
const IMPORT_GUIDANCE = /(?:suggested from the imported screenplay|review the imported screenplay|confirm or revise the structural interpretation)/i;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEvidenceText(value: string) {
  if (!value) return "";
  const withoutNullBytes = value.replace(/\u0000/g, "");
  const normalizedSpacing = withoutNullBytes.replace(/\s+/g, " ");
  return normalizedSpacing.trim();
}

export function isUsableBuildEvidenceText(value: string) {
  const normalized = normalizeEvidenceText(value || "");
  if (!normalized) return false;
  if (GUIDANCE_PREFIX.test(normalized)) return false;
  if (IMPORT_GUIDANCE.test(normalized)) return false;
  return true;
}

function importedScreenplay(project: PlotPickleProject) {
  return Boolean(project.screenplay.importedAt) && project.screenplay.analysisStatus !== "none";
}

function directScreenplayEvidence(project: PlotPickleProject, block: StoryBlock) {
  if (!importedScreenplay(project)) return [];
  return project.screenplay.draftElements.filter((element) => (
    element.blockNumber === block.number
    && !element.omitted
    && Boolean(normalizeEvidenceText(element.text))
  ));
}

function evidenceSource(element: ScreenplayDraftElement): BuildEvidenceSource {
  return {
    id: element.id,
    kind: element.type,
    label: element.sceneNumber > 0 ? `Scene ${element.sceneNumber} · ${element.type}` : element.type,
    excerpt: normalizeEvidenceText(element.text).slice(0, 180),
  };
}

function requirementSupport(block: StoryBlock, directEvidenceCount: number) {
  const requirements: Array<[string, boolean]> = [
    ["Dramatic purpose", isUsableBuildEvidenceText(block.purpose)],
    ["Conflict", isUsableBuildEvidenceText(block.conflict)],
    ["Choice", isUsableBuildEvidenceText(block.choice)],
    ["Visible action", isUsableBuildEvidenceText(block.action)],
    ["Consequence", isUsableBuildEvidenceText(block.consequence)],
    ["Emotional turn", isUsableBuildEvidenceText(block.emotionalTurn)],
    ["Setup", isUsableBuildEvidenceText(block.setup)],
    ["Payoff", isUsableBuildEvidenceText(block.payoff)],
    ["Character linkage", block.characterIds.length > 0],
    ["Location linkage", block.locationIds.length > 0],
    ["Source or summary support", directEvidenceCount > 0 || isUsableBuildEvidenceText(block.summary)],
  ];
  return {
    supported: requirements.filter(([, supported]) => supported).map(([label]) => label),
    missing: requirements.filter(([, supported]) => !supported).map(([label]) => label),
    expected: requirements.length,
  };
}

function containsImportedGuidance(block: StoryBlock) {
  return [
    block.title,
    block.purpose,
    block.summary,
    block.goal,
    block.conflict,
    block.choice,
    block.action,
    block.consequence,
    block.emotionalTurn,
    block.audienceExpectation,
    block.pickleTurn,
    block.setup,
    block.payoff,
    block.storyboardDirection,
    block.notes,
  ].some((value) => GUIDANCE_PREFIX.test(normalizeEvidenceText(value || "")) || IMPORT_GUIDANCE.test(normalizeEvidenceText(value || "")));
}

export function deriveBuildEvidence(project: PlotPickleProject, block: StoryBlock): BuildEvidenceSummary {
  const directEvidence = directScreenplayEvidence(project, block);
  const requirements = requirementSupport(block, directEvidence.length);
  const reviewStatus: BuildEvidenceReviewStatus = importedScreenplay(project)
    ? project.screenplay.analysisStatus
    : "not-imported";
  const hasUsableSupport = requirements.supported.length > 0;
  const hasImportedGuidance = containsImportedGuidance(block);

  let status: BuildEvidenceStatus = "missing";
  let reason = "No usable canonical Block decision or direct screenplay evidence supports this story movement yet.";

  if (directEvidence.length > 0) {
    status = "observed";
    reason = reviewStatus === "suggested"
      ? `${directEvidence.length} direct screenplay passage${directEvidence.length === 1 ? " is" : "s are"} assigned to this Block. The structural interpretation remains a reviewable import suggestion.`
      : `${directEvidence.length} direct screenplay passage${directEvidence.length === 1 ? " is" : "s are"} assigned to this Block. The imported analysis has been reviewed.`;
  } else if (reviewStatus === "suggested" && (hasImportedGuidance || hasUsableSupport)) {
    status = "emerging";
    reason = "Imported analysis proposes story information here, but no direct screenplay passage is assigned to this Block. Review it before treating the interpretation as canon.";
  } else if (hasUsableSupport) {
    status = "defined";
    reason = reviewStatus === "reviewed"
      ? "The imported interpretation has been reviewed and this Block now has usable canonical support."
      : "Usable canonical Block decisions support this story movement without an unresolved import-analysis gate.";
  }

  const sources = directEvidence.slice(0, 8).map(evidenceSource);
  return {
    status,
    reason,
    directEvidenceCount: directEvidence.length,
    sourceIds: unique(directEvidence.map((element) => element.sceneId || element.id)),
    sources,
    reviewStatus,
    supportedRequirements: requirements.supported.length,
    expectedRequirements: requirements.expected,
    supportedRequirementLabels: requirements.supported,
    missingRequirementLabels: requirements.missing,
  };
}

function buildStatus(block: StoryBlock): BuildBlockStatus {
  if (block.scenes.length > 0 && block.scenes.every((scene) => scene.locked || scene.status === "locked")) return "locked";
  const completed = [
    block.title,
    block.purpose,
    block.conflict,
    block.emotionalTurn,
    block.setup,
    block.payoff,
    block.notes,
  ].filter((value) => value.trim().length > 0).length;
  if (completed >= 6 && block.scenes.length > 0) return "ready";
  if (completed > 1 || block.scenes.length > 0) return "developing";
  return "empty";
}

function cardForBlock(
  project: PlotPickleProject,
  block: StoryBlock,
  characterNames: Map<string, string>,
  locationNames: Map<string, string>,
): BuildBlockCard {
  const characterFocus = block.characterIds.map((id) => characterNames.get(id) || id).filter(Boolean);
  const locations = block.locationIds.map((id) => locationNames.get(id) || id).filter(Boolean);
  const sceneStatuses = block.scenes.map((scene) => scene.status);
  const evidence = deriveBuildEvidence(project, block);
  return {
    id: block.id,
    number: block.number,
    act: block.act,
    sequenceNumber: block.sequenceNumber,
    title: block.title,
    purpose: block.purpose,
    conflict: block.conflict,
    characterFocus,
    emotionalMovement: block.emotionalTurn,
    setup: block.setup,
    payoff: block.payoff,
    notes: block.notes,
    status: buildStatus(block),
    evidence,
    labels: unique([
      `Act ${block.act}`,
      `Sequence ${block.sequenceNumber}`,
      `Evidence ${evidence.status}`,
      ...characterFocus,
      ...locations,
      ...sceneStatuses,
    ]),
    sceneIds: block.scenes.map((scene) => scene.id),
    sceneCount: block.scenes.length,
    miniBlockCount: block.scenes.reduce((total, scene) => total + scene.miniBlocks.length, 0),
  };
}

function matchesFilter(card: BuildBlockCard, filter: BuildWorkspaceFilter) {
  if (filter.acts?.length && !filter.acts.includes(card.act)) return false;
  if (filter.sequences?.length && !filter.sequences.includes(card.sequenceNumber)) return false;
  if (filter.statuses?.length && !filter.statuses.includes(card.status)) return false;
  if (filter.labels?.length && !filter.labels.every((label) => card.labels.includes(label))) return false;
  const query = filter.query?.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    card.title,
    card.purpose,
    card.conflict,
    card.emotionalMovement,
    card.setup,
    card.payoff,
    card.notes,
    card.evidence.status,
    card.evidence.reason,
    ...card.evidence.supportedRequirementLabels,
    ...card.evidence.missingRequirementLabels,
    ...card.characterFocus,
    ...card.labels,
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

function storyCoverage(cards: BuildBlockCard[]): BuildStoryCoverage {
  const supportedRequirements = cards.reduce((total, card) => total + card.evidence.supportedRequirements, 0);
  const expectedRequirements = cards.reduce((total, card) => total + card.evidence.expectedRequirements, 0);
  const evidenceCounts: Record<BuildEvidenceStatus, number> = {
    defined: 0,
    observed: 0,
    emerging: 0,
    missing: 0,
    locked: 0,
  };
  for (const card of cards) evidenceCounts[card.evidence.status] += 1;
  return {
    supportedRequirements,
    expectedRequirements,
    percent: expectedRequirements ? Math.round((supportedRequirements / expectedRequirements) * 100) : 0,
    evidenceCounts,
  };
}

export function createBuildWorkspaceModel(
  project: PlotPickleProject,
  filter: BuildWorkspaceFilter = {},
): BuildWorkspaceModel {
  const characterNames = new Map(project.characters.map((character) => [character.id, character.name]));
  const locationNames = new Map(project.world.locations.map((location) => [location.id, location.name]));
  const cards = project.blocks
    .map((block) => cardForBlock(project, block, characterNames, locationNames))
    .sort((left, right) => left.number - right.number);
  const visibleCards = cards.filter((card) => matchesFilter(card, filter));
  const sequences = project.structure.sequences
    .slice()
    .sort((left, right) => left.number - right.number)
    .map((sequence) => ({
      id: sequence.id,
      number: sequence.number,
      act: sequence.act,
      title: sequence.title,
      purpose: sequence.purpose,
      cards: visibleCards.filter((card) => card.sequenceNumber === sequence.number),
    }));
  const acts = [1, 2, 3, 4].map((number) => ({
    number,
    cards: visibleCards.filter((card) => card.act === number),
    sequences: sequences.filter((sequence) => sequence.act === number),
  }));
  return {
    cards,
    visibleCards,
    sequences,
    acts,
    coverage: storyCoverage(cards),
    totals: {
      blocks: cards.length,
      scenes: cards.reduce((total, card) => total + card.sceneCount, 0),
      miniBlocks: cards.reduce((total, card) => total + card.miniBlockCount, 0),
    },
  };
}

export function updateCanonicalBuildBlock(
  project: PlotPickleProject,
  blockId: string,
  patch: BuildBlockPatch,
): PlotPickleProject {
  if (!project.blocks.some((block) => block.id === blockId)) return project;
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
    },
    blocks: project.blocks.map((block) => block.id === blockId ? { ...block, ...patch, id: block.id } : block),
  };
}
