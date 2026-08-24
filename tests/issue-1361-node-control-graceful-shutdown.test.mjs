import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ensurePlotPickleNodeIdentity,
  resetPlotPickleNodeIdentityCacheForTests,
  shortPlotPickleNodeId,
  createPlotPickleNodeShutdownLifecycle,
  runSaveFirstNodeShutdown,
} from "../core/runtime/plotpickle-node-control-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Node identity is installation-scoped, durable, and short ID is presentation-only", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "plotpickle-node-"));
  try {
    const first = ensurePlotPickleNodeIdentity({ root: home, env: {} });
    resetPlotPickleNodeIdentityCacheForTests();
    const second = ensurePlotPickleNodeIdentity({ root: home, env: {} });
    assert.equal(second.nodeId, first.nodeId);
    assert.match(first.nodeId, /^pp-node-[a-f0-9]{32}$/i);
    assert.match(first.shortId, /^PP-[A-F0-9]{4}$/);
    assert.equal(first.shortId, shortPlotPickleNodeId(first.nodeId));
    assert.notEqual(first.shortId, first.nodeId);
    assert.ok(fs.existsSync(path.join(home, "node", "identity", "node.json")));
  } finally {
    resetPlotPickleNodeIdentityCacheForTests();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("Node lifecycle rejects repeated shutdown and supports a blocked retry", () => {
  let sequence = 0;
  const lifecycle = createPlotPickleNodeShutdownLifecycle({
    tokenFactory: () => `proof-${++sequence}`,
    now: () => "2026-08-24T19:00:00.000Z",
  });
  assert.equal(lifecycle.snapshot().state, "RUNNING");
  const first = lifecycle.begin();
  assert.equal(first.lifecycle.state, "SAVING");
  assert.throws(() => lifecycle.begin(), /already in progress/i);
  assert.equal(lifecycle.block(first.token, "disk full").state, "SHUTDOWN BLOCKED");
  const retry = lifecycle.begin();
  assert.notEqual(retry.token, first.token);
  assert.equal(lifecycle.commit(retry.token).state, "SHUTTING DOWN");
  assert.equal(lifecycle.stop().state, "STOPPED");
});

test("save-first shutdown sequence blocks before session release when persistence fails", async () => {
  const order = [];
  await assert.rejects(() => runSaveFirstNodeShutdown({
    begin: async () => ({ token: "proof" }),
    persist: async () => { order.push("save"); throw new Error("cannot persist"); },
    releaseSession: async () => order.push("session"),
    commit: async () => order.push("commit"),
    block: async () => order.push("blocked"),
  }), /cannot persist/i);
  assert.deepEqual(order, ["save", "blocked"]);
});

test("graceful shutdown source preserves save, session, supervisor and owned-browser ordering", () => {
  const shell = source("app/plotpickle-workspace-shell.tsx");
  const control = shell;
  const gateway = source("build/node-topology-gateway.ts");
  const browser = source("Start-PlotPickle.bat");
  const topology = source("build/node-topology-gateway.ts");

  assert.match(shell, /<NodeControl \/>/);
  assert.match(control, /Shut down this PlotPickle Node\?/);
  assert.match(control, /PlotPickle will save your work, close the current session, stop local services, and close this PlotPickle window\./);
  assert.ok(control.indexOf("persistActiveProfileProject()") < control.indexOf("logoutHumanProfile(currentProfile.csrfToken)"));
  assert.ok(control.indexOf("logoutHumanProfile(currentProfile.csrfToken)") < control.indexOf('nodeAction("complete-shutdown"'));
  assert.match(control, /flushProfilePrivateWrites\(\)/);
  assert.match(control, /clearProfilePrivateBrowser\(\)/);

  const commitAt = gateway.indexOf("lifecycle.commit");
  const releaseAt = gateway.indexOf("resetProfileExperienceRuntime()", commitAt);
  const managedStopAt = gateway.indexOf("stopManagedLlama()", commitAt);
  const launcherAt = gateway.indexOf("signalOwnedLauncher()", commitAt);
  const serverCloseAt = gateway.indexOf("server.close()", commitAt);
  assert.ok(commitAt >= 0 && commitAt < releaseAt);
  assert.ok(releaseAt < managedStopAt);
  assert.ok(managedStopAt < launcherAt);
  assert.ok(launcherAt < serverCloseAt);
  assert.match(gateway, /process\.exit\(0\)/);
  assert.doesNotMatch(gateway, /taskkill|killall|pkill/i);

  assert.match(browser, /--app=/);
  assert.match(browser, /--user-data-dir=/);
  assert.match(browser, /Start-Process[^\n]+-PassThru/);
  assert.match(browser, /Stop-Process -Id \$browser\.Id/);
  assert.doesNotMatch(browser, /Stop-Process[^\n]+-Name|taskkill|killall|pkill/i);

  assert.match(topology, /id: identity\.nodeId/);
});
