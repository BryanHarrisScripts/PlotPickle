import type { PlotPickleProject } from "./project";

export type StoryProposalKind = "character" | "world" | "scene" | "action" | "dialogue";
export type StoryProposalStatus = "proposed" | "accepted" | "edited" | "rejected" | "deferred";

export type ImageToStoryProposal = {
  id: string;
  sourceAssetId: string;
  sourceCandidateId: string;
  targetKind: StoryProposalKind;
  targetId: string;
  targetLabel: string;
  fieldPath: string;
  currentText: string;
  proposedText: string;
  rationale: string;
  status: StoryProposalStatus;
  humanDecision: string;
  decidedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ImageToStoryProposalStore = {
  version: 1;
  proposals: ImageToStoryProposal[];
};

export type AcceptedStoryRevision = {
  proposalId: string;
  sourceAssetId: string;
  sourceCandidateId: string;
  targetKind: StoryProposalKind;
  targetId: string;
  fieldPath: string;
  before: string;
  after: string;
  humanDecision: string;
  decidedBy: string;
  createdAt: string;
};

const EXTENSION_KEY = "imageToStoryProposals";
const REVISION_EXTENSION_KEY = "acceptedStoryRevisions";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown) { return typeof value === "string" ? value : ""; }

export function readImageToStoryProposalStore(project: PlotPickleProject): ImageToStoryProposalStore {
  const extensions = record(project.extensions);
  const raw = record(extensions[EXTENSION_KEY]);
  const proposals = Array.isArray(raw.proposals) ? raw.proposals.flatMap((entry, index) => {
    const proposal = record(entry);
    if (!Object.keys(proposal).length) return [];
    const status = ["proposed", "accepted", "edited", "rejected", "deferred"].includes(text(proposal.status))
      ? text(proposal.status) as StoryProposalStatus : "proposed";
    const targetKind = ["character", "world", "scene", "action", "dialogue"].includes(text(proposal.targetKind))
      ? text(proposal.targetKind) as StoryProposalKind : "scene";
    const createdAt = text(proposal.createdAt) || new Date().toISOString();
    return [{
      id: text(proposal.id) || `image-story-proposal-${index + 1}`,
      sourceAssetId: text(proposal.sourceAssetId),
      sourceCandidateId: text(proposal.sourceCandidateId),
      targetKind,
      targetId: text(proposal.targetId),
      targetLabel: text(proposal.targetLabel),
      fieldPath: text(proposal.fieldPath),
      currentText: text(proposal.currentText),
      proposedText: text(proposal.proposedText),
      rationale: text(proposal.rationale),
      status,
      humanDecision: text(proposal.humanDecision),
      decidedBy: text(proposal.decidedBy),
      createdAt,
      updatedAt: text(proposal.updatedAt) || createdAt,
    }];
  }) : [];
  return { version: 1, proposals };
}

function writeProposalStore(project: PlotPickleProject, store: ImageToStoryProposalStore): PlotPickleProject {
  return { ...project, extensions: { ...record(project.extensions), [EXTENSION_KEY]: store } };
}

export function addImageToStoryProposal(project: PlotPickleProject, proposal: ImageToStoryProposal) {
  const store = readImageToStoryProposalStore(project);
  return writeProposalStore(project, { version: 1, proposals: [...store.proposals, proposal] });
}

export function decideImageToStoryProposal(
  project: PlotPickleProject,
  proposalId: string,
  status: Extract<StoryProposalStatus, "rejected" | "deferred">,
  decidedBy: string,
  humanDecision: string,
  updatedAt = new Date().toISOString(),
) {
  const store = readImageToStoryProposalStore(project);
  return writeProposalStore(project, {
    version: 1,
    proposals: store.proposals.map((proposal) => proposal.id === proposalId ? {
      ...proposal, status, decidedBy, humanDecision, updatedAt,
    } : proposal),
  });
}

function applyFieldPath(project: PlotPickleProject, fieldPath: string, value: string): PlotPickleProject {
  const parts = fieldPath.split(".").filter(Boolean);
  if (parts.length < 2) return project;
  const [root, key] = parts;
  if (root === "story" && key in project.story) return { ...project, story: { ...project.story, [key]: value } };
  if (root === "world" && key in project.world && key !== "locations") return { ...project, world: { ...project.world, [key]: value } };
  return project;
}

export function acceptImageToStoryProposal(
  project: PlotPickleProject,
  proposalId: string,
  decidedBy: string,
  editedText?: string,
  humanDecision = "Accepted visual-to-story proposal",
  createdAt = new Date().toISOString(),
) {
  const store = readImageToStoryProposalStore(project);
  const proposal = store.proposals.find((entry) => entry.id === proposalId);
  if (!proposal) return project;
  const after = typeof editedText === "string" ? editedText : proposal.proposedText;
  const status: StoryProposalStatus = typeof editedText === "string" && editedText !== proposal.proposedText ? "edited" : "accepted";
  const updatedStore: ImageToStoryProposalStore = {
    version: 1,
    proposals: store.proposals.map((entry) => entry.id === proposalId ? {
      ...entry, proposedText: after, status, decidedBy, humanDecision, updatedAt: createdAt,
    } : entry),
  };
  const revision: AcceptedStoryRevision = {
    proposalId: proposal.id,
    sourceAssetId: proposal.sourceAssetId,
    sourceCandidateId: proposal.sourceCandidateId,
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    fieldPath: proposal.fieldPath,
    before: proposal.currentText,
    after,
    humanDecision,
    decidedBy,
    createdAt,
  };
  const extensions = record(project.extensions);
  const revisions = Array.isArray(extensions[REVISION_EXTENSION_KEY]) ? extensions[REVISION_EXTENSION_KEY] as unknown[] : [];
  const withRevision = {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: updatedStore,
      [REVISION_EXTENSION_KEY]: [...revisions, revision],
    },
  };
  return applyFieldPath(withRevision, proposal.fieldPath, after);
}

export function proposalsForAsset(project: PlotPickleProject, sourceAssetId: string) {
  return readImageToStoryProposalStore(project).proposals.filter((proposal) => proposal.sourceAssetId === sourceAssetId);
}
