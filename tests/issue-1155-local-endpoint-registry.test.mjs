import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  LocalEndpointRegistry,
  launchWithPortRetry,
  reserveLoopbackPort,
  verifyExactLocalInstance,
} from "../core/runtime/local-endpoint-registry.mjs";
import {
  endpointRuntimeEnvironment,
  managedEndpointEvidence,
  startManagedPlotPickleEndpoint,
} from "../scripts/local-endpoint-runtime.mjs";
import { resolveLocalEndpointTarget } from "../scripts/local-endpoint-target.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const COMMIT_A = "a".repeat(40);
const COMMIT_B = "b".repeat(40);

function registryFixture() {
  return new LocalEndpointRegistry({ idFactory: () => "ep-fixture", now: () => "2026-08-20T22:00:00.000Z" });
}

function jobRecord(overrides = {}) {
  return {
    endpointId: "ep-fixture",
    serviceKind: "plotpickle-app",
    ownerScope: "job",
    jobId: "job-a",
    worktreeRef: "wt-a",
    branchRef: "main",
    commitSha: COMMIT_A,
    processRef: "pid:100",
    transport: "direct",
    host: "127.0.0.1",
    port: 43123,
    lifecycleState: "running",
    readinessState: "not_ready",
    generation: 1,
    instanceRef: "inst-private-a",
    ...overrides,
  };
}

function fakeResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

function fakeChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr.setEncoding = () => {};
  child.kill = () => { child.exitCode = 0; return true; };
  return child;
}

test("#1155 endpoint identity separates lifecycle, readiness, generation and raw port", () => {
  const registry = registryFixture();
  const created = registry.register(jobRecord());
  assert.equal(created.endpointId, "ep-fixture");
  assert.equal(created.url, "http://127.0.0.1:43123");
  assert.equal(created.lifecycleState, "running");
  assert.equal(created.readinessState, "not_ready");
  assert.equal(registry.resolve("ep-fixture", { jobId: "job-a" }, { expectedGeneration: 1 }).commitSha, COMMIT_A);

  const ready = registry.markReadiness("ep-fixture", "ready", { kind: "exact-instance", result: "pass", detail: "proof matched" });
  assert.equal(ready.lifecycleState, "running");
  assert.equal(ready.readinessState, "ready");
  assert.equal(Object.hasOwn(registry.snapshot().endpoints[0], "instanceRef"), false, "process instance token must not be persisted");

  const restarted = registry.restart("ep-fixture", { port: 43124, instanceRef: "inst-private-b" });
  assert.equal(restarted.generation, 2);
  assert.equal(restarted.url, "http://127.0.0.1:43124");
  assert.throws(() => registry.resolve("ep-fixture", { jobId: "job-a" }, { expectedGeneration: 1 }), /generation changed/i);
  assert.equal(registry.revoke("ep-fixture", { jobId: "job-a" }), true);
});

test("#1155 profile/job authorization cannot be selected by another Human and enumeration is internal-only", () => {
  const registry = registryFixture();
  registry.register(jobRecord({ profileRef: "profile-a" }));
  assert.equal(registry.resolve("ep-fixture", { jobId: "job-a", profileRef: "profile-a" }).endpointId, "ep-fixture");
  assert.throws(() => registry.resolve("ep-fixture", { jobId: "job-a", profileRef: "profile-b" }), /unavailable/i);
  assert.throws(() => registry.resolve("ep-fixture", { jobId: "job-a" }), /unavailable/i);
  assert.throws(() => registry.enumerate({ profileRef: "profile-a" }), /internal\/admin/i);
  assert.equal(registry.enumerate({ internal: true }).length, 1);
});

test("#1155 concurrent direct-mode reservations do not share a loopback port", async () => {
  const first = await reserveLoopbackPort();
  const second = await reserveLoopbackPort();
  try {
    assert.equal(first.host, "127.0.0.1");
    assert.equal(second.host, "127.0.0.1");
    assert.notEqual(first.port, second.port);
  } finally {
    await Promise.all([first.release(), second.release()]);
  }
});

test("#1155 an EADDRINUSE race retries without an unrelated-process termination hook", async () => {
  const ports = [45101, 45102];
  let launches = 0;
  let releases = 0;
  const result = await launchWithPortRetry({
    reserve: async () => ({ host: "127.0.0.1", port: ports.shift(), release: async () => { releases += 1; } }),
    launch: async ({ port }) => {
      launches += 1;
      if (launches === 1) {
        const error = new Error("listen EADDRINUSE: address already in use");
        error.code = "EADDRINUSE";
        throw error;
      }
      return { owner: "current-job", selectedPort: port };
    },
  });
  assert.equal(launches, 2);
  assert.equal(releases, 2);
  assert.equal(result.port, 45102);
  assert.equal(result.owner, "current-job");
});

test("#1155 exact-instance proof rejects wrong endpoint, generation and commit", async () => {
  const record = jobRecord();
  const matching = { endpointId: record.endpointId, generation: 1, commitSha: COMMIT_A, instanceRef: record.instanceRef, exactHead: true };
  assert.equal((await verifyExactLocalInstance(record, { fetchImpl: async () => fakeResponse({ body: matching }) })).ok, true);
  for (const [body, label] of [
    [{ ...matching, endpointId: "ep-other" }, /endpoint id/i],
    [{ ...matching, generation: 2 }, /generation/i],
    [{ ...matching, commitSha: COMMIT_B }, /commit/i],
  ]) {
    const result = await verifyExactLocalInstance(record, { fetchImpl: async () => fakeResponse({ body }) });
    assert.equal(result.ok, false);
    assert.match(result.reason, label);
  }
});

test("#1155 two worktree jobs launch with distinct endpoint identity and exact provenance", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-endpoint-"));
  let nextPort = 45200;
  let nextPid = 7000;
  const runtimes = [];
  try {
    const start = async (jobId, worktreeRef, commitSha) => {
      let childEnv;
      const runtime = await startManagedPlotPickleEndpoint({
        repoRoot: temp,
        jobId,
        timeoutMs: 2_000,
        pollMs: 0,
        deps: {
          access: async () => {},
          provenance: async () => ({ branchRef: `branch-${jobId}`, worktreeRef, commitSha }),
          registryPath: path.join(temp, `${jobId}.json`),
          reservePort: async () => ({ host: "127.0.0.1", port: ++nextPort, release: async () => {} }),
          spawn: (_command, _args, options) => { childEnv = options.env; return fakeChild(++nextPid); },
          sleep: async () => {},
          fetch: async (url) => String(url).includes("/api/local-instance-proof")
            ? fakeResponse({ body: {
              endpointId: childEnv.PLOTPICKLE_ENDPOINT_ID,
              generation: Number(childEnv.PLOTPICKLE_ENDPOINT_GENERATION),
              commitSha: childEnv.PLOTPICKLE_EXPECTED_COMMIT,
              instanceRef: childEnv.PLOTPICKLE_INSTANCE_ID,
              exactHead: true,
            } })
            : fakeResponse({ body: "<title>PlotPickle</title>" }),
        },
      });
      runtimes.push(runtime);
      return runtime;
    };
    const [first, second] = await Promise.all([start("job-one", "wt-one", COMMIT_A), start("job-two", "wt-two", COMMIT_B)]);
    assert.notEqual(first.record.endpointId, second.record.endpointId);
    assert.notEqual(first.record.url, second.record.url);
    assert.equal(first.record.worktreeRef, "wt-one");
    assert.equal(second.record.worktreeRef, "wt-two");
    assert.equal(managedEndpointEvidence(first).exactInstanceProof, "pass");
    assert.equal(endpointRuntimeEnvironment(second).PLOTPICKLE_LOCAL_ENDPOINT_WORKTREE, "wt-two");
  } finally {
    for (const runtime of runtimes) runtime.child.exitCode = 0;
    await rm(temp, { recursive: true, force: true });
  }
});

test("#1155 resolver rejects wrong profile and invalidates evidence after a generation change", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-endpoint-target-"));
  const registryPath = path.join(temp, "registry.json");
  const snapshot = {
    schemaVersion: 1,
    authority: "plotpickle-local-endpoint-registry",
    generatedAt: "2026-08-20T22:00:00.000Z",
    endpoints: [{
      ...jobRecord({ profileRef: "profile-a", readinessState: "ready" }),
      url: "http://127.0.0.1:43123",
      readinessEvidence: { kind: "exact-instance", result: "pass", observedAt: "2026-08-20T22:00:00.000Z" },
    }],
  };
  delete snapshot.endpoints[0].instanceRef;
  await writeFile(registryPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  try {
    const env = {
      PLOTPICKLE_LOCAL_ENDPOINT_REGISTRY: registryPath,
      PLOTPICKLE_LOCAL_ENDPOINT_ID: "ep-fixture",
      PLOTPICKLE_LOCAL_ENDPOINT_GENERATION: "1",
      PLOTPICKLE_LOCAL_ENDPOINT_JOB: "job-a",
      PLOTPICKLE_LOCAL_ENDPOINT_WORKTREE: "wt-a",
      PLOTPICKLE_LOCAL_ENDPOINT_PROFILE: "profile-a",
    };
    const target = await resolveLocalEndpointTarget({ args: [], env });
    assert.equal(target.evidence.exactInstanceProof, "pass");
    await target.assertCurrent();
    await assert.rejects(resolveLocalEndpointTarget({ args: [], env: { ...env, PLOTPICKLE_LOCAL_ENDPOINT_PROFILE: "profile-b" } }), /profile provenance/i);
    snapshot.endpoints[0].generation = 2;
    snapshot.endpoints[0].url = "http://127.0.0.1:43124";
    await writeFile(registryPath, `${JSON.stringify(snapshot)}\n`, "utf8");
    await assert.rejects(target.assertCurrent(), /generation changed from 1 to 2/i);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("#1155 managed consumers use run-scoped endpoint context and direct mode has no Portless/TLS dependency", async () => {
  const [core, runtime, graph, progress, writer, exhaustive, proof, community, workspace] = await Promise.all([
    read("core/runtime/local-endpoint-registry.mjs"),
    read("scripts/local-endpoint-runtime.mjs"),
    read("scripts/full-verification-graph.mjs"),
    read("scripts/full-verification-progress-runner.mjs"),
    read("scripts/run-writer-in-residence.mjs"),
    read("scripts/run-exhaustive-ui-uat.mjs"),
    read("build/local-instance-proof-gateway.ts"),
    read("build/buzz-community-gateway.ts"),
    read("app/_components/community/community-workspace.tsx"),
  ]);
  assert.match(core, /reserveLoopbackPort/);
  assert.match(runtime, /--strictPort/);
  assert.doesNotMatch(`${core}\n${runtime}`, /@portless|mkcert|openssl|Node\.js 24|node-version:\s*24/i);
  assert.match(graph, /createVerificationEndpointContext/);
  assert.match(graph, /execute\(node, endpointContext\)/);
  assert.match(graph, /endpointProvenance:\s*endpointContext\.evidence\(\)/);
  assert.doesNotMatch(graph, /managedVerificationRuntime|"--port",\s*"4173"|plotPickleUrl\s*=\s*"http:\/\/127\.0\.0\.1:4173"/);
  assert.match(progress, /execute:\s*async \(node, endpointContext\)/);
  assert.match(progress, /endpointContext\.environment\(\)/);
  assert.match(writer, /managedEndpoint:\s*!requestedBaseUrl/);
  assert.match(writer, /assertEndpointStillCurrent/);
  assert.match(exhaustive, /resolveLocalEndpointTarget/);
  assert.match(exhaustive, /endpointTarget\.assertCurrent\(\)/);
  assert.match(proof, /\/api\/local-instance-proof/);
  assert.match(proof, /exactHead/);
  assert.doesNotMatch(`${community}\n${workspace}`, /PLOTPICKLE_LOCAL_ENDPOINT|local-endpoint-registry|local-instance-proof/i);
});
