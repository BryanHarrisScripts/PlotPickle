import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createPlotPickleAuthService,
  toPublicAuthError,
} from "../core/auth/plotpickle-auth-core.mjs";
import { ARGON2ID_SECURITY_FLOOR } from "../core/auth/profile-crypto-contract-core.mjs";
import {
  createAuthenticationThrottle,
  createServerExposurePolicy,
  createServerSessionBoundary,
  toPublicServerSessionError,
} from "../core/auth/server-session/server-session-boundary-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const password = "Server session fixture passphrase";

function serviceOptions(stateStore, overrides = {}) {
  return {
    nodeId: "node_server_session_fixture",
    accessMode: "desktop-loopback",
    stateStore,
    passwordParameters: ARGON2ID_SECURITY_FLOOR,
    ...overrides,
  };
}

async function createDesktopFixture(context, overrides = {}) {
  const clock = overrides.clock || { value: Date.parse("2026-08-20T18:00:00.000Z") };
  const auth = await createPlotPickleAuthService(serviceOptions(createInMemoryAuthStateStore(), {
    now: () => clock.value,
    ...overrides.auth,
  }));
  const created = await auth.createFirstProfile({ displayName: "Bryan", password, avatarRef: null });
  auth.lock(created.authContext);
  const boundary = createServerSessionBoundary({
    authService: auth,
    exposure: {
      accessMode: "desktop-loopback",
      allowedOrigins: ["http://127.0.0.1:4173"],
      allowedHosts: ["127.0.0.1:4173"],
    },
    now: () => clock.value,
    ...overrides.boundary,
  });
  context.after(() => auth.close());
  return { auth, boundary, clock, profile: created.profile, recoverySecret: created.recoverySecret };
}

function browserRequest({ method = "GET", cookie = null, csrf = null, origin = "http://127.0.0.1:4173", headers = {}, body } = {}) {
  return {
    method,
    url: "http://127.0.0.1:4173/private",
    remoteAddress: "127.0.0.1",
    body,
    headers: {
      host: "127.0.0.1:4173",
      ...(origin === null ? {} : { origin }),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-plotpickle-csrf": csrf } : {}),
      ...headers,
    },
  };
}

function cookieFrom(result) {
  return result.headers["Set-Cookie"].split(";", 1)[0];
}

function tokenFrom(cookie) {
  return cookie.slice(cookie.indexOf("=") + 1);
}

async function login(boundary, profileId, suppliedPassword = password, request = browserRequest({ method: "POST" })) {
  return boundary.loginWithPassword({ profileId, password: suppliedPassword }, request);
}

test("#1142 issues opaque rotating 256-bit sessions without returning AuthContext to the browser", async (context) => {
  const { boundary, profile } = await createDesktopFixture(context);
  const first = await login(boundary, profile.profileId);
  const second = await login(boundary, profile.profileId);
  const firstCookie = cookieFrom(first);
  const secondCookie = cookieFrom(second);
  assert.notEqual(firstCookie, secondCookie);
  assert.equal(Buffer.from(tokenFrom(firstCookie), "base64url").byteLength, 32);
  assert.equal(Object.hasOwn(first, "authContext"), false);
  assert.equal(Object.hasOwn(first, "sessionId"), false);
  assert.equal(JSON.stringify(first).includes(profile.profileId), true);
  assert.equal(tokenFrom(firstCookie).includes(profile.profileId), false);
  assert.match(first.headers["Set-Cookie"], /^ppsid=[A-Za-z0-9_-]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+$/u);
  assert.doesNotMatch(first.headers["Set-Cookie"], /Domain=|; Secure/u);
});

test("#1142 keeps raw session records server-side with idle and absolute expiry", async (context) => {
  const clock = { value: Date.parse("2026-08-20T18:10:00.000Z") };
  const { boundary, profile } = await createDesktopFixture(context, { clock, auth: { sessionIdleTtlMs: 1_000, sessionTtlMs: 5_000 } });
  const signedIn = await login(boundary, profile.profileId);
  const cookie = cookieFrom(signedIn);
  clock.value += 500;
  assert.equal((await boundary.authorizeRequest(browserRequest({ cookie }))).authContext.profileId, profile.profileId);
  clock.value += 900;
  assert.equal((await boundary.authorizeRequest(browserRequest({ cookie }))).authContext.profileId, profile.profileId);
  clock.value += 1_001;
  await assert.rejects(boundary.authorizeRequest(browserRequest({ cookie })), (error) => error?.code === "SESSION_REJECTED");

  const absolute = await login(boundary, profile.profileId);
  clock.value += 5_001;
  await assert.rejects(boundary.authorizeRequest(browserRequest({ cookie: cookieFrom(absolute) })), (error) => error?.code === "SESSION_REJECTED");
});

test("#1142 resolves AuthContext only from the cookie and ignores browser profile claims", async (context) => {
  const { auth, boundary, profile } = await createDesktopFixture(context);
  const ownerLogin = await login(boundary, profile.profileId);
  const ownerCookie = cookieFrom(ownerLogin);
  const ownerContext = (await boundary.authorizeRequest(browserRequest({ cookie: ownerCookie }))).authContext;
  const jane = await auth.createProfile({ displayName: "Jane", password: "Jane independent session passphrase", avatarRef: null }, ownerContext);
  const janeCookie = cookieFrom(await login(boundary, jane.profile.profileId, "Jane independent session passphrase"));
  const forged = browserRequest({ cookie: janeCookie, body: { profileId: profile.profileId } });
  await assert.rejects(boundary.authorizeRequest(forged, { profileId: profile.profileId }), (error) => error?.code === "ACCESS_DENIED");
  await assert.rejects(boundary.authorizeRequest({ ...forged, url: `${forged.url}?sessionId=${tokenFrom(ownerCookie)}` }), (error) => error?.code === "SESSION_EXCHANGE_REJECTED");
  await assert.rejects(boundary.authorizeRequest(browserRequest({ cookie: janeCookie, headers: { authorization: `Bearer ${tokenFrom(ownerCookie)}` } })), (error) => error?.code === "SESSION_EXCHANGE_REJECTED");
});

test("#1142 central guards deny guessed project and profile-secret ids", async (context) => {
  const allowed = new Set(["project-owned"]);
  const { auth, profile } = await createDesktopFixture(context);
  const boundary = createServerSessionBoundary({
    authService: auth,
    exposure: { accessMode: "desktop-loopback", allowedOrigins: ["http://127.0.0.1:4173"], allowedHosts: ["127.0.0.1:4173"] },
    projectAccess: async ({ authContext, projectId }) => authContext.profileId === profile.profileId && allowed.has(projectId),
  });
  const signedIn = await login(boundary, profile.profileId);
  const request = browserRequest({ cookie: cookieFrom(signedIn) });
  await assert.rejects(boundary.authorizeRequest(request, { projectId: "project-guessed" }), (error) => error?.code === "ACCESS_DENIED");
  await assert.rejects(boundary.authorizeRequest(request, { profileSecretProfileId: "profile_other" }), (error) => error?.code === "ACCESS_DENIED");
});

test("#1142 requires allowed Origin and a server-bound CSRF proof for every mutation", async (context) => {
  const { boundary, profile } = await createDesktopFixture(context);
  const signedIn = await login(boundary, profile.profileId);
  const cookie = cookieFrom(signedIn);
  await assert.rejects(boundary.authorizeRequest(browserRequest({ method: "POST", cookie, origin: null })), (error) => error?.code === "ORIGIN_REJECTED");
  await assert.rejects(boundary.authorizeRequest(browserRequest({ method: "POST", cookie, origin: "http://attacker.test", csrf: signedIn.csrfToken })), (error) => error?.code === "ORIGIN_REJECTED");
  await assert.rejects(boundary.authorizeRequest(browserRequest({ method: "POST", cookie })), (error) => error?.code === "CSRF_REJECTED");
  await assert.rejects(boundary.authorizeRequest(browserRequest({ method: "POST", cookie, csrf: Buffer.alloc(32, 4).toString("base64url") })), (error) => error?.code === "CSRF_REJECTED");
  assert.equal((await boundary.authorizeRequest(browserRequest({ method: "POST", cookie, csrf: signedIn.csrfToken }))).authContext.profileId, profile.profileId);
  await assert.rejects(boundary.authorizePrivateStream(browserRequest({ cookie, origin: null })), (error) => error?.code === "ORIGIN_REJECTED");
  assert.equal((await boundary.authorizePrivateStream(browserRequest({ cookie }))).authContext.profileId, profile.profileId);
});

test("#1142 logout, profile disable, and session revocation fail closed without exposing raw tokens", async (context) => {
  const { auth, boundary, profile } = await createDesktopFixture(context);
  const first = await login(boundary, profile.profileId);
  const second = await login(boundary, profile.profileId);
  const firstCookie = cookieFrom(first);
  const secondCookie = cookieFrom(second);
  const summaries = await boundary.listSessions(browserRequest({ cookie: secondCookie }));
  assert.equal(summaries.length, 2);
  assert.equal(JSON.stringify(summaries).includes(tokenFrom(firstCookie)), false);
  assert.equal(summaries.every((summary) => Buffer.from(summary.sessionRef, "base64url").byteLength === 16), true);
  const other = summaries.find((summary) => !summary.current);
  assert.equal(await boundary.revokeSession(browserRequest({ method: "POST", cookie: secondCookie, csrf: second.csrfToken }), other.sessionRef), true);
  await assert.rejects(boundary.authorizeRequest(browserRequest({ cookie: firstCookie })), (error) => error?.code === "SESSION_REJECTED");
  const loggedOut = await boundary.logout(browserRequest({ method: "POST", cookie: secondCookie, csrf: second.csrfToken }));
  assert.match(loggedOut.headers["Set-Cookie"], /Max-Age=0/u);
  await assert.rejects(boundary.authorizeRequest(browserRequest({ cookie: secondCookie })), (error) => error?.code === "SESSION_REJECTED");

  const third = await login(boundary, profile.profileId);
  const fourth = await login(boundary, profile.profileId);
  const fourthContext = (await boundary.authorizeRequest(browserRequest({ cookie: cookieFrom(fourth) }))).authContext;
  await auth.disableProfile(profile.profileId, fourthContext);
  for (const cookie of [cookieFrom(third), cookieFrom(fourth)]) {
    await assert.rejects(boundary.authorizeRequest(browserRequest({ cookie })), (error) => error?.code === "SESSION_REJECTED");
  }
});

test("#1142 destructive profile actions require recent password authentication", async (context) => {
  const clock = { value: Date.parse("2026-08-20T18:25:00.000Z") };
  const { auth, boundary, profile, recoverySecret } = await createDesktopFixture(context, {
    clock,
    auth: { recentReauthenticationMs: 1_000 },
  });
  const signedIn = await login(boundary, profile.profileId);
  const authContext = (await boundary.authorizeRequest(browserRequest({ cookie: cookieFrom(signedIn) }))).authContext;
  clock.value += 1_001;
  await assert.rejects(auth.disableProfile(profile.profileId, authContext), (error) => error?.code === "RECENT_REAUTHENTICATION_REQUIRED");

  const recovered = await boundary.resetPasswordWithRecovery({
    profileId: profile.profileId,
    recoverySecret,
    newPassword: "Recovered server session passphrase",
  }, browserRequest({ method: "POST" }));
  const recoveryContext = (await boundary.authorizeRequest(browserRequest({ cookie: cookieFrom(recovered) }))).authContext;
  await assert.rejects(auth.disableProfile(profile.profileId, recoveryContext), (error) => error?.code === "RECENT_REAUTHENTICATION_REQUIRED");
});

test("#1142 preserves same-profile concurrent project state when only one session is revoked", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1142-concurrency-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { auth, boundary, profile } = await createDesktopFixture(context);
  const first = await login(boundary, profile.profileId);
  const second = await login(boundary, profile.profileId);
  const contextA = (await boundary.authorizeRequest(browserRequest({ cookie: cookieFrom(first) }))).authContext;
  const contextB = (await boundary.authorizeRequest(browserRequest({ cookie: cookieFrom(second) }))).authContext;
  const storage = createProfilePrivateStorageService({ root: directory, authService: auth, now: () => "2026-08-20T18:30:00.000Z" });
  context.after(() => storage.close());
  await storage.saveProject(contextA, { project: { id: "story-a", title: "A" } });
  await storage.saveProject(contextB, { project: { id: "story-b", title: "B" } });
  assert.equal((await storage.loadActiveProject(contextA)).id, "story-a");
  assert.equal((await storage.loadActiveProject(contextB)).id, "story-b");
  auth.lock(contextA);
  assert.equal((await storage.loadActiveProject(contextB)).id, "story-b");
});

test("#1142 throttles login, recovery, and bootstrap with generic value-free failures", async (context) => {
  let clock = Date.parse("2026-08-20T18:40:00.000Z");
  const { boundary, profile } = await createDesktopFixture(context, { clock: { get value() { return clock; } } });
  const publicFailures = [];
  for (const candidate of [
    { profileId: profile.profileId, password: "Incorrect passphrase" },
    { profileId: `profile_${Buffer.alloc(16, 9).toString("base64url")}`, password: "Incorrect passphrase" },
  ]) {
    try {
      await boundary.loginWithPassword(candidate, browserRequest({ method: "POST" }));
    } catch (error) {
      publicFailures.push(toPublicServerSessionError(error));
    }
  }
  assert.equal(publicFailures[0].code, "AUTHENTICATION_REJECTED");
  assert.deepEqual(publicFailures[0], publicFailures[1]);
  await assert.rejects(login(boundary, profile.profileId, "Incorrect again"), (error) => error?.code === "AUTHENTICATION_REJECTED");
  await assert.rejects(login(boundary, profile.profileId, password), (error) => error?.code === "AUTHENTICATION_THROTTLED" && error.retryAfterMs > 0);
  assert.deepEqual(boundary.throttleMetadata(), { activeBuckets: 4, valuesLogged: false });

  const separate = createAuthenticationThrottle({ accessMode: "server-network", now: () => clock });
  const rate = { sourceIp: "192.0.2.1", locator: "recovery-locator", purpose: "recovery" };
  separate.recordFailure(rate);
  assert.throws(() => separate.assertAllowed(rate), (error) => error?.code === "AUTHENTICATION_THROTTLED");
  clock += 2_001;
  separate.recordSuccess(rate);
  assert.equal(separate.retryAfter(rate), 0);
});

test("#1142 server-network refuses remote auth until TLS, Host, Origin, proxy, and bootstrap policy are complete", () => {
  const incomplete = createServerExposurePolicy({ accessMode: "server-network" });
  assert.equal(incomplete.ready, false);
  assert.deepEqual(incomplete.reasons, [
    "server-network-not-explicitly-enabled",
    "explicit-bind-address-required",
    "https-external-origin-required",
    "explicit-https-origin-allowlist-required",
    "explicit-host-allowlist-required",
    "tls-mode-required",
    "first-run-bootstrap-incomplete",
  ]);
  const direct = createServerExposurePolicy({
    accessMode: "server-network",
    bindHost: "0.0.0.0",
    externalOrigin: "https://plotpickle.example",
    allowedOrigins: ["https://plotpickle.example"],
    allowedHosts: ["plotpickle.example"],
    serverNetworkEnabled: true,
    tlsMode: "direct",
    bootstrapComplete: true,
    enableHsts: true,
  });
  assert.equal(direct.ready, true);
  assert.equal(direct.cookieName, "__Host-ppsid");
  assert.equal(direct.secureCookies, true);
  const proxyMissingTrust = createServerExposurePolicy({
    accessMode: "server-network",
    bindHost: "192.0.2.10",
    externalOrigin: "https://plotpickle.example",
    allowedOrigins: ["https://plotpickle.example"],
    allowedHosts: ["plotpickle.example"],
    serverNetworkEnabled: true,
    tlsMode: "trusted-proxy",
    bootstrapComplete: true,
  });
  assert.equal(proxyMissingTrust.ready, false);
  assert.deepEqual(proxyMissingTrust.reasons, ["trusted-proxy-addresses-required"]);
});

test("#1142 network cookies are Secure and remote plain HTTP, wildcard Host/CORS, and untrusted forwarding fail closed", async (context) => {
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore, { accessMode: "server-network" }));
  context.after(() => auth.close());
  const bootstrap = await auth.createServerBootstrapProof();
  const created = await auth.createFirstProfile({ displayName: "Remote Human", password, avatarRef: null }, bootstrap.proof);
  auth.lock(created.authContext);
  const boundary = createServerSessionBoundary({
    authService: auth,
    exposure: {
      accessMode: "server-network",
      bindHost: "0.0.0.0",
      externalOrigin: "https://plotpickle.example",
      allowedOrigins: ["https://plotpickle.example"],
      allowedHosts: ["plotpickle.example"],
      serverNetworkEnabled: true,
      tlsMode: "trusted-proxy",
      trustedProxyAddresses: ["192.0.2.10"],
      bootstrapComplete: true,
      enableHsts: true,
    },
  });
  const request = {
    method: "POST",
    url: "https://plotpickle.example/auth/login",
    remoteAddress: "192.0.2.10",
    headers: {
      host: "plotpickle.example",
      origin: "https://plotpickle.example",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "198.51.100.25",
      "user-agent": "Mozilla/5.0 Firefox/100",
    },
  };
  const signedIn = await boundary.loginWithPassword({ profileId: created.profile.profileId, password }, request);
  assert.match(signedIn.headers["Set-Cookie"], /^__Host-ppsid=.*; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/u);
  assert.equal(signedIn.headers["Strict-Transport-Security"], "max-age=31536000");
  assert.equal(Object.values(signedIn.headers).some((value) => String(value).includes("Access-Control-Allow-Origin: *")), false);
  await assert.rejects(boundary.loginWithPassword({ profileId: created.profile.profileId, password }, { ...request, url: "http://plotpickle.example/auth/login", headers: { ...request.headers, "x-forwarded-proto": "http" } }), (error) => error?.code === "TLS_REQUIRED");
  await assert.rejects(boundary.loginWithPassword({ profileId: created.profile.profileId, password }, { ...request, headers: { ...request.headers, host: "attacker.test" } }), (error) => error?.code === "HOST_REJECTED");
  await assert.rejects(boundary.loginWithPassword({ profileId: created.profile.profileId, password }, { ...request, remoteAddress: "192.0.2.99", url: "/auth/login" }), (error) => error?.code === "TLS_REQUIRED");
  assert.throws(() => createServerExposurePolicy({
    accessMode: "server-network",
    bindHost: "0.0.0.0",
    externalOrigin: "https://plotpickle.example",
    allowedOrigins: ["https://plotpickle.example"],
    allowedHosts: ["*"],
    serverNetworkEnabled: true,
    tlsMode: "direct",
    bootstrapComplete: true,
  }), (error) => error?.code === "INVALID_SERVER_SESSION_CONTRACT");
});

test("#1142 source contracts forbid browser token persistence and register private route ownership", async () => {
  const core = await readFile(path.join(root, "core/auth/server-session/server-session-boundary-core.mjs"), "utf8");
  const authCore = await readFile(path.join(root, "core/auth/plotpickle-auth-core.mjs"), "utf8");
  const storage = await readFile(path.join(root, "core/storage/profile-private/profile-private-storage-core.mjs"), "utf8");
  const architecture = await readFile(path.join(root, "docs/architecture/PLOTPICKLE-SERVER-SESSION-BOUNDARY.md"), "utf8");
  const workflow = await readFile(path.join(root, ".github/workflows/server-session-boundary.yml"), "utf8");
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const uat = JSON.parse(await readFile(path.join(root, "config/uat-autopilot-registry.json"), "utf8"));
  assert.doesNotMatch(core, /localStorage|sessionStorage/u);
  assert.match(core, /HttpOnly[\s\S]*SameSite=Strict/u);
  assert.match(core, /requireProfileOwner[\s\S]*requireProjectAccess[\s\S]*requireProfileSecretAccess[\s\S]*requireNodeAdministrator[\s\S]*requireRecentReauthentication/u);
  assert.match(authCore, /plotpickle:server-session:v1/u);
  assert.match(storage, /resolveSession\(sessionId, \{ touch: false \}\)/u);
  assert.match(architecture, /server-network[\s\S]*trusted proxy/iu);
  assert.match(architecture, /universal Human-vault decryptor/iu);
  assert.match(workflow, /windows-latest[\s\S]*ubuntu-latest[\s\S]*test:server-session[\s\S]*npm run build/u);
  assert.equal(packageJson.scripts["test:server-session"], "node --test tests/issue-1142-server-session-boundary.test.mjs");
  assert.equal(uat.areas.find((area) => area.id === "startup").tests.includes("tests/issue-1142-server-session-boundary.test.mjs"), true);
  assert.equal(toPublicAuthError(new Error("secret password value")).message.includes("secret"), false);
});
