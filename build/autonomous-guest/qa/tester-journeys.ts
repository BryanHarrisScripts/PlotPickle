import { autonomousGuestRegisteredRouteIds } from "../recovery/route-task-policy";
import type { AutonomousQaTesterRole } from "./test-campaign";

export const AUTONOMOUS_QA_EXECUTION_ADAPTERS = [
  "windows-installer",
  "focused-uat",
  "autonomous-story-reference",
  "deterministic-boundary",
] as const;

export type AutonomousQaExecutionAdapter = (typeof AUTONOMOUS_QA_EXECUTION_ADAPTERS)[number];

export type AutonomousQaTesterJourney = Readonly<{
  role: AutonomousQaTesterRole;
  adapter: AutonomousQaExecutionAdapter;
  routeIds: readonly string[];
  deterministicRefs: readonly string[];
  requiresWindows: boolean;
  requiresApplicationLifecycle: boolean;
  referenceWorkingCopy: boolean;
}>;

const JOURNEYS: readonly AutonomousQaTesterJourney[] = [
  {
    role: "fresh-install",
    adapter: "windows-installer",
    routeIds: [],
    deterministicRefs: [
      "tests/issue-1456-windows-installer.test.mjs",
      ".github/workflows/windows-installer.yml",
    ],
    requiresWindows: true,
    requiresApplicationLifecycle: true,
    referenceWorkingCopy: false,
  },
  {
    role: "beginner-writer",
    adapter: "focused-uat",
    routeIds: ["library", "learn", "plan", "build"],
    deterministicRefs: [
      "scripts/run-uat-autopilot.mjs",
      "config/uat-autopilot-registry.json",
    ],
    requiresWindows: false,
    requiresApplicationLifecycle: true,
    referenceWorkingCopy: false,
  },
  {
    role: "full-story-journey",
    adapter: "autonomous-story-reference",
    routeIds: [
      "library",
      "learn",
      "plan",
      "build",
      "story-decisions",
      "story-workbench",
      "visual-readiness",
      "storyboard",
      "production-shots",
      "previs-animatic",
      "write",
      "edit",
      "refine",
      "reports",
    ],
    deterministicRefs: [
      "scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs",
      "scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs",
    ],
    requiresWindows: false,
    requiresApplicationLifecycle: true,
    referenceWorkingCopy: true,
  },
  {
    role: "visual-production",
    adapter: "autonomous-story-reference",
    routeIds: ["visual-readiness", "storyboard", "production-shots", "previs-animatic"],
    deterministicRefs: [
      "scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs",
      "config/uat-autopilot-registry.json",
    ],
    requiresWindows: false,
    requiresApplicationLifecycle: true,
    referenceWorkingCopy: true,
  },
  {
    role: "persistence-recovery",
    adapter: "autonomous-story-reference",
    routeIds: ["library", "story-decisions", "story-workbench", "visual-readiness", "storyboard", "previs-animatic"],
    deterministicRefs: [
      "scripts/creative-uat/autonomous/application-lifecycle.mjs",
      "scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs",
    ],
    requiresWindows: false,
    requiresApplicationLifecycle: true,
    referenceWorkingCopy: true,
  },
  {
    role: "adversarial-boundary",
    adapter: "deterministic-boundary",
    routeIds: ["story-decisions", "story-workbench"],
    deterministicRefs: [
      "tests/issue-1553-autonomous-story-decision-authority.test.mjs",
      "tests/issue-1569-autonomous-guest-task-lifecycle.test.mjs",
    ],
    requiresWindows: false,
    requiresApplicationLifecycle: false,
    referenceWorkingCopy: false,
  },
] as const;

export function autonomousQaTesterJourneys(): readonly AutonomousQaTesterJourney[] {
  const registered = new Set(autonomousGuestRegisteredRouteIds());
  const roles = new Set<string>();
  for (const journey of JOURNEYS) {
    if (roles.has(journey.role)) throw new Error(`Autonomous QA tester role ${journey.role} has more than one journey owner.`);
    roles.add(journey.role);
    if (journey.routeIds.some((routeId) => !registered.has(routeId))) {
      throw new Error(`Autonomous QA tester ${journey.role} contains an unregistered product route.`);
    }
    if (!journey.deterministicRefs.length) throw new Error(`Autonomous QA tester ${journey.role} has no deterministic execution evidence.`);
  }
  return JOURNEYS;
}

export function autonomousQaTesterJourney(role: AutonomousQaTesterRole): AutonomousQaTesterJourney {
  const journey = autonomousQaTesterJourneys().find((candidate) => candidate.role === role);
  if (!journey) throw new Error(`Autonomous QA tester role ${role} has no bounded journey.`);
  return journey;
}
