import type { PlotPickleSettings } from "./ai/settings";
import type { PlotPickleProject } from "./project";

export type ConnectionId = "github" | "ai" | "plugins" | "google" | "storage" | "backups";
export type ConnectionState = "connected" | "configured" | "disconnected" | "checking" | "error" | "unavailable" | "disabled";
export type PermissionState = "granted" | "not-granted" | "unavailable";

export type ConnectionPermission = {
  id: "calendar" | "meet";
  label: string;
  state: PermissionState;
  scope: string;
  explanation: string;
};

export type PublicConnectionStatus = {
  id: ConnectionId;
  label: string;
  state: ConnectionState;
  identity: string;
  detail: string;
  lastSuccessfulConnection: string;
  error: string;
  repairGuidance: string;
  dataShared: string[];
  scopes: string[];
  permissions: ConnectionPermission[];
  optional: true;
};

export type ConnectionRuntimeSnapshot = {
  checkedAt?: string;
  github?: Partial<PublicConnectionStatus>;
  ai?: Partial<PublicConnectionStatus>;
  google?: Partial<PublicConnectionStatus>;
  storage?: Partial<PublicConnectionStatus>;
  backups?: Partial<PublicConnectionStatus>;
};

export type ConnectionStatusSnapshot = {
  checkedAt: string;
  items: Record<ConnectionId, PublicConnectionStatus>;
};

export const GOOGLE_IDENTITY_SCOPES = ["openid", "email", "profile"] as const;
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
export const GOOGLE_MEET_SCOPE = GOOGLE_CALENDAR_SCOPE; // Meet links are created through Calendar conferenceData; no direct Meet API scope is requested.

const TARGETS: Record<ConnectionId, { label: string; section: string }> = {
  github: { label: "Repository & Collab", section: "github" },
  ai: { label: "Story & Art", section: "ai" },
  plugins: { label: "Media & Film Engines", section: "plugins" },
  google: { label: "Scheduling & Meetings", section: "google" },
  storage: { label: "Storage", section: "storage" },
  backups: { label: "Backups", section: "storage" },
};

function item(
  id: ConnectionId,
  patch: Partial<Omit<PublicConnectionStatus, "id" | "label" | "optional">> = {},
): PublicConnectionStatus {
  return {
    id,
    label: TARGETS[id].label,
    state: "disconnected",
    identity: "",
    detail: "Not connected. PlotPickle remains fully usable locally.",
    lastSuccessfulConnection: "",
    error: "",
    repairGuidance: "Open Settings to configure or test this optional connection.",
    dataShared: [],
    scopes: [],
    permissions: [],
    optional: true,
    ...patch,
  };
}

function merge(
  base: PublicConnectionStatus,
  runtime: Partial<PublicConnectionStatus> | undefined,
): PublicConnectionStatus {
  if (!runtime) return base;
  return {
    ...base,
    ...runtime,
    id: base.id,
    label: base.label,
    optional: true,
    dataShared: Array.isArray(runtime.dataShared) ? runtime.dataShared.filter((value): value is string => typeof value === "string") : base.dataShared,
    scopes: Array.isArray(runtime.scopes) ? runtime.scopes.filter((value): value is string => typeof value === "string") : base.scopes,
    permissions: Array.isArray(runtime.permissions) ? runtime.permissions : base.permissions,
  };
}

export function createConnectionStatusSnapshot(
  project: PlotPickleProject,
  settings: PlotPickleSettings,
  runtime: ConnectionRuntimeSnapshot = {},
  saveState = "Saved on this device",
): ConnectionStatusSnapshot {
  const githubConfigured = project.collaboration.provider === "github" && Boolean(project.collaboration.repositoryUrl);
  const githubIdentity = [project.collaboration.owner, project.collaboration.repo].filter(Boolean).join("/");
  const aiDisabled = settings.ai.provider === "disabled";
  const activePlugins = settings.plugins.filter((plugin) => plugin.status === "enabled");
  const revisionCount = project.revisions.length;

  const github = item("github", githubConfigured ? {
    state: "configured",
    identity: githubIdentity,
    detail: project.collaboration.repositoryUrl || "Repository metadata is recorded in this project.",
    lastSuccessfulConnection: project.collaboration.updatedAt,
    repairGuidance: "Test the local credential before pulling or proposing changes.",
    dataShared: ["Selected .ppf project content", "proposal title and contributor note", "repository branch and project path"],
    scopes: ["Repository contents", "Pull requests"],
  } : {
    dataShared: ["Nothing until a repository is connected and an action is confirmed"],
  });

  const ai = item("ai", aiDisabled ? {
    state: "disabled",
    identity: "No AI provider",
    detail: "Story and art assistance is optional and currently disabled.",
    repairGuidance: "No repair is required. Select a provider only if you want AI assistance.",
    dataShared: ["Nothing while AI is disabled"],
  } : {
    state: "configured",
    identity: settings.ai.provider,
    detail: `${settings.ai.provider} is selected. A private local credential must be verified separately.`,
    repairGuidance: "Open Story & Art, save the credential locally and test the optional connection.",
    dataShared: ["Only the story context explicitly selected for an AI request"],
    scopes: ["Text generation", ...(settings.ai.imageModel ? ["Image generation"] : [])],
  });

  const plugins = item("plugins", activePlugins.length ? {
    state: "connected",
    identity: activePlugins.map((plugin) => plugin.label).join(", "),
    detail: `${activePlugins.length} optional plugin${activePlugins.length === 1 ? "" : "s"} enabled.`,
    dataShared: ["Only capabilities approved for each enabled plugin"],
    scopes: activePlugins.map((plugin) => plugin.label),
  } : {
    identity: "No rendering engine",
    detail: "No media or film engine is connected. External rendering remains a future extension.",
    repairGuidance: "No repair is required. PlotPickle's visual storyworld tools work without a rendering API.",
    dataShared: ["Nothing; no media or film engine connection is active"],
  });

  const google = item("google", {
    identity: "No Google account",
    detail: "Scheduling and meetings are optional and disconnected.",
    repairGuidance: "Configure Google OAuth for this local installation, then choose only the permissions you need.",
    dataShared: ["Account name and email after consent", "Non-sensitive meeting title, time and link when explicitly saved"],
    scopes: [...GOOGLE_IDENTITY_SCOPES],
    permissions: [
      {
        id: "calendar",
        label: "Google Calendar",
        state: "not-granted",
        scope: GOOGLE_CALENDAR_SCOPE,
        explanation: "Create and manage events only on calendars owned by the signed-in account.",
      },
      {
        id: "meet",
        label: "Google Meet",
        state: "not-granted",
        scope: GOOGLE_MEET_SCOPE,
        explanation: "Create unique Google Meet links through PlotPickle-owned Calendar events; no separate Meet API access is requested.",
      },
    ],
  });

  const storage = item("storage", {
    state: /^Saved\b/i.test(saveState) ? "connected" : "checking",
    identity: "This device",
    detail: /^Saved\b/i.test(saveState) ? "The active canonical project is saved on this device." : saveState,
    lastSuccessfulConnection: project.metadata.updatedAt,
    repairGuidance: "Keep PlotPickle open until the local save completes.",
    dataShared: ["Project content remains on this device"],
  });

  const backups = item("backups", {
    state: revisionCount ? "connected" : "configured",
    identity: "Local rolling backups",
    detail: revisionCount
      ? `${revisionCount} project revision snapshot${revisionCount === 1 ? "" : "s"} recorded.`
      : "Backup storage is ready; no revision snapshot has been recorded yet.",
    lastSuccessfulConnection: project.revisions.at(-1)?.createdAt || "",
    repairGuidance: "Use Storage and backups to create or review a local backup.",
    dataShared: ["Project backups remain under the current computer account"],
  });

  return {
    checkedAt: runtime.checkedAt || new Date().toISOString(),
    items: {
      github: merge(github, runtime.github),
      ai: merge(ai, runtime.ai),
      plugins,
      google: merge(google, runtime.google),
      storage: merge(storage, runtime.storage),
      backups: merge(backups, runtime.backups),
    },
  };
}

export function connectionSettingsSection(id: ConnectionId) {
  return TARGETS[id].section;
}

export function reportsRuntimeConnections(snapshot: ConnectionStatusSnapshot) {
  return Object.fromEntries(Object.entries(snapshot.items).map(([id, status]) => {
    const reportState = status.state === "connected"
      ? "connected"
      : status.state === "error"
        ? "error"
        : status.state === "configured" || status.state === "checking" || status.state === "unavailable"
          ? "unknown"
          : "disconnected";
    return [id, {
      status: reportState,
      label: status.label,
      detail: [status.identity, status.detail].filter(Boolean).join(" · "),
      checkedAt: status.lastSuccessfulConnection || snapshot.checkedAt,
      error: status.error,
    }];
  }));
}

export type NonSensitiveMeetingMetadata = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetUrl: string;
  calendarEventId: string;
  status: "none" | "pending" | "success" | "failure";
};

export function sanitizeMeetingMetadata(value: Partial<NonSensitiveMeetingMetadata>): NonSensitiveMeetingMetadata {
  const clean = (input: unknown, maximum: number) => typeof input === "string" ? input.trim().slice(0, maximum) : "";
  return {
    id: clean(value.id, 120),
    title: clean(value.title, 200),
    startsAt: clean(value.startsAt, 40),
    endsAt: clean(value.endsAt, 40),
    meetUrl: clean(value.meetUrl, 500),
    calendarEventId: clean(value.calendarEventId, 180),
    status: value.status === "pending" || value.status === "success" || value.status === "failure" ? value.status : "none",
  };
}
