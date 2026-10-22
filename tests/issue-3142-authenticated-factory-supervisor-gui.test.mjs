import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
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
  const calls = { auth: [], status: 0, pause: 0, resume: 0 };
  const setup = {
    platform: "win32",
    authorize: async (request, mutation) => { calls.auth.push(mutation); },
    lifecycle: {
      status: async () => { calls.status++; return status(); },
      pause: async () => { calls.pause++; return { state: "PAUSE_REQUESTED" }; },
      resume: async () => { calls.resume++; return { state: "RESUME_REQUESTED" }; },
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

test("#3142 reject command strings, arbitrary PID, START/STOP/merge and unverified lifecycle receipts", async () => {
  const { calls, go } = harness();
  for (const payload of [
    { action: "start" }, { action: "stop" }, { action: "merge" },
    { action: "pause", pid: 1234 }, { action: "pause", command: "cmd.exe /c ..." },
    { action: "__proto__" }, [], null,
  ]) {
    const response = await go(req("POST", payload));
    assert.equal(response.status, 400);
  }
  assert.equal(calls.pause, 0);
  assert.equal(calls.resume, 0);
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
  ];
  const files = await Promise.all(paths.map(p => readFile(new URL("../" + p, import.meta.url), "utf8")));
  assert.match(files[0], /boundary\.authorizeRequest\(requestBoundary\(request\), mutation/u);
  assert.match(files[0], /recentReauthentication: true/u);
  assert.match(files[0], /accessMode !== "desktop-loopback"/u);
  assert.match(files[0], /supervisorStatus, pauseSupervisor, resumeSupervisor/u);
  assert.match(files[0], /dispatchSupervisorRequest/u);
  assert.match(files[1], /authenticatedProfileFetch\(ENDPOINT/u);
  assert.match(files[1], /data-factory-supervisor-state/u);
  assert.match(files[2], /<FactorySupervisorPanel/u);
  assert.match(files[3], /"X-PlotPickle-CSRF"/u);
  assert.match(files[4], /GET as supervisorGet, POST as supervisorPost/u);
  assert.match(files[4], /"\/api\/factory\/supervisor"/u);
  assert.match(files[4], /handlers: Object\.freeze\(\{ GET: supervisorGet, POST: supervisorPost \}\)/u);
  assert.doesNotMatch(files[0], /spawn\(|execFile\(|taskkill|shell: true|modelRoute|merge_pull/u);
});
