import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createPlotPickleAuthService,
} from "../core/auth/plotpickle-auth-core.mjs";
import { createServerSessionBoundary } from "../core/auth/server-session/server-session-boundary-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

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

test("#1143 server-network sessions persist encrypted Human-private state independently", async (context) => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1143-network-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  const auth = await createPlotPickleAuthService({ nodeId: "node-1143-network", accessMode: "server-network", stateStore: createInMemoryAuthStateStore() });
  context.after(() => auth.close());
  const storage = createProfilePrivateStorageService({ root: home, authService: auth });
  context.after(() => storage.close());
  const boundary = createServerSessionBoundary({
    authService: auth,
    exposure: {
      accessMode: "server-network",
      bindHost: "10.0.0.2",
      externalOrigin: "https://plotpickle.test",
      allowedOrigins: ["https://plotpickle.test"],
      allowedHosts: ["plotpickle.test"],
      serverNetworkEnabled: true,
      tlsMode: "direct",
      bootstrapComplete: true,
    },
  });
  const remoteRequest = ({ method = "GET", cookie = "", csrf = "" } = {}) => ({
    method,
    url: "https://plotpickle.test/api/auth/profile-private",
    remoteAddress: "203.0.113.10",
    secure: true,
    headers: { host: "plotpickle.test", origin: "https://plotpickle.test", ...(cookie ? { cookie } : {}), ...(csrf ? { "x-plotpickle-csrf": csrf } : {}) },
  });
  const bootstrap = await auth.createServerBootstrapProof();
  const bryan = await boundary.createFirstProfile({ displayName: "Bryan", password: passwordA, avatarRef: null }, bootstrap.proof, remoteRequest({ method: "POST" }));
  const bryanCookie = cookie(bryan);
  const bryanContext = (await boundary.authorizeRequest(remoteRequest({ cookie: bryanCookie }))).authContext;
  const janeCreated = await auth.createProfile({ displayName: "Jane", password: passwordB, avatarRef: null }, bryanContext);
  auth.lock(janeCreated.authContext);
  const jane = await boundary.loginWithPassword({ profileId: janeCreated.profile.profileId, password: passwordB }, remoteRequest({ method: "POST" }));
  const janeCookie = cookie(jane);
  const janeContext = (await boundary.authorizeRequest(remoteRequest({ cookie: janeCookie }))).authContext;
  await storage.saveProject(bryanContext, { project: { id: "bryan-project", title: "Bryan Secret" } });
  await storage.saveProject(janeContext, { project: { id: "jane-project", title: "Jane Secret" } });
  assert.equal((await storage.loadActiveProject(bryanContext)).title, "Bryan Secret");
  assert.equal((await storage.loadActiveProject(janeContext)).title, "Jane Secret");
  assert.deepEqual(auth.listProfileSummaries(), []);
  await boundary.logout(remoteRequest({ method: "POST", cookie: bryanCookie, csrf: bryan.csrfToken }));
  await assert.rejects(storage.loadActiveProject(bryanContext), (error) => error?.code === "SESSION_REJECTED");
  assert.equal((await storage.loadActiveProject(janeContext)).title, "Jane Secret");
  assert.doesNotMatch(await readFile(path.join(home, "profiles", janeCreated.profile.profileId, "projects", "jane-project.json"), "utf8"), /Jane Secret/u);
});

test("#1143 profile gate contains branded installed-ready state, offline setup, recovery acknowledgement, chooser, Guest and active-Human controls", async () => {
  const ui = await readFile(path.join(root, "app/profile-access/profile-access-boundary.tsx"), "utf8");
  const boundaryCss = await readFile(path.join(root, "app/profile-access/profile-access-boundary.module.css"), "utf8");
  const privateBrowser = await readFile(path.join(root, "core/storage/profile-private-browser.ts"), "utf8");
  for (const phrase of ["Create your local profile", "No email, phone, cloud account", "I saved the recovery secret", "Choose a PlotPickle profile", "Use isolated Guest", "Save as new profile", "Switch profile", "BUZZ identity is separate"]) {
    assert.ok(ui.includes(phrase), `Missing profile experience copy: ${phrase}`);
  }
  assert.match(boundaryCss, /PlotPickle is installed and ready/u);
  assert.match(boundaryCss, /workflow-relics\/profile\.svg/u);
  assert.doesNotMatch(ui, /type="email"|name="email"|Sign up for PlotPickle/u);
  assert.match(ui, /persistActiveProfileProject\(\)[\s\S]*flushProfilePrivateWrites\(\)[\s\S]*profileRequest\(action[\s\S]*clearPrivateScreen/u);
  assert.match(privateBrowser, /window\.sessionStorage\.clear\(\)[\s\S]*csrfToken = ""/u);
  assert.match(ui, /autoComplete=\{`\$\{purpose\}-password`\}[\s\S]*getModifierState\("CapsLock"\)/u);
});

test("#1143 API uses the existing Auth/session boundary and does not return raw AuthContext", async () => {
  const route = await readFile(path.join(root, "app/api/auth/profile/route.ts"), "utf8");
  const privateRoute = await readFile(path.join(root, "app/api/auth/profile-private/route.ts"), "utf8");
  const runtime = await readFile(path.join(root, "core/auth/profile-experience/profile-experience-runtime.ts"), "utf8");
  assert.match(route, /boundary\.loginWithPassword[\s\S]*boundary\.authorizeRequest[\s\S]*boundary\.logout/u);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true/u);
  assert.doesNotMatch(route, /authContext\s*:/u);
  assert.match(route, /locateProfile[\s\S]*AUTHENTICATION_REJECTED|locateProfile[\s\S]*profile_A/u);
  assert.match(privateRoute, /boundary\.authorizeRequest[\s\S]*privateStorage\.listProjects[\s\S]*privateStorage\.saveProject/u);
  assert.match(runtime, /PLOTPICKLE_ACCESS_MODE[\s\S]*serverExposure\(\)[\s\S]*accessMode: mode/u);
  assert.doesNotMatch(route, /accessMode: "desktop-loopback"/u);
});

test("#1143 LEARN and Wyrmwood use session-only browser state backed by authenticated encrypted storage", async () => {
  const learn = await readFile(path.join(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");
  const wyrmwood = await readFile(path.join(root, "modules/wyrmwood/ui/wyrmwood-workspace.tsx"), "utf8");
  const library = await readFile(path.join(root, "core/storage/project-library-browser.ts"), "utf8");
  const privateBrowser = await readFile(path.join(root, "core/storage/profile-private-browser.ts"), "utf8");
  assert.match(learn, /loadFoundationProject\(\)[\s\S]*saveFoundationProject/u);
  assert.doesNotMatch(learn, /plotpickle\.foundation\.project\.v1/u);
  assert.match(wyrmwood, /hydratedProfilePrivateValue\("wyrmwood"\)[\s\S]*loadFoundationProject\(\)[\s\S]*persistProfilePrivateValue\("wyrmwood"/u);
  assert.doesNotMatch(wyrmwood, /localStorage|LEARN_PROJECT_STORAGE_KEY/u);
  assert.match(library, /return window\.sessionStorage/u);
  assert.doesNotMatch(library, /return window\.localStorage/u);
  assert.match(privateBrowser, /\/api\/auth\/profile-private[\s\S]*X-PlotPickle-CSRF[\s\S]*save-project/u);
});

test("#1143 Profile owns security actions while Settings no longer duplicates Profiles & Security", async () => {
  const settings = await readFile(path.join(root, "app/sage-settings-workspace.tsx"), "utf8");
  const profile = await readFile(path.join(root, "app/profile-access/profile-identity-panel.tsx"), "utf8");
  const profileCss = await readFile(path.join(root, "app/profile-access/profile-identity-panel.module.css"), "utf8");
  assert.doesNotMatch(settings, /ProfilesSecurityPanel|Profiles & Security|id:\s*["']profiles["']/u);
  for (const phrase of ["Access", "Security", "Lock", "Switch profile", "Profile actions", "Add profile", "Log out"]) {
    assert.ok(profile.includes(phrase), `Profile must own security/action copy: ${phrase}`);
  }
  assert.match(profileCss, /grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(260px, 0\.72fr\)/u);
  assert.match(profileCss, /\.identityColumn\s*\{[\s\S]*grid-column:\s*1;/u);
  assert.match(profileCss, /\.rightRail\s*\{[\s\S]*display:\s*grid;[\s\S]*align-content:\s*start;/u);
  assert.match(profileCss, /@media \(max-width: 820px\)[\s\S]*\.identityColumn,[\s\S]*\.rightRail[\s\S]*grid-column:\s*1;/u);
});
