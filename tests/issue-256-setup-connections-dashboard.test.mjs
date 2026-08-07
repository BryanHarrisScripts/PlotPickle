import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./issue-278-writing-assistant-console.test.mjs";
import "./issue-333-dashboard-settings-separation.test.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #256 replaces the generic Dashboard connection grid with a first-class setup section", async () => {
  const dashboard = await source("app/dashboard-command-centre.tsx");
  assert.match(dashboard, /SetupConnectionsDashboard/);
  assert.match(dashboard, /#dashboard-setup/);
  assert.match(dashboard, /Setup &amp; connections/);
  assert.doesNotMatch(dashboard, /id="dashboard-connections"/);
});

test("issue #256 separates included local foundations from optional user configuration", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const phrase of [
    "What is included—and what you configure yourself",
    "Comes with the open-source installation",
    "Choose one of three creative-compute paths",
    "PlotPickle application",
    "Local PPF project storage",
    "Rolling local backups",
    "Local writing & planning · Ollama",
    "Local image generation · ComfyUI",
    "Cloud writing & images · OpenAI",
    "Cloud text, images & H3 video · MiniMax",
    "Manual image import",
    "Buzz community",
    "GitHub account & story repository",
    "Google Calendar & Meet",
  ]) assert.ok(setup.includes(phrase), `Setup Dashboard is missing: ${phrase}`);
  assert.match(setup, /PlotPickle works locally without any optional account/);
  assert.match(setup, /ChatGPT Plus does not include OpenAI API usage/);
  assert.match(setup, /One repository per story is recommended/);
});

test("issue #256 exposes one direct internal Settings route per component", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const target of ["ollama", "openai", "minimax", "comfyui", "github", "google", "buzz", "storage"]) {
    assert.ok(setup.includes(`settingsSection: "${target}"`), `Setup Dashboard is missing Settings target: ${target}`);
  }
  assert.doesNotMatch(setup, /target="_blank" rel="noreferrer"/);
  assert.doesNotMatch(setup, /nsec1|sk-[A-Za-z0-9]|privateKey|accessToken|refreshToken/);
});

test("issue #256 uses verified lifecycle semantics and tests all real connection sources", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const phrase of [
    "Verified and working",
    "Setup or verification needed",
    "A previously working connection has failed",
    "/api/local-buzz/status",
    "identityVerified",
    "relay?.reachable",
    "cli?.available",
    "lastSuccessfulConnection",
    "Last checked",
  ]) assert.ok(setup.includes(phrase), `Setup health contract is missing: ${phrase}`);
  assert.match(setup, /connection\.state === "connected"/);
  assert.match(setup, /connection\.state === "error" && connection\.lastSuccessfulConnection/);
});

test("first-run configuration remains available in the live product without interrupting the public visual-storytelling splash", async () => {
  const overview = await source("app/configuration-dashboard-overview.tsx");
  const host = await source("app/configuration-dashboard-host.tsx");
  const splash = await source("app/marketing-splash.tsx");
  const base = await source("app/marketing-splash-base.tsx");
  const layout = await source("app/layout.tsx");
  const ordering = await source("app/first-run-configuration-dashboard.css");

  for (const phrase of [
    "Local Story Mode",
    "Writers’ Room Mode",
    "Repository Collaboration Mode",
    "Ollama Local LLM",
    "OpenAI API",
    "MiniMax-M3 text · image-01 · MiniMax-H3 video",
    "ComfyUI",
    "GitHub Story Repository",
    "Buzz Account & Community",
    "Google Calendar & Meet",
    "Afterglow is an example story",
    "Show detailed setup and tests",
  ]) assert.ok(overview.includes(phrase), `First-run overview is missing: ${phrase}`);

  assert.doesNotMatch(overview, /Anthropic|Modal|Runway|Pika Labs|future provider/i);
  assert.match(host, /createPortal/);
  assert.doesNotMatch(layout, /ConfigurationDashboardHost/);
  assert.doesNotMatch(splash, /ConfigurationDashboardOverview/);
  assert.doesNotMatch(splash, /children: \[children\[0\], preview/);
  assert.match(base, /Storytelling<br \/>Has Changed\./);
  assert.match(base, /provider, model, endpoint and billing details stay in Settings/i);
  assert.match(layout, /first-run-configuration-dashboard\.css/);
  assert.match(ordering, /#dashboard-setup\{order:-20\}/);
});

test("issue #256 setup Dashboard test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-256-setup-connections-dashboard\.test\.mjs/);
  assert.equal(packageJson.scripts["test:setup-connections-dashboard"], "node --test tests/issue-256-setup-connections-dashboard.test.mjs");
});
