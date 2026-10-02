import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { launcherLivenessGateway } from "../build/startup/launcher-liveness-gateway.ts";

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
