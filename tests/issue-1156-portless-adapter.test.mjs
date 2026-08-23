import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LocalEndpointRegistry,
  opaquePortlessRouteName,
} from "../core/runtime/local-endpoint-registry.mjs";
import {
  PORTLESS_PINNED_VERSION,
  attachPortlessAlias,
  defaultPortlessStateDirectory,
  detachPortlessAlias,
  parseWindowsListenerEvidence,
  probeOpenSslForHttps,
  probePortlessRuntime,
  remapPortlessAlias,
  safePortlessEnvironment,
  validatePortlessSecurityBoundary,
  verifyPortlessLoopbackListeners,
} from "../core/runtime/portless-adapter.mjs";

const COMMIT = "a".repeat(40);
const CANARIES = ["Bryan", "Afterglow Secret Ending", "provider-account@example.com", "nsec1privatecanary"];

function makeRuntime() {
  const registry = new LocalEndpointRegistry({ now: () => "2026-08-20T23:20:00.000Z" });
  const endpointId = "ep-1156-test-endpoint";
  const record = registry.register({
    endpointId,
    serviceKind: "plotpickle-app",
    ownerScope: "job",
    jobId: "job-1156-a",
    worktreeRef: "wt-1156-a",
    branchRef: "branch-opaque-a",
    commitSha: COMMIT,
    transport: "direct",
    host: "127.0.0.1",
    port: 43111,
    lifecycleState: "running",
    readinessState: "ready",
    generation: 1,
    instanceRef: "inst-1156-a",
  });
  return {
    registry,
    registryPath: "/tmp/plotpickle-1156-registry.json",
    endpointId,
    record,
    baseUrl: record.url,
    proof: { ok: true, reason: "direct proof" },
  };
}

function fakePortlessRuntime() {
  return {
    state: "managed-pinned",
    available: true,
    nodeVersion: "v24.19.0",
    version: PORTLESS_PINNED_VERSION,
    nodePath: "/opt/plotpickle/node24/bin/node",
    cliPath: "/opt/plotpickle/portless/node_modules/portless/dist/cli.js",
  };
}

function fakeProxy() {
  return {
    proxyPort: 43155,
    stateDir: "/tmp/plotpickle-portless-1156",
    profile: "portless/http",
    sourceState: "managed-pinned",
    version: PORTLESS_PINNED_VERSION,
  };
}

function exactFetch(runtime) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      endpointId: runtime.record.endpointId,
      generation: runtime.record.generation,
      instanceRef: runtime.record.instanceRef,
      commitSha: runtime.record.commitSha,
      exactHead: true,
    }),
  });
}

const okExec = async () => ({ stdout: "", stderr: "" });

test("#1156 keeps Portless pinned outside the PlotPickle product dependency graph", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const pin = JSON.parse(await readFile(new URL("../config/portless-runtime.json", import.meta.url), "utf8"));
  assert.equal(pkg.engines.node, ">=22.13.0");
  assert.equal(pkg.dependencies?.portless, undefined);
  assert.equal(pkg.devDependencies?.portless, undefined);
  assert.equal(pin.version, "0.15.5");
  assert.equal(pin.license, "Apache-2.0");
  assert.equal(pin.nodeEngine, ">=24");
  assert.equal(pin.plotpickleNodeStrategy, "isolated-developer-tool-runtime");
  assert.equal(pin.defaultProfile, "portless/http");
});

test("#1156 opaque route names are stable DNS labels and leak no Human/project/provider canaries", () => {
  const route = opaquePortlessRouteName("ep-1156-private-route-source");
  assert.match(route, /^pp-[a-f0-9]{24}$/);
  assert.equal(route.length <= 63, true);
  assert.equal(route, opaquePortlessRouteName("ep-1156-private-route-source"));
  for (const canary of CANARIES) assert.equal(route.toLowerCase().includes(canary.toLowerCase()), false);
});

test("#1156 registry accepts only the exact opaque .localhost Portless route", () => {
  const registry = new LocalEndpointRegistry();
  const endpointId = "ep-1156-route-contract";
  const routeName = opaquePortlessRouteName(endpointId);
  const record = registry.register({
    endpointId,
    serviceKind: "plotpickle-app",
    ownerScope: "job",
    jobId: "job-1156-route",
    worktreeRef: "wt-1156-route",
    commitSha: COMMIT,
    transport: "portless",
    transportProfile: "portless/http",
    host: "127.0.0.1",
    port: 43112,
    routeName,
    url: `http://${routeName}.localhost:43156`,
    lifecycleState: "running",
    readinessState: "ready",
  });
  assert.equal(record.transportProfile, "portless/http");
  assert.equal(record.url, `http://${routeName}.localhost:43156`);
  assert.throws(() => registry.transition(endpointId, { url: "http://afterglow.localhost:43156" }), /registered opaque \.localhost route/);
  assert.throws(() => registry.transition(endpointId, { url: `http://${routeName}.example.com:43156` }), /registered opaque \.localhost route/);
});

test("#1156 managed environment hard-rejects LAN, tunnel, wildcard and custom-TLD exposure", () => {
  for (const key of ["PORTLESS_LAN", "PORTLESS_TAILSCALE", "PORTLESS_FUNNEL", "PORTLESS_NGROK", "PORTLESS_WILDCARD"]) {
    assert.throws(() => validatePortlessSecurityBoundary({ env: { [key]: "1" } }), new RegExp(key));
  }
  assert.throws(() => validatePortlessSecurityBoundary({ env: { PORTLESS_TLD: "local" } }), /restricted to the \.localhost TLD/);
  assert.throws(() => validatePortlessSecurityBoundary({ proxyArgs: ["--lan"] }), /Arbitrary Portless proxy arguments/);
  assert.throws(() => validatePortlessSecurityBoundary({ stateDir: "/tmp/PlotPickle/profiles/profile-a/portless" }), /cannot live inside a Human profile/);
});

test("#1156 safe environment disables hosts mutation, LAN, tunnels and TLS for routine HTTP", () => {
  const env = safePortlessEnvironment({ PATH: "synthetic-long-path" }, {
    stateDir: "/tmp/PlotPickle/node/runtime/portless/0.15.5",
    proxyPort: 43157,
  });
  assert.equal(env.PATH, "synthetic-long-path");
  assert.equal(env.PORTLESS_SYNC_HOSTS, "0");
  assert.equal(env.PORTLESS_LAN, "0");
  assert.equal(env.PORTLESS_TAILSCALE, "0");
  assert.equal(env.PORTLESS_FUNNEL, "0");
  assert.equal(env.PORTLESS_NGROK, "0");
  assert.equal(env.PORTLESS_WILDCARD, "0");
  assert.equal(env.PORTLESS_HTTPS, "0");
  assert.equal(env.PORTLESS_PORT, "43157");
});

test("#1156 runtime probe enforces Node 24 and exact managed Portless version", async () => {
  const good = await probePortlessRuntime({
    sourceMode: "managed-pinned",
    nodePath: "/opt/node24/node",
    cliPath: "/opt/portless/cli.js",
    execFileImpl: async (_command, args) => args.length === 1
      ? { stdout: "v24.19.0\n", stderr: "" }
      : { stdout: "portless 0.15.5\n", stderr: "" },
  });
  assert.equal(good.available, true);
  assert.equal(good.state, "managed-pinned");
  assert.equal(good.version, "0.15.5");

  const oldNode = await probePortlessRuntime({
    sourceMode: "managed-pinned",
    nodePath: "/opt/node23/node",
    cliPath: "/opt/portless/cli.js",
    execFileImpl: async () => ({ stdout: "v23.11.0\n", stderr: "" }),
  });
  assert.equal(oldNode.state, "incompatible");
  assert.match(oldNode.detail, /Node 24/);

  const wrongVersion = await probePortlessRuntime({
    sourceMode: "managed-pinned",
    nodePath: "/opt/node24/node",
    cliPath: "/opt/portless/cli.js",
    execFileImpl: async (_command, args) => args.length === 1
      ? { stdout: "v24.19.0\n", stderr: "" }
      : { stdout: "portless 0.15.4\n", stderr: "" },
  });
  assert.equal(wrongVersion.state, "incompatible");
  assert.match(wrongVersion.detail, /exactly 0\.15\.5/);
});

test("#1156 Windows listener proof rejects wildcard bind and accepts loopback-only listeners", async () => {
  const safeOutput = [
    "TCP    127.0.0.1:43158      0.0.0.0:0      LISTENING       1234",
    "TCP    [::1]:43158          [::]:0         LISTENING       1234",
  ].join("\r\n");
  assert.deepEqual(parseWindowsListenerEvidence(safeOutput, 43158), ["127.0.0.1:43158", "[::1]:43158"]);
  const safe = await verifyPortlessLoopbackListeners(43158, { platform: "win32", listenerOutput: safeOutput });
  assert.equal(safe.ok, true);

  const unsafe = await verifyPortlessLoopbackListeners(43158, {
    platform: "win32",
    listenerOutput: "TCP    0.0.0.0:43158      0.0.0.0:0      LISTENING       1234",
  });
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.state, "non-loopback-listener");
});

test("#1156 static alias upgrades a ready direct endpoint only after exact-instance proof", async () => {
  const runtime = makeRuntime();
  const calls = [];
  const adapter = await attachPortlessAlias(runtime, {
    portlessRuntime: fakePortlessRuntime(),
    proxy: fakeProxy(),
    execFileImpl: async (_command, args) => { calls.push(args); return okExec(); },
    fetchImpl: exactFetch(runtime),
  });
  assert.equal(adapter.state, "route-ready");
  assert.equal(runtime.record.transport, "portless");
  assert.equal(runtime.record.transportProfile, "portless/http");
  assert.match(runtime.record.url, /^http:\/\/pp-[a-f0-9]{24}\.localhost:43155$/);
  assert.deepEqual(calls[0].slice(-3), ["alias", adapter.routeName, "43111"]);
  assert.equal(adapter.evidence.exactInstanceProof, "pass");
});

test("#1156 Portless failure keeps the healthy app alive on direct routing when fallback is allowed", async () => {
  const runtime = makeRuntime();
  const adapter = await attachPortlessAlias(runtime, {
    portlessRuntime: { state: "unavailable", available: false, detail: "not installed" },
    proxy: null,
    allowDirectFallback: true,
  });
  assert.equal(adapter.state, "degraded-direct-fallback");
  assert.equal(runtime.record.transport, "direct");
  assert.equal(runtime.record.transportProfile, "direct/http");
  assert.equal(runtime.record.url, "http://127.0.0.1:43111");
  assert.equal(runtime.record.lifecycleState, "running");
});

test("#1156 a route remap increments endpoint generation and changes only the underlying app port", async () => {
  const runtime = makeRuntime();
  const calls = [];
  const execFileImpl = async (_command, args) => { calls.push(args); return okExec(); };
  const adapter = await attachPortlessAlias(runtime, {
    portlessRuntime: fakePortlessRuntime(),
    proxy: fakeProxy(),
    execFileImpl,
    fetchImpl: exactFetch(runtime),
  });
  const originalUrl = runtime.record.url;
  await remapPortlessAlias(runtime, adapter, {
    port: 43113,
    instanceRef: "inst-1156-b",
    execFileImpl,
    fetchImpl: exactFetch(runtime),
  });
  assert.equal(runtime.record.generation, 2);
  assert.equal(runtime.record.port, 43113);
  assert.equal(runtime.record.url, originalUrl);
  assert.equal(calls.some((args) => args.includes("--force") && args.includes("43113")), true);
});

test("#1156 cancellation removes only its alias and restores direct endpoint authority", async () => {
  const runtime = makeRuntime();
  const calls = [];
  const execFileImpl = async (_command, args) => { calls.push(args); return okExec(); };
  const adapter = await attachPortlessAlias(runtime, {
    portlessRuntime: fakePortlessRuntime(),
    proxy: fakeProxy(),
    execFileImpl,
    fetchImpl: exactFetch(runtime),
  });
  await detachPortlessAlias(runtime, adapter, { execFileImpl });
  assert.equal(adapter.state, "removed");
  assert.equal(runtime.record.transport, "direct");
  assert.equal(runtime.record.url, `http://127.0.0.1:${runtime.record.port}`);
  assert.equal(calls.some((args) => args.slice(-3, -1).join(" ") === "alias --remove"), true);
});

test("#1156 HTTPS is never silently enabled or trusted and missing OpenSSL is diagnostic only", async () => {
  assert.throws(() => validatePortlessSecurityBoundary({ profile: "portless/https" }), /explicit developer trust intent/);
  const explicit = validatePortlessSecurityBoundary({ profile: "portless/https", trustIntent: "explicit" });
  assert.equal(explicit.profile, "portless/https");
  const openssl = await probeOpenSslForHttps();
  assert.equal(openssl.state, "openssl-unavailable");
  assert.equal(openssl.available, false);
});

test("#1156 adapter contains no service-install, CA-trust or app-spawn authority", async () => {
  const source = await readFile(new URL("../core/runtime/portless-adapter.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /service\s*["']?\s*,\s*["']install/i);
  assert.doesNotMatch(source, /["']trust["']\s*\]/i);
  assert.doesNotMatch(source, /["']run["']\s*,/i);
  assert.match(source, /"alias", routeName/);
  assert.match(source, /"proxy", "start"/);
  assert.match(source, /"--foreground"/);
  assert.match(source, /PORTLESS_SYNC_HOSTS = "0"/);
  assert.equal(defaultPortlessStateDirectory().toLowerCase().includes("profiles"), false);
});
