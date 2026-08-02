import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
    "Configured by the user when needed",
    "PlotPickle application",
    "Local PPF project storage",
    "Rolling local backups",
    "AI provider",
    "Buzz community",
    "GitHub account & story repository",
    "Google Calendar & Meet",
    "Local or external media engines",
  ]) assert.ok(setup.includes(phrase), `Setup Dashboard is missing: ${phrase}`);
  assert.match(setup, /PlotPickle works locally without any optional account/);
  assert.match(setup, /ChatGPT Plus does not include OpenAI API usage/);
  assert.match(setup, /One repository per story is recommended/);
});

test("issue #256 exposes safe direct account and service setup destinations", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const url of [
    "https://platform.openai.com/api-keys",
    "https://platform.openai.com/settings/organization/billing/overview",
    "https://developers.openai.com/api/docs/quickstart",
    "https://plotpickleplayhouse.communities.buzz.xyz/invite/v2.tdZwBnmvMuZ_E3lh_cEjbo4qeJHdTvFogatjMfVgB-k",
    "https://app.builderlab.xyz/buzz",
    "https://github.com/signup",
    "https://github.com/new",
    "https://console.cloud.google.com/apis/credentials",
  ]) assert.ok(setup.includes(url), `Setup Dashboard is missing destination: ${url}`);
  assert.match(setup, /target="_blank" rel="noreferrer"/);
  assert.doesNotMatch(setup, /nsec1|sk-[A-Za-z0-9]|privateKey|accessToken|refreshToken/);
});

test("issue #256 uses verified lifecycle semantics and tests all real connection sources", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const phrase of [
    "Verified and working",
    "Optional and not configured",
    "Setup or verification needed",
    "A previously working connection has failed",
    "Test all connections",
    "requestConnectionStatusRefresh",
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

test("issue #256 setup Dashboard test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-256-setup-connections-dashboard\.test\.mjs/);
  assert.equal(packageJson.scripts["test:setup-connections-dashboard"], "node --test tests/issue-256-setup-connections-dashboard.test.mjs");
});
