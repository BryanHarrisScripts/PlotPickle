import type { PlotPickleProject, ProjectCollaboration } from "./project";

export const COLLABORATION_MODES = [
  "local-story",
  "writers-room",
  "repository-collaboration",
] as const;

export type CollaborationMode = (typeof COLLABORATION_MODES)[number];

export type CollaborationModeInput = Partial<ProjectCollaboration> & {
  mode?: unknown;
};

export type CollaborationModeRecord = ProjectCollaboration & {
  mode: CollaborationMode;
};

export type CollaborationModeRequirements = {
  localPpf: true;
  localBackups: true;
  buzz: "optional" | "required";
  github: "optional" | "required";
};

export type CollaborationService = "buzz" | "github";
export type CollaborationServiceState = "configured" | "unconfigured" | "unknown";
export type CollaborationTransitionStatus = "ready" | "attention";

export type CollaborationTransitionContext = Partial<Record<CollaborationService, CollaborationServiceState | boolean>>;

export type CollaborationModeTransitionPlan = {
  from: CollaborationMode;
  to: CollaborationMode;
  changed: boolean;
  status: CollaborationTransitionStatus;
  requiredServices: CollaborationService[];
  missingRequiredServices: CollaborationService[];
  automaticActions: readonly [];
  preserves: typeof COLLABORATION_TRANSITION_PRESERVES;
  guidance: string;
};

export type CollaborationModeTransitionResult = {
  project: PlotPickleProject;
  plan: CollaborationModeTransitionPlan;
};

const MODE_REQUIREMENTS: Record<CollaborationMode, CollaborationModeRequirements> = {
  "local-story": {
    localPpf: true,
    localBackups: true,
    buzz: "optional",
    github: "optional",
  },
  "writers-room": {
    localPpf: true,
    localBackups: true,
    buzz: "required",
    github: "optional",
  },
  "repository-collaboration": {
    localPpf: true,
    localBackups: true,
    buzz: "optional",
    github: "required",
  },
};

const SERVICE_ORDER: CollaborationService[] = ["buzz", "github"];

export const COLLABORATION_TRANSITION_PRESERVES = {
  canonicalPpf: true,
  localBackups: true,
  githubConfiguration: true,
  githubHistory: true,
  buzzConfiguration: true,
  buzzIdentity: true,
  storyCanon: true,
} as const;

export function isCollaborationMode(value: unknown): value is CollaborationMode {
  return typeof value === "string" && COLLABORATION_MODES.includes(value as CollaborationMode);
}

export function normalizeCollaborationMode(value: unknown): CollaborationMode {
  return isCollaborationMode(value) ? value : "local-story";
}

export function collaborationModeRequirements(mode: unknown): CollaborationModeRequirements {
  return MODE_REQUIREMENTS[normalizeCollaborationMode(mode)];
}

export function withCollaborationMode(
  collaboration: CollaborationModeInput,
  mode: unknown,
): CollaborationModeRecord {
  return {
    ...collaboration,
    mode: normalizeCollaborationMode(mode),
  } as CollaborationModeRecord;
}

export function normalizeCollaborationModeRecord(
  collaboration: CollaborationModeInput,
): CollaborationModeRecord {
  return withCollaborationMode(collaboration, collaboration.mode);
}

function normalizeCollaborationServiceState(value: unknown): CollaborationServiceState {
  if (value === true || value === "configured") return "configured";
  if (value === false || value === "unconfigured") return "unconfigured";
  return "unknown";
}

function transitionGuidance(
  mode: CollaborationMode,
  status: CollaborationTransitionStatus,
  missingRequiredServices: CollaborationService[],
) {
  if (mode === "local-story") {
    return "Local Story Mode is ready. The PPF and local backups remain active; saved GitHub and Buzz setup is preserved but optional.";
  }
  if (status === "ready") {
    return mode === "writers-room"
      ? "Writers' Room Mode is ready. Buzz remains separate from canon, and every selected discussion change still requires human approval."
      : "Repository Collaboration Mode is ready. Story Proposals, approved history and synchronization remain under Project Lead control.";
  }
  if (missingRequiredServices.includes("buzz")) {
    return "Writers' Room Mode is selected. Configure or connect Buzz deliberately in Settings before opening the Story Room.";
  }
  return "Repository Collaboration Mode is selected. Configure a story repository deliberately in Settings before using Story Proposals or synchronization.";
}

export function planCollaborationModeTransition(
  currentMode: unknown,
  targetMode: unknown,
  context: CollaborationTransitionContext = {},
): CollaborationModeTransitionPlan {
  const from = normalizeCollaborationMode(currentMode);
  const to = normalizeCollaborationMode(targetMode);
  const requirements = collaborationModeRequirements(to);
  const requiredServices = SERVICE_ORDER.filter((service) => requirements[service] === "required");
  const missingRequiredServices = requiredServices.filter(
    (service) => normalizeCollaborationServiceState(context[service]) !== "configured",
  );
  const status: CollaborationTransitionStatus = missingRequiredServices.length > 0 ? "attention" : "ready";

  return {
    from,
    to,
    changed: from !== to,
    status,
    requiredServices,
    missingRequiredServices,
    automaticActions: [],
    preserves: COLLABORATION_TRANSITION_PRESERVES,
    guidance: transitionGuidance(to, status, missingRequiredServices),
  };
}

export function transitionCollaborationMode(
  project: PlotPickleProject,
  targetMode: unknown,
  context: CollaborationTransitionContext = {},
): CollaborationModeTransitionResult {
  const currentMode = normalizeCollaborationModeRecord(project.collaboration).mode;
  const plan = planCollaborationModeTransition(currentMode, targetMode, context);
  if (!plan.changed) return { project, plan };

  return {
    project: {
      ...project,
      collaboration: withCollaborationMode(project.collaboration, plan.to),
    },
    plan,
  };
}

export function collaborationTransitionConfirmation(plan: CollaborationModeTransitionPlan) {
  const copy = COLLABORATION_MODE_COPY[plan.to];
  const nextStep = plan.status === "attention" ? `\n\nNext step after selection: ${plan.guidance}` : "";
  return `Change this project to ${copy.title}?\n\n`
    + `${copy.summary}\n\n`
    + "Your PPF, local backups, GitHub setup and Buzz setup will be preserved.\n\n"
    + "This changes the project operating mode only. It will not connect or disconnect GitHub or Buzz, start synchronization, publish changes, or alter story canon."
    + nextStep;
}

export function githubCollaborationServiceState(
  collaboration: CollaborationModeInput,
): CollaborationServiceState {
  const repositoryUrl = typeof collaboration.repositoryUrl === "string" ? collaboration.repositoryUrl.trim() : "";
  const owner = typeof collaboration.owner === "string" ? collaboration.owner.trim() : "";
  const repo = typeof collaboration.repo === "string" ? collaboration.repo.trim() : "";
  return collaboration.provider === "github" && Boolean(repositoryUrl || (owner && repo))
    ? "configured"
    : "unconfigured";
}

export const COLLABORATION_MODE_COPY: Record<CollaborationMode, {
  title: string;
  summary: string;
}> = {
  "local-story": {
    title: "Local Story Mode",
    summary: "PPF and local backups only. Buzz and GitHub remain optional.",
  },
  "writers-room": {
    title: "Writers' Room Mode",
    summary: "PPF plus Buzz discussion. Human approval remains required before canon changes.",
  },
  "repository-collaboration": {
    title: "Repository Collaboration Mode",
    summary: "PPF plus GitHub proposals, revision history, synchronization and formal approvals.",
  },
};
