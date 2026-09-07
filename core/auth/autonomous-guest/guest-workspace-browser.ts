import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "../../storage/project-library-browser";

const MIRROR_VERSION = 1 as const;
const GUEST_WORKSPACE_PREFIX = "guest-auto-";
let activeWorkspaceId = "";

function mirrorKey(workspaceId: string) {
  return `plotpickle.autonomous-guest.workspace.v1.${workspaceId}`;
}

function libraryPrefix(workspaceId: string) {
  return `plotpickle.library.profile.v1.${workspaceId}.`;
}

function libraryRegistryKey(workspaceId: string) {
  return `${libraryPrefix(workspaceId)}registry`;
}

function libraryProjectKey(workspaceId: string, projectId: string) {
  return `${libraryPrefix(workspaceId)}projects.${encodeURIComponent(projectId)}`;
}

function allowedKey(key: string, workspaceId: string) {
  return key === PROJECT_LIBRARY_ACTIVE_PROFILE_KEY || key.startsWith(libraryPrefix(workspaceId));
}

function removeGuestSessionKeys(workspaceId = "") {
  const keys = Array.from({ length: window.sessionStorage.length }, (_value, index) => window.sessionStorage.key(index)).filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (workspaceId ? key.startsWith(libraryPrefix(workspaceId)) : key.startsWith("plotpickle.library.profile.v1.guest-auto-")) {
      window.sessionStorage.removeItem(key);
    }
  }
  const owner = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
  if (owner.startsWith(GUEST_WORKSPACE_PREFIX) && (!workspaceId || owner === workspaceId)) {
    window.sessionStorage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
  }
}

function collectWorkspaceEntries(workspaceId: string) {
  const entries: Record<string, string> = {};
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key || !allowedKey(key, workspaceId)) continue;
    const value = window.sessionStorage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  entries[PROJECT_LIBRARY_ACTIVE_PROFILE_KEY] = workspaceId;
  return entries;
}

function workspaceSessionReady(workspaceId: string) {
  if (window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) !== workspaceId) return false;
  const rawRegistry = window.sessionStorage.getItem(libraryRegistryKey(workspaceId));
  if (!rawRegistry) return false;
  try {
    const registry = JSON.parse(rawRegistry) as { readonly activeProjectId?: unknown; readonly projects?: unknown };
    const activeProjectId = typeof registry.activeProjectId === "string" ? registry.activeProjectId.trim() : "";
    if (!activeProjectId || !Array.isArray(registry.projects)) return false;
    const activeSummary = registry.projects.find((item) => item && typeof item === "object" && !Array.isArray(item)
      && (item as { readonly id?: unknown }).id === activeProjectId
      && !(item as { readonly archivedAt?: unknown }).archivedAt);
    return Boolean(activeSummary && window.sessionStorage.getItem(libraryProjectKey(workspaceId, activeProjectId)));
  } catch {
    return false;
  }
}

export function hydrateAutonomousGuestBrowser(workspaceId: string) {
  const normalized = workspaceId.trim();
  if (!/^guest-auto-[a-f0-9]{24}$/i.test(normalized)) throw new Error("Autonomous Guest workspace identity is invalid.");
  activeWorkspaceId = normalized;

  // A shared browser profile can restore the owner key while omitting one or
  // more session-backed Library records. Treat that partial restore as stale
  // and repair it from the durable autonomous-Guest mirror before rendering.
  if (workspaceSessionReady(normalized)) return;

  removeGuestSessionKeys();
  const raw = window.localStorage.getItem(mirrorKey(normalized));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { readonly version?: unknown; readonly workspaceId?: unknown; readonly entries?: unknown };
      if (parsed.version === MIRROR_VERSION && parsed.workspaceId === normalized && parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries)) {
        for (const [key, value] of Object.entries(parsed.entries as Record<string, unknown>)) {
          if (allowedKey(key, normalized) && typeof value === "string") window.sessionStorage.setItem(key, value);
        }
      }
    } catch (error) {
      window.localStorage.removeItem(mirrorKey(normalized));
      console.warn("Autonomous Guest ignored an unreadable local workspace checkpoint.", error instanceof Error ? error.name : "unknown-error");
    }
  }
  window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, normalized);
  if (!workspaceSessionReady(normalized)) {
    removeGuestSessionKeys(normalized);
    window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, normalized);
  }
}

export function persistAutonomousGuestLibrary() {
  if (!activeWorkspaceId) return;
  const checkpoint = {
    version: MIRROR_VERSION,
    workspaceId: activeWorkspaceId,
    savedAt: new Date().toISOString(),
    entries: collectWorkspaceEntries(activeWorkspaceId),
  };
  window.localStorage.setItem(mirrorKey(activeWorkspaceId), JSON.stringify(checkpoint));
}

export function clearAutonomousGuestBrowser() {
  const workspaceId = activeWorkspaceId;
  activeWorkspaceId = "";
  removeGuestSessionKeys(workspaceId);
}
