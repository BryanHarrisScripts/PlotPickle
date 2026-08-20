import { loadFoundationProject, saveFoundationProject } from "./foundation-project-browser";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "./project-library-browser";

type HydratedPrivateState = {
  readonly project: unknown | null;
  readonly wyrmwood: unknown | null;
};

let csrfToken = "";
let hydrated: HydratedPrivateState = { project: null, wyrmwood: null };
let pendingWrite: Promise<void> = Promise.resolve();

function queueWrite(action: string, payload: Record<string, unknown>) {
  const token = csrfToken;
  if (!token) return Promise.reject(new Error("The Human profile is locked."));
  pendingWrite = pendingWrite.catch(() => undefined).then(async () => {
    const result = await fetch("/api/auth/profile-private", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": token },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!result.ok) throw new Error("PlotPickle could not persist the encrypted profile state.");
  });
  return pendingWrite;
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
