import { normalizeStoryResult, reduceStoryResults } from "./story-workflow-core.mjs";

export const STORY_COUNCIL_VERSION = 1;

export const STORY_COUNCIL_DECISION_CLASSES = [
  "no-action",
  "informational-finding",
  "bounded-proposal",
  "alternative-choice",
  "unresolved-conflict",
  "blocked-prerequisite",
];

export const STORY_COUNCIL_SPECIALISTS = Object.freeze([
  {
    agentId: "sage-brinewick",
    buzzActorId: "sage-brinewick",
    responsibility: "curriculum-coordination",
    coordinator: true,
    workerEligible: false,
    requiredReadScope: "curriculum",
  },
  {
    agentId: "tamsin-hearthquill",
    buzzActorId: "tamsin-hearthquill",
    responsibility: "foundations-application",
    coordinator: false,
    workerEligible: true,
    requiredReadScope: "foundations-fields",
  },
  {
    agentId: "quillan-reedcloak",
    buzzActorId: "quillan-reedcloak",
    responsibility: "creative-coordination",
    coordinator: true,
    workerEligible: false,
    requiredReadScope: "current-task-proposals",
  },
  {
    agentId: "elowen-mapweaver",
    buzzActorId: "elowen-mapweaver",
    responsibility: "structure-causality",
    coordinator: false,
    workerEligible: true,
    requiredReadScope: "story-map",
  },
  {
    agentId: "mira-threadmere",
    buzzActorId: "mira-threadmere",
    responsibility: "continuity",
    coordinator: false,
    workerEligible: true,
    requiredReadScope: "ppf-revision-history",
  },
  {
    agentId: "critics-circle",
    buzzActorId: "critics-circle",
    responsibility: "independent-critique",
    coordinator: false,
    workerEligible: true,
    requiredReadScope: "approved-project-context",
  },
  {
    agentId: "marquee-director",
    buzzActorId: "marquee-director",
    responsibility: "visual-development",
    coordinator: false,
    workerEligible: true,
    requiredReadScope: "approved-visual-continuity",
  },
  {
    agentId: "orin-ledgerbark",
    buzzActorId: "orin-ledgerbark",
    responsibility: "provenance-lookup",
    coordinator: false,
    workerEligible: true,
    requiredReadScope: "owner-approved-buzz-history",
  },
]);

const SPECIALIST_BY_ID = new Map(STORY_COUNCIL_SPECIALISTS.map((entry) => [entry.agentId, entry]));
const DECISION_BY_GATE = Object.freeze({
  "auto-check-complete": "no-action",
  informational: "informational-finding",
  "proposal-review": "bounded-proposal",
  "creative-choice": "alternative-choice",
  conflict: "unresolved-conflict",
  blocked: "blocked-prerequisite",
});
const HUMAN_GATE_WEIGHT = Object.freeze({
  "auto-check-complete": 0,
  informational: 1,
  "proposal-review": 2,
  "creative-choice": 3,
  blocked: 4,
  conflict: 5,
});

function councilString(value, maximum = 1_000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function councilStrings(value, maximum = 128, itemMaximum = 240) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => councilString(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

function councilIsoTimestamp(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function addSpecialist(target, agentId, reason) {
  const specialist = SPECIALIST_BY_ID.get(agentId);
  if (!specialist?.workerEligible || target.some((entry) => entry.agentId === agentId)) return;
  target.push({
    agentId,
    responsibility: specialist.responsibility,
    reason: councilString(reason, 480),
    independent: specialist.responsibility === "independent-critique" || specialist.responsibility === "provenance-lookup",
  });
}

function storyRefsArePrivate(refs) {
  return councilStrings(refs).some((ref) => /^(?:ppf|project|screenplay|file|asset):/i.test(ref));
}

function councilWorkText(workItem) {
  const parts = [
    workItem?.frontier,
    workItem?.curriculumRequirementId,
    workItem?.reason,
    ...(workItem?.targetRefs || []),
    ...(workItem?.evidenceRefs || []),
  ];
  const text = parts.join(" ");
  return text.toLowerCase();
}

export function storyCouncilSpecialistByAgentId(agentId) {
  return SPECIALIST_BY_ID.get(councilString(agentId, 180)) ?? null;
}

export function selectStoryCouncilSpecialists(workItem, input = {}) {
  if (!workItem || typeof workItem !== "object") throw new Error("Story Council requires one structured Story Work Item.");
  const workItemId = councilString(workItem.workItemId, 180);
  const baseRevision = councilString(workItem.baseRevision, 120);
  if (!workItemId || !baseRevision) throw new Error("Story Council requires workItemId and baseRevision.");

  const maximum = Math.max(1, Math.min(3, Number.isFinite(Number(input.maxSpecialists)) ? Math.floor(Number(input.maxSpecialists)) : 3));
  const text = councilWorkText(workItem);
  const specialists = [];
  const assigned = storyCouncilSpecialistByAgentId(workItem.assignedAgentId);
  if (assigned?.workerEligible) addSpecialist(specialists, assigned.agentId, "The Story Workflow already assigned this approved specialist responsibility.");

  if (/foundations|premise|protagonist|theme|stakes/.test(text)) {
    addSpecialist(specialists, "tamsin-hearthquill", "The work item belongs to Foundations application and reviewable PLAN proposal work.");
  }
  if (/character|motivation|relationship|continuity|voice|want|need/.test(text)) {
    addSpecialist(specialists, "mira-threadmere", "The target contains character or continuity evidence that benefits from an independent continuity pass.");
  }
  if (/structure|scene|block|beat|causality|stakes|pacing|turn/.test(text)) {
    addSpecialist(specialists, "elowen-mapweaver", "The target contains structure or causality evidence covered by the Story Architect contract.");
  }
  if (/visual|poster|trailer|key-art|marquee/.test(text)) {
    addSpecialist(specialists, "marquee-director", "The work item explicitly targets approved visual-development evidence.");
  }
  if (/buzz-history|guildhall|provenance|receipt/.test(text)) {
    addSpecialist(specialists, "orin-ledgerbark", "The work item explicitly requests owner-approved BUZZ provenance/history lookup.");
  }

  if (workItem.severity === "high" || workItem.kind === "audit" || workItem.kind === "re-evaluation" || specialists.length < 2) {
    addSpecialist(specialists, "critics-circle", "An independent holistic critique supplies a separate bounded check without becoming canon authority.");
  }

  if (!specialists.length) addSpecialist(specialists, "critics-circle", "No narrower approved specialist matched, so use one bounded independent critique rather than waking the full roster.");
  const selected = specialists.slice(0, maximum);
  const coordinatorAgentId = /foundations|curriculum/.test(text) ? "sage-brinewick" : "quillan-reedcloak";
  const allRefs = [...(workItem.targetRefs || []), ...(workItem.evidenceRefs || [])];
  const privateEvidence = storyRefsArePrivate(allRefs);
  const buzzAvailable = Boolean(input.buzzAvailable);
  const publicDiscussionAllowed = Boolean(input.allowPublicDiscussion) && !privateEvidence;
  const visual = selected.some((entry) => entry.agentId === "marquee-director");
  const buzzMode = !buzzAvailable
    ? "local-only"
    : privateEvidence
      ? "private-story-room"
      : publicDiscussionAllowed
        ? (visual ? "marquee" : "story-council")
        : "local-only";

  return {
    version: STORY_COUNCIL_VERSION,
    workItemId,
    baseRevision,
    coordinatorAgentId,
    specialists: selected,
    maxParallelism: Math.max(1, Math.min(2, selected.length)),
    buzz: {
      optional: true,
      mode: buzzMode,
      privateEvidence,
      transcriptRequired: false,
    },
  };
}

export function normalizeStoryCouncilContribution(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Story Council contribution must be a structured object.");
  const agentId = councilString(input.agentId, 180);
  const specialist = storyCouncilSpecialistByAgentId(agentId);
  if (!specialist?.workerEligible) throw new Error(`Agent ${agentId || "missing"} is not an approved Story Council worker responsibility.`);
  const runId = councilString(input.runId, 180);
  const baseRevision = councilString(input.baseRevision, 120);
  if (!runId || !baseRevision) throw new Error("Story Council contribution requires runId and baseRevision.");

  const result = normalizeStoryResult({
    resultId: input.contributionId,
    workItemId: input.workItemId,
    kind: input.kind,
    targetRefs: input.targetRefs,
    evidenceRefs: input.evidenceRefs,
    curriculumRequirementId: input.curriculumRequirementId,
    principleRef: input.principleRef,
    severity: input.severity,
    confidence: input.confidence,
    changesCanon: input.changesCanon,
    explanation: input.explanation,
    proposal: input.proposal,
    alternatives: input.alternatives,
    affectedDownstreamRefs: input.affectedDownstreamRefs,
  });

  const transport = input.provenance?.transport === "buzz" ? "buzz" : "local-runtime";
  const roomClass = councilString(input.provenance?.roomClass, 80) || (transport === "buzz" ? "private-story-room" : "local-only");
  const buzzActorId = councilString(input.provenance?.buzzActorId, 180);
  const buzzActorPublicKey = councilString(input.provenance?.buzzActorPublicKey, 128);
  const buzzEventId = councilString(input.provenance?.buzzEventId, 180);
  const buzzSignatureVerified = input.provenance?.buzzSignatureVerified === true;
  if (transport === "buzz") {
    if (buzzActorId !== specialist.buzzActorId) throw new Error("Story Council BUZZ actor identity does not match the approved Agent Contract binding.");
    if (!buzzEventId || !buzzSignatureVerified) throw new Error("Story Council BUZZ contribution requires a verified signed event.");
    if (buzzActorPublicKey && !/^[a-f0-9]{64}$/i.test(buzzActorPublicKey)) throw new Error("Story Council BUZZ actor public key is invalid.");
    if (storyRefsArePrivate([...result.targetRefs, ...result.evidenceRefs]) && roomClass !== "private-story-room") {
      throw new Error("Private Story Council evidence may only use an authorized private Story Room BUZZ context.");
    }
  }

  return {
    version: STORY_COUNCIL_VERSION,
    contributionId: result.resultId,
    workItemId: result.workItemId,
    runId,
    agentId,
    responsibility: specialist.responsibility,
    baseRevision,
    targetRefs: result.targetRefs,
    findingClass: result.kind,
    evidenceRefs: result.evidenceRefs,
    curriculumRefs: councilStrings([
      input.curriculumRequirementId,
      input.principleRef,
      ...(input.curriculumRefs || []),
    ], 64, 360),
    severity: result.severity,
    confidence: result.confidence,
    changesCanon: result.changesCanon,
    explanation: result.explanation,
    proposal: result.proposal,
    alternatives: result.alternatives,
    affectedDownstreamRefs: result.affectedDownstreamRefs,
    agreementRefs: councilStrings(input.agreementRefs, 64, 180),
    disagreementRefs: councilStrings(input.disagreementRefs, 64, 180),
    humanGate: result.humanGate,
    provenance: {
      transport,
      roomClass,
      buzzActorId: transport === "buzz" ? buzzActorId : "",
      buzzActorPublicKey: transport === "buzz" ? buzzActorPublicKey : "",
      buzzEventId: transport === "buzz" ? buzzEventId : "",
      buzzSignatureVerified: transport === "buzz" ? true : false,
      recordedAt: councilIsoTimestamp(input.provenance?.recordedAt),
    },
  };
}

function strongestHumanGate(contributions, conflicts) {
  if (conflicts.length) return "conflict";
  return contributions.reduce((strongest, contribution) => (
    HUMAN_GATE_WEIGHT[contribution.humanGate] > HUMAN_GATE_WEIGHT[strongest] ? contribution.humanGate : strongest
  ), "auto-check-complete");
}

export function reduceStoryCouncilContributions(input) {
  const contributions = (Array.isArray(input) ? input : []).map(normalizeStoryCouncilContribution);
  const byWorkItem = new Map();
  for (const contribution of contributions) {
    const group = byWorkItem.get(contribution.workItemId) || [];
    group.push(contribution);
    byWorkItem.set(contribution.workItemId, group);
  }

  return [...byWorkItem.entries()].map(([workItemId, positions]) => {
    const reduced = reduceStoryResults(positions.map((position) => ({
      resultId: position.contributionId,
      workItemId: position.workItemId,
      kind: position.findingClass,
      targetRefs: position.targetRefs,
      evidenceRefs: position.evidenceRefs,
      curriculumRequirementId: position.curriculumRefs[0] || "",
      principleRef: position.curriculumRefs[1] || "",
      severity: position.severity,
      confidence: position.confidence,
      changesCanon: position.changesCanon,
      explanation: position.explanation,
      proposal: position.proposal,
      alternatives: position.alternatives,
      affectedDownstreamRefs: position.affectedDownstreamRefs,
    })));
    const explicitAgreements = positions.flatMap((position) => position.agreementRefs.map((ref) => ({ contributionId: position.contributionId, ref })));
    const duplicateAgreements = reduced.results.flatMap((result) => result.duplicateResultIds.map((duplicateId) => ({ contributionId: result.resultId, ref: duplicateId })));
    const explicitDisagreements = positions.flatMap((position) => position.disagreementRefs.map((ref) => ({ contributionId: position.contributionId, ref })));
    const conflictDisagreements = reduced.conflicts.flatMap((conflict) => conflict.resultIds.map((resultId) => ({ contributionId: resultId, ref: conflict.targetKey })));
    const humanGate = strongestHumanGate(positions, reduced.conflicts);
    const decisionClass = DECISION_BY_GATE[humanGate];
    const evidenceRefs = councilStrings(positions.flatMap((position) => position.evidenceRefs), 128, 240);
    const affectedDownstreamRefs = councilStrings(positions.flatMap((position) => position.affectedDownstreamRefs), 128, 240);
    const disputed = explicitDisagreements.length + conflictDisagreements.length;
    const agreed = explicitAgreements.length + duplicateAgreements.length;
    const requiresHuman = !["auto-check-complete", "informational"].includes(humanGate);
    const summary = `Council checked ${positions.length} structured ${positions.length === 1 ? "position" : "positions"}; ${agreed ? `${agreed} agreement link${agreed === 1 ? "" : "s"}` : "no explicit agreement"}; ${disputed ? `${disputed} disagreement link${disputed === 1 ? "" : "s"}` : "no unresolved disagreement"}. ${requiresHuman ? "Human judgment or approval is required." : "No Human decision is required by this reduction."}`;

    return {
      version: STORY_COUNCIL_VERSION,
      workItemId,
      baseRevision: positions[0]?.baseRevision || "",
      contributionIds: positions.map((position) => position.contributionId),
      positions,
      agreements: [...duplicateAgreements, ...explicitAgreements],
      disagreements: [...conflictDisagreements, ...explicitDisagreements],
      evidenceRefs,
      affectedDownstreamRefs,
      humanGate,
      decisionClass,
      requiresHuman,
      summary,
    };
  });
}
