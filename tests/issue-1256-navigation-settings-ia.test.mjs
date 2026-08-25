import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function navItems(source) {
  return [...source.matchAll(/\{ id: "([^"]+)", relic: "[^"]+", label: "([^"]+)", detail: "[^"]+", selectable: (?:true|false) \}/g)]
    .map((match) => ({ id: match[1], label: match[2] }));
}

test("#1256 global workflow navigation follows the attended UAT order", async () => {
  const source = await read("app/plotpickle-workspace-shell.tsx");
  assert.deepEqual(navItems(source).map((item) => item.label), [
    "Community",
    "Library",
    "Learn",
    "Wyrmwood",
    "Plan",
    "Build",
    "Storyboard",
    "Previs",
    "Write",
    "Edit",
    "Feedback",
    "Refine",
    "Reports",
    "Dashboard",
    "Settings",
  ]);
});

test("#1256/#1377 Settings exposes the approved compute-first information architecture", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  for (const group of ["START", "AI COMPUTE", "COMMUNITY", "SYSTEM"]) {
    assert.match(source, new RegExp(`label: ["']${group}["']`));
  }
  for (const item of [
    "Overview",
    "What’s New",
    "Help",
    "Sage & PLAN Setup",
    "Local Compute",
    "Cloud Compute",
    "ComfyUI Setup",
    "BUZZ Setup",
    "Agent Activity",
    "Advanced Runtime",
  ]) {
    assert.match(source, new RegExp(`label: ["']${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`));
  }
  assert.doesNotMatch(source, /label: ["'](?:Sage Setup|PLAN Setup|LLM Routing|Images Setup|Video Setup|Ollama|OpenAI Cloud|MiniMax Cloud)["']/);
  assert.doesNotMatch(source, /Profiles\s*&\s*Security/i);
  assert.match(source, /Profile owns the Human BUZZ identity/);
});

test("#1256/#1377 existing setup owners are reused in their focused Settings destinations", async () => {
  const [settings, compute] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);
  assert.match(settings, /<AiComputeWorkspace mode="local" \/>/);
  assert.match(settings, /<AiComputeWorkspace mode="cloud" \/>/);
  assert.match(compute, /<AiRoutingPanel/);
  assert.match(compute, /<SageFastModelSetup \/>/);
  assert.match(settings, /<MediaRoutingPanel/);
  assert.doesNotMatch(compute, /<MediaRoutingPanel/);
  assert.match(compute, /<AiProviderSetupPanel provider="openai" \/>/);
  assert.match(compute, /<AiProviderSetupPanel provider="minimax" \/>/);
  assert.match(settings, /<BuzzSettingsPanel \/>/);
  assert.match(settings, /<LocalRuntimePanel \/>/);
});
