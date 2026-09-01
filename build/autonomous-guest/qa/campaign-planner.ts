import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { enqueueAutonomousGuestTask, type AutonomousGuestTask } from "../task-ledger";
import type { AutonomousGuestTaskPolicySnapshot } from "../task-lifecycle";
import {
  AUTONOMOUS_QA_TESTER_ROLES,
  type AutonomousQaCampaign,
  type AutonomousQaCampaignType,
  type AutonomousQaTesterRole,
} from "./test-campaign";
import { autonomousQaTesterJourney } from "./tester-journeys";

export type AutonomousQaRolePlan = Readonly<{
  role: AutonomousQaTesterRole;
  reasonRefs: readonly string[];
}>;

export type AutonomousQaCurrentPolicy = Readonly<{
  enabled: boolean;
  commitSha: string;
  allowedRoles: readonly AutonomousQaTesterRole[];
  satisfiedDependencyRefs: readonly string[];
  providerPolicyRef: string;
  providerAllowed: boolean;
  budgetAllowed: boolean;
  cancelled?: boolean;
}>;

const DEEP_CAMPAIGNS = new Set<AutonomousQaCampaignType>(["scheduled-deep", "release-candidate"]);

const PATH_RULES: readonly Readonly<{
  match: RegExp;
  roles: readonly AutonomousQaTesterRole[];
  reason: string;
}>[] = [
  {
    match: /^(windows\/|scripts\/windows-installer\/|scripts\/windows-(?:interaction|runtime)|start-plotpickle\.bat|\.github\/workflows\/windows-installer\.yml)/i,
    roles: ["fresh-install", "persistence-recovery"],
    reason: "changed:installer-runtime",
  },
  {
    match: /(learn|curriculum|foundations|settings|library)/i,
    roles: ["beginner-writer", "full-story-journey"],
    reason: "changed:beginner-story-surface",
  },
  {
    match: /(story-workflow|story-decisions|story-workbench|\bplan\b|\bbuild\b|\bwrite\b|\bedit\b|\brefine\b)/i,
    roles: ["full-story-journey", "persistence-recovery", "adversarial-boundary"],
    reason: "changed:story-authority",
  },
  {
    match: /(visual-readiness|storyboard|production-shots|previs|animatic|visual)/i,
    roles: ["visual-production", "full-story-journey"],
    reason: "changed:visual-production",
  },
  {
    match: /(autonomous-guest|creative-uat\/autonomous|guest-authority|uat-autopilot-registry|vite\.config)/i,
    roles: ["persistence-recovery", "adversarial-boundary", "full-story-journey"],
    reason: "changed:autonomous-runtime",
  },
  {
    match: /(local-ai|provider|comfyui|ollama|llama|openai)/i,
    roles: ["beginner-writer", "full-story-journey", "adversarial-boundary"],
    reason: "changed:provider-runtime",
  },
  {
    match: /(buzz|community|profile|auth)/i,
    roles: ["adversarial-boundary", "full-story-journey"],
    reason: "changed:identity-community",
  },
];

function normalizedPath(value: string) {
  const path = String(value || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.length > 512 || path.startsWith("/") || path.includes("../") || /[\u0000-\u001f\u007f]/.test(path)) {
    throw new Error("Autonomous QA changed path is missing or invalid.");
  }
  return path;
}

export function planAutonomousQaRoles(input: Readonly<{
  campaignType: AutonomousQaCampaignType;
  changedPaths: readonly string[];
}>): readonly AutonomousQaRolePlan[] {
  if (DEEP_CAMPAIGNS.has(input.campaignType)) {
    return Object.freeze(AUTONOMOUS_QA_TESTER_ROLES.map((role) => Object.freeze({ role, reasonRefs: Object.freeze([`campaign:${input.campaignType}`]) })));
  }

  const selected = new Map<AutonomousQaTesterRole, Set<string>>();
  for (const rawPath of input.changedPaths) {
    const path = normalizedPath(rawPath);
    for (const rule of PATH_RULES) {
      if (!rule.match.test(path)) continue;
      for (const role of rule.roles) {
        const reasons = selected.get(role) ?? new Set<string>();
        reasons.add(rule.reason);
        selected.set(role, reasons);
      }
    }
  }

  if (!selected.size && input.campaignType !== "pr-exact-head") {
    selected.set("beginner-writer", new Set([`campaign:${input.campaignType}`]));
  }

  return Object.freeze(AUTONOMOUS_QA_TESTER_ROLES
    .filter((role) => selected.has(role))
    .map((role) => Object.freeze({ role, reasonRefs: Object.freeze([...(selected.get(role) ?? [])]) })));
}

export async function enqueueAutonomousQaCampaignTask(input: Readonly<{
  authority: AutonomousGuestAuthority;
  campaign: AutonomousQaCampaign;
  reasonRefs: readonly string[];
  notBefore?: string;
  expiresAt?: string;
}>) {
  const journey = autonomousQaTesterJourney(input.campaign.testerRole);
  const schedulingScope = input.campaign.projectId || `qa-${input.campaign.campaignId}`;
  return enqueueAutonomousGuestTask(input.authority, {
    projectId: schedulingScope,
    taskKind: `qa:${input.campaign.testerRole}`,
    targetRoute: "/",
    baseRevision: input.campaign.commitSha,
    dependencyRefs: Object.freeze([...new Set([...input.campaign.assertionRefs, ...input.reasonRefs, ...journey.deterministicRefs])]),
    notBefore: input.notBefore,
    expiresAt: input.expiresAt,
    priority: input.campaign.campaignType === "release-candidate" ? 50 : 0,
    maxAttempts: 2,
    affectsCanon: false,
    providerPolicyRef: input.campaign.providerPolicyRef,
    dedupeKey: `qa:${input.campaign.commitSha.slice(0, 16)}:${input.campaign.campaignType}:${input.campaign.testerRole}`,
  });
}

function qaTaskRole(task: AutonomousGuestTask): AutonomousQaTesterRole | null {
  const match = /^qa:(.+)$/.exec(task.taskKind);
  const role = match?.[1] || "";
  return (AUTONOMOUS_QA_TESTER_ROLES as readonly string[]).includes(role) ? role as AutonomousQaTesterRole : null;
}

export function resolveAutonomousQaTaskPolicy(
  authority: AutonomousGuestAuthority,
  task: AutonomousGuestTask,
  policy: AutonomousQaCurrentPolicy,
): AutonomousGuestTaskPolicySnapshot {
  const role = qaTaskRole(task);
  const allowed = role !== null && policy.allowedRoles.includes(role);
  const namespaceMatches = task.autonomousRunId === authority.autonomousRunId && task.guestWorkspaceId === authority.workspaceId;
  return Object.freeze({
    guestEnabled: policy.enabled === true && namespaceMatches,
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    projectId: task.projectId,
    allowListedTaskKinds: Object.freeze(allowed ? [task.taskKind] : []),
    currentRevision: policy.commitSha.toLowerCase(),
    satisfiedDependencyRefs: Object.freeze([...policy.satisfiedDependencyRefs]),
    providerPolicyRef: policy.providerPolicyRef,
    providerAllowed: policy.providerAllowed === true,
    budgetAllowed: policy.budgetAllowed === true,
    cancelled: policy.cancelled === true,
  });
}

export function createAutonomousQaTaskPolicyResolver(authority: AutonomousGuestAuthority, policy: AutonomousQaCurrentPolicy) {
  return (task: AutonomousGuestTask) => resolveAutonomousQaTaskPolicy(authority, task, policy);
}
