import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { launcherLivenessGateway } from "../build/startup/launcher-liveness-gateway.ts";
import { outlineLauncherReadinessTimeout } from "../scripts/pi/durable/launcher-readiness.mjs";

test("#2723 Outline recovery waits for the native launcher's existing readiness contract", async () => {
  const launcherSource = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  const nativeSeconds = Number(launcherSource.match(/^set "READY_TIMEOUT_SECONDS=(\d+)"/mu)[1]);
  const timeout = outlineLauncherReadinessTimeout({ platform: "win32", launcherSource });
  assert.equal(timeout, nativeSeconds * 1000);
  // The old fixture killed a still-live normal launcher at 180s while that
  // launcher continued waiting for its own completed startup contract at 240s.
  assert.ok(timeout > 180_000);
  assert.equal(outlineLauncherReadinessTimeout({ platform: "win32", launcherSource: 'set "READY_TIMEOUT_SECONDS=90"' }), 90_000, "Follow a stricter launcher policy rather than enforce a fixture minimum.");
  assert.equal(outlineLauncherReadinessTimeout({ platform: "linux", launcherSource }), 180_000);
  assert.equal(outlineLauncherReadinessTimeout({ cold: true, platform: "win32", launcherSource }), 480_000);
  for (const invalid of ["", 'set "READY_TIMEOUT_SECONDS=0"', 'set "READY_TIMEOUT_SECONDS=bad"']) {
    assert.throws(() => outlineLauncherReadinessTimeout({ platform: "win32", launcherSource: invalid }), /contract is missing or invalid/);
  }
});

test("#2723 Windows proof keeps owned shutdown strict while bounding shell-wrapper cleanup", async () => {
  const proof = await readFile(new URL("./issue-2698-windows-startup-proof.mjs", import.meta.url), "utf8");
  assert.match(proof, /const ownedShutdownTimeoutMs = 20_000;/);
  assert.match(proof, /const launcherWrapperExitTimeoutMs = 60_000;/);
  assert.match(proof, /launcher-owned service shutdown[\\s\\S]*ownedShutdownTimeoutMs/);
  assert.match(proof, /owned Edge shutdown[\\s\\S]*ownedShutdownTimeoutMs/);
  assert.match(proof, /core process shutdown[\\s\\S]*ownedShutdownTimeoutMs/);
  assert.match(proof, /launcher wrapper exit[\\s\\S]*launcherWrapperExitTimeoutMs/);
});

test("#2698 companion readiness renders the startup contract after the browser is already owned", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-probe-"));
  const previous = process.env.PLOTPICKLE_BROWSER_STATE;
  try {
    process.env.PLOTPICKLE_BROWSER_STATE = path.join(root, "browser.json");
    await writeFile(process.env.PLOTPICKLE_BROWSER_STATE, "{}");
    let middleware;
    launcherLivenessGateway().configureServer({ middlewares: { use: (handler) => { middleware = handler; } } });
    for (const purpose of ["warmup", "companion-maintenance", "liveness"]) {
      let rendered = false;
      let ended = false;
      const response = { statusCode: 200, setHeader() {}, end() { ended = true; } };
      middleware({ method: "GET", url: "/skin-v1", headers: { "user-agent": "WindowsPowerShell", "x-plotpickle-startup-probe": purpose } }, response, () => { rendered = true; });
      assert.equal(rendered, purpose !== "liveness");
      assert.equal(ended, purpose === "liveness");
      assert.equal(response.statusCode, purpose === "liveness" ? 204 : 200);
    }
  } finally {
    if (previous === undefined) delete process.env.PLOTPICKLE_BROWSER_STATE;
    else process.env.PLOTPICKLE_BROWSER_STATE = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("#2698 startup inventory cannot activate an optional model or issue inference", async () => {
  const gateway = await readFile(new URL("../build/local-runtime-gateway.ts", import.meta.url), "utf8");
  const startup = gateway.slice(gateway.indexOf('if (pathname === STARTUP_READINESS_PATH'), gateway.indexOf('if (pathname === SETTINGS_PATH'));
  assert.match(startup, /attemptManagedStart: false, probeInference: false/);
  assert.doesNotMatch(startup, /startManagedLlama|probeInference: true/);
  assert.match(gateway, /READINESS_PATH && request.method === "GET"[\s\S]*probeInference: true/);
});
