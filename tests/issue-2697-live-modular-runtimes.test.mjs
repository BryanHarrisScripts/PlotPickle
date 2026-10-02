import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { craftContextForQuestion, craftRouteInstruction, liveCraftRoute, LIVE_CRAFT_CAPABILITIES } from "../core/learning/live-craft-runtime.ts";

test("#2697 live craft selection preserves bounded fan-out and proposal authority", () => {
  assert.equal(LIVE_CRAFT_CAPABILITIES.length, 6);
  const context = craftContextForQuestion("theme character scene dialogue", "revision");
  const route = liveCraftRoute("authoring-proposal", context);
  assert.equal(route.primary.id, "craft-theme");
  assert.equal(route.supporting.length, 2);
  assert.equal(route.canonicalMutationAllowed, false);
  assert.match(craftRouteInstruction("authoring-proposal", context), /explicit Human review/);
  assert.match(craftRouteInstruction("learn", ["revision"]), /simulated/);
  assert.equal(liveCraftRoute("learn", ["unknown"]).fallback, "baseline-learn");
});

test("#2697 registered modular services initialize and stop without model or remote transport", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "plotpickle-2697-"));
  try {
    for (const id of ["craft-runtime", "media-runtime", "chatgpt-mcp-gateway"]) {
      const child = spawn(process.execPath, ["--experimental-strip-types", `scripts/sidecars/${id}-service.mjs`, "--home", home], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe", "ipc"] });
      let stderr = "";
      child.stderr.on("data", (data) => { stderr += data; });
      const closed = new Promise((resolve) => child.once("exit", resolve));
      try {
        const status = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`${id} startup timed out: ${stderr}`)), 10000);
          child.once("message", (message) => { clearTimeout(timer); resolve(message); });
          child.once("error", (error) => { clearTimeout(timer); reject(error); });
          child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`${id} exited ${code}: ${stderr}`)); });
        });
        assert.ok(["ready", "degraded"].includes(status.state), stderr);
        const saved = JSON.parse(await readFile(path.join(home, "node/runtime/sidecars/services", id, "status.json"), "utf8"));
        assert.equal(saved.state, status.state);
        if (id === "chatgpt-mcp-gateway") assert.match(saved.evidence[0].summary, /External transport disconnected/);
      } finally {
        child.kill("SIGTERM");
        await closed;
      }
    }
  } finally { await rm(home, { recursive: true, force: true }); }
});
