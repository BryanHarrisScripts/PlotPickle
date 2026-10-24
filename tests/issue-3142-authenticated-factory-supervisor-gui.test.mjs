import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { enableSupervisor, disableSupervisor, supervisorStatus, resumeSupervisor } from "../scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs";
import { dispatchSupervisorRequest, summarizeSupervisorForGui } from "../scripts/engineering-team/windows/supervisor/supervisor-http.mjs";

const URL_LOCAL = "http://127.0.0.1:4173/api/factory/supervisor";
const HEAD = "a".repeat(40);
const status = () => ({ state: "RUNNING", exactSha: HEAD, checkedAt: 100, reason: null,
  pauseAcknowledged: false, secret: "SECRET_PRIVATE_STORY_DO_NOT_LEAK" });
const req = (method = "GET", action = null, origin = "http://127.0.0.1:4173") =>
  new Request(URL_LOCAL, { method, headers: method === "POST"
    ? { Origin: origin, "Content-Type": "application/json", "X-PlotPickle-CSRF": "synthetic" }
    : {}, body: method === "POST" ? JSON.stringify(action) : undefined });
const harness = (overrides = {}) => {
  const calls = { auth: [], status: 0, pause: 0, resume: 0, stop: 0 };
  const setup = {
    platform: "win32",
    authorize: async (request, mutation) => { calls.auth.push(mutation); },
    lifecycle: {
      status: async () => { calls.status++; return status(); },
      pause: async () => { calls.pause++; return { state: "PAUSE_REQUESTED" }; },
      resume: async () => { calls.resume++; return { state: "RESUME_REQUESTED" }; },
      stop: async () => { calls.stop++; return { state: "STOP_REQUESTED" }; },
    },
    ...overrides,
  };
  return { calls, go: request => dispatchSupervisorRequest({ request, ...setup }) };
};

test("#3142 GET requires local Windows and authenticated profile, strips sensitive supervisor details", async () => {
  const { calls, go } = harness();
  const response = await go(req());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.state, "RUNNING");
  assert.equal(body.sourceHead, HEAD);
  assert.equal(body.workerProcessVerified, false);
  assert.equal(body.autonomousCodingVerified, false);
  assert.equal(body.automaticMergeEnabled, false);
  assert.deepEqual(calls.auth, [false]);
  assert.equal(calls.status, 1);
  assert.doesNotMatch(JSON.stringify(body), /SECRET_PRIVATE_STORY_DO_NOT_LEAK/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(summarizeSupervisorForGui({ state: "SOME_UNKNOWN_STATE", exactSha: "../secret",
    reason: "secret unsafe value" }).state, "BLOCKED");
});

test("#3142 local/network, cross-origin, and session denials occur before worker access", async () => {
  const cases = [
    [new Request("http://external.example/api/factory/supervisor"), {}, 403],
    [req("POST", { action: "pause" }, "https://evil.example"), {}, 403],
    [new Request("http://localhost:4173/api/factory/supervisor", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: '{"action":"pause"}' }), {}, 403],
    [req(), { platform: "linux" }, 403],
    [req(), { authorize: async () => { throw Error("SECRET_AUTH_EXCEPTION"); } }, 403],
    [req("POST", { action: "pause" }), { authorize: async () => { throw Error("UNAUTHENTICATED"); } }, 403],
  ];
  for (const [request, overrides, code] of cases) {
    const { calls, go } = harness(overrides);
    const response = await go(request);
    assert.equal(response.status, code);
    assert.equal(calls.status, 0);
    assert.equal(calls.pause, 0);
    assert.equal(calls.resume, 0);
    assert.equal(calls.stop, 0);
    assert.doesNotMatch(await response.text(), /SECRET_AUTH_EXCEPTION|UNAUTHENTICATED/);
  }
});

test("#3142 GUI PAUSE/RESUME call one real canonical supervisor operation after mutation authorization", async () => {
  const { calls, go } = harness({
    lifecycle: {
      status: async () => ({ state: "PAUSED", exactSha: HEAD, checkedAt: 100,
        pauseAcknowledged: true }),
      pause: async () => { calls.pause++; return { state: "PAUSE_REQUESTED" }; },
      resume: async () => { calls.resume++; return { state: "RESUME_REQUESTED" }; },
    },
  });
  const paused = await go(req("POST", { action: "pause" }));
  assert.equal(paused.status, 200);
  const body = await paused.json();
  assert.equal(body.capability, "factory.supervisor.pause");
  assert.equal(body.state, "PAUSED");
  assert.equal(body.acknowledged, true);
  assert.equal(body.workerProcessVerified, false);
  const resumed = await go(req("POST", { action: "resume" }));
  assert.equal((await resumed.json()).capability, "factory.supervisor.resume");
  assert.deepEqual(calls.auth, [true, true]);
  assert.equal(calls.pause, 1);
  assert.equal(calls.resume, 1);
});

test("#3142 reject command strings, arbitrary PID, START/merge and unverified lifecycle receipts", async () => {
  const { calls, go } = harness();
  for (const payload of [
    { action: "start" }, { action: "merge" }, { action: "stop", pid: 1234 },
    { action: "pause", pid: 1234 }, { action: "pause", command: "cmd.exe /c ..." },
    { action: "__proto__" }, [], null,
  ]) {
    const response = await go(req("POST", payload));
    assert.equal(response.status, 400);
  }
  assert.equal(calls.pause, 0);
  assert.equal(calls.resume, 0);
  assert.equal(calls.stop, 0);
  const bad = harness({
    lifecycle: { status: async () => status(), pause: async () => ({ state: "TEST_PASSED" }),
      resume: async () => ({ state: "RESUME_REQUESTED" }) },
  });
  const response = await bad.go(req("POST", { action: "pause" }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "LIFECYCLE_RECEIPT_UNVERIFIED");
});

test("#3142 route and GUI bind to same reviewed supervisor, Human session and existing Settings shell", async () => {
  const paths = [
    "app/api/factory/supervisor/route.ts",
    "app/skin-v1/factory-supervisor-panel.tsx",
    "app/skin-v1/settings-workspace-panel.tsx",
    "core/auth/profile-request-browser.ts",
    "build/local-profile-auth-gateway.ts",
    "core/auth/profile-experience/local-factory-request.ts",
  ];
  const files = await Promise.all(paths.map(p => readFile(new URL("../" + p, import.meta.url), "utf8")));
  assert.match(files[0], /authorizeLocalFactoryRequest as authorize/u);
  assert.match(files[5], /boundary\.authorizeRequest\(requestBoundary\(request\), mutation/u);
  assert.match(files[5], /recentReauthentication: true/u);
  assert.match(files[5], /accessMode !== "desktop-loopback"/u);
  assert.match(files[0], /supervisorStatus, pauseSupervisor, resumeSupervisor, disableSupervisor/u);
  assert.match(files[0], /dispatchSupervisorRequest/u);
  assert.match(files[1], /authenticatedProfileFetch\(ENDPOINT/u);
  assert.match(files[1], /window\.confirm\("Request STOP/u);
  assert.match(files[1], /request\("stop"\)/u);
  assert.match(files[0], /stop: \(\) => disableSupervisor\(\)/u);
  assert.match(files[1], /data-factory-supervisor-state/u);
  assert.match(files[2], /<FactorySupervisorPanel/u);
  assert.match(files[3], /"X-PlotPickle-CSRF"/u);
  assert.ok(files[4].includes('await import("../app/api/factory/supervisor/route")'),
    "Factory endpoint must load lazily inside the live Node profile gateway");
  assert.match(files[4], /"\/api\/factory\/supervisor"/u);
  assert.match(files[4], /handlers: Object\.freeze\(\{ GET: supervisorGet, POST: supervisorPost \}\)/u);
  assert.doesNotMatch(files[0], /spawn\(|execFile\(|taskkill|shell: true|modelRoute|merge_pull/u);
});

test("#3142 authenticated STOP uses one existing kill-switch, never claims killed descendants", async () => {
  let stops = 0;
  const { calls, go } = harness({
    lifecycle: {
      status: async () => status(),
      pause: async () => { throw Error("pause must not run"); },
      resume: async () => { throw Error("resume must not run"); },
      stop: async () => { stops++; return { state: "STOP_REQUESTED", reason: "LOCAL_KILL_SWITCH",
        pid: 1234, privatePath: "SECRET_NEVER_LEAK" }; },
    },
  });
  const response = await go(req("POST", { action: "stop" }));
  assert.equal(response.status, 200);
  const receipt = await response.json();
  assert.equal(receipt.capability, "factory.supervisor.stop");
  assert.equal(receipt.state, "STOP_REQUESTED");
  assert.equal(receipt.requested, true);
  assert.equal(receipt.acknowledged, false);
  assert.equal(receipt.stopDisposition, "STOP_REQUESTED_UNCONFIRMED");
  assert.equal(receipt.ownedDescendantsVerifiedGone, false);
  assert.equal(receipt.workerProcessVerified, false);
  assert.equal(receipt.inFlightCancellationProven, false);
  assert.equal(stops, 1);
  assert.deepEqual(calls.auth, [true]);
  assert.equal(calls.status, 0, "STOP receipt must not mistake stale status for kill proof");
  assert.doesNotMatch(JSON.stringify(receipt), /SECRET_NEVER_LEAK|1234/);
});

test("#3142 rejected or unauthenticated STOP never touches local supervisor", async () => {
  for (const overrides of [
    { platform: "linux" },
    { authorize: async () => { throw Error("no current Human session"); } },
  ]) {
    const { calls, go } = harness(overrides);
    const result = await go(req("POST", { action: "stop" }));
    assert.equal(result.status, 403);
    assert.equal(calls.stop, 0);
  }
  const uncertain = harness({ lifecycle: {
    status: async () => status(), pause: async () => {}, resume: async () => {},
    stop: async () => ({ state: "OFF" }),
  } });
  const result = await uncertain.go(req("POST", { action: "stop" }));
  assert.equal(result.status, 409);
  assert.equal((await result.json()).code, "LIFECYCLE_RECEIPT_UNVERIFIED");
});

test("#3142 STOP through HTTP modifies the SAME disposable local supervisor marker as CMD", async () => {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), "ppf-factory-stop-"));
  try {
    const options = { appRoot, platform: "win32", consent: "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR",
      head: async () => HEAD,
      paired: async () => ({ enabled: true, hostId: "host-" + "a".repeat(32),
        authorizedActor: "Fixture Human" }),
      now: () => 1800000000000 };
    await enableSupervisor(options);
    const route = harness({ lifecycle: {
      status: () => supervisorStatus({ appRoot, now: options.now }),
      pause: async () => { throw Error("wrong lifecycle"); },
      resume: () => resumeSupervisor(options),
      stop: () => disableSupervisor({ appRoot, now: options.now }),
    } });
    const receipt = await route.go(req("POST", { action: "stop" }));
    assert.equal(receipt.status, 200);
    assert.equal((await receipt.json()).stopDisposition, "STOP_REQUESTED_UNCONFIRMED");
    const status = await supervisorStatus({ appRoot, now: options.now });
    assert.equal(status.state, "STOP_REQUESTED");
    const marker = JSON.parse(await readFile(path.join(appRoot, "engineering-team",
      "supervisor", "stop-request.json"), "utf8"));
    assert.equal(marker.localOperator, true);
    await assert.rejects(resumeSupervisor(options), /LOCAL_STOP_REQUIRES_OPERATOR_REENABLE/);
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});

test("#3142 Factory Settings UI changes select the real Windows Product Gate", async () => {
  const workflow = await readFile(new URL("../.github/workflows/architecture-shadow.yml", import.meta.url), "utf8");
  assert.match(workflow, /settings-workspace-panel\|factory-supervisor-panel\|settings-review-system-panel/u);
  assert.match(workflow, /then build=true; fi/u);
  assert.match(workflow, /name: Impact-selected Windows Product Gate/u);
});

test("#3142 falsified ACK on non-PAUSED state cannot become a public verified pause", async () => {
  const summary = summarizeSupervisorForGui({
    state: "BLOCKED", pauseAcknowledged: true, exactSha: HEAD,
    inFlightCancellationProven: true, workerProcessVerified: true,
  });
  assert.equal(summary.state, "BLOCKED");
  assert.equal(summary.pauseAcknowledged, false);
  assert.equal(summary.inFlightCancellationProven, false);
  assert.equal(summary.workerProcessVerified, false);
});

test("#3142 successful PAUSE marker followed by unreadable status remains uncertain", async () => {
  let writes = 0;
  const { go } = harness({
    lifecycle: {
      pause: async () => { writes++; return { state: "PAUSE_REQUESTED" }; },
      resume: async () => { throw Error("must not resume"); },
      stop: async () => { throw Error("must not stop"); },
      status: async () => { throw Error("PRIVATE_ERROR_MUST_NOT_LEAK"); },
    },
  });
  const reply = await go(req("POST", { action: "pause" }));
  const body = await reply.json();
  assert.equal(reply.status, 409);
  assert.equal(body.code, "ACTION_SUBMITTED_STATUS_UNVERIFIED");
  assert.equal(body.requested, true);
  assert.equal(body.inFlightCancellationProven, false);
  assert.equal(body.workerProcessVerified, false);
  assert.equal(body.automaticMergeEnabled, false);
  assert.equal(writes, 1);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_ERROR_MUST_NOT_LEAK/);
});
