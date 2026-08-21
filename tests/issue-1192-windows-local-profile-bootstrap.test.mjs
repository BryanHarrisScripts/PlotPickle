import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createPlotPickleAuthService,
  toPublicAuthError,
} from "../core/auth/plotpickle-auth-core.mjs";
import { ARGON2ID_SECURITY_FLOOR } from "../core/auth/profile-crypto-contract-core.mjs";
import {
  createServerSessionBoundary,
  toPublicServerSessionError,
} from "../core/auth/server-session/server-session-boundary-core.mjs";

const origin = "http://127.0.0.1:4173";
const desktopRequest = {
  method: "POST",
  url: `${origin}/api/auth/profile`,
  remoteAddress: "127.0.0.1",
  headers: { host: "127.0.0.1:4173", origin },
};

function options(accessMode, stateStore = createInMemoryAuthStateStore()) {
  return {
    nodeId: `node_1192_${accessMode.replace("-", "_")}`,
    accessMode,
    stateStore,
    passwordParameters: ARGON2ID_SECURITY_FLOOR,
  };
}

function desktopBoundary(auth) {
  return createServerSessionBoundary({
    authService: auth,
    exposure: {
      accessMode: "desktop-loopback",
      allowedOrigins: [origin],
      allowedHosts: ["127.0.0.1:4173"],
    },
  });
}

test("#1192 desktop first-profile accepts the real-world passphrase without any server bootstrap proof", async (context) => {
  const auth = await createPlotPickleAuthService(options("desktop-loopback"));
  context.after(() => auth.close());
  const boundary = desktopBoundary(auth);
  const created = await boundary.createFirstProfile({
    displayName: "Bryan",
    password: "hi welcome to the thunderdome",
    avatarRef: null,
  }, undefined, desktopRequest);
  assert.equal(created.profile.displayName, "Bryan");
  assert.match(created.recoverySecret, /^pprec1\./);
  assert.match(created.headers["Set-Cookie"], /^ppsid=/);
});

test("#1192 desktop first-profile preserves safe Auth Core errors instead of inventing a server-bootstrap failure", async (context) => {
  const auth = await createPlotPickleAuthService(options("desktop-loopback"));
  context.after(() => auth.close());
  const boundary = desktopBoundary(auth);
  let observed;
  try {
    await boundary.createFirstProfile({ displayName: "Bryan", password: "password123", avatarRef: null }, undefined, desktopRequest);
  } catch (error) {
    observed = error;
  }
  assert.equal(observed?.code, "INVALID_PROFILE_PASSWORD");
  const publicAuth = toPublicAuthError(observed);
  assert.equal(publicAuth.code, "INVALID_PROFILE_PASSWORD");
  assert.match(publicAuth.message, /password|passphrase/i);
  const publicServer = toPublicServerSessionError(observed);
  assert.equal(publicServer.code, "AUTH_REQUEST_REJECTED");
  assert.notEqual(publicAuth.message, "The server bootstrap request was rejected.");
});

test("#1192 real server-network first-profile failures remain generic bootstrap rejections", async (context) => {
  const auth = await createPlotPickleAuthService(options("server-network"));
  context.after(() => auth.close());
  const bootstrap = await auth.createServerBootstrapProof();
  const boundary = createServerSessionBoundary({
    authService: auth,
    exposure: {
      accessMode: "server-network",
      bindHost: "192.0.2.10",
      externalOrigin: "https://plotpickle.example.test",
      allowedOrigins: ["https://plotpickle.example.test"],
      allowedHosts: ["plotpickle.example.test"],
      serverNetworkEnabled: true,
      tlsMode: "direct",
      bootstrapComplete: true,
    },
  });
  const request = {
    method: "POST",
    url: "https://plotpickle.example.test/api/auth/profile",
    remoteAddress: "198.51.100.20",
    secure: true,
    headers: { host: "plotpickle.example.test", origin: "https://plotpickle.example.test" },
  };
  await assert.rejects(
    boundary.createFirstProfile({ displayName: "Network Human", password: "Network Human independent passphrase", avatarRef: null }, `${bootstrap.proof.slice(0, -1)}A`, request),
    (error) => error?.code === "BOOTSTRAP_PROOF_REJECTED" && error?.publicMessage === "The server bootstrap request was rejected.",
  );
});

test("#1192 profile API explicitly routes server-session and Auth Core errors through their own public converters", async () => {
  const source = await readFile(new URL("../app/api/auth/profile/route.ts", import.meta.url), "utf8");
  assert.match(source, /PlotPickleAuthError/);
  assert.match(source, /PlotPickleServerSessionError/);
  assert.match(source, /error instanceof PlotPickleServerSessionError/);
  assert.match(source, /error instanceof PlotPickleAuthError/);
  assert.doesNotMatch(source, /server\.code\s*!==\s*["']SERVER_SESSION_FAILED["']/);
});
