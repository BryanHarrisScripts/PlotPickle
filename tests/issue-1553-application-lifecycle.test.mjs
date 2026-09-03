import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createManagedPlotPickleLifecycle,
  resolveManagedPlotPickleTarget,
} from "../scripts/creative-uat/autonomous/application-lifecycle.mjs";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

test("#1553 managed application lifecycle is loopback-only", () => {
  const local = resolveManagedPlotPickleTarget("http://127.0.0.1:4173/");
  assert.equal(local.host, "127.0.0.1");
  assert.equal(local.port, 4173);
  assert.throws(() => resolveManagedPlotPickleTarget("https://127.0.0.1:4173/"), /local http/i);
  assert.throws(() => resolveManagedPlotPickleTarget("http://example.com:4173/"), /loopback/i);
});

test("#1649 managed lifecycle separates process readiness from optional application/provider health", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-readiness-"));
  const serverFile = path.join(temp, "server.mjs");
  const port = await freePort();
  await writeFile(serverFile, [
    'import http from "node:http";',
    'const port = Number(process.argv[2]);',
    'const server = http.createServer((request, response) => {',
    '  response.statusCode = request.url === "/ready" ? 200 : 503;',
    '  response.end(request.url === "/ready" ? "process-ready" : "optional-provider-unavailable");',
    '});',
    'server.listen(port, "127.0.0.1");',
    'process.on("SIGTERM", () => server.close(() => process.exit(0)));',
  ].join("\n"), "utf8");

  const lifecycle = createManagedPlotPickleLifecycle({
    repoRoot: temp,
    baseUrl: `http://127.0.0.1:${port}/`,
    command: process.execPath,
    args: [serverFile, String(port)],
    readinessPath: "/ready",
    startupTimeoutMs: 5_000,
    shutdownTimeoutMs: 5_000,
    probeTimeoutMs: 500,
  });

  try {
    const started = await lifecycle.start();
    assert.equal(started.started, true);
    assert.equal(started.readinessEndpoint, "/ready");
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 503);
    assert.equal((await fetch(`http://127.0.0.1:${port}/ready`)).ok, true);
  } finally {
    const stopped = await lifecycle.stop();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.endpointUnavailable, true);
    await rm(temp, { recursive: true, force: true });
  }
});

test("#1553 lifecycle proves a real process exits before a new process resumes the endpoint", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-lifecycle-"));
  const serverFile = path.join(temp, "server.mjs");
  const port = await freePort();
  await writeFile(serverFile, [
    'import http from "node:http";',
    'const port = Number(process.argv[2]);',
    'const server = http.createServer((_request, response) => { response.statusCode = 200; response.end("PlotPickle lifecycle contract"); });',
    'server.listen(port, "127.0.0.1");',
    'process.on("SIGTERM", () => server.close(() => process.exit(0)));',
  ].join("\n"), "utf8");

  const lifecycle = createManagedPlotPickleLifecycle({
    repoRoot: temp,
    baseUrl: `http://127.0.0.1:${port}/`,
    command: process.execPath,
    args: [serverFile, String(port)],
    startupTimeoutMs: 5_000,
    shutdownTimeoutMs: 5_000,
    probeTimeoutMs: 500,
  });

  try {
    const first = await lifecycle.start();
    assert.equal(first.started, true);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).ok, true);

    const restart = await lifecycle.restart();
    assert.equal(restart.restarted, true);
    assert.equal(restart.stopped.stopped, true);
    assert.equal(restart.stopped.endpointUnavailable, true);
    assert.equal(restart.newProcessIdentity, true);
    assert.notEqual(restart.previousProcess.processIdentity, restart.currentProcess.processIdentity);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).ok, true);
  } finally {
    const stopped = await lifecycle.stop();
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.endpointUnavailable, true);
    await rm(temp, { recursive: true, force: true });
  }
});

test("#1553 one-command reference run owns the PlotPickle app lifecycle without state shortcuts", async () => {
  const root = new URL("../", import.meta.url);
  const lifecycle = await readFile(new URL("scripts/creative-uat/autonomous/application-lifecycle.mjs", root), "utf8");
  const reference = await readFile(new URL("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs", root), "utf8");
  const routeRunner = await readFile(new URL("scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs", root), "utf8");

  assert.match(lifecycle, /node_modules[\s\S]*vite[\s\S]*bin[\s\S]*vite\.js/);
  assert.match(lifecycle, /--strictPort/);
  assert.match(lifecycle, /\/@vite\/client/);
  assert.match(lifecycle, /readinessTarget/);
  assert.match(lifecycle, /SIGTERM/);
  assert.match(lifecycle, /endpointUnavailable/);
  assert.match(reference, /createManagedPlotPickleLifecycle/);
  assert.match(reference, /run-autonomous-story-routes\.mjs/);
  assert.match(reference, /managed-plotpickle-application-process-plus-fresh-playwright-mcp/);
  assert.match(reference, /applicationProcessRestarted/);
  assert.match(reference, /newProcessIdentity/);
  assert.match(routeRunner, /fresh-playwright-mcp-process-shared-browser-profile/);

  const combined = `${lifecycle}\n${reference}`;
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB|saveFoundationProject|applyStoryCommand|sqlite|database|fixture/i);
  assert.doesNotMatch(combined, /authenticated-human/);
  assert.doesNotMatch(combined, /chainOfThought|reasoningTrace|modelOutput/);
});
