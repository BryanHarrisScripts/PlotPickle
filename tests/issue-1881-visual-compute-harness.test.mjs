import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1881 exposes one bounded Visual Compute Harness instead of raw Comfy tooling", async () => {
  const [harness, adapter] = await Promise.all([
    read("lib/runtime/ai/visual-compute-harness.ts"),
    read("lib/runtime/ai/comfy-visual-adapter.ts"),
  ]);

  for (const capability of [
    "find_visual_workflow",
    "validate_visual_workflow",
    "run_visual_workflow",
    "get_visual_output",
    "cancel_visual_job",
  ]) assert.match(harness, new RegExp(`"${capability}"`, "u"));

  for (const stage of ["discover", "validate", "approve", "run", "retrieve", "provenance"]) {
    assert.match(harness, new RegExp(`"${stage}"`, "u"));
  }

  for (const rawComfyTool of ["search_templates", "get_template_schema", "run_template", "submit_workflow", "search_nodes"]) {
    assert.doesNotMatch(harness, new RegExp(rawComfyTool, "u"));
  }

  assert.match(adapter, /preferred: "comfy-mcp"/u);
  assert.match(adapter, /cloudFallback: "comfy-cloud-api"/u);
  assert.match(adapter, /developerOnly: "comfy-cli"/u);
  assert.match(adapter, /excludedAgentProvider: "comfy-agent"/u);
});

test("#1881 keeps local and cloud targets explicit with no silent cross-target fallback", async () => {
  const [adapter, harness, mediaStore] = await Promise.all([
    read("lib/runtime/ai/comfy-visual-adapter.ts"),
    read("lib/runtime/ai/visual-compute-harness.ts"),
    read("build/media-routing-store.ts"),
  ]);

  assert.match(adapter, /if \(target === "local"\)/u);
  assert.match(adapter, /if \(!state\.localMcpAvailable\) return null/u);
  assert.match(adapter, /if \(state\.cloudMcpAvailable\)/u);
  assert.match(adapter, /if \(state\.cloudApiReady\)/u);
  assert.match(harness, /explicit \$\{request\.target\} target/u);
  assert.match(harness, /Paid Cloud execution requires explicit Human approval/u);
  assert.match(harness, /workflow must be explicitly imported and reviewed/u);
  assert.match(harness, /SHA-256 provenance hash/u);
  assert.match(mediaStore, /LOCAL_COMFYUI_URL = "http:\/\/127\.0\.0\.1:8188"/u);
});

test("#1881 workflow lanes are registry data and can grow horizontally without harness branches", async () => {
  const [lanes, harness, route, compatibility] = await Promise.all([
    read("lib/runtime/ai/visual-compute-lanes.ts"),
    read("lib/runtime/ai/visual-compute-harness.ts"),
    read("app/api/cloud-story-mode/comfy-cloud/route.ts"),
    read("lib/runtime/ai/comfy-cloud-workflow-catalog.ts"),
  ]);

  assert.match(lanes, /export type VisualComputeLaneId = string/u);
  for (const lane of ["cinematic", "marketing", "utility"]) assert.match(lanes, new RegExp(`id: "${lane}"`, "u"));
  assert.match(lanes, /VISUAL_COMPUTE_LANES\.some\(\(lane\) => lane\.id === value\)/u);
  assert.match(harness, /visualWorkflowsForLane\(search\.laneId\)/u);
  assert.doesNotMatch(harness, /laneId === "cinematic"|laneId === "marketing"|laneId === "utility"/u);
  assert.match(route, /isVisualComputeLaneId\(item\.defaultLane\)/u);
  assert.match(route, /DEFAULT_VISUAL_COMPUTE_LANE/u);
  assert.doesNotMatch(route, /item\.defaultLane === "marketing" \|\| item\.defaultLane === "utility"/u);
  assert.match(compatibility, /VISUAL_COMPUTE_LANES as COMFY_WORKFLOW_LANES/u);
  assert.match(compatibility, /VISUAL_WORKFLOW_CATALOG as COMFY_CLOUD_WORKFLOW_CATALOG/u);
});

test("#1881 Comfy remains visual compute and never enters PlotPickle Agent text-provider ownership", async () => {
  const [agents, agentGateway, cloudPanel] = await Promise.all([
    read("app/skin-v1/plotpickle-agents-host.tsx"),
    read("build/agent-compute-gateway.ts"),
    read("app/skin-v1/comfy-cloud-setup-panel.tsx"),
  ]);

  assert.doesNotMatch(agents, /Comfy Agent|comfy-agent/u);
  assert.doesNotMatch(agentGateway, /comfy-cloud|ComfyUI Cloud|comfy-agent/u);
  assert.match(cloudPanel, /These are transports around one Comfy capability, not competing PlotPickle providers/u);
  assert.match(cloudPanel, /Local ComfyUI remains in Local Story Mode/u);
});
