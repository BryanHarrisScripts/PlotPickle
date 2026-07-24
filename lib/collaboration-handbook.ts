import { createRevisionSnapshot } from "./core-model";
import {
  cloneProject,
  type PlotPickleProject,
  type ReviewAnchor,
  type ReviewThread,
  type RightsCollaborator,
} from "./project";

export type CollaborationModelId =
  | "solo-feedback"
  | "private-review"
  | "invited-contributor"
  | "co-writing"
  | "commissioned"
  | "production-team"
  | "public-feedback"
  | "open-community";

export type CollaborationRoleId =
  | "project-owner"
  | "co-owner-maintainer"
  | "writer-co-writer"
  | "contributor"
  | "reviewer"
  | "story-editor"
  | "research-continuity"
  | "specialist-contributor";

export type CollaborationAuthority =
  | "view"
  | "comment"
  | "create-review-threads"
  | "propose-changes"
  | "edit-rights-records"
  | "approve-specialist-assets"
  | "merge-canon"
  | "change-licence"
  | "manage-collaborators";

export type CollaborationPrivacy = "local-only" | "private-file-exchange" | "private-repository" | "public-repository";
export type BriefStatus = "draft" | "assigned" | "in-progress" | "submitted" | "accepted" | "closed";
export type ProposalPacketStatus = "draft" | "ready" | "submitted" | "changes-requested" | "approved" | "declined" | "superseded" | "withdrawn";
export type ReviewCategory = "required" | "continuity" | "rights" | "craft" | "question" | "preference" | "praise";
export type ReviewOutcome = "accepted" | "changes-requested" | "question-for-contributor" | "deferred" | "declined" | "superseded" | "withdrawn" | "resolved-without-change";
export type DecisionOutcome = "merged" | "declined" | "deferred" | "withdrawn" | "superseded";

export type CollaborationAgreement = {
  id: string;
  model: CollaborationModelId;
  ownerName: string;
  canonicalAuthority: string;
  privacy: CollaborationPrivacy;
  responseExpectation: string;
  unsolicitedProposals: boolean;
  confidentiality: string;
  reuseLicence: string;
  compensationExpectation: string;
  creditExpectation: string;
  notes: string;
  updatedAt: string;
};

export type AuthorityRecord = {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  role: CollaborationRoleId;
  authority: CollaborationAuthority[];
  scope: string;
  delegatedBy: string;
  agreementReference: string;
  active: boolean;
  updatedAt: string;
};

export type ContributionBrief = {
  id: string;
  title: string;
  template: string;
  contributorId: string;
  contributorName: string;
  requestedRole: CollaborationRoleId;
  decisionMaker: string;
  targetKind: ReviewAnchor["kind"];
  targetId: string;
  targetLabel: string;
  problem: string;
  storyPurpose: string;
  canonLocks: string;
  mustNotChange: string;
  preferredOutput: string;
  creativeFreedom: "exact" | "bounded" | "exploratory";
  dueDate: string;
  reviewWindow: string;
  privacy: CollaborationPrivacy;
  creditExpectation: string;
  compensationReference: string;
  ownershipReference: string;
  licenceReference: string;
  acceptanceCriteria: string;
  relatedReviewThreadIds: string[];
  sourceRecordIds: string[];
  previousProposalNumbers: number[];
  status: BriefStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProposalReviewPacket = {
  id: string;
  briefId: string;
  title: string;
  contributorId: string;
  contributorName: string;
  changed: string;
  reason: string;
  audienceEffect: string;
  affectedAreas: string[];
  beforeAfterEvidence: string;
  dependencies: string;
  characterEffects: string;
  continuityEffects: string;
  runtimeProductionEffects: string;
  rightsEffects: string;
  newCanonAssumptions: string;
  unresolvedQuestions: string;
  alternativesConsidered: string;
  sourceRecordIds: string[];
  aiProvenanceIds: string[];
  requestedCredit: string;
  inspectClosely: string;
  baseRevision: string;
  pullRequestNumber: number | null;
  status: ProposalPacketStatus;
  createdAt: string;
  updatedAt: string;
};

export type CollaborationDecision = {
  id: string;
  proposalPacketId: string;
  pullRequestNumber: number | null;
  outcome: DecisionOutcome;
  decisionMaker: string;
  decidedAt: string;
  summary: string;
  rationale: string;
  acceptedParts: string;
  declinedParts: string;
  resolvedReviewThreadIds: string[];
  deferredReviewThreadIds: string[];
  revisionSnapshotId: string;
  rightsUpdated: boolean;
  followUp: string;
};

export type CategorizedReviewNote = {
  id: string;
  category: ReviewCategory;
  outcome: ReviewOutcome | "open";
  title: string;
  author: string;
  anchor: ReviewAnchor;
  observation: string;
  evidence: string;
  intendedOutcome: string;
  createdAt: string;
  updatedAt: string;
};

export type HandbookRecords = {
  agreement: CollaborationAgreement;
  authorities: AuthorityRecord[];
  briefs: ContributionBrief[];
  proposalPackets: ProposalReviewPacket[];
  decisions: CollaborationDecision[];
  reviewNotes: CategorizedReviewNote[];
};

type CanonicalRecordKind = "agreement" | "authority" | "brief" | "packet" | "decision" | "review-note";

const MARKERS: Record<CanonicalRecordKind, string> = {
  agreement: "[PLOTPICKLE_COLLAB_AGREEMENT_V1]",
  authority: "[PLOTPICKLE_AUTHORITY_V1]",
  brief: "[PLOTPICKLE_BRIEF_V1]",
  packet: "[PLOTPICKLE_PACKET_V1]",
  decision: "[PLOTPICKLE_DECISION_V1]",
  "review-note": "[PLOTPICKLE_REVIEW_NOTE_V1]",
};

export const collaborationModels: Array<{
  id: CollaborationModelId;
  label: string;
  summary: string;
  defaultPrivacy: CollaborationPrivacy;
  ownershipNote: string;
}> = [
  { id: "solo-feedback", label: "Solo project with occasional feedback", summary: "The owner keeps the project local or shares selected material for comments. Feedback does not create canon or ownership.", defaultPrivacy: "local-only", ownershipNote: "Owner retains canon authority and existing rights." },
  { id: "private-review", label: "Private reviewer access", summary: "Invited readers comment or create anchored review notes without proposing canonical changes.", defaultPrivacy: "private-file-exchange", ownershipNote: "Review access does not transfer copyright or approval authority." },
  { id: "invited-contributor", label: "Invited bounded contribution", summary: "A contributor receives a defined brief and may submit a proposal within that scope.", defaultPrivacy: "private-repository", ownershipNote: "Credit, payment and ownership must be documented separately." },
  { id: "co-writing", label: "Co-writing partnership", summary: "Two or more writers create material under an explicit shared-authority and rights agreement.", defaultPrivacy: "private-repository", ownershipNote: "Shared creative authority should match a written agreement." },
  { id: "commissioned", label: "Commissioned rewrite or specialist service", summary: "A contributor is retained for a defined service, deliverable and review authority.", defaultPrivacy: "private-file-exchange", ownershipNote: "The commission or services agreement controls payment, credit and rights." },
  { id: "production-team", label: "Production-team collaboration", summary: "Writers, directors, producers and specialists coordinate story and production assets with delegated approval areas.", defaultPrivacy: "private-repository", ownershipNote: "Authority may be delegated by area without transferring story ownership." },
  { id: "public-feedback", label: "Public feedback project", summary: "The public may read or comment, while authorized people alone may submit or approve changes.", defaultPrivacy: "public-repository", ownershipNote: "Public visibility is not an open licence or ownership grant." },
  { id: "open-community", label: "Openly licensed community project", summary: "The project intentionally accepts community contributions under a stated reuse licence and contribution policy.", defaultPrivacy: "public-repository", ownershipNote: "The chosen licence and contributor terms must be explicit before reuse." },
];

export const collaborationRoles: Array<{ id: CollaborationRoleId; label: string; summary: string; defaultAuthority: CollaborationAuthority[] }> = [
  { id: "project-owner", label: "Project Owner", summary: "Controls the canonical project, repository connection, rights settings and final acceptance decisions.", defaultAuthority: ["view", "comment", "create-review-threads", "propose-changes", "edit-rights-records", "approve-specialist-assets", "merge-canon", "change-licence", "manage-collaborators"] },
  { id: "co-owner-maintainer", label: "Co-owner / Maintainer", summary: "Shares final authority only where explicitly authorized by the project agreement.", defaultAuthority: ["view", "comment", "create-review-threads", "propose-changes", "approve-specialist-assets", "merge-canon"] },
  { id: "writer-co-writer", label: "Writer / Co-writer", summary: "Creates story or screenplay material within the agreed authorship and approval model.", defaultAuthority: ["view", "comment", "create-review-threads", "propose-changes"] },
  { id: "contributor", label: "Contributor", summary: "Proposes bounded additions or changes from a contribution brief.", defaultAuthority: ["view", "comment", "propose-changes"] },
  { id: "reviewer", label: "Reviewer", summary: "Reports reader experience, questions and evidence without changing canon.", defaultAuthority: ["view", "comment", "create-review-threads"] },
  { id: "story-editor", label: "Story Editor", summary: "Diagnoses and recommends revisions but does not automatically own or approve them.", defaultAuthority: ["view", "comment", "create-review-threads", "propose-changes"] },
  { id: "research-continuity", label: "Research / Continuity Contributor", summary: "Supplies sourced facts, canon checks and continuity findings.", defaultAuthority: ["view", "comment", "create-review-threads", "propose-changes"] },
  { id: "specialist-contributor", label: "Visual, Music or Production Contributor", summary: "Supplies specialist assets with provenance, permission and approval records.", defaultAuthority: ["view", "comment", "propose-changes"] },
];

export const authorityActions: Array<{ id: CollaborationAuthority; label: string }> = [
  { id: "view", label: "View material" },
  { id: "comment", label: "Comment" },
  { id: "create-review-threads", label: "Create review threads" },
  { id: "propose-changes", label: "Submit proposals" },
  { id: "edit-rights-records", label: "Edit rights records" },
  { id: "approve-specialist-assets", label: "Approve specialist assets" },
  { id: "merge-canon", label: "Merge into canon" },
  { id: "change-licence", label: "Change project licence" },
  { id: "manage-collaborators", label: "Invite or remove collaborators" },
];

export const briefTemplates = [
  "Feedback only",
  "Rewrite proposal",
  "Alternative scene or Block",
  "Dialogue pass",
  "Character or world contribution",
  "Research or continuity check",
  "Storyboard, music or production asset",
  "Pitch or marketing material",
] as const;

export const reviewCategories: ReviewCategory[] = ["required", "continuity", "rights", "craft", "question", "preference", "praise"];
export const reviewOutcomes: ReviewOutcome[] = ["accepted", "changes-requested", "question-for-contributor", "deferred", "declined", "superseded", "withdrawn", "resolved-without-change"];

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function projectAnchor(project: PlotPickleProject): ReviewAnchor {
  return { kind: "project", targetId: project.id, label: "Whole project" };
}

function markerBody<T>(kind: CanonicalRecordKind, value: T) {
  return `${MARKERS[kind]}\n${JSON.stringify(value)}`;
}

function parseMarker<T>(thread: ReviewThread, kind: CanonicalRecordKind): T | null {
  const body = thread.comments[0]?.body ?? "";
  const marker = MARKERS[kind];
  if (!body.startsWith(marker)) return null;
  try {
    return JSON.parse(body.slice(marker.length).trim()) as T;
  } catch {
    return null;
  }
}

function recordThreadTitle(kind: CanonicalRecordKind, record: Record<string, unknown>) {
  if (kind === "agreement") return "Collaboration operating agreement";
  if (kind === "authority") return `Authority record: ${String(record.collaboratorName || "Contributor")}`;
  if (kind === "brief") return `Contribution brief: ${String(record.title || "Untitled")}`;
  if (kind === "packet") return `Proposal packet: ${String(record.title || "Untitled")}`;
  if (kind === "decision") return `Canon decision: ${String(record.summary || record.outcome || "Recorded")}`;
  return `Review note: ${String(record.title || "Untitled")}`;
}

function threadStatus(kind: CanonicalRecordKind, record: Record<string, unknown>): ReviewThread["status"] {
  if (kind === "brief") {
    const status = record.status;
    if (status === "accepted" || status === "closed") return "resolved";
    if (status === "submitted") return "in-review";
  }
  if (kind === "packet") {
    const status = record.status;
    if (["approved", "declined", "superseded", "withdrawn"].includes(String(status))) return "resolved";
    if (status === "submitted" || status === "changes-requested") return "in-review";
  }
  if (kind === "decision") return "resolved";
  if (kind === "review-note" && record.outcome && record.outcome !== "open") return "resolved";
  return "open";
}

function upsertRecord<T extends { id: string }>(
  project: PlotPickleProject,
  kind: CanonicalRecordKind,
  value: T,
  anchor: ReviewAnchor = projectAnchor(project),
): PlotPickleProject {
  const next = cloneProject(project);
  const timestamp = now();
  const existingIndex = next.review.threads.findIndex((thread) => {
    const parsed = parseMarker<{ id?: string }>(thread, kind);
    return parsed?.id === value.id;
  });
  const title = recordThreadTitle(kind, value as unknown as Record<string, unknown>);
  const body = markerBody(kind, value);
  if (existingIndex >= 0) {
    const existing = next.review.threads[existingIndex];
    next.review.threads[existingIndex] = {
      ...existing,
      title,
      anchor,
      status: threadStatus(kind, value as unknown as Record<string, unknown>),
      comments: existing.comments.length
        ? [{ ...existing.comments[0], body }, ...existing.comments.slice(1)]
        : [{ id: id("review-comment"), author: "PlotPickle collaboration handbook", body, createdAt: timestamp }],
      updatedAt: timestamp,
      resolvedAt: threadStatus(kind, value as unknown as Record<string, unknown>) === "resolved" ? timestamp : "",
    };
  } else {
    next.review.threads.push({
      id: id(`collaboration-${kind}`),
      title,
      anchor,
      status: threadStatus(kind, value as unknown as Record<string, unknown>),
      priority: kind === "decision" ? "high" : "normal",
      comments: [{ id: id("review-comment"), author: "PlotPickle collaboration handbook", body, createdAt: timestamp }],
      createdAt: timestamp,
      updatedAt: timestamp,
      resolvedAt: threadStatus(kind, value as unknown as Record<string, unknown>) === "resolved" ? timestamp : "",
    });
  }
  next.metadata.updatedAt = timestamp;
  return next;
}

function parseAll<T>(project: PlotPickleProject, kind: CanonicalRecordKind): T[] {
  return project.review.threads.flatMap((thread) => {
    const parsed = parseMarker<T>(thread, kind);
    return parsed ? [parsed] : [];
  });
}

export function createDefaultCollaborationAgreement(project: PlotPickleProject): CollaborationAgreement {
  const owner = project.rights.projectOwner || "Project owner";
  return {
    id: "collaboration-agreement",
    model: "solo-feedback",
    ownerName: owner,
    canonicalAuthority: owner,
    privacy: project.collaboration.provider === "github" ? "private-repository" : "local-only",
    responseExpectation: "Review timing is agreed per contribution brief; detailed feedback is not guaranteed for unsolicited material.",
    unsolicitedProposals: false,
    confidentiality: "Do not share unfinished or confidential project material without the project owner's permission.",
    reuseLicence: project.rights.defaultCreativeLicence || "All rights reserved",
    compensationExpectation: "Document any fee, commission or expense arrangement in a separate agreement reference.",
    creditExpectation: "Credit is recorded when a contribution is accepted into canon; feedback alone does not automatically create ownership.",
    notes: "GitHub permissions enforce technical access. This operating agreement describes creative authority and process.",
    updatedAt: now(),
  };
}

export function createDefaultAuthorityRecord(collaborator?: RightsCollaborator): AuthorityRecord {
  const role = collaborator?.role.toLowerCase().includes("owner") ? "project-owner" : "contributor";
  return {
    id: collaborator ? `authority-${collaborator.id}` : id("authority"),
    collaboratorId: collaborator?.id ?? "",
    collaboratorName: collaborator?.name || collaborator?.creditedAs || "New contributor",
    role,
    authority: collaborationRoles.find((item) => item.id === role)?.defaultAuthority ?? ["view", "comment"],
    scope: collaborator?.contribution ?? "",
    delegatedBy: "",
    agreementReference: collaborator?.agreementReference ?? "",
    active: true,
    updatedAt: now(),
  };
}

export function createDefaultContributionBrief(project: PlotPickleProject): ContributionBrief {
  return {
    id: id("contribution-brief"),
    title: "New contribution brief",
    template: briefTemplates[0],
    contributorId: "",
    contributorName: "",
    requestedRole: "contributor",
    decisionMaker: project.rights.projectOwner || "Project owner",
    targetKind: "project",
    targetId: project.id,
    targetLabel: "Whole project",
    problem: "",
    storyPurpose: "",
    canonLocks: "",
    mustNotChange: "",
    preferredOutput: "Anchored review notes or a bounded PlotPickle proposal",
    creativeFreedom: "bounded",
    dueDate: "",
    reviewWindow: "",
    privacy: project.collaboration.provider === "github" ? "private-repository" : "local-only",
    creditExpectation: "",
    compensationReference: "",
    ownershipReference: "",
    licenceReference: project.rights.defaultCreativeLicence,
    acceptanceCriteria: "",
    relatedReviewThreadIds: [],
    sourceRecordIds: [],
    previousProposalNumbers: [],
    status: "draft",
    createdAt: now(),
    updatedAt: now(),
  };
}

export function createDefaultProposalPacket(project: PlotPickleProject, brief?: ContributionBrief): ProposalReviewPacket {
  return {
    id: id("proposal-packet"),
    briefId: brief?.id ?? "",
    title: brief?.title ? `${brief.title} proposal` : `Proposal for ${project.metadata.title}`,
    contributorId: brief?.contributorId ?? "",
    contributorName: brief?.contributorName ?? "",
    changed: "",
    reason: brief?.problem ?? "",
    audienceEffect: brief?.storyPurpose ?? "",
    affectedAreas: brief?.targetLabel ? [brief.targetLabel] : [],
    beforeAfterEvidence: "",
    dependencies: "",
    characterEffects: "",
    continuityEffects: "",
    runtimeProductionEffects: "",
    rightsEffects: "",
    newCanonAssumptions: "",
    unresolvedQuestions: "",
    alternativesConsidered: "",
    sourceRecordIds: brief?.sourceRecordIds ?? [],
    aiProvenanceIds: [],
    requestedCredit: brief?.creditExpectation ?? "",
    inspectClosely: brief?.canonLocks ?? "",
    baseRevision: project.collaboration.lastPulledCommit,
    pullRequestNumber: null,
    status: "draft",
    createdAt: now(),
    updatedAt: now(),
  };
}

export function createDefaultDecision(project: PlotPickleProject, packet?: ProposalReviewPacket): CollaborationDecision {
  return {
    id: id("collaboration-decision"),
    proposalPacketId: packet?.id ?? "",
    pullRequestNumber: packet?.pullRequestNumber ?? null,
    outcome: "deferred",
    decisionMaker: project.rights.projectOwner || "Project owner",
    decidedAt: now(),
    summary: packet?.title ?? "Collaboration decision",
    rationale: "",
    acceptedParts: "",
    declinedParts: "",
    resolvedReviewThreadIds: [],
    deferredReviewThreadIds: [],
    revisionSnapshotId: "",
    rightsUpdated: false,
    followUp: "",
  };
}

export function readCollaborationHandbook(project: PlotPickleProject): HandbookRecords {
  return {
    agreement: parseAll<CollaborationAgreement>(project, "agreement")[0] ?? createDefaultCollaborationAgreement(project),
    authorities: parseAll<AuthorityRecord>(project, "authority"),
    briefs: parseAll<ContributionBrief>(project, "brief"),
    proposalPackets: parseAll<ProposalReviewPacket>(project, "packet"),
    decisions: parseAll<CollaborationDecision>(project, "decision"),
    reviewNotes: parseAll<CategorizedReviewNote>(project, "review-note"),
  };
}

export function saveCollaborationAgreement(project: PlotPickleProject, agreement: CollaborationAgreement) {
  return upsertRecord(project, "agreement", { ...agreement, updatedAt: now() });
}

export function saveAuthorityRecord(project: PlotPickleProject, record: AuthorityRecord) {
  return upsertRecord(project, "authority", { ...record, authority: [...new Set(record.authority)], updatedAt: now() });
}

export function saveContributionBrief(project: PlotPickleProject, brief: ContributionBrief) {
  const anchor: ReviewAnchor = { kind: brief.targetKind, targetId: brief.targetId, label: brief.targetLabel || "Contribution target" };
  return upsertRecord(project, "brief", { ...brief, updatedAt: now() }, anchor);
}

export function saveProposalPacket(project: PlotPickleProject, packet: ProposalReviewPacket) {
  const brief = readCollaborationHandbook(project).briefs.find((item) => item.id === packet.briefId);
  const anchor: ReviewAnchor = brief
    ? { kind: brief.targetKind, targetId: brief.targetId, label: brief.targetLabel || "Proposal target" }
    : projectAnchor(project);
  return upsertRecord(project, "packet", { ...packet, affectedAreas: [...new Set(packet.affectedAreas)], updatedAt: now() }, anchor);
}

export function saveCategorizedReviewNote(project: PlotPickleProject, note: CategorizedReviewNote) {
  return upsertRecord(project, "review-note", { ...note, updatedAt: now() }, note.anchor);
}

export function recordCollaborationDecision(project: PlotPickleProject, decision: CollaborationDecision) {
  const timestamp = now();
  const snapshotLabel = `Collaboration decision: ${decision.summary || decision.outcome}`;
  const withSnapshot = createRevisionSnapshot(project, snapshotLabel, `${decision.outcome}. ${decision.rationale}`);
  const snapshotId = withSnapshot.revisions.at(-1)?.id ?? "";
  const savedDecision = { ...decision, decidedAt: timestamp, revisionSnapshotId: snapshotId };
  return upsertRecord(withSnapshot, "decision", savedDecision);
}

export function addRightsCollaborator(project: PlotPickleProject, input: Partial<RightsCollaborator>) {
  const timestamp = now();
  const collaborator: RightsCollaborator = {
    id: input.id || id("collaborator"),
    name: input.name || "New contributor",
    role: input.role || "Contributor",
    contribution: input.contribution || "",
    ownershipShare: input.ownershipShare || "No ownership recorded",
    agreementReference: input.agreementReference || "",
    creditedAs: input.creditedAs || input.name || "",
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const next = cloneProject(project);
  const exists = next.rights.collaborators.some((item) => item.id === collaborator.id);
  next.rights.collaborators = exists
    ? next.rights.collaborators.map((item) => item.id === collaborator.id ? collaborator : item)
    : [...next.rights.collaborators, collaborator];
  next.metadata.updatedAt = timestamp;
  return next;
}

export function buildTargetOptions(project: PlotPickleProject) {
  const options: Array<ReviewAnchor & { value: string }> = [
    { value: `project:${project.id}`, kind: "project", targetId: project.id, label: "Whole project" },
    { value: "story:logline", kind: "story-field", targetId: "story.logline", label: "Story: Logline" },
    { value: "story:theme", kind: "story-field", targetId: "story.theme", label: "Story: Theme and anti-theme" },
    { value: "story:ending", kind: "story-field", targetId: "story.ending", label: "Story: Ending" },
  ];
  project.blocks.forEach((block) => {
    options.push({ value: `block:${block.id}`, kind: "block", targetId: block.id, label: `Block ${block.number}: ${block.title}` });
    block.scenes.forEach((scene) => options.push({ value: `scene:${scene.id}`, kind: "scene", targetId: scene.id, label: `Block ${block.number} · Scene ${scene.number}: ${scene.title}` }));
  });
  project.characters.forEach((character) => options.push({ value: `character:${character.id}`, kind: "character", targetId: character.id, label: `Character: ${character.name}` }));
  project.screenplay.draftElements.forEach((element) => options.push({ value: `screenplay:${element.id}`, kind: "screenplay-element", targetId: element.id, label: `${element.type} · Block ${element.blockNumber}.${element.miniBlockNumber}` }));
  return options;
}

export function buildWelcomeCardMarkdown(project: PlotPickleProject, agreement: CollaborationAgreement, authority?: AuthorityRecord, brief?: ContributionBrief) {
  const model = collaborationModels.find((item) => item.id === agreement.model);
  const role = collaborationRoles.find((item) => item.id === authority?.role);
  return [
    `# Welcome to ${project.metadata.title}`,
    "",
    `Project owner: ${agreement.ownerName || project.rights.projectOwner || "Project owner"}`,
    `Collaboration model: ${model?.label || agreement.model}`,
    `Your role: ${role?.label || authority?.role || brief?.requestedRole || "Reviewer or contributor"}`,
    `Canonical authority: ${agreement.canonicalAuthority}`,
    `Privacy and sharing: ${agreement.privacy}. ${agreement.confidentiality}`,
    `Current brief: ${brief?.title || "No contribution brief selected"}`,
    `Target area: ${brief?.targetLabel || "To be agreed"}`,
    `Purpose: ${brief?.problem || "Review the current material within the agreed scope."}`,
    `Do not change: ${brief?.mustNotChange || "Follow the current canon and continuity locks."}`,
    `Submit: Work locally, preserve unfinished drafts, and submit anchored feedback or a bounded proposal for review.` ,
    `Decision path: ${agreement.canonicalAuthority} decides what becomes canonical unless a written agreement grants shared authority.`,
    `Credit / agreement: ${brief?.creditExpectation || agreement.creditExpectation} ${brief?.ownershipReference || ""}`.trim(),
    `Reuse licence: ${agreement.reuseLicence}. Public access and reuse permission are separate decisions.`,
    `Review timing: ${brief?.reviewWindow || agreement.responseExpectation}`,
    "",
    "GitHub terms are secondary: approved story → local draft → proposal → review → decision → canon.",
  ].join("\n");
}

export function buildWelcomeCardHtml(project: PlotPickleProject, agreement: CollaborationAgreement, authority?: AuthorityRecord, brief?: ContributionBrief) {
  const text = buildWelcomeCardMarkdown(project, agreement, authority, brief);
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${project.metadata.title} contributor welcome</title><style>body{font-family:Arial,sans-serif;background:#f4f8f7;color:#183633;margin:0}main{max-width:860px;margin:40px auto;background:white;border:1px solid #cfdfdc;border-radius:24px;padding:42px;box-shadow:0 18px 55px rgba(20,60,55,.12)}pre{white-space:pre-wrap;font:16px/1.65 Arial,sans-serif;margin:0}footer{margin-top:28px;padding-top:18px;border-top:1px solid #dbe7e5;color:#58736f;font-size:13px}</style></head><body><main><pre>${escaped}</pre><footer>Generated locally by PlotPickle. Invitation, repository access, credit, ownership and licensing remain separate decisions.</footer></main></body></html>`;
}

export function buildProposalSummary(packet: ProposalReviewPacket) {
  return [
    `Proposal packet: ${packet.title}`,
    `Contributor: ${packet.contributorName || "Not recorded"}`,
    `Base revision: ${packet.baseRevision || "Pull the approved story before submission"}`,
    `What changed: ${packet.changed}`,
    `Why: ${packet.reason}`,
    `Audience / story effect: ${packet.audienceEffect}`,
    `Affected areas: ${packet.affectedAreas.join(", ") || "Not specified"}`,
    `Before / after evidence: ${packet.beforeAfterEvidence}`,
    `Dependencies: ${packet.dependencies}`,
    `Character effects: ${packet.characterEffects}`,
    `Continuity effects: ${packet.continuityEffects}`,
    `Runtime / production effects: ${packet.runtimeProductionEffects}`,
    `Rights / provenance: ${packet.rightsEffects}`,
    `New canon assumptions: ${packet.newCanonAssumptions}`,
    `Unresolved questions: ${packet.unresolvedQuestions}`,
    `Alternatives considered: ${packet.alternativesConsidered}`,
    `Requested credit: ${packet.requestedCredit}`,
    `Inspect closely: ${packet.inspectClosely}`,
  ].join("\n");
}

export function latestProposalPacket(project: PlotPickleProject) {
  return readCollaborationHandbook(project).proposalPackets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function contextualCollaborationQuestions(project: PlotPickleProject, blockNumber: number, sceneId = "", characterId = "") {
  const block = project.blocks.find((item) => item.number === blockNumber) ?? project.blocks[0];
  const scene = block.scenes.find((item) => item.id === sceneId) ?? block.scenes[0];
  const character = project.characters.find((item) => item.id === characterId);
  const act = block.act;
  const stage = act === 1
    ? ["Does this contribution clarify the story promise, world, character condition and originating problem?", "Does it contradict approved character, setting, Ghost or Catalyst material?", "Does it create a compelling question without explaining too much?"]
    : act === 2
      ? ["Does the change alter the protagonist's objective, strategy, pressure or relationships?", "What consequence now affects later Blocks?", "Does it repeat an obstacle or meaningfully change the problem?"]
      : act === 3
        ? ["Does the change follow from earlier choices and setups?", "Does it strengthen or weaken the crisis, revelation or cost?", "Which arc, Story Thread or payoff now requires adjustment?"]
        : ["Does the ending answer the central dramatic question?", "Does the final choice prove change, refusal or consequence?", "Are remaining threads, rights, production and continuity effects accounted for?"];
  return [
    ...stage,
    `Selected Block evidence: goal “${block.goal || "not defined"}”; conflict “${block.conflict || "not defined"}”; consequence “${block.consequence || "not defined"}”.`,
    `Selected scene: ${scene.title || `Scene ${scene.number}`}. What audience experience or factual conflict should the reviewer report before prescribing a fix?`,
    character ? `For ${character.name}, does the proposal preserve or deliberately change the want, need, Ghost, Voiceprint and arc evidence?` : "Which characters gain or lose agency, pressure, information or consequence?",
    "Is the feedback required, continuity, rights, craft, question, preference or praise—and who has authority to decide?",
  ];
}

export function collaborationSourceAliases() {
  return [
    "Your Role and Key Questions",
    "Process Post-Submission",
    "Feedback and Communication",
    "Unlimited Contributions",
    "Evolving Together",
    "Act review questions",
    "Afterglow collaborator guide",
    "million minds",
    "collaborator welcome",
    "contributor onboarding",
  ];
}
