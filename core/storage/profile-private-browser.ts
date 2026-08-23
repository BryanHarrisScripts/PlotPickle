import { normalizeFoundationProject, type PPFProject } from "../project/project";
import { loadFoundationProject, saveFoundationProject } from "./foundation-project-browser";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "./project-library-browser";

type HydratedPrivateState = {
  readonly project: unknown | null;
  readonly wyrmwood: unknown | null;
};

const LEGACY_ACTIVE_PROJECT_KEY = "plotpickle.foundation.project.v1";
const LEGACY_LIBRARY_PREFIX = "plotpickle.library.profile.v1.";

let csrfToken = "";
let hydrated: HydratedPrivateState = { project: null, wyrmwood: null };
let pendingWrite: Promise<void> = Promise.resolve();

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

function queueWrite(action: string, payload: Record<string, unknown>) {
  const token = csrfToken;
  if (!token) return Promise.reject(new Error("The Human profile is locked."));
  pendingWrite = pendingWrite.catch(() => undefined).then(async () => {
    await privateMutation(action, payload, token);
  });
  return pendingWrite;
}

function legacyBrowserProjects() {
  const projects = new Map<string, PPFProject>();
  const add = (raw: string | null, wrapped = false) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const value = wrapped && parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { readonly project?: unknown }).project
        : parsed;
      if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { readonly id?: unknown }).id !== "string") return;
      const project = normalizeFoundationProject(value);
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
  csrfToken = token;
  window.sessionStorage.clear();
  window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profileId);
  const result = await fetch("/api/auth/profile-private", { credentials: "same-origin", cache: "no-store" });
  if (!result.ok) throw new Error("PlotPickle could not open the encrypted profile state.");
  hydrated = await result.json() as HydratedPrivateState;
  if (hydrated.project) saveFoundationProject(hydrated.project as Parameters<typeof saveFoundationProject>[0]);
  else saveFoundationProject(loadFoundationProject());
}

export function hydratedProfilePrivateValue(key: "wyrmwood") {
  return hydrated[key];
}

export function persistActiveProfileProject() {
  return queueWrite("save-project", { project: loadFoundationProject() });
}

export function persistProfilePrivateValue(key: "wyrmwood", value: unknown) {
  hydrated = { ...hydrated, [key]: structuredClone(value) };
  return queueWrite("save-wyrmwood", { value });
}

export async function flushProfilePrivateWrites() {
  await pendingWrite;
}

export function clearProfilePrivateBrowser() {
  csrfToken = "";
  hydrated = { project: null, wyrmwood: null };
  pendingWrite = Promise.resolve();
  window.sessionStorage.clear();
}
