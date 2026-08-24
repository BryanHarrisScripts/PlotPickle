import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function navItems(source) {
  return [...source.matchAll(/\{ id: "([^"]+)", relic: "[^"]+", label: "([^"]+)", detail: "([^"]+)", selectable: (?:true|false) \}/g)]
    .map((match) => ({ id: match[1], label: match[2], detail: match[3] }));
}

test("#1256 global workflow navigation follows the attended UAT order", async () => {
  const source = await read("app/plotpickle-workspace-shell.tsx");
  assert.deepEqual(navItems(source).map((item) => item.label), [
    "Dashboard",
    "Library",
    "Community",
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
    "Settings",
  ]);
});

test("#1341 Library and Dashboard keep their titles while using the approved subtitles", async () => {
  const source = await read("app/plotpickle-workspace-shell.tsx");
  const items = navItems(source);
  assert.deepEqual(items.find((item) => item.id === "library"), { id: "library", label: "Library", detail: "Stories" });
  assert.deepEqual(items.find((item) => item.id === "dashboard"), { id: "dashboard", label: "Dashboard", detail: "KPI" });
});

test("#1256 Settings exposes the approved capability-owned information architecture", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  for (const group of ["START", "LOCAL AI", "MODEL PROVIDERS", "COMMUNITY", "SYSTEM"]) {
    assert.match(source, new RegExp(`label: ["']${group}["']`));
  }
  for (const item of [
    "Overview",
    "What’s New",
    "Help",
    "Sage Setup",
    "PLAN Setup",
    "LLM Routing",
    "Images Setup",
    "Video Setup",
    "Ollama",
    "OpenAI Cloud",
    "MiniMax Cloud",
    "BUZZ Setup",
    "Agent Activity",
    "Advanced Runtime",
  ]) {
    assert.match(source, new RegExp(`label: ["']${item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`));
  }
  assert.doesNotMatch(source, /Profiles\s*&\s*Security/i);
  assert.match(source, /Profile owns the Human BUZZ identity/);
});

test("#1256 existing setup owners are reused rather than duplicated", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  assert.match(source, /<SageFastModelSetup\s*\/>/);
  assert.match(source, /<AiRoutingPanel\s*\/>/);
  assert.match(source, /<MediaRoutingPanel onManage=\{openSettingsTarget\}\s*\/>/);
  assert.match(source, /<BuzzSettingsPanel\s*\/>/);
  assert.match(source, /<LocalRuntimePanel\s*\/>/);
});
