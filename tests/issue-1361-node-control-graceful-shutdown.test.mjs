import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PLOTPICKLE_NODE_LIFECYCLE_STATES,
  createPlotPickleNodeShutdownLifecycle,
} from "../core/runtime/plotpickle-node-control-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Node lifecycle rejects repeated shutdown and supports a blocked retry", () => {
  let sequence = 0;
  const lifecycle = createPlotPickleNodeShutdownLifecycle({
    tokenFactory: () => `proof-${++sequence}`,
    now: () => "2026-08-24T19:00:00.000Z",
  });
  assert.deepEqual(PLOTPICKLE_NODE_LIFECYCLE_STATES, ["RUNNING", "SAVING", "SHUTTING DOWN", "SHUTDOWN BLOCKED", "STOPPED"]);
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

test("#1361 preserves the existing Studio signing identity as the compatibility node_id", () => {
  const gateway = source("build/node-topology-gateway.ts");
  const core = source("core/runtime/plotpickle-node-control-core.mjs");
  const identityContract = source("docs/architecture/IDENTITY-AUTHORITY.md");

  assert.match(gateway, /createStudioIdentity, readPublicStudioIdentity/);
  assert.match(gateway, /existing\.configured \? existing : await createStudioIdentity\("Local"\)/);
  assert.match(gateway, /nodeId: identity\.studioId/);
  assert.match(gateway, /shortId: `PP-\$\{identity\.shortCode\}`/);
  assert.doesNotMatch(core, /pp-node-|node\/identity\/node\.json/);
  assert.match(identityContract, /existing StudioIdentity\.studioId\s+-> node_id \(same opaque value\)/);
  assert.match(identityContract, /Existing `pp_studio_XXXXXXXX` IDs remain valid/);
});

test("graceful shutdown source preserves save, Human release, supervisor and owned-browser ordering", () => {
  const shell = source("app/plotpickle-workspace-shell.tsx");
  const gateway = source("build/node-topology-gateway.ts");
  const browser = source("Start-PlotPickle.bat");

  assert.match(shell, /<NodeControl \/>/);
  assert.match(shell, /Shut down this PlotPickle Node\?/);
  assert.match(shell, /PlotPickle will save your work, close the current session, stop local services, and close this PlotPickle window\./);
  assert.ok(shell.indexOf("persistActiveProfileProject()") < shell.indexOf("logoutHumanProfile(currentProfile.csrfToken)"));
  assert.ok(shell.indexOf("logoutHumanProfile(currentProfile.csrfToken)") < shell.indexOf('nodeAction("complete-shutdown"'));
  assert.match(shell, /flushProfilePrivateWrites\(\)/);
  assert.match(shell, /clearProfilePrivateBrowser\(\)/);
  assert.match(shell, /localStorage\.removeItem\(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY\)/);

  const commitAt = gateway.indexOf("lifecycle.commit");
  const releaseAt = gateway.indexOf("resetProfileExperienceRuntime()", commitAt);
  const managedStopAt = gateway.indexOf("stopManagedLlama()", commitAt);
  const launcherAt = gateway.indexOf("signalOwnedLauncher(identity)", commitAt);
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
  assert.match(browser, /PLOTPICKLE_SHUTDOWN_SIGNAL/);

  const openWhenReady = browser.slice(
    browser.indexOf(":open_when_ready"),
    browser.indexOf(":start_deferred_companion_maintenance"),
  );
  assert.match(openWhenReady, /\) \| Where-Object/);
  assert.match(openWhenReady, /\} \| ConvertTo-Json \| Set-Content/);
  assert.doesNotMatch(openWhenReady, /\^\|/);
});
