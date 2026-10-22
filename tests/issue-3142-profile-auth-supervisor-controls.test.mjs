import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { dispatchSupervisorRequest, summarizeSupervisorForGui }
  from "../scripts/engineering-team/windows/supervisor/supervisor-http.mjs";
import {
  enableSupervisor, pauseSupervisor, resumeSupervisor, supervisorStatus,
  supervisorCycle, disableSupervisor,
} from "../scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs";

const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const HEAD = "a".repeat(40);
const NOW = () => 1_800_000_000_000;
const PAIR = { enabled: true, hostId: "host-" + "1".repeat(32), authorizedActor: "authorized-human" };
const paired = async () => PAIR;
const head = async () => HEAD;
const local = "http://127.0.0.1:4173/api/factory/supervisor";
const request = (method = "GET", action, extras = {}) => new Request(local, {
  method,
  headers: method === "POST"
    ? { Origin: "http://127.0.0.1:4173", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", ...(extras.headers || {}) }
    : extras.headers,
  ...(method === "POST" ? { body: JSON.stringify(action) } : {}),
});
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3142-gui-"));
  try { return await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const opts = root => ({ appRoot: root, consent: CONSENT, platform: "win32", head, paired, now: NOW });
const state = async response => ({ status: response.status, value: await response.json() });

test("#3142 authenticated local GUI adapter refuses remote, HTTP mutation methods and invalid origins before auth", async () => {
  let auth = 0, dispatch = 0;
  const deps = { platform: "win32", authorize: async () => { auth++; },
    lifecycle: { status: async () => { dispatch++; return { state: "RUNNING" }; },
      pause: async () => { dispatch++; }, resume: async () => { dispatch++; } } };
  const bad = [
    [new Request("https://127.0.0.1:4173/api/factory/supervisor"), 403],
    [new Request("http://public.example/api/factory/supervisor"), 403],
    [new Request(local + "?unsafe=1"), 403],
    [request("POST", { action: "pause" }, { headers: { Origin: "http://evil.test" } }), 403],
    [request("POST", { action: "pause" }, { headers: { "Sec-Fetch-Site": "cross-site" } }), 403],
    [request("POST", { action: "pause" }, { headers: { "Content-Type": "text/plain" } }), 403],
    [new Request(local, { method: "DELETE" }), 405],
  ];
  for (const [req, status] of bad) assert.equal((await state(await dispatchSupervisorRequest({ request: req, ...deps }))).status, status);
  assert.equal((await state(await dispatchSupervisorRequest({ request: request(), ...deps, platform: "linux" }))).status, 403);
  assert.equal(auth, 0);
  assert.equal(dispatch, 0);
});

test("#3142 no worker state disclosure or pause/resume without an authorized Human session and recent CSRF reauthentication", async () => {
  let calls = 0, auth = 0;
  const api = x => dispatchSupervisorRequest({ platform: "win32", request: x,
    authorize: async (_, mutation) => { auth++; assert.equal(typeof mutation, "boolean"); throw Error("TOKEN_PRIVATE"); },
    lifecycle: { status: async () => { calls++; }, pause: async () => { calls++; }, resume: async () => { calls++; } } });
  for (const req of [request(), request("POST", { action: "pause" }), request("POST", { action: "resume" })]) {
    const result = await state(await api(req));
    assert.equal(result.status, 403);
    assert.deepEqual(result.value, { code: "PROFILE_SESSION_REQUIRED" });
    assert.doesNotMatch(JSON.stringify(result.value), /TOKEN_PRIVATE/);
  }
  assert.equal(auth, 3);
  assert.equal(calls, 0);
});

test("#3142 local GUI and CMD use the same owner-scoped supervisor state and preserve STOP authority", () => sandbox(async root => {
  await enableSupervisor(opts(root));
  let authReads = 0, authorizesMutation = 0;
  const lifecycle = {
    status: () => supervisorStatus({ appRoot: root, now: NOW }),
    pause: () => pauseSupervisor(opts(root)),
    resume: () => resumeSupervisor(opts(root)),
  };
  const api = x => dispatchSupervisorRequest({
    request: x, platform: "win32", lifecycle,
    authorize: async (_, mutation) => {
      if (mutation) authorizesMutation++; else authReads++;
    },
  });
  let result = await state(await api(request()));
  assert.equal(result.status, 200);
  assert.equal(result.value.state, "OFFLINE");
  assert.equal(result.value.sourceHead, HEAD);
  assert.equal(result.value.workerProcessVerified, false);
  assert.equal(result.value.automaticMergeEnabled, false);

  result = await state(await api(request("POST", { action: "pause" })));
  assert.equal(result.status, 200);
  assert.equal(result.value.state, "PAUSE_REQUESTED");
  assert.equal(result.value.acknowledged, false);
  let polls = 0;
  const paused = await supervisorCycle({
    appRoot: root, platform: "win32", paired, head, now: NOW,
    queue: async () => { throw Error("queue cannot be examined while paused"); },
    poll: async () => { polls++; return { state: "POLL_COMPLETE" }; },
  });
  assert.equal(paused.state, "PAUSED");
  assert.equal(polls, 0);
  result = await state(await api(request()));
  assert.equal(result.value.state, "PAUSED");
  assert.equal(result.value.pauseAcknowledged, true);
  result = await state(await api(request("POST", { action: "resume" })));
  assert.equal(result.status, 200);
  assert.equal(result.value.state, "RESUME_REQUESTED");
  assert.equal(result.value.acknowledged, false);
  assert.equal(result.value.workerProcessVerified, false);
  assert.equal((await lifecycle.status()).state, "RESUME_REQUESTED");

  await disableSupervisor({ appRoot: root, now: NOW });
  result = await state(await api(request("POST", { action: "resume" })));
  assert.equal(result.status, 409);
  assert.equal(result.value.code, "LIFECYCLE_OPERATION_BLOCKED");
  assert.equal((await lifecycle.status()).state, "STOP_REQUESTED");
  assert.equal(authorizesMutation, 3);
  assert.equal(authReads, 2);
}));

test("#3142 adapter does not accept issue execution, START/STOP PID requests, oversized or ambiguous payloads", async () => {
  let mutated = 0;
  const api = x => dispatchSupervisorRequest({
    request: x, platform: "win32", authorize: async () => {},
    lifecycle: { pause: async () => { mutated++; return { state: "PAUSE_REQUESTED" }; },
      resume: async () => { mutated++; return { state: "RESUME_REQUESTED" }; },
      status: async () => ({ state: "OFF" }) },
  });
  for (const body of [
    { action: "start" }, { action: "stop", pid: 1234 }, { action: "run", issue: 3142 },
    { action: "pause", command: "git reset --hard" }, { action: "" }, ["pause"], {},
  ]) {
    const result = await state(await api(request("POST", body)));
    assert.equal(result.status, 400);
    assert.ok(["ACTION_NOT_AUTHORIZED", "ACTION_INVALID"].includes(result.value.code));
  }
  const huge = request("POST", { action: "pause" }, { headers: { "Content-Length": "9999" } });
  assert.equal((await state(await api(huge))).status, 400);
  assert.equal(mutated, 0);
  const unexpected = await state(await dispatchSupervisorRequest({
    request: request("POST", { action: "pause" }), platform: "win32",
    authorize: async () => {}, lifecycle: { pause: async () => ({ state: "VERIFIED" }), status: async () => ({ state: "RUNNING" }) },
  }));
  assert.equal(unexpected.status, 409);
  assert.equal(unexpected.value.code, "LIFECYCLE_RECEIPT_UNVERIFIED");
});

test("#3142 GUI receipt bounds private reason, head and process verification", () => {
  const sample = summarizeSupervisorForGui({
    state: "WINNER", reason: "secret=owner-key", exactSha: "wrong", checkedAt: -9,
    pauseAcknowledged: true, agentExecutionProven: true, automaticMergeEnabled: true,
    privatePayload: "NEVER_DISCLOSE_SOURCE",
  });
  assert.deepEqual(sample, {
    state: "BLOCKED", reason: "SOURCE_UNVERIFIED", sourceHead: null, heartbeatAt: null,
    pauseAcknowledged: true, inFlightCancellationProven: false, workerProcessVerified: false,
    autonomousCodingVerified: false, automaticMergeEnabled: false,
  });
  assert.doesNotMatch(JSON.stringify(sample), /secret|NEVER_DISCLOSE_SOURCE|owner-key/);
});

test("#3142 Settings GUI and route share the single HTTP adapter and profile-auth boundary", async () => {
  const read = async path => readFile(new URL("../" + path, import.meta.url), "utf8");
  const [route, panel, settings, style] = await Promise.all([
    read("app/api/factory/supervisor/route.ts"),
    read("app/skin-v1/factory-supervisor-panel.tsx"),
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/skin-v1/factory-supervisor-panel.module.css"),
  ]);
  assert.match(route, /boundary\.authorizeRequest\(requestBoundary\(request\)/);
  assert.match(route, /recentReauthentication: true/);
  assert.match(route, /state\.accessMode !== "desktop-loopback"/);
  assert.match(route, /dispatchSupervisorRequest/);
  assert.match(route, /pauseSupervisor.*resumeSupervisor/s);
  assert.match(panel, /authenticatedProfileFetch/);
  assert.match(panel, /Pause new work/);
  assert.match(panel, /Resume polling/);
  assert.match(settings, /<FactorySupervisorPanel \/>/);
  assert.match(style, /\.panel/);
  assert.doesNotMatch(panel, /Start-ScheduledTask|taskkill|process\.kill|execFile|merge_pull_request/);
});
