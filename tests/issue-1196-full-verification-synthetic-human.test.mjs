import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  establishVerificationSyntheticHuman,
  verificationAuthRequestHeaders,
  verificationPlaywrightArgs,
  verificationSyntheticHome,
  verificationSyntheticRuntime,
} from "../scripts/full-verification-auth.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

test("#1196 Full Verification synthetic Human runtime overrides stale normal/server Auth locations", () => {
  const env = {
    LOCALAPPDATA: "C:\\Users\\Writer\\AppData\\Local",
    PLOTPICKLE_HOME: "D:\\real-human-home",
    PLOTPICKLE_AUTH_STATE_PATH: "D:\\real-human-auth.json",
    PLOTPICKLE_ACCESS_MODE: "server-network",
    PLOTPICKLE_SERVER_NETWORK_ENABLED: "true",
  };
  const runtime = verificationSyntheticRuntime("verification-job-A", { env, platform: "win32" });
  assert.equal(runtime.home, verificationSyntheticHome("verification-job-A", { env, platform: "win32" }));
  assert.match(runtime.home, /PlotPickle[\\/]full-verification[\\/]synthetic-humans[\\/]fv-[a-f0-9]{24}$/u);
  assert.equal(runtime.runtimeEnv.PLOTPICKLE_HOME, runtime.home);
  assert.equal(runtime.runtimeEnv.PLOTPICKLE_AUTH_STATE_PATH, path.join(runtime.home, "auth", "state.json"));
  assert.equal(runtime.runtimeEnv.PLOTPICKLE_ACCESS_MODE, "desktop-loopback");
  assert.equal(runtime.runtimeEnv.PLOTPICKLE_SERVER_NETWORK_ENABLED, "false");
  assert.notEqual(runtime.runtimeEnv.PLOTPICKLE_HOME, env.PLOTPICKLE_HOME);
  assert.notEqual(runtime.runtimeEnv.PLOTPICKLE_AUTH_STATE_PATH, env.PLOTPICKLE_AUTH_STATE_PATH);
});

test("#1196 synthetic Human warms current Profile routes before real create/login/status API sequence", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1196-"));
  const profileId = "profile_AAAAAAAAAAAAAAAAAAAAAA";
  const passwordBodies = [];
  const requests = [];
  try {
    const fetchImpl = async (url, init = {}) => {
      requests.push({ url: String(url), method: init.method || "GET", headers: init.headers || {}, body: init.body || "" });
      if ((init.method || "GET") === "GET") {
        const authenticated = String(init.headers?.Cookie || "").startsWith("ppsid=session-1196");
        return jsonResponse(authenticated
          ? { configured: true, authenticated: true, accessMode: "desktop-loopback", profile: { profileId, displayName: "PlotPickle Verification Human" } }
          : { configured: false, authenticated: false, accessMode: "desktop-loopback", profile: null });
      }
      const payload = JSON.parse(init.body);
      passwordBodies.push(payload.password);
      if (payload.action === "create-first-profile") {
        return jsonResponse({ profile: { profileId, displayName: "PlotPickle Verification Human" }, recoverySecret: "recovery-should-never-persist" });
      }
      if (payload.action === "login") {
        return jsonResponse({ profile: { profileId }, csrfToken: "csrf-1196" }, { headers: { "Set-Cookie": "ppsid=session-1196; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600" } });
      }
      return jsonResponse({ message: "unexpected" }, { status: 400 });
    };

    const result = await establishVerificationSyntheticHuman({
      baseUrl: "http://127.0.0.1:54321",
      home,
      fetchImpl,
      now: () => 1_787_275_200_000,
    });
    assert.equal(result.profileId, profileId);
    assert.equal(result.environment.PLOTPICKLE_VERIFICATION_AUTH_MODE, "synthetic-human");
    assert.equal(result.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE, "ppsid=session-1196");
    assert.equal(result.environment.PLOTPICKLE_VERIFICATION_AUTH_CSRF, "csrf-1196");
    assert.equal(passwordBodies.length, 2);
    assert.equal(passwordBodies[0], passwordBodies[1]);
    assert.match(passwordBodies[0], /^fv-[A-Za-z0-9_-]{40,}$/u);

    assert.equal(new URL(requests[0].url).pathname, "/api/auth/profile");
    assert.equal(new URL(requests[1].url).pathname, "/api/auth/profile-private");
    assert.equal(new URL(requests[2].url).pathname, "/api/auth/profile-presentation");
    assert.equal(new URL(requests[3].url).pathname, "/api/auth/profile");
    assert.equal(requests[4].headers.Origin, "http://127.0.0.1:54321");
    assert.equal(requests[5].headers.Origin, "http://127.0.0.1:54321");
    assert.equal(requests[6].headers.Cookie, "ppsid=session-1196");

    const storageText = await readFile(result.storageStatePath, "utf8");
    const storage = JSON.parse(storageText);
    assert.equal(storage.cookies.length, 1);
    assert.deepEqual(storage.cookies[0], {
      name: "ppsid",
      value: "session-1196",
      domain: "127.0.0.1",
      path: "/",
      expires: 1_787_304_000,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    });
    assert.equal(storageText.includes(passwordBodies[0]), false);
    assert.equal(storageText.includes("recovery-should-never-persist"), false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#1196 BUZZ synthetic session headers add Cookie for reads and Cookie plus Origin/CSRF for mutations", () => {
  const env = {
    PLOTPICKLE_VERIFICATION_AUTH_MODE: "synthetic-human",
    PLOTPICKLE_VERIFICATION_AUTH_COOKIE: "ppsid=session-1196",
    PLOTPICKLE_VERIFICATION_AUTH_CSRF: "csrf-1196",
  };
  assert.deepEqual(verificationAuthRequestHeaders("http://127.0.0.1:61234", "GET", env), {
    Cookie: "ppsid=session-1196",
  });
  assert.deepEqual(verificationAuthRequestHeaders("http://127.0.0.1:61234", "POST", env), {
    Cookie: "ppsid=session-1196",
    Origin: "http://127.0.0.1:61234",
    "X-PlotPickle-CSRF": "csrf-1196",
  });
  assert.deepEqual(verificationAuthRequestHeaders("http://127.0.0.1:61234", "POST", {}), {});
  assert.throws(() => verificationAuthRequestHeaders("http://127.0.0.1:61234", "POST", {
    PLOTPICKLE_VERIFICATION_AUTH_MODE: "synthetic-human",
    PLOTPICKLE_VERIFICATION_AUTH_COOKIE: "ppsid=session-1196",
  }), /CSRF proof is missing/u);
});

test("#1196 Playwright storage state is injected only for the bounded synthetic verification context", () => {
  const home = path.resolve(os.tmpdir(), "plotpickle-1196-auth-home");
  const state = path.join(home, "verification-browser", "storage-state.json");
  const args = ["-y", "@playwright/mcp@0.0.78", "--headless", "--isolated"];
  const env = {
    PLOTPICKLE_VERIFICATION_AUTH_MODE: "synthetic-human",
    PLOTPICKLE_VERIFICATION_AUTH_HOME: home,
    PLOTPICKLE_VERIFICATION_STORAGE_STATE: state,
  };
  assert.deepEqual(verificationPlaywrightArgs(args, {}), args);
  assert.deepEqual(verificationPlaywrightArgs(args, env), [...args, "--storage-state", state]);
  assert.deepEqual(verificationPlaywrightArgs(["-y", "some-other-package"], env), ["-y", "some-other-package"]);
  assert.throws(() => verificationPlaywrightArgs(args, {
    ...env,
    PLOTPICKLE_VERIFICATION_STORAGE_STATE: path.resolve(home, "..", "outside.json"),
  }), /invalid Playwright synthetic-auth storage-state path/u);
  assert.throws(() => verificationPlaywrightArgs([...args, "--storage-state", state], env), /competing Playwright storage-state argument/u);
});

test("#1196 desktop profile, private state and backup share one Node-host authority while server-network stays on the server boundary", async () => {
  const gateway = await read("build/local-profile-auth-gateway.ts");
  const vite = await read("vite.config.ts");
  assert.match(gateway, /PROFILE_API = "\/api\/auth\/profile"/u);
  assert.match(gateway, /PROFILE_PRIVATE_API = "\/api\/auth\/profile-private"/u);
  assert.match(gateway, /PROFILE_BACKUP_API = "\/api\/auth\/profile-backup"/u);
  assert.match(gateway, /profilePrivateGet/u);
  assert.match(gateway, /profileBackupPost/u);
  assert.match(gateway, /PLOTPICKLE_ACCESS_MODE\?\.trim\(\) !== "server-network"/u);
  assert.match(gateway, /LOOPBACK_PEERS/u);
  assert.match(gateway, /32 \* 1024 \* 1024/u);
  assert.match(vite, /localProfileAuthGateway\(\)/u);
});

test("#1196 managed Full Verification endpoint owns synthetic Auth lifecycle without weakening product Auth", async () => {
  const endpoint = await read("scripts/local-endpoint-runtime.mjs");
  const npx = await read("scripts/run-npx-stdio.mjs");
  const buzz = await read("scripts/buzz-live-activity.mjs");
  const verifyBuzz = await read("scripts/verify-buzz-live-activity.mjs");
  const boundary = await read("app/profile-access/profile-access-boundary.tsx");

  assert.match(endpoint, /serviceKind === "plotpickle-full-verification"/u);
  assert.match(endpoint, /verificationSyntheticRuntime\(jobId\)/u);
  assert.match(endpoint, /establishVerificationSyntheticHuman/u);
  assert.match(endpoint, /cleanupVerificationSyntheticHome/u);
  assert.match(endpoint, /\.\.\.\(runtime\.verificationAuth\?\.environment \|\| \{\}\)/u);
  assert.match(npx, /verificationPlaywrightArgs\(requestedArgs\)/u);
  assert.match(buzz, /verificationAuthRequestHeaders\(baseUrl, method\)/u);
  assert.match(verifyBuzz, /verificationAuthRequestHeaders\(baseUrl, "GET"\)/u);
  assert.doesNotMatch(boundary, /PLOTPICKLE_VERIFICATION_AUTH_MODE|synthetic-human/u);
});
