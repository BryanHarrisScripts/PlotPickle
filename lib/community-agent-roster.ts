import {
  AGENT_PROFILES,
  effectiveForbiddenCapabilities,
  type AgentProfile,
  type AgentProfileAvailability,
  type AgentProfileCapabilityRole,
} from "./agent-profiles";
import { BUZZ_GUILDHALL_CHANNELS } from "./buzz-guildhall";

export type AgentRosterState = "working" | "online" | "away" | "on-demand" | "parked" | "offline" | "needs-approval" | "setup-needed" | "unavailable";

export type WritingAssistantStatus = {
  readonly mastra?: {
    readonly ready?: boolean;
    readonly agents?: string[];
  };
};

export type AgentTrace = {
  readonly agentId: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly status: "running" | "success" | "error";
  readonly runtimeProvider?: string;
  readonly model?: string;
};

export type BuzzNativeAgentState = {
  readonly actorId: string;
  readonly created: boolean;
  readonly verified: boolean;
  readonly ownedByMe: boolean;
  readonly pubkey: string;
  readonly presence: string;
  readonly updatedAt: string;
  readonly lookupError?: boolean;
};

export type CommunityAgentRosterItem = {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly summary: string;
  readonly avatarInitials: string;
  readonly avatarKind: "local-initials";
  readonly runtime: string;
  readonly runtimeLabel: string;
  readonly roleId: string;
  readonly activeRuntimeProvider: string;
  readonly activeModel: string;
  readonly homeRoom: string;
  readonly homeRoomId: string;
  readonly state: AgentRosterState;
  readonly stateLabel: string;
  readonly stateDetail: string;
  readonly lastActiveAt: string;
  readonly buzzPresence: string;
  readonly lifecycleState: AgentProfileAvailability;
  readonly requestedModelRole: AgentProfileCapabilityRole | null;
  readonly requestedCapabilities: readonly string[];
  readonly skillUris: readonly string[];
  readonly projectMemoryScope: readonly string[];
  readonly projectMemoryPolicy: string;
  readonly readScopes: readonly string[];
  readonly proposalScopes: readonly string[];
  readonly forbiddenCapabilities: readonly string[];
  readonly creativeAuthority: string;
  readonly verificationContract: string;
};

function runtimeLabel(kind: AgentProfile["execution"]["kind"]) {
  if (kind === "embedded-mastra") return "PlotPickle embedded · Mastra";
  if (kind === "buzz-managed") return "BUZZ-managed agent";
  if (kind === "plotpickle-uat") return "PlotPickle UAT";
  if (kind === "deterministic-observer") return "Visual observer";
  if (kind === "deterministic-gate") return "Deterministic UAT";
  if (kind === "repository-handoff") return "Repository handoff";
  return kind.replaceAll("-", " ");
}

function buzzPresence(profile: AgentProfile) {
  if (profile.buzzBinding.mode === "native") return "native-draft";
  if (profile.buzzBinding.mode === "mirrored") return "mirrored";
  return "service";
}

function newestTrace(traces: readonly AgentTrace[], agentId: string) {
  return traces
    .filter((trace) => trace.agentId === agentId)
    .sort((left, right) => Date.parse(right.startedAt || "") - Date.parse(left.startedAt || ""))[0] ?? null;
}

function initials(displayName: string) {
  const words = displayName.replace(/^The\s+/i, "").replace(/[^A-Za-z0-9' -]/g, " ").split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word.replace(/[^A-Za-z0-9]/g, "").charAt(0)).join("").toUpperCase();
  return letters || "PP";
}

function projectMemoryPolicy(profile: AgentProfile) {
  if (profile.execution.kind === "buzz-managed") {
    return "BUZZ core/cold memory stays BUZZ-owned and separate. Only owner-approved history may enter PlotPickle task context; memory is never PPF canon.";
  }
  return "Task-scoped only. The host may attach approved data from the listed read scopes; project memory is evidence, never automatic canon or permission.";
}

function parkedState(profile: AgentProfile) {
  return {
    state: "parked" as const,
    label: "Parked",
    detail: `${profile.displayName} is preserved but intentionally inactive until this product area returns to the active workflow.`,
    lastActiveAt: "",
  };
}

function mastraState(profile: AgentProfile, status: WritingAssistantStatus | null, traces: readonly AgentTrace[]) {
  const roleId = profile.execution.roleId;
  const trace = roleId ? newestTrace(traces, roleId) : null;
  const mastraReady = status?.mastra?.ready === true;
  const registered = roleId ? Boolean(status?.mastra?.agents?.includes(roleId)) : false;
  if (trace?.status === "running") {
    return {
      state: "working" as const,
      label: "Working",
      detail: "This embedded Mastra agent has an active run right now.",
      lastActiveAt: trace.startedAt,
    };
  }
  if (!mastraReady) {
    return {
      state: "offline" as const,
      label: "Offline",
      detail: "The local Mastra agent runtime is not ready.",
      lastActiveAt: trace?.finishedAt || trace?.startedAt || "",
    };
  }
  if (!registered) {
    return {
      state: "offline" as const,
      label: "Offline",
      detail: "Mastra is running, but this embedded PlotPickle role is not registered in the current runtime.",
      lastActiveAt: trace?.finishedAt || trace?.startedAt || "",
    };
  }
  return {
    state: "online" as const,
    label: "Online",
    detail: trace ? `Mastra is ready. Last run: ${trace.status}.` : "Mastra is ready and this embedded role is registered.",
    lastActiveAt: trace?.finishedAt || trace?.startedAt || "",
  };
}

function buzzState(profile: AgentProfile, identityVerified: boolean, nativeAgents: readonly BuzzNativeAgentState[]) {
  if (!identityVerified) {
    return {
      state: "setup-needed" as const,
      label: "Setup needed",
      detail: "Connect and verify BUZZ before this BUZZ-managed agent can report presence.",
      lastActiveAt: "",
    };
  }
  const native = nativeAgents.find((item) => item.actorId === profile.buzzBinding.actorId);
  if (native?.lookupError) {
    return {
      state: "unavailable" as const,
      label: "Status unavailable",
      detail: "PlotPickle could not read this BUZZ identity, so it will not guess whether the agent exists or is online.",
      lastActiveAt: native.updatedAt || "",
    };
  }
  if (!native?.created || !native.verified || !native.ownedByMe) {
    return {
      state: "needs-approval" as const,
      label: "Needs owner approval",
      detail: "Create and approve this agent in Buzz Desktop. PlotPickle will detect the binding automatically afterward.",
      lastActiveAt: native?.updatedAt || "",
    };
  }
  const presence = native.presence.trim().toLowerCase();
  if (presence === "online") {
    return { state: "online" as const, label: "Online", detail: "BUZZ reports this agent online.", lastActiveAt: native.updatedAt };
  }
  if (presence === "away") {
    return { state: "away" as const, label: "Away", detail: "BUZZ reports this agent away.", lastActiveAt: native.updatedAt };
  }
  return {
    state: "offline" as const,
    label: "Offline",
    detail: "The BUZZ identity exists, but no online presence is currently reported.",
    lastActiveAt: native.updatedAt,
  };
}

function onDemandState(profile: AgentProfile) {
  const detail = profile.execution.kind === "plotpickle-uat"
    ? "Runs only when the Writer-in-Residence journey is started."
    : profile.execution.kind === "deterministic-observer"
      ? "Starts when rendered visual review needs evidence."
      : profile.execution.kind === "deterministic-gate"
        ? "Runs when PlotPickle executes deterministic quality gates."
        : "Runs only when verified development work needs a handoff.";
  return { state: "on-demand" as const, label: "On demand", detail, lastActiveAt: "" };
}

function profileState(profile: AgentProfile, input: {
  readonly assistantStatus: WritingAssistantStatus | null;
  readonly traces: readonly AgentTrace[];
  readonly buzzIdentityVerified: boolean;
  readonly nativeAgents: readonly BuzzNativeAgentState[];
}) {
  if (profile.defaultAvailability === "parked") return parkedState(profile);
  if (profile.execution.kind === "embedded-mastra") return mastraState(profile, input.assistantStatus, input.traces);
  if (profile.execution.kind === "buzz-managed") return buzzState(profile, input.buzzIdentityVerified, input.nativeAgents);
  return onDemandState(profile);
}

export function buildCommunityAgentRoster(input: {
  readonly assistantStatus: WritingAssistantStatus | null;
  readonly traces: readonly AgentTrace[];
  readonly buzzIdentityVerified: boolean;
  readonly nativeAgents: readonly BuzzNativeAgentState[];
}): CommunityAgentRosterItem[] {
  return AGENT_PROFILES.map((profile) => {
    const dynamic = profileState(profile, input);
    const room = BUZZ_GUILDHALL_CHANNELS.find((candidate) => candidate.id === profile.homeRoomId);
    const trace = profile.execution.roleId ? newestTrace(input.traces, profile.execution.roleId) : null;
    return {
      id: profile.id,
      displayName: profile.displayName,
      title: profile.title,
      summary: profile.responsibility,
      avatarInitials: initials(profile.displayName),
      avatarKind: "local-initials",
      runtime: profile.execution.kind,
      runtimeLabel: runtimeLabel(profile.execution.kind),
      roleId: profile.execution.roleId,
      activeRuntimeProvider: trace?.runtimeProvider || "",
      activeModel: trace?.model || "",
      homeRoom: room?.label || profile.homeRoomId,
      homeRoomId: profile.homeRoomId,
      state: dynamic.state,
      stateLabel: dynamic.label,
      stateDetail: dynamic.detail,
      lastActiveAt: dynamic.lastActiveAt,
      buzzPresence: buzzPresence(profile),
      lifecycleState: profile.defaultAvailability,
      requestedModelRole: profile.requestedCapabilityRole,
      requestedCapabilities: profile.requestedCapabilities,
      skillUris: profile.skillUris,
      projectMemoryScope: profile.readScopes,
      projectMemoryPolicy: projectMemoryPolicy(profile),
      readScopes: profile.readScopes,
      proposalScopes: profile.proposalScopes,
      forbiddenCapabilities: effectiveForbiddenCapabilities(profile),
      creativeAuthority: profile.creativeAuthority,
      verificationContract: profile.verificationContract,
    };
  });
}