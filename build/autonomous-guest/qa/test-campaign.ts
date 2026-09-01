import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { autonomousGuestRegisteredRouteIds } from "../recovery/route-task-policy";

export const AUTONOMOUS_QA_TESTER_ROLES = [
  "fresh-install",
  "beginner-writer",
  "full-story-journey",
  "visual-production",
  "persistence-recovery",
  "adversarial-boundary",
] as const;

export const AUTONOMOUS_QA_CAMPAIGN_TYPES = [
  "pr-exact-head",
  "main-smoke",
  "scheduled-smoke",
  "scheduled-deep",
  "release-candidate",
  "targeted-rerun",
] as const;

export const AUTONOMOUS_QA_ISOLATION_CLASSES = [
  "no-project",
  "temporary-test-project",
  "reference-working-copy",
] as const;

export const AUTONOMOUS_QA_FINAL_STATES = ["passed", "failed", "blocked", "flaky", "cancelled"] as const;

export type AutonomousQaTesterRole = (typeof AUTONOMOUS_QA_TESTER_ROLES)[number];
export type AutonomousQaCampaignType = (typeof AUTONOMOUS_QA_CAMPAIGN_TYPES)[number];
export type AutonomousQaIsolationClass = (typeof AUTONOMOUS_QA_ISOLATION_CLASSES)[number];
export type AutonomousQaFinalState = (typeof AUTONOMOUS_QA_FINAL_STATES)[number];

export type AutonomousQaBudget = Readonly<{
  maxActions: number;
  maxDurationMs: number;
  maxRequests: number;
  maxTokens: number;
  maxCloudCostUsd: number;
}>;

export type AutonomousQaCampaignInput = Readonly<{
  campaignId: string;
  campaignType: AutonomousQaCampaignType;
  testerRole: AutonomousQaTesterRole;
  commitSha: string;
  buildId: string;
  isolationClass: AutonomousQaIsolationClass;
  projectId?: string;
  referenceSourceId?: string;
  allowedRouteIds: readonly string[];
  assertionRefs: readonly string[];
  providerPolicyRef: string;
  paidCloudAllowed: boolean;
  budget: AutonomousQaBudget;
}>;

export type AutonomousQaCampaign = Readonly<{
  schemaVersion: 1;
  campaignId: string;
  campaignType: AutonomousQaCampaignType;
  testerRole: AutonomousQaTesterRole;
  commitSha: string;
  buildId: string;
  authorityClass: "delegated-guest-autonomous-operator";
  autonomousRunId: string;
  guestWorkspaceId: string;
  humanProfileId: "";
  isolationClass: AutonomousQaIsolationClass;
  projectId: string;
  referenceSourceId: string;
  allowedRouteIds: readonly string[];
  assertionRefs: readonly string[];
  providerPolicyRef: string;
  paidCloudAllowed: boolean;
  budget: AutonomousQaBudget;
  directStateMutationAllowed: false;
  sourceCodeMutationAllowed: false;
  humanCredentialAccessAllowed: false;
  humanCommunityPostingAllowed: false;
  aiSelfCertificationAllowed: false;
}>;

export type AutonomousQaRouteOutcome = Readonly<{
  routeId: string;
  disposition: "passed" | "failed" | "blocked" | "skipped";
  assertionRefs: readonly string[];
  evidenceRefs: readonly string[];
  timingMs: number;
}>;

export type AutonomousQaFinding = Readonly<{
  fingerprint: string;
  severity: "blocker" | "critical" | "major" | "minor" | "flaky";
  routeId: string;
  expectedRef: string;
  actualRef: string;
  reproductionRefs: readonly string[];
  linkedIssue: string;
}>;

export type AutonomousQaEvidenceInput = Readonly<{
  finalState: AutonomousQaFinalState;
  startedAt: string;
  completedAt: string;
  routeOutcomes: readonly AutonomousQaRouteOutcome[];
  findings?: readonly AutonomousQaFinding[];
  deterministicGateRefs: readonly string[];
  cleanupState: "clean" | "evidence-preserved" | "cleanup-blocked";
}>;

const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:/-]{1,239}$/i;
const SHA = /^[a-f0-9]{40}$/i;
const MAX_ROUTES = 32;
const MAX_REFS = 128;
const MAX_ACTIONS = 500;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
const MAX_REQUESTS = 2_000;
const MAX_TOKENS = 2_000_000;
const MAX_CLOUD_COST_USD = 1_000;
const MAX_TOKEN_LENGTH = 240;

function assertGuestAuthority(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous QA requires delegated non-Human Guest authority.");
  }
}

function safeToken(value: string, label: string, allowEmpty = false) {
  const normalized = String(value || "").trim();
  if (normalized.length > MAX_TOKEN_LENGTH) throw new Error(`Autonomous QA ${label} exceeds its bounded length.`);
  if (allowEmpty && normalized === "") return "";
  if (!SAFE_TOKEN.test(normalized)) throw new Error(`Autonomous QA ${label} is missing or invalid.`);
  return normalized;
}

function safeRefs(values: readonly string[], label: string, maximum = MAX_REFS) {
  const refs = [...new Set(values.map((value) => safeToken(value, label)))];
  if (refs.length > maximum) throw new Error(`Autonomous QA ${label} exceeds its bounded size.`);
  return Object.freeze(refs);
}

function integer(value: number, label: string, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Autonomous QA ${label} is outside its bounded range.`);
  return value;
}

function budget(value: AutonomousQaBudget, paidCloudAllowed: boolean): AutonomousQaBudget {
  const maxCloudCostUsd = Number(value.maxCloudCostUsd);
  if (!Number.isFinite(maxCloudCostUsd) || maxCloudCostUsd < 0 || maxCloudCostUsd > MAX_CLOUD_COST_USD) {
    throw new Error("Autonomous QA cloud budget is outside its bounded range.");
  }
  if (!paidCloudAllowed && maxCloudCostUsd !== 0) {
    throw new Error("Autonomous QA cannot carry a paid-cloud budget when paid cloud is not explicitly allowed.");
  }
  return Object.freeze({
    maxActions: integer(value.maxActions, "action budget", 1, MAX_ACTIONS),
    maxDurationMs: integer(value.maxDurationMs, "duration budget", 10_000, MAX_DURATION_MS),
    maxRequests: integer(value.maxRequests, "request budget", 1, MAX_REQUESTS),
    maxTokens: integer(value.maxTokens, "token budget", 0, MAX_TOKENS),
    maxCloudCostUsd: Number(maxCloudCostUsd.toFixed(4)),
  });
}

function timestamp(value: string, label: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Autonomous QA ${label} timestamp is invalid.`);
  return parsed.toISOString();
}

export function createAutonomousQaCampaign(authority: AutonomousGuestAuthority, input: AutonomousQaCampaignInput): AutonomousQaCampaign {
  assertGuestAuthority(authority);
  if (!(AUTONOMOUS_QA_TESTER_ROLES as readonly string[]).includes(input.testerRole)) throw new Error("Autonomous QA tester role is not approved.");
  if (!(AUTONOMOUS_QA_CAMPAIGN_TYPES as readonly string[]).includes(input.campaignType)) throw new Error("Autonomous QA campaign type is not approved.");
  if (!(AUTONOMOUS_QA_ISOLATION_CLASSES as readonly string[]).includes(input.isolationClass)) throw new Error("Autonomous QA isolation class is not approved.");
  if (!SHA.test(input.commitSha)) throw new Error("Autonomous QA requires an exact 40-character commit SHA.");

  const allowed = new Set(autonomousGuestRegisteredRouteIds());
  const allowedRouteIds = safeRefs(input.allowedRouteIds, "route ID", MAX_ROUTES);
  if (allowedRouteIds.some((routeId) => !allowed.has(routeId))) throw new Error("Autonomous QA campaign contains an unregistered product route.");

  const projectId = safeToken(input.projectId || "", "project ID", true);
  const referenceSourceId = safeToken(input.referenceSourceId || "", "reference source ID", true);
  if (input.isolationClass === "no-project" && (projectId || referenceSourceId)) throw new Error("No-project QA campaigns cannot bind a project or reference source.");
  if (input.isolationClass === "temporary-test-project" && !projectId) throw new Error("Temporary-project QA campaigns require an isolated project ID.");
  if (input.isolationClass === "reference-working-copy" && (!projectId || !referenceSourceId)) {
    throw new Error("Reference-working-copy QA campaigns require both a working-copy project and immutable reference source.");
  }

  return Object.freeze({
    schemaVersion: 1,
    campaignId: safeToken(input.campaignId, "campaign ID"),
    campaignType: input.campaignType,
    testerRole: input.testerRole,
    commitSha: input.commitSha.toLowerCase(),
    buildId: safeToken(input.buildId, "build ID"),
    authorityClass: authority.authorityClass,
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    humanProfileId: "",
    isolationClass: input.isolationClass,
    projectId,
    referenceSourceId,
    allowedRouteIds,
    assertionRefs: safeRefs(input.assertionRefs, "assertion reference"),
    providerPolicyRef: safeToken(input.providerPolicyRef, "provider policy reference"),
    paidCloudAllowed: input.paidCloudAllowed === true,
    budget: budget(input.budget, input.paidCloudAllowed === true),
    directStateMutationAllowed: false,
    sourceCodeMutationAllowed: false,
    humanCredentialAccessAllowed: false,
    humanCommunityPostingAllowed: false,
    aiSelfCertificationAllowed: false,
  });
}

export function createAutonomousQaEvidence(campaign: AutonomousQaCampaign, input: AutonomousQaEvidenceInput) {
  if (!(AUTONOMOUS_QA_FINAL_STATES as readonly string[]).includes(input.finalState)) throw new Error("Autonomous QA final state is invalid.");
  const startedAt = timestamp(input.startedAt, "start");
  const completedAt = timestamp(input.completedAt, "completion");
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new Error("Autonomous QA completion cannot precede campaign start.");
  if (!input.deterministicGateRefs.length) throw new Error("Autonomous QA evidence requires deterministic gate evidence; an AI verdict cannot certify the campaign.");

  const allowedRoutes = new Set(campaign.allowedRouteIds);
  const routeOutcomes = input.routeOutcomes.map((outcome) => {
    const routeId = safeToken(outcome.routeId, "evidence route ID");
    if (!allowedRoutes.has(routeId)) throw new Error("Autonomous QA evidence escaped the campaign route allow-list.");
    return Object.freeze({
      routeId,
      disposition: outcome.disposition,
      assertionRefs: safeRefs(outcome.assertionRefs, "route assertion reference"),
      evidenceRefs: safeRefs(outcome.evidenceRefs, "route evidence reference"),
      timingMs: integer(outcome.timingMs, "route timing", 0, MAX_DURATION_MS),
    });
  });
  const findings = [...(input.findings || [])].map((finding) => Object.freeze({
    fingerprint: safeToken(finding.fingerprint, "finding fingerprint"),
    severity: finding.severity,
    routeId: safeToken(finding.routeId, "finding route ID", true),
    expectedRef: safeToken(finding.expectedRef, "expected-result reference"),
    actualRef: safeToken(finding.actualRef, "actual-result reference"),
    reproductionRefs: safeRefs(finding.reproductionRefs, "reproduction reference"),
    linkedIssue: safeToken(finding.linkedIssue, "linked issue", true),
  }));

  return Object.freeze({
    schemaVersion: 1,
    campaignId: campaign.campaignId,
    commitSha: campaign.commitSha,
    buildId: campaign.buildId,
    testerRole: campaign.testerRole,
    authorityClass: campaign.authorityClass,
    guestWorkspaceId: campaign.guestWorkspaceId,
    finalState: input.finalState,
    startedAt,
    completedAt,
    routeOutcomes: Object.freeze(routeOutcomes),
    findings: Object.freeze(findings),
    deterministicGateRefs: safeRefs(input.deterministicGateRefs, "deterministic gate reference"),
    cleanupState: input.cleanupState,
    aiSelfCertified: false as const,
  });
}
