import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "./project-library-browser";

const MIRROR_VERSION = 1 as const;
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
  window.sessionStorage.clear();
  const raw = window.localStorage.getItem(mirrorKey(normalized));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { readonly version?: unknown; readonly workspaceId?: unknown; readonly entries?: unknown };
      if (parsed.version === MIRROR_VERSION && parsed.workspaceId === normalized && parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries)) {
        for (const [key, value] of Object.entries(parsed.entries as Record<string, unknown>)) {
          if (allowedKey(key, normalized) && typeof value === "string") window.sessionStorage.setItem(key, value);
        }
      }
    } catch {
      // Preserve an unreadable guest checkpoint in localStorage; start with a clean isolated session instead of guessing at its contents.
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
  activeWorkspaceId = "";
  window.sessionStorage.clear();
}
