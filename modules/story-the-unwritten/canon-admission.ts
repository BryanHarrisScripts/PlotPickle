import type { PlotPickleProject } from "../../lib/projects/project";
import {
  canonicalProposalById,
  createCanonicalProposal,
  readCanonicalRevisionStore,
  type CanonicalProposalRecord,
  type CanonicalRevisionRecord,
} from "../../lib/projects/persistence/project-revisions";
import { readStorySessionHistory } from "./history-persistence.mjs";
import {
  loadStorySessionSnapshot,
  persistStorySessionSnapshot,
} from "./project-persistence.mjs";

export const STORY_CANON_ADMISSION_SKILL_URI = "story://the-unwritten/canon-admission" as const;

export type StoryCanonProposalInput = {
  project: PlotPickleProject;
  sessionId: string;
  targetIds: string[];
  requestedByProfileId: string;
  safeSummary: string;
  proposalId?: string;
  proposedAt?: string;
};

export type StoryCanonProposalResult = {
  status: "proposed";
  project: PlotPickleProject;
  proposal: CanonicalProposalRecord;
  evidence: {
    sessionId: string;
    acceptedEventLogRef: string;
    checkpointRef: string;
    stateRevision: number;
    stateHash: string;
  };
};

export type StoryCanonAdmissionResult = {
  status: "recorded" | "already-recorded";
  project: PlotPickleProject;
  proposal: CanonicalProposalRecord;
  revision: CanonicalRevisionRecord;
};

function requireStoryReference(input: { value: unknown; label: string }) {
  if (typeof input.value !== "string") throw new Error(`${input.label} must be a non-empty reference.`);
  const normalized = input.value.trim();
  if (!normalized) throw new Error(`${input.label} must be a non-empty reference.`);
  return normalized;
}

function uniqueReferences(values: unknown, label: string) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} must contain at least one reference.`);
  const normalized = values.map((value, index) => requireStoryReference({ value, label: `${label}[${index}]` }));
  return [...new Set(normalized)];
}

function storyOutcomeFingerprint(stateHash: unknown) {
  if (typeof stateHash !== "string" || !/^[a-f0-9]{64}$/u.test(stateHash)) {
    throw new Error("STORY canon proposal requires a valid final checkpoint hash.");
  }
  return `story:${stateHash}`;
}

function completedSessionEvidence(project: PlotPickleProject, sessionId: string) {
  const loaded = loadStorySessionSnapshot(project, sessionId);
  if (!loaded.ok || !loaded.snapshot) {
    throw new Error(`STORY session ${sessionId} requires a valid persisted snapshot for canon review.`);
  }
  if (loaded.snapshot.runtime.session.status !== "completed") {
    throw new Error("Only a completed STORY session may participate in durable canon review.");
  }

  const history = readStorySessionHistory(project, sessionId);
  if (!history.ok || !history.history?.latestCheckpointRef) {
    throw new Error(`STORY session ${sessionId} requires valid accepted history for canon review.`);
  }
  const checkpointRef = history.history.latestCheckpointRef;
  const checkpoint = history.history.checkpoints[checkpointRef];
  if (!checkpoint || checkpoint.revision !== loaded.snapshot.mechanicalState.revision) {
    throw new Error("STORY session history does not match the persisted final state revision.");
  }
  if (loaded.snapshot.runtime.session.latestCheckpointRef !== checkpointRef) {
    throw new Error("STORY session snapshot does not reference the final accepted-history checkpoint.");
  }

  return {
    snapshot: loaded.snapshot,
    acceptedEventLogRef: history.history.acceptedEventLogRef,
    checkpointRef,
    checkpoint,
  };
}

export function proposeCompletedStorySessionOutcomeForCanon(input: StoryCanonProposalInput): StoryCanonProposalResult {
  const sessionId = requireStoryReference({ value: input.sessionId, label: "sessionId" });
  const requestedByProfileId = requireStoryReference({ value: input.requestedByProfileId, label: "requestedByProfileId" });
  const targetIds = uniqueReferences(input.targetIds, "targetIds");
  const summary = typeof input.safeSummary === "string" ? input.safeSummary.trim() : "";
  if (!summary) throw new Error("A safe summary is required before a STORY outcome can be proposed for canon.");

  const evidence = completedSessionEvidence(input.project, sessionId);
  if (evidence.snapshot.runtime.session.canonAdmissionRef !== null) {
    throw new Error("This STORY session already records a canonical admission.");
  }
  const created = createCanonicalProposal(input.project, {
    id: input.proposalId,
    kind: "story",
    targetIds,
    profileId: requestedByProfileId,
    skillUri: STORY_CANON_ADMISSION_SKILL_URI,
    runId: `story-session:${sessionId}`,
    sourceKind: "system",
    contentFingerprint: storyOutcomeFingerprint(evidence.checkpoint.stateHash),
    safeSummary: summary,
    generation: null,
    contextReceipt: null,
    generatedAt: input.proposedAt,
  });

  return {
    status: "proposed",
    project: created.project,
    proposal: created.proposal,
    evidence: {
      sessionId,
      acceptedEventLogRef: evidence.acceptedEventLogRef,
      checkpointRef: evidence.checkpointRef,
      stateRevision: evidence.checkpoint.revision,
      stateHash: evidence.checkpoint.stateHash,
    },
  };
}

export function recordWriterApprovedStoryCanonAdmission(input: {
  project: PlotPickleProject;
  sessionId: string;
  proposalId: string;
}): StoryCanonAdmissionResult {
  const sessionId = requireStoryReference({ value: input.sessionId, label: "sessionId" });
  const proposalId = requireStoryReference({ value: input.proposalId, label: "proposalId" });
  const evidence = completedSessionEvidence(input.project, sessionId);
  const proposal = canonicalProposalById(input.project, proposalId);
  if (!proposal || proposal.status !== "accepted" || proposal.appliedRevision === null) {
    throw new Error("STORY can record canon admission only after the host PPF proposal is writer-approved and accepted.");
  }
  if (proposal.kind !== "story"
    || proposal.sourceKind !== "system"
    || proposal.skillUri !== STORY_CANON_ADMISSION_SKILL_URI
    || proposal.runId !== `story-session:${sessionId}`
    || proposal.contentFingerprint !== storyOutcomeFingerprint(evidence.checkpoint.stateHash)) {
    throw new Error("Accepted canonical proposal does not match this STORY session outcome.");
  }

  const revisionStore = readCanonicalRevisionStore(input.project);
  const revision = revisionStore.history.find((candidate) =>
    candidate.proposalId === proposal.id && candidate.revision === proposal.appliedRevision) ?? null;
  if (!revision) throw new Error("Accepted STORY canonical proposal is missing its canonical revision record.");

  const existingAdmissionRef = evidence.snapshot.runtime.session.canonAdmissionRef;
  if (existingAdmissionRef === revision.id) {
    return { status: "already-recorded", project: input.project, proposal, revision };
  }
  if (existingAdmissionRef !== null) {
    throw new Error("STORY session is already linked to a different canonical revision.");
  }

  const runtime = structuredClone(evidence.snapshot.runtime);
  runtime.session.canonAdmissionRef = revision.id;
  const persisted = persistStorySessionSnapshot(input.project, {
    runtime,
    state: evidence.snapshot.mechanicalState,
    savedAt: revision.acceptedAt,
  });
  return { status: "recorded", project: persisted.project, proposal, revision };
}
