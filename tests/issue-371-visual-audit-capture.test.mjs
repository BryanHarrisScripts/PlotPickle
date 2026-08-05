import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #371 covers every canonical UI/UX registry screen", async () => {
  const [registry, captures] = await Promise.all([
    source("config/ui-ux-screen-registry.json").then(JSON.parse),
    source("config/visual-audit-captures.json").then(JSON.parse),
  ]);
  const covered = new Set(captures.captures.map((capture) => capture.screenId));
  const missing = registry.screens.map((screen) => screen.id).filter((id) => !covered.has(id));
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(captures.viewports), ["desktop", "tablet", "mobile"]);
  assert.equal(captures.settingsSessionKey, "plotpickle.settings.section");
});

test("issue #371 captures real rendered pages through Chrome DevTools", async () => {
  const script = await source("scripts/visual-audit-capture.mjs");
  for (const contract of [
    'client.send("Page.captureScreenshot"',
    'client.send("Page.getLayoutMetrics")',
    'client.send("Emulation.setDeviceMetricsOverride"',
    'client.send("Page.addScriptToEvaluateOnNewDocument"',
    "visual-audit-manifest.json",
    "index.html",
    "horizontalOverflow",
    "captureBeyondViewport: true",
  ]) assert.ok(script.includes(contract), `Missing visual capture contract: ${contract}`);
  assert.doesNotMatch(script, /lighthouse|puppeteer|playwright/i);
});

test("issue #371 redacts sensitive values and local user paths", async () => {
  const script = await source("scripts/visual-audit-capture.mjs");
  for (const contract of [
    "input[type=password]",
    "data-visual-audit-redact",
    "PRIVATE KEY",
    "[A-Za-z]:\\\\Users\\\\",
    "/home/[user]",
    "/Users/[user]",
  ]) assert.ok(script.includes(contract), `Missing redaction contract: ${contract}`);
});

test("issue #371 includes every configurable component in visual evidence", async () => {
  const captures = JSON.parse(await source("config/visual-audit-captures.json"));
  const targets = new Set(captures.captures.map((capture) => capture.settingsTarget).filter(Boolean));
  for (const target of [
    "sitemap",
    "general",
    "project-defaults",
    "appearance",
    "runtime",
    "ollama",
    "comfyui",
    "buzz",
    "openai",
    "ai",
    "minimax",
    "github",
    "google",
    "storage",
    "plugins",
    "privacy",
    "about",
  ]) assert.ok(targets.has(target), `Missing Settings visual target: ${target}`);
});

test("issue #371 publishes visual evidence as a CI artifact", async () => {
  const workflow = await source(".github/workflows/visual-audit-capture.yml");
  for (const contract of [
    "node scripts/visual-audit-capture.mjs",
    "node --check scripts/visual-audit-capture.mjs",
    "tests/issue-371-visual-audit-capture.test.mjs",
    "actions/upload-artifact",
    "reports/visual-audit/",
    "plotpickle-visual-audit-${{ github.sha }}",
  ]) assert.ok(workflow.includes(contract), `Missing visual workflow contract: ${contract}`);
});
