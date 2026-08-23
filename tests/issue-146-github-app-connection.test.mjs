import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

test("issue #146 makes GitHub App sign-in the recommended collaboration path", async () => {
  const [workspace, appConnection, css] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("app/github-app-connection.tsx"),
    source("app/github-collaboration.module.css"),
  ]);

  for (const phrase of [
    "Recommended: connect your GitHub account",
    "Connect GitHub Account",
    "Use selected story project",
    "PlotPickle checks for",
    "Manage repository access",
    "Advanced Setup: fine-grained GitHub token",
    "Sign in through GitHub",
  ]) assert.ok(`${workspace}\n${appConnection}`.includes(phrase), `GitHub App onboarding is missing: ${phrase}`);

  for (const style of [
    "appConnection",
    "deviceCard",
    "repositoryPicker",
    "accountCard",
    "advancedSetup",
  ]) assert.ok(css.includes(`.${style}`), `GitHub App onboarding is missing CSS: ${style}`);

  assert.match(workspace, /<GitHubAppConnection/);
  assert.match(workspace, /onConnected=\{applyConnectedRepository\}/);
  assert.match(workspace, /<details className=\{styles\.advancedSetup\}>/);
});


test("issue #146 replaces the complete GitHub status panel when async account state changes", async () => {
  const appConnection = await source("app/github-app-connection.tsx");

  for (const key of [
    'key="github-app-unavailable"',
    'key="github-app-sign-in"',
    'key="github-app-repositories"',
  ]) assert.ok(appConnection.includes(key), `GitHub status panel is missing its stable transition key: ${key}`);

  assert.match(appConnection, /!status\.configured \? \(\s*<div key="github-app-unavailable"/);
  assert.match(appConnection, /!status\.authenticated \? \(\s*<div key="github-app-sign-in"/);
  assert.match(appConnection, /:\s*\(\s*<div key="github-app-repositories"/);
});

test("issue #146 implements GitHub App device flow without a bundled client secret", async () => {
  const gateway = await source("build/github-app-gateway.ts");
  for (const contract of [
    "PLOTPICKLE_GITHUB_APP_CLIENT_ID",
    "https://github.com/login/device/code",
    "https://github.com/login/oauth/access_token",
    "urn:ietf:params:oauth:grant-type:device_code",
    "authorization_pending",
    "slow_down",
    "expired_token",
    "access_denied",
    "intervalSeconds += 5",
    "github-app-pending.json",
    "github-app-authorization.json",
  ]) assert.ok(gateway.includes(contract), `GitHub device flow is missing: ${contract}`);

  assert.doesNotMatch(gateway, /PLOTPICKLE_GITHUB_APP_CLIENT_SECRET/);
  assert.doesNotMatch(gateway, /client_secret/);
  assert.match(gateway, /readCredentialJson/);
  assert.match(gateway, /writeCredentialJson/);
  assert.match(gateway, /removeCredentialFile/);
});

test("issue #146 refreshes expiring GitHub App user tokens", async () => {
  const gateway = await source("build/github-app-gateway.ts");
  for (const contract of [
    'grant_type: "refresh_token"',
    "refreshTokenExpiresAt",
    "28_800",
    "15_897_600",
    "refreshAuthorization",
    "syncSelectedConnectionToken",
    "tokenExpiresAt",
  ]) assert.ok(gateway.includes(contract), `GitHub token refresh is missing: ${contract}`);
  assert.match(gateway, /Date\.parse\(saved\.expiresAt\) > Date\.now\(\) \+ 60_000/);
});

test("issue #146 discovers installed repositories and detects the approved branch", async () => {
  const gateway = await source("build/github-app-gateway.ts");
  for (const contract of [
    "/user/installations?per_page=100",
    "/repositories?per_page=100",
    "default_branch",
    "repository.permissions.push",
    'authMode: "github-app"',
    'readiness: { ready: false, checks: [] }',
    "The selected repository is not available to the PlotPickle GitHub App",
  ]) assert.ok(gateway.includes(contract), `GitHub repository selection is missing: ${contract}`);

  assert.match(gateway, /writeCredentialJson\(CONNECTION_FILE, connection\)/);
  assert.match(gateway, /removeCredentialFile\(CONNECTION_FILE\)/);
});

test("issue #146 registers the GitHub App gateway and documentation", async () => {
  const [vite, docs] = await Promise.all([
    source("vite.config.ts"),
    source("docs/issue-146-github-app-connection.md"),
  ]);
  assert.match(vite, /githubAppGateway/);
  assert.match(vite, /githubAppGateway\(\)/);
  for (const phrase of [
    "Enable Device Flow",
    "Metadata: Read-only",
    "Contents: Read and write",
    "Pull requests: Read and write",
    "PLOTPICKLE_GITHUB_APP_CLIENT_ID",
    "The device flow does not embed or require a GitHub App client secret",
    "Phase 3 of the six-phase collaboration roadmap",
  ]) assert.ok(docs.includes(phrase), `GitHub App documentation is missing: ${phrase}`);
});

test("issue #146 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-146-github-app-connection\.test\.mjs/);
  assert.equal(packageJson.scripts["test:github-app-connection"], "node --test tests/issue-146-github-app-connection.test.mjs");
});
