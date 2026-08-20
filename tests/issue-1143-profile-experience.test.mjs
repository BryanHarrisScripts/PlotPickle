import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createPlotPickleAuthService,
} from "../core/auth/plotpickle-auth-core.mjs";
import { createServerSessionBoundary } from "../core/auth/server-session/server-session-boundary-core.mjs";

const root = process.cwd();
const passwordA = "Bryan private story passphrase";
const passwordB = "Jane separate story passphrase";

function request({ method = "GET", cookie = "", csrf = "" } = {}) {
  return {
    method,
    url: "http://127.0.0.1:4173/api/auth/profile",
    remoteAddress: "127.0.0.1",
    headers: {
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:4173",
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-plotpickle-csrf": csrf } : {}),
    },
  };
}

function cookie(result) {
  return result.headers["Set-Cookie"].split(";", 1)[0];
}

async function fixture(context) {
  const auth = await createPlotPickleAuthService({ nodeId: "node-1143-test", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
  context.after(() => auth.close());
  const first = await auth.createFirstProfile({ displayName: "Bryan", password: passwordA, avatarRef: null });
  const second = await auth.createProfile({ displayName: "Jane", password: passwordB, avatarRef: null }, first.authContext);
  auth.lock(first.authContext);
  auth.lock(second.authContext);
  const boundary = createServerSessionBoundary({ authService: auth, exposure: { accessMode: "desktop-loopback", allowedOrigins: ["http://127.0.0.1:4173"], allowedHosts: ["127.0.0.1:4173"] } });
  return { auth, boundary, first, second };
}

test("#1143 local chooser exposes safe profile presentation only while remote mode enumerates nothing", async (context) => {
  const { auth } = await fixture(context);
  assert.deepEqual(auth.listProfileSummaries().map(({ displayName, avatarRef, status }) => ({ displayName, avatarRef, status })), [
    { displayName: "Bryan", avatarRef: null, status: "active" },
    { displayName: "Jane", avatarRef: null, status: "active" },
  ]);
  assert.equal(JSON.stringify(auth.listProfileSummaries()).includes("story"), false);
  const remote = await createPlotPickleAuthService({ nodeId: "node-1143-remote", accessMode: "server-network", stateStore: createInMemoryAuthStateStore() });
  context.after(() => remote.close());
  assert.deepEqual(remote.listProfileSummaries(), []);
});

test("#1143 two Humans retain independent simultaneous sessions and logout is session-scoped", async (context) => {
  const { auth, boundary, first, second } = await fixture(context);
  const bryan = await boundary.loginWithPassword({ profileId: first.profile.profileId, password: passwordA }, request({ method: "POST" }));
  const jane = await boundary.loginWithPassword({ profileId: second.profile.profileId, password: passwordB }, request({ method: "POST" }));
  const bryanRequest = request({ cookie: cookie(bryan) });
  const janeRequest = request({ cookie: cookie(jane) });
  assert.equal((await boundary.authorizeRequest(bryanRequest)).authContext.profileId, first.profile.profileId);
  assert.equal((await boundary.authorizeRequest(janeRequest)).authContext.profileId, second.profile.profileId);
  await boundary.logout(request({ method: "POST", cookie: cookie(bryan), csrf: bryan.csrfToken }));
  await assert.rejects(boundary.authorizeRequest(bryanRequest), (error) => error?.code === "SESSION_REJECTED");
  assert.equal((await boundary.authorizeRequest(janeRequest)).authContext.profileId, second.profile.profileId);
  assert.equal(auth.getAuthStatus().authenticated, false);
});

test("#1143 profile gate contains offline setup, recovery acknowledgement, chooser, Guest and active-Human controls", async () => {
  const ui = await readFile(path.join(root, "app/profile-access/profile-access-boundary.tsx"), "utf8");
  for (const phrase of ["Create your local profile", "No email, phone, cloud account", "I saved the recovery secret", "Choose a PlotPickle profile", "Use isolated Guest", "Save as new profile", "Switch profile", "BUZZ identity is separate"]) assert.match(ui, new RegExp(phrase, "u"));
  assert.doesNotMatch(ui, /type="email"|name="email"|Sign up for PlotPickle/u);
  assert.match(ui, /sessionStorage\.clear\(\)[\s\S]*removeItem\(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY\)[\s\S]*history\.replaceState/u);
  assert.match(ui, /autoComplete=\{`\$\{purpose\}-password`\}[\s\S]*getModifierState\("CapsLock"\)/u);
});

test("#1143 API uses the existing Auth/session boundary and does not return raw AuthContext", async () => {
  const route = await readFile(path.join(root, "app/api/auth/profile/route.ts"), "utf8");
  assert.match(route, /boundary\.loginWithPassword[\s\S]*boundary\.authorizeRequest[\s\S]*boundary\.logout/u);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true/u);
  assert.doesNotMatch(route, /authContext\s*:/u);
  assert.match(route, /locateProfile[\s\S]*AUTHENTICATION_REJECTED|locateProfile[\s\S]*profile_A/u);
});

test("#1143 LEARN and Wyrmwood resolve project state through the active opaque Human profile", async () => {
  const learn = await readFile(path.join(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");
  const wyrmwood = await readFile(path.join(root, "modules/wyrmwood/ui/wyrmwood-workspace.tsx"), "utf8");
  assert.match(learn, /loadFoundationProject\(\)[\s\S]*saveFoundationProject/u);
  assert.doesNotMatch(learn, /plotpickle\.foundation\.project\.v1/u);
  assert.match(wyrmwood, /PROJECT_LIBRARY_ACTIVE_PROFILE_KEY[\s\S]*loadFoundationProject\(\)[\s\S]*WYRMWOOD_STORAGE_KEY/u);
  assert.doesNotMatch(wyrmwood, /LEARN_PROJECT_STORAGE_KEY/u);
});

test("#1143 Profiles & Security is a first-class Settings destination", async () => {
  const settings = await readFile(path.join(root, "app/sage-settings-workspace.tsx"), "utf8");
  const panel = await readFile(path.join(root, "app/profile-access/profiles-security-panel.tsx"), "utf8");
  assert.match(settings, /Profiles & Security[\s\S]*ProfilesSecurityPanel/u);
  for (const phrase of ["Current Human", "Change the local vault passphrase", "Recovery material created", "browser session(s)", "Lock all other sessions"]) assert.match(panel, new RegExp(phrase.replace(/[()]/gu, "\\$&"), "u"));
  assert.match(panel, /separate[\s\S]*BUZZ identity/u);
});
