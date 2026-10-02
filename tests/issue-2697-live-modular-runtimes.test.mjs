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

test("#2697 Screening consumes the actual media adapter evidence and rejects stale sources", async () => {
  const { projectScreeningMediaEvidence } = await import("../core/media/screening-media-evidence.ts");
  const evidence = { schemaVersion: 1, requestId: "render-1", engineId: "fframes-local", engineVersion: "test", state: "succeeded", startedAt: "", completedAt: "", sourceAssets: [{ position: 1, assetId: "frame-1", assetUrl: "/assets/frame.webp", sha256: "hash", durationMs: 3000, sourceRefs: ["frame-1"] }], artifacts: { contactSheetPath: "", frameDirectory: "", videoPath: "render.mp4" }, inspection: null, timeline: null, diagnostics: [], reason: "" };
  const media = { roughCutId: "cut-1", state: "succeeded", engineEvidence: [evidence], sourceRefs: ["frame-1"], reason: "" };
  const projection = projectScreeningMediaEvidence({ roughCutId: "cut-1", currentSourceRefs: ["frame-1"], media });
  assert.equal(projection.state, "ready");
  assert.deepEqual(projection.playbackArtifactPaths, ["render.mp4"]);
  assert.equal(projection.inspection.durationMs, 3000);
  assert.equal(projection.inspection.sourceCount, 1);
  assert.equal(projectScreeningMediaEvidence({ roughCutId: "cut-1", currentSourceRefs: [], media }).state, "stale");
});
