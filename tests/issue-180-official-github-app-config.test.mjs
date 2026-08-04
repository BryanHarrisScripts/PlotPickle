import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

function forbiddenPublicKeys(value, trail = "config") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(["clientSecret", "webhookSecret", "privateKey", "accessToken", "refreshToken", "pem"].includes(key) ? [`${trail}.${key}`] : []),
    ...forbiddenPublicKeys(child, `${trail}.${key}`),
  ]);
}

test("issue #180 commits one registered non-secret GitHub App identity", async () => {
  const [configText, schemaText] = await Promise.all([
    source("config/github-app.json"),
    source("schema/plotpickle-github-app-public-config.schema.json"),
  ]);
  const config = JSON.parse(configText);
  const schema = JSON.parse(schemaText);
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.product, "PlotPickle");
  assert.equal(config.registrationStatus, "registered");
  assert.match(config.clientId, /^[A-Za-z0-9._-]{8,200}$/);
  assert.equal(config.slug, "plotpickle-github-app");
  assert.equal(config.installUrl, "https://github.com/apps/plotpickle-github-app/installations/new");
  assert.equal(config.installUrl, `https://github.com/apps/${config.slug}/installations/new`);
  assert.equal(config.deviceFlow, true);
  assert.equal(config.expiringUserTokens, true);
  assert.equal(config.webhooks, false);
  assert.deepEqual(config.permissions, {
    metadata: "read",
    contents: "write",
    pullRequests: "write",
    administration: "write",
  });
  assert.deepEqual(forbiddenPublicKeys(config), []);
  assert.equal(schema.properties.product.const, "PlotPickle");
  assert.doesNotThrow(() => JSON.parse(schemaText));
});

test("issue #180 loads packaged configuration before the existing GitHub gateway", async () => {
  const [loader, vite] = await Promise.all([
    source("build/github-app-public-config.ts"),
    source("vite.config.ts"),
  ]);
  for (const contract of [
    "config/github-app.json",
    "PLOTPICKLE_GITHUB_APP_CONFIG",
    "PLOTPICKLE_GITHUB_APP_CLIENT_ID",
    "PLOTPICKLE_GITHUB_APP_SLUG",
    "PLOTPICKLE_GITHUB_APP_INSTALL_URL",
    "assertNoSecrets",
    "applyGitHubAppPublicConfig",
  ]) assert.ok(`${loader}\n${vite}`.includes(contract), `Public GitHub App loader is missing: ${contract}`);
  assert.ok(vite.indexOf("applyGitHubAppPublicConfig();") < vite.indexOf("githubAppGateway()"));
  assert.doesNotMatch(loader, /clientSecret\s*:|webhookSecret\s*:|privateKey\s*:|accessToken\s*:|refreshToken\s*:/);
});

test("issue #180 packages and loads the same configuration on every desktop platform", async () => {
  const [packager, smoke] = await Promise.all([
    source("scripts/package-platform.mjs"),
    source("scripts/package-smoke.mjs"),
  ]);
  assert.match(packager, /"config"/);
  assert.match(packager, /githubApp:/);
  assert.match(packager, /PLOTPICKLE_GITHUB_APP_CONFIG=%CD%\\\\config\\\\github-app\.json/);
  assert.match(packager, /\$PWD\/config\/github-app\.json/);
  assert.match(smoke, /config\/github-app\.json/);
  assert.match(smoke, /registrationStatus, "registered"/);
  assert.match(smoke, /PLOTPICKLE_GITHUB_APP_CONFIG/);
  assert.match(smoke, /config\[\\\\\/\]github-app/);
});

test("issue #180 provides one owner registration helper and user-facing release guidance", async () => {
  const [registration, guidance, layout, docs] = await Promise.all([
    source("scripts/github-app-registration.mjs"),
    source("app/github-app-release-guidance.tsx"),
    source("app/layout.tsx"),
    source("docs/issue-180-official-github-app-config.md"),
  ]);
  for (const contract of [
    "https://github.com/settings/apps/new",
    'url.searchParams.set("name", "PlotPickle GitHub App")',
    'url.searchParams.set("contents", "write")',
    'url.searchParams.set("pull_requests", "write")',
    'url.searchParams.set("administration", "write")',
    'url.searchParams.set("webhook_active", "false")',
    "configure <client-id> <app-slug>",
    "https://github.com/apps/plotpickle-github-app",
  ]) assert.ok(`${registration}\n${docs}`.includes(contract), `Registration helper is missing: ${contract}`);
  assert.doesNotMatch(registration, /client_secret|private_key|webhook_secret/);
  assert.match(guidance, /GitHub connection is unavailable in this download/);
  assert.match(guidance, /updated PlotPickle release/);
  assert.match(layout, /GitHubAppReleaseGuidance/);
  assert.match(docs, /No second application is installed/);
});

test("issue #180 regression and maintainer commands are registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-180-official-github-app-config\.test\.mjs/);
  assert.equal(packageJson.scripts["test:official-github-app"], "node --test tests/issue-180-official-github-app-config.test.mjs");
  assert.equal(packageJson.scripts["github-app:register"], "node scripts/github-app-registration.mjs open");
  assert.equal(packageJson.scripts["github-app:verify"], "node scripts/github-app-registration.mjs verify");
});
