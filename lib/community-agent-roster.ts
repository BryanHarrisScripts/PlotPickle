import { BUZZ_GUILDHALL_ACTORS, BUZZ_GUILDHALL_CHANNELS } from "./buzz-guildhall";

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
  readonly runtime: string;
  readonly runtimeLabel: string;
  readonly roleId: string;
  readonly homeRoom: string;
  readonly homeRoomId: string;
  readonly state: AgentRosterState;
  readonly stateLabel: string;
  readonly stateDetail: string;
  readonly lastActiveAt: string;
  readonly buzzPresence: string;
};

function roleId(actor: (typeof BUZZ_GUILDHALL_ACTORS)[number]) {
  return "existingRoleId" in actor && typeof actor.existingRoleId === "string" ? actor.existingRoleId : "";
}

function runtimeLabel(runtime: string) {
  if (runtime === "mastra") return "Mastra · local AI";
  if (runtime === "buzz") return "BUZZ-native agent";
  if (runtime === "plotpickle-uat") return "PlotPickle UAT";
  if (runtime === "deterministic-observer") return "Visual observer";
  if (runtime === "uat") return "Deterministic UAT";
  if (runtime === "repository-workflow") return "Repository workflow";
  return runtime.replaceAll("-", " ");
}

function newestTrace(traces: readonly AgentTrace[], agentId: string) {
  return traces
    .filter((trace) => trace.agentId === agentId)
    .sort((left, right) => Date.parse(right.startedAt || "") - Date.parse(left.startedAt || ""))[0] ?? null;
}

function mastraState(actorRoleId: string, status: WritingAssistantStatus | null, traces: readonly AgentTrace[]) {
  const trace = actorRoleId ? newestTrace(traces, actorRoleId) : null;
  const mastraReady = status?.mastra?.ready === true;
  const registered = actorRoleId ? Boolean(status?.mastra?.agents?.includes(actorRoleId)) : false;
  if (trace?.status === "running") {
    return {
      state: "working" as const,
      label: "Working",
      detail: "This Mastra agent has an active run right now.",
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
      state: "parked" as const,
      label: "Parked",
      detail: "This lore role is preserved, but its product module is not active in the current slim app.",
      lastActiveAt: trace?.finishedAt || trace?.startedAt || "",
    };
  }
  return {
    state: "online" as const,
    label: "Online",
    detail: trace ? `Mastra is ready. Last run: ${trace.status}.` : "Mastra is ready and this agent role is registered.",
    lastActiveAt: trace?.finishedAt || trace?.startedAt || "",
  };
}

function buzzState(actorId: string, identityVerified: boolean, nativeAgents: readonly BuzzNativeAgentState[]) {
  if (!identityVerified) {
    return {
      state: "setup-needed" as const,
      label: "Setup needed",
      detail: "Connect and verify BUZZ before this native steward can report presence.",
      lastActiveAt: "",
    };
  }
  const native = nativeAgents.find((item) => item.actorId === actorId);
  if (native?.lookupError) {
    return {
      state: "unavailable" as const,
      label: "Status unavailable",
      detail: "PlotPickle could not read this BUZZ-native identity, so it will not guess whether the steward exists or is online.",
      lastActiveAt: native.updatedAt || "",
    };
  }
  if (!native?.created || !native.verified || !native.ownedByMe) {
    return {
      state: "needs-approval" as const,
      label: "Needs owner approval",
      detail: "Create and approve this steward in Buzz Desktop. PlotPickle will detect it automatically afterward.",
      lastActiveAt: native?.updatedAt || "",
    };
  }
  const presence = native.presence.trim().toLowerCase();
  if (presence === "online") {
    return { state: "online" as const, label: "Online", detail: "BUZZ reports this steward online.", lastActiveAt: native.updatedAt };
  }
  if (presence === "away") {
    return { state: "away" as const, label: "Away", detail: "BUZZ reports this steward away.", lastActiveAt: native.updatedAt };
  }
  return {
    state: "offline" as const,
    label: "Offline",
    detail: "The BUZZ identity exists, but no online presence is currently reported.",
    lastActiveAt: native.updatedAt,
  };
}

function onDemandState(runtime: string) {
  const detail = runtime === "plotpickle-uat"
    ? "Runs only when the Writer-in-Residence journey is started."
    : runtime === "deterministic-observer"
      ? "Starts when rendered visual review needs evidence."
      : runtime === "uat"
        ? "Runs when PlotPickle executes deterministic quality gates."
        : "Runs only when verified development work needs a handoff.";
  return { state: "on-demand" as const, label: "On demand", detail, lastActiveAt: "" };
}

export function buildCommunityAgentRoster(input: {
  readonly assistantStatus: WritingAssistantStatus | null;
  readonly traces: readonly AgentTrace[];
  readonly buzzIdentityVerified: boolean;
  readonly nativeAgents: readonly BuzzNativeAgentState[];
}): CommunityAgentRosterItem[] {
  return BUZZ_GUILDHALL_ACTORS.map((actor) => {
    const actorRoleId = roleId(actor);
    const dynamic = actor.runtime === "mastra"
      ? mastraState(actorRoleId, input.assistantStatus, input.traces)
      : actor.runtime === "buzz"
        ? buzzState(actor.id, input.buzzIdentityVerified, input.nativeAgents)
        : onDemandState(actor.runtime);
    const room = BUZZ_GUILDHALL_CHANNELS.find((candidate) => candidate.id === actor.primaryChannel);
    return {
      id: actor.id,
      displayName: actor.displayName,
      title: actor.title,
      summary: actor.summary,
      runtime: actor.runtime,
      runtimeLabel: runtimeLabel(actor.runtime),
      roleId: actorRoleId,
      homeRoom: room?.label || actor.primaryChannel,
      homeRoomId: actor.primaryChannel,
      state: dynamic.state,
      stateLabel: dynamic.label,
      stateDetail: dynamic.detail,
      lastActiveAt: dynamic.lastActiveAt,
      buzzPresence: actor.buzzPresence,
    };
  });
}
