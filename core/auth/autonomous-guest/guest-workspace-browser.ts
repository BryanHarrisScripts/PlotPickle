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

export function hydrateAutonomousGuestBrowser(workspaceId: string) {
  const normalized = workspaceId.trim();
  if (!/^guest-auto-[a-f0-9]{24}$/i.test(normalized)) throw new Error("Autonomous Guest workspace identity is invalid.");
  activeWorkspaceId = normalized;

  if (window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) === normalized) return;

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
