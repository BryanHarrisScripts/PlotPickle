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
  return new LocalEndpointRegistry({
    idFactory: () => "ep-fixture",
    now: () => "2026-08-20T22:00:00.000Z",
  });
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
  child.kill = () => {
    child.exitCode = 0;
    child.emit("exit", 0, null);
    return true;
  };
  return child;
}

test("#1155 registers, resolves, marks ready and revokes by endpoint identity rather than raw port", () => {
  const registry = registryFixture();
  const created = registry.register(jobRecord());
  assert.equal(created.endpointId, "ep-fixture");
  assert.equal(created.url, "http://127.0.0.1:43123");
  assert.equal(created.lifecycleState, "running");
  assert.equal(created.readinessState, "not_ready");
  assert.equal(created.generation, 1);

  const resolved = registry.resolve("ep-fixture", { jobId: "job-a" }, { expectedGeneration: 1 });
  assert.equal(resolved.worktreeRef, "wt-a");
  assert.equal(resolved.commitSha, COMMIT_A);

  const ready = registry.markReadiness("ep-fixture", "ready", {
    kind: "exact-instance",
    result: "pass",
    detail: "proof matched",
  });
  assert.equal(ready.lifecycleState, "running", "process lifecycle and readiness remain separate");
  assert.equal(ready.readinessState, "ready");

  const snapshot = registry.snapshot();
  assert.equal(snapshot.endpoints.length, 1);
  assert.equal(Object.hasOwn(snapshot.endpoints[0], "instanceRef"), false, "instance proof token is never persisted");
  assert.equal(snapshot.endpoints[0].readinessEvidence.result, "pass");

  assert.equal(registry.revoke("ep-fixture", { jobId: "job-a" }), true);
  assert.throws(() => registry.resolve("ep-fixture", { jobId: "job-a" }), /unavailable/i);
});

test("#1155 enforces server-side profile/job scope and keeps enumeration internal-only", () => {
  const registry = registryFixture();
  registry.register(jobRecord({ profileRef: "profile-a" }));

  assert.equal(registry.resolve("ep-fixture", { jobId: "job-a", profileRef: "profile-a" }).endpointId, "ep-fixture");
  assert.throws(() => registry.resolve("ep-fixture", { jobId: "job-a", profileRef: "profile-b" }), /unavailable/i);
  assert.throws(() => registry.resolve("ep-fixture", { jobId: "job-a" }), /unavailable/i);
  assert.throws(() => registry.enumerate({ profileRef: "profile-a" }), /internal\/admin authority/i);
  assert.equal(registry.enumerate({ internal: true }).length, 1);
});

test("#1155 restart increments generation and stale-generation consumers fail closed", () => {
  const registry = registryFixture();
  registry.register(jobRecord());
  const restarted = registry.restart("ep-fixture", { port: 43124, instanceRef: "inst-private-b" });
  assert.equal(restarted.generation, 2);
  assert.equal(restarted.lifecycleState, "starting");
  assert.equal(restarted.readinessState, "not_ready");
  assert.equal(restarted.url, "http://127.0.0.1:43124");
  assert.throws(
    () => registry.resolve("ep-fixture", { jobId: "job-a" }, { expectedGeneration: 1 }),
    /generation changed from 1 to 2/i,
  );
  assert.equal(registry.resolve("ep-fixture", { jobId: "job-a" }, { expectedGeneration: 2 }).port, 43124);
});

test("#1155 allocates concurrent loopback reservations without sharing a port", async () => {
  const first = await reserveLoopbackPort();
  const second = await reserveLoopbackPort();
  try {
    assert.equal(first.host, "127.0.0.1");
    assert.equal(second.host, "127.0.0.1");
    assert.notEqual(first.port, second.port);
    assert.ok(first.port > 0 && second.port > 0);
  } finally {
    await Promise.all([first.release(), second.release()]);
  }
});

test("#1155 retries an EADDRINUSE bind race without any unrelated-process kill path", async () => {
  const reservations = [45101, 45102];
  let releases = 0;
  let launches = 0;
  const result = await launchWithPortRetry({
    reserve: async () => ({
      host: "127.0.0.1",
      port: reservations.shift(),
      release: async () => { releases += 1; },
    }),
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

test("#1155 exact-instance proof rejects wrong endpoint/generation/worktree commit and accepts the matching instance", async () => {
  const record = jobRecord();
  const matching = {
    endpointId: record.endpointId,
    generation: record.generation,
    commitSha: record.commitSha,
    instanceRef: record.instanceRef,
    exactHead: true,
  };
  const pass = await verifyExactLocalInstance(record, {
    fetchImpl: async () => fakeResponse({ body: matching }),
  });
  assert.equal(pass.ok, true);

  const wrongEndpoint = await verifyExactLocalInstance(record, {
    fetchImpl: async () => fakeResponse({ body: { ...matching, endpointId: "ep-other" } }),
  });
  assert.equal(wrongEndpoint.ok, false);
  assert.match(wrongEndpoint.reason, /endpoint id/i);

  const wrongGeneration = await verifyExactLocalInstance(record, {
    fetchImpl: async () => fakeResponse({ body: { ...matching, generation: 2 } }),
  });
  assert.equal(wrongGeneration.ok, false);
  assert.match(wrongGeneration.reason, /generation/i);

  const wrongCommit = await verifyExactLocalInstance(record, {
    fetchImpl: async () => fakeResponse({ body: { ...matching, commitSha: COMMIT_B } }),
  });
  assert.equal(wrongCommit.ok, false);
  assert.match(wrongCommit.reason, /commit/i);
});

test("#1155 managed worktree jobs receive distinct endpoint identities and exact provenance", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-endpoint-"));
  let nextPort = 45200;
  let nextPid = 7000;
  const runtimes = [];
  try {
    async function start(jobId, worktreeRef, commitSha) {
      let spawnedEnvironment = null;
      const runtime = await startManagedPlotPickleEndpoint({
        repoRoot: temp,
        jobId,
        timeoutMs: 2_000,
        pollMs: 0,
        deps: {
          access: async () => {},
          provenance: async () => ({ branchRef: `branch-${jobId}`, worktreeRef, commitSha }),
          registryPath: path.join(temp, `${jobId}.json`),
          reservePort: async () => ({
            host: "127.0.0.1",
            port: ++nextPort,
            release: async () => {},
          }),
          spawn: (_command, _args, options) => {
            spawnedEnvironment = options.env;
            return fakeChild(++nextPid);
          },
          sleep: async () => {},
          fetch: async (url) => {
            if (String(url).includes("/api/local-instance-proof")) {
              return fakeResponse({
                body: {
                  endpointId: spawnedEnvironment.PLOTPICKLE_ENDPOINT_ID,
                  generation: Number(spawnedEnvironment.PLOTPICKLE_ENDPOINT_GENERATION),
                  commitSha: spawnedEnvironment.PLOTPICKLE_EXPECTED_COMMIT,
                  instanceRef: spawnedEnvironment.PLOTPICKLE_INSTANCE_ID,
                  exactHead: true,
                },
              });
            }
            return fakeResponse({ body: "<title>PlotPickle</title>" });
          },
        },
      });
      runtimes.push(runtime);
      return runtime;
    }

    const [first, second] = await Promise.all([
      start("job-one", "wt-one", COMMIT_A),
      start("job-two", "wt-two", COMMIT_B),
    ]);
    assert.notEqual(first.record.endpointId, second.record.endpointId);
    assert.notEqual(first.record.port, second.record.port);
    assert.notEqual(first.record.url, second.record.url);
    assert.equal(first.record.worktreeRef, "wt-one");
    assert.equal(second.record.worktreeRef, "wt-two");
    assert.equal(first.record.commitSha, COMMIT_A);
    assert.equal(second.record.commitSha, COMMIT_B);
    assert.equal(first.proof.ok, true);
    assert.equal(second.proof.ok, true);
    assert.equal(managedEndpointEvidence(first).exactInstanceProof, "pass");
    assert.equal(endpointRuntimeEnvironment(first).PLOTPICKLE_ACCEPTANCE_URL, first.record.url);
  } finally {
    for (const runtime of runtimes) runtime.child.exitCode = 0;
    await rm(temp, { recursive: true, force: true });
  }
});

test("#1155 endpoint target resolver validates profile/job/worktree/generation and invalidates stale UAT", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-endpoint-target-"));
  const registryPath = path.join(temp, "registry.json");
  const baseSnapshot = {
    schemaVersion: 1,
    authority: "plotpickle-local-endpoint-registry",
    generatedAt: "2026-08-20T22:00:00.000Z",
    endpoints: [{
      ...jobRecord({ profileRef: "profile-a", readinessState: "ready" }),
      instanceRef: undefined,
      readinessEvidence: { kind: "exact-instance", result: "pass", observedAt: "2026-08-20T22:00:00.000Z" },
      url: "http://127.0.0.1:43123",
    }],
  };
  delete baseSnapshot.endpoints[0].instanceRef;
  await writeFile(registryPath, `${JSON.stringify(baseSnapshot)}\n`, "utf8");
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
    assert.equal(target.source, "local-endpoint-registry");
    assert.equal(target.baseUrl, "http://127.0.0.1:43123");
    assert.equal(target.evidence.exactInstanceProof, "pass");
    await target.assertCurrent();

    await assert.rejects(
      resolveLocalEndpointTarget({ args: [], env: { ...env, PLOTPICKLE_LOCAL_ENDPOINT_PROFILE: "profile-b" } }),
      /profile provenance/i,
    );

    baseSnapshot.endpoints[0].generation = 2;
    baseSnapshot.endpoints[0].port = 43124;
    baseSnapshot.endpoints[0].url = "http://127.0.0.1:43124";
    await writeFile(registryPath, `${JSON.stringify(baseSnapshot)}\n`, "utf8");
    await assert.rejects(target.assertCurrent(), /generation changed from 1 to 2/i);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("#1155 direct fallback requires no Portless, Node-24, TLS or machine-wide PATH dependency", async () => {
  const [core, runtime, target, graph] = await Promise.all([
    read("core/runtime/local-endpoint-registry.mjs"),
    read("scripts/local-endpoint-runtime.mjs"),
    read("scripts/local-endpoint-target.mjs"),
    read("scripts/full-verification-graph.mjs"),
  ]);
  assert.match(core, /transport.*direct/);
  assert.match(core, /reserveLoopbackPort/);
  assert.match(runtime, /--strictPort/);
  assert.match(runtime, /127\.0\.0\.1/);
  assert.doesNotMatch(`${core}\n${runtime}\n${target}`, /@portless|mkcert|openssl|Node\.js 24|node-version:\s*24/i);
  assert.doesNotMatch(graph, /plotPickleUrl\s*=\s*"http:\/\/127\.0\.0\.1:4173"/);
  assert.doesNotMatch(graph, /"--port",\s*"4173"/);
});

test("#1155 Full Verification, Writer and exhaustive UAT consume the registry while BUZZ Community does not serialize it", async () => {
  const [graph, progress, writer, exhaustive, proof, community, workspace] = await Promise.all([
    read("scripts/full-verification-graph.mjs"),
    read("scripts/full-verification-progress-runner.mjs"),
    read("scripts/run-writer-in-residence.mjs"),
    read("scripts/run-exhaustive-ui-uat.mjs"),
    read("build/local-instance-proof-gateway.ts"),
    read("build/buzz-community-gateway.ts"),
    read("app/community-workspace.tsx"),
  ]);
  assert.match(graph, /startManagedPlotPickleEndpoint/);
  assert.match(graph, /verificationEndpointEnvironment/);
  assert.match(graph, /endpointProvenance/);
  assert.match(progress, /verificationEndpointEnvironment\(\)/);
  assert.match(writer, /managedEndpoint:\s*!requestedBaseUrl/);
  assert.match(writer, /assertEndpointStillCurrent/);
  assert.match(exhaustive, /resolveLocalEndpointTarget/);
  assert.match(exhaustive, /endpointTarget\.assertCurrent\(\)/);
  assert.match(exhaustive, /endpointProvenance/);
  assert.match(proof, /\/api\/local-instance-proof/);
  assert.match(proof, /exactHead/);
  assert.doesNotMatch(`${community}\n${workspace}`, /PLOTPICKLE_LOCAL_ENDPOINT|local-endpoint-registry|local-instance-proof/i);
});
