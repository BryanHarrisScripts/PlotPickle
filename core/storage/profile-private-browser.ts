import {
  normalizeStoryMapContext,
  normalizeStoryMapContextRegistry,
  type StoryMapContext,
} from "./story-map-context";
import { normalizeLibraryProject, type LibraryPPFProject } from "./library-project";
import {
  clearLibraryProjectSessionCache,
  consumeSessionActiveProjectHandoff,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  hydrateProfileProjectLibrary,
  listArchivedLibraryProjects,
  listPersistableLibraryProjects,
  loadLibraryProjectSnapshot,
  initializeProjectLibrary,
  resumeSessionActiveProject,
  sessionActiveProjectId,
} from "./project-library-browser";

type HydratedPrivateProjectEntry = Readonly<{
  project: unknown;
  summary?: Readonly<Record<string, unknown>>;
}>;

export type ProfileRecoveryPoint = Readonly<{
  id: string;
  projectId: string;
  title: string;
  revision: number;
  createdAt: string;
  reason: "unload" | "manual" | "pre-restore";
  project: LibraryPPFProject;
}>;

type HydratedPrivateState = {
  readonly project: unknown | null;
  readonly activeProjectId?: string | null;
  readonly projects?: readonly HydratedPrivateProjectEntry[];
  readonly wyrmwood: unknown | null;
  readonly storyMapContexts: unknown | null;
  readonly recoveryPoints?: unknown;
};

type ProfilePrivateSaveState = Readonly<{
  state: "saved" | "saving" | "blocked";
  message: string;
}>;

const LEGACY_ACTIVE_PROJECT_KEY = "plotpickle.foundation.project.v1";
const LEGACY_LIBRARY_PREFIX = "plotpickle.library.profile.v1.";
const PROFILE_RECOVERY_LIMIT = 20;
export const PROFILE_PRIVATE_SAVE_STATE_EVENT = "plotpickle:profile-private-save-state";

function normalizeRecoveryPoints(value: unknown): readonly ProfileRecoveryPoint[] {
  if (!Array.isArray(value)) return [];
  const points: ProfileRecoveryPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 360) : "";
    const projectId = typeof raw.projectId === "string" ? raw.projectId.trim().slice(0, 240) : "";
    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 500) : "";
    const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim().slice(0, 80) : "";
    const reason = raw.reason === "unload" || raw.reason === "manual" || raw.reason === "pre-restore" ? raw.reason : null;
    if (!id || !projectId || !title || !createdAt || !reason || !raw.project) continue;
    try {
      const project = normalizeLibraryProject(raw.project);
      if (project.id !== projectId) continue;
      points.push({
        id,
        projectId,
        title,
        revision: Number.isInteger(raw.revision) ? Number(raw.revision) : project.revision,
        createdAt,
        reason,
        project,
      });
    } catch {
      // Invalid recovery points remain ignored rather than becoming project authority.
    }
  }
  return points
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, PROFILE_RECOVERY_LIMIT);
}

let csrfToken = "";
let hydratedProfileId = "";
let hydrated: HydratedPrivateState = { project: null, wyrmwood: null, storyMapContexts: null, recoveryPoints: [] };
let pendingWrite: Promise<void> = Promise.resolve();
let pendingCacheWrite: Promise<void> = Promise.resolve();
let saveState: ProfilePrivateSaveState = Object.freeze({ state: "saved", message: "Saved" });
let authorityEpoch = 0;
let removeProjectPersistenceListener: (() => void) | null = null;

function observeProjectWrites() {
  removeProjectPersistenceListener?.();
  const persist = async () => {
    const epoch = authorityEpoch;
    try {
      await persistActiveProfileProject();
    } catch (error) {
      if (epoch !== authorityEpoch) return;
      updateSaveState("blocked", error instanceof Error ? error.message : "Project changes could not be persisted.");
    }
  };
  window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, persist);
  removeProjectPersistenceListener = () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, persist);
}

function updateSaveState(state: ProfilePrivateSaveState["state"], message: string) {
  saveState = Object.freeze({ state, message });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROFILE_PRIVATE_SAVE_STATE_EVENT, { detail: saveState }));
}

async function privateMutation(action: string, payload: Record<string, unknown>, token = csrfToken) {
  if (!token) throw new Error("The Human profile is locked.");
  const result = await fetch("/api/auth/profile-private", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": token },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await result.json().catch(() => ({})) as Record<string, unknown>;
  if (!result.ok) throw new Error(typeof body.message === "string" ? body.message : "PlotPickle could not persist the encrypted profile state.");
  return body;
}

function queueWriteOperation(operation: (token: string) => Promise<void>, explicitToken = "") {
  const token = explicitToken || csrfToken;
  if (!token) {
    updateSaveState("blocked", "The Human profile is locked.");
    return Promise.reject(new Error("The Human profile is locked."));
  }
  const epoch = authorityEpoch;
  updateSaveState("saving", "Unsaved changes");
  const current = pendingWrite.catch(() => undefined).then(() => {
    if (epoch !== authorityEpoch) throw new Error("The Human profile changed before this write could start.");
    return operation(token);
  });
  pendingWrite = current;
  void current.then(
    () => { if (epoch === authorityEpoch && pendingWrite === current) updateSaveState("saved", "Saved"); },
    (error) => {
      if (epoch === authorityEpoch && pendingWrite === current) updateSaveState("blocked", error instanceof Error ? error.message : "Unsaved changes could not be persisted.");
    },
  );
  return current;
}

function queueWrite(action: string, payload: Record<string, unknown>, explicitToken = "") {
  return queueWriteOperation(async (token) => {
    await privateMutation(action, payload, token);
  }, explicitToken);
}

function queueCacheWrite(action: string, payload: Record<string, unknown>) {
  const token = csrfToken;
  if (!token) return Promise.reject(new Error("The Human profile is locked."));
  const current = pendingCacheWrite.catch(() => undefined).then(async () => {
    await privateMutation(action, payload, token);
  });
  pendingCacheWrite = current;
  return current;
}

function legacyBrowserProjects() {
  const projects = new Map<string, LibraryPPFProject>();
  const add = (raw: string | null, wrapped = false) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const value = wrapped && parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { readonly project?: unknown }).project
        : parsed;
      if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { readonly id?: unknown }).id !== "string") return;
      const project = normalizeLibraryProject(value);
      projects.set(project.id, project);
    } catch {
      // Leave unreadable legacy browser records in place for explicit recovery rather than deleting them.
    }
  };

  add(window.localStorage.getItem(LEGACY_ACTIVE_PROJECT_KEY));
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(LEGACY_LIBRARY_PREFIX) || !key.includes(".projects.") || key.includes(".quarantine.")) continue;
    add(window.localStorage.getItem(key), true);
  }
  return [...projects.values()];
}

function legacySessionLibrary(profileId: string) {
  const prefix = `${LEGACY_LIBRARY_PREFIX}${profileId}.`;
  const registryRaw = window.sessionStorage.getItem(`${prefix}registry`);
  const keys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(`${prefix}projects.`) && !key.includes(".quarantine.")));
  if (!keys.length) return null;
  const registry: { activeProjectId?: string | null; projects?: Array<Record<string, unknown>> } = registryRaw ? JSON.parse(registryRaw) : {};
  const summaries = new Map((registry.projects || []).map((item) => [item.id, item]));
  const projects = keys.map((key) => {
    const entry = JSON.parse(window.sessionStorage.getItem(key) || "");
    if (entry.profileId !== profileId || !entry.project || entry.projectId !== entry.project.id) throw new Error("The browser Library snapshot's project identity does not match its profile. The record remains untouched.");
    return { project: normalizeLibraryProject(entry.project), summary: summaries.get(entry.projectId) || {} };
  });
  return { projects, activeProjectId: registry.activeProjectId || null };
}

function retireMigratedLegacyBrowserState() {
  const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key && (key === LEGACY_ACTIVE_PROJECT_KEY || key === PROJECT_LIBRARY_ACTIVE_PROFILE_KEY || key.startsWith(LEGACY_LIBRARY_PREFIX))));
  for (const key of keys) window.localStorage.removeItem(key);
}

export async function migrateLegacyBrowserProjects(token: string) {
  const projects = legacyBrowserProjects();
  if (!projects.length) return 0;
  csrfToken = token;
  for (const project of projects) {
    const result = await privateMutation("save-project", { project }, token);
    if (result.projectId !== project.id) throw new Error("PlotPickle could not verify the migrated legacy browser project.");
  }
  retireMigratedLegacyBrowserState();
  return projects.length;
}

export async function hydrateProfilePrivateBrowser(profileId: string, token: string) {
  // Re-reading the same live authority must not replace a newer working story.
  if (profilePrivateBrowserAuthorityMatches(profileId, token)) return;
  if (hydratedProfileId) await flushProfilePrivateWrites();
  const epoch = ++authorityEpoch;
  removeProjectPersistenceListener?.();
  removeProjectPersistenceListener = null;
  try {
    const legacy = legacySessionLibrary(profileId);
    let result = await fetch("/api/auth/profile-private", { credentials: "same-origin", cache: "no-store" });
    if (!result.ok) throw new Error("PlotPickle could not open the encrypted profile state.");
    let next = await result.json() as HydratedPrivateState;
    if (legacy) {
      const remote = Array.isArray(next.projects) && next.projects.length ? next.projects : next.project ? [{ project: next.project }] : [];
      const merged = new Map(remote.map((item) => [(item.project as { id: string }).id, item]));
      for (const item of legacy.projects) {
        const previous = merged.get(item.project.id);
        const localTime = Date.parse(String((item.summary as { updatedAt?: unknown }).updatedAt || item.project.updatedAt || ""));
        const remoteTime = Date.parse(String((previous?.summary as { updatedAt?: unknown } | undefined)?.updatedAt || ""));
        if (!previous || (Number.isFinite(localTime) && (!Number.isFinite(remoteTime) || localTime > remoteTime))) merged.set(item.project.id, item);
      }
      const projects = [...merged.values()];
      const activeProjectId = legacy.activeProjectId && projects.some((item) => (item.project as { id: string }).id === legacy.activeProjectId && !(item.summary as { archivedAt?: unknown })?.archivedAt)
        ? legacy.activeProjectId : next.activeProjectId || (next.project as { id?: string } | null)?.id || null;
      await privateMutation("sync-library", { projects, activeProjectId }, token);
      result = await fetch("/api/auth/profile-private", { credentials: "same-origin", cache: "no-store" });
      if (!result.ok) throw new Error("PlotPickle could not verify the migrated Library snapshots. Browser copies remain available for recovery.");
      next = await result.json() as HydratedPrivateState;
      const verified = new Map((next.projects || []).map((item) => [(item.project as { id: string }).id, item]));
      if (projects.some((item) => {
        const restored = verified.get((item.project as { id: string }).id);
        return !restored || JSON.stringify(restored.project) !== JSON.stringify(item.project)
          || Boolean((restored.summary as { archivedAt?: unknown } | undefined)?.archivedAt) !== Boolean((item.summary as { archivedAt?: unknown } | undefined)?.archivedAt);
      })) throw new Error("PlotPickle could not verify the migrated Library snapshots. Browser copies remain available for recovery.");
    }
    if (epoch !== authorityEpoch) throw new Error("The Human profile changed while encrypted state was loading.");
    csrfToken = token;
    const explicitSessionProjectId = consumeSessionActiveProjectHandoff(profileId);
    clearLibraryProjectSessionCache();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profileId);
    const projects = Array.isArray(next.projects) && next.projects.length
      ? next.projects
      : next.project
        ? [{ project: next.project }]
        : [];
    const activeProjectId = typeof next.activeProjectId === "string" && next.activeProjectId.trim()
      ? next.activeProjectId
      : next.project && typeof next.project === "object" && !Array.isArray(next.project) && typeof (next.project as { readonly id?: unknown }).id === "string"
        ? String((next.project as { readonly id: string }).id)
        : null;
    const restored = hydrateProfileProjectLibrary({ activeProjectId, projects });
    if (explicitSessionProjectId && restored.registry.activeProjectId === explicitSessionProjectId) {
      resumeSessionActiveProject(explicitSessionProjectId);
    }
    hydrated = {
      ...next,
      project: restored.activeProject,
      activeProjectId: restored.registry.activeProjectId,
      projects,
      storyMapContexts: normalizeStoryMapContextRegistry(next.storyMapContexts),
      recoveryPoints: normalizeRecoveryPoints(next.recoveryPoints),
    };
    hydratedProfileId = profileId;
    updateSaveState("saved", "Saved");
  } finally {
    if (epoch === authorityEpoch && hydratedProfileId) observeProjectWrites();
  }
}

export function profilePrivateBrowserAuthorityMatches(profileId: string, token: string) {
  const normalizedProfileId = profileId.trim();
  return Boolean(normalizedProfileId && token && hydratedProfileId === normalizedProfileId && csrfToken === token);
}

export function listProfileRecoveryPoints(projectId = "") {
  const points = normalizeRecoveryPoints(hydrated.recoveryPoints);
  const normalizedProjectId = projectId.trim();
  return normalizedProjectId ? points.filter((point) => point.projectId === normalizedProjectId) : points;
}

export function profileRecoveryPoint(pointId: string) {
  const id = pointId.trim();
  return listProfileRecoveryPoints().find((point) => point.id === id) ?? null;
}

export function createProfileRecoveryPoint(
  projectValue: LibraryPPFProject,
  reason: ProfileRecoveryPoint["reason"] = "manual",
) {
  const project = normalizeLibraryProject(structuredClone(projectValue));
  const createdAt = new Date().toISOString();
  const idSuffix = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
  const point: ProfileRecoveryPoint = Object.freeze({
    id: `${project.id}:${createdAt}:${idSuffix}`,
    projectId: project.id,
    title: project.title,
    revision: project.revision,
    createdAt,
    reason,
    project,
  });
  const next = normalizeRecoveryPoints([point, ...listProfileRecoveryPoints()]);
  hydrated = { ...hydrated, recoveryPoints: next };
  return queueCacheWrite("save-recovery-points", { value: next }).then(() => point);
}

export function hydratedProfilePrivateValue(key: "wyrmwood") {
  return hydrated[key];
}

export function hydratedStoryMapContext(projectId: string) {
  return normalizeStoryMapContextRegistry(hydrated.storyMapContexts)[projectId] ?? null;
}

export function persistActiveProfileProject(explicitToken = "") {
  const activeProjectId = sessionActiveProjectId();
  const active = listPersistableLibraryProjects();
  const projects = [...active, ...listArchivedLibraryProjects()].map((item) => {
    const project = loadLibraryProjectSnapshot(item.id);
    if (!project) throw new Error(`Library snapshot for ${item.title} is unavailable; the last saved profile state was preserved.`);
    return { project, summary: {
      projectId: item.id,
      title: item.title, updatedAt: item.updatedAt, createdAt: item.createdAt,
      progress: item.progress, frontier: item.frontier, thumbnailRef: item.thumbnail,
      sourceKind: item.sourceKind, sourceId: item.sourceId, genre: item.genre,
      format: item.format, archivedAt: item.archivedAt,
    } };
  });
  const persistedActiveProjectId = activeProjectId && active.some((item) => item.id === activeProjectId)
    ? activeProjectId
    : null;
  return queueWriteOperation(async (token) => {
    for (const entry of projects) {
      await privateMutation("save-project", {
        project: entry.project,
        summary: entry.summary,
        activate: false,
      }, token);
    }
    await privateMutation("sync-library-index", {
      summaries: projects.map((entry) => entry.summary),
      activeProjectId: persistedActiveProjectId,
    }, token);
  }, explicitToken);
}

export function deleteArchivedProfileProjectFromVault(projectId: string) {
  return queueWrite("delete-archived-project", { projectId });
}

export function persistProfilePrivateValue(key: "wyrmwood", value: unknown) {
  hydrated = { ...hydrated, [key]: structuredClone(value) };
  return queueWrite("save-wyrmwood", { value });
}

export function persistStoryMapContext(projectId: string, value: StoryMapContext) {
  const id = projectId.trim();
  if (!id || id.length > 240) return Promise.reject(new Error("Story Map context requires a valid project id."));
  const current = normalizeStoryMapContextRegistry(hydrated.storyMapContexts);
  const context = normalizeStoryMapContext(value);
  const previous = current[id];
  if (previous
    && previous.blockNumber === context.blockNumber
    && previous.miniBlockNumber === context.miniBlockNumber
    && previous.stage === context.stage
    && previous.passageId === context.passageId) return Promise.resolve();
  const storyMapContexts = normalizeStoryMapContextRegistry({ ...current, [id]: context });
  hydrated = { ...hydrated, storyMapContexts };
  return queueCacheWrite("save-story-map-contexts", { value: storyMapContexts });
}

export function getProfilePrivateSaveState() {
  return saveState;
}

export async function flushProfilePrivateWrites() {
  // A write queued while awaiting an earlier one is part of the same flush.
  for (;;) {
    const current = pendingWrite;
    await current;
    if (pendingWrite === current) break;
  }
  await pendingCacheWrite.catch(() => undefined);
}

export function releaseProfilePrivateBrowserAuthority() {
  authorityEpoch += 1;
  removeProjectPersistenceListener?.();
  removeProjectPersistenceListener = null;
  csrfToken = "";
  hydratedProfileId = "";
  hydrated = { project: null, wyrmwood: null, storyMapContexts: null, recoveryPoints: [] };
  pendingWrite = Promise.resolve();
  pendingCacheWrite = Promise.resolve();
  saveState = Object.freeze({ state: "saved", message: "Saved" });
  clearLibraryProjectSessionCache();
}

export function clearProfilePrivateBrowser() {
  releaseProfilePrivateBrowserAuthority();
  window.sessionStorage.clear();
}
