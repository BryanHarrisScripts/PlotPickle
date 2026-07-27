import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

test("issue #144 keeps GitHub's visible readiness states and trustworthy first-time instructions", async () => {
  const [panel, appConnection, css] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("app/github-app-connection.tsx"),
    source("app/github-collaboration.module.css"),
  ]);
  const onboarding = `${panel}\n${appConnection}`;
  for (const phrase of [
    "Not connected",
    "Checking",
    "Ready",
    "Needs attention",
    "Recommended: connect your GitHub account",
    "Advanced Setup: fine-grained GitHub token",
    "Create a fine-grained token in GitHub",
    "https://github.com/settings/personal-access-tokens/new",
    "Contents and Pull requests to Read and write",
    "The green Ready light still requires all five live collaboration checks",
  ]) assert.ok(onboarding.includes(phrase), `GitHub onboarding is missing: ${phrase}`);
  for (const style of [
    "readinessDisconnected",
    "readinessChecking",
    "readinessReady",
    "readinessError",
  ]) assert.ok(css.includes(`.${style}`), `Readiness light is missing CSS state: ${style}`);
  assert.match(panel, /role="status" aria-live="polite"/);
  assert.match(panel, /disabled=\{working \|\| !status\.ready\}/);
});

test("issue #144 verifies every GitHub collaboration prerequisite before Ready", async () => {
  const gateway = await source("build/local-project-gateway.ts");
  for (const contract of [
    "verifyGitHubReadiness",
    '"repository"',
    '"branch"',
    '"project-path"',
    '"contents-write"',
    '"pull-requests"',
    "Contents repository permission set to Read and write",
    "Pull requests repository permission set to Read and write",
    "response.status === 422",
    'body: "{}"',
    "no file was created or changed by this check",
    "no pull request was created by this check",
    "parsePortableProjectFile",
    "integrityValid",
  ]) assert.ok(gateway.includes(contract), `GitHub readiness verification is missing: ${contract}`);
  assert.match(gateway, /readiness\?\.ready/);
  assert.match(gateway, /wait for the green Ready light/);
});

test("issue #144 centralizes credentials and protects new Windows secrets with current-user DPAPI", async () => {
  const [vault, ai, github, google, review] = await Promise.all([
    source("build/local-credentials.ts"),
    source("build/local-ai-gateway.ts"),
    source("build/local-project-gateway.ts"),
    source("build/local-connections-gateway.ts"),
    source("build/github-review-gateway.ts"),
  ]);
  for (const contract of [
    "PLOTPICKLE_HOME",
    '"secrets"',
    "plotpickle-protected-credential",
    "Add-Type -AssemblyName System.Security",
    "System.Security.Cryptography.ProtectedData",
    "DataProtectionScope]::CurrentUser",
    "windows-dpapi-current-user",
    "0o600",
    "atomicWrite",
    "readCredentialJson",
    "writeCredentialJson",
    "eraseAllCredentials",
    'if (process.platform === "win32") await writeCredentialJson(name, stored)',
  ]) assert.ok(vault.includes(contract), `Credential vault is missing: ${contract}`);
  for (const gateway of [ai, github, google, review]) {
    assert.match(gateway, /local-credentials/);
  }
  assert.doesNotMatch(vault, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(vault, /ExecutionPolicy|Bypass/);
});

test("issue #144 exposes open-folder and erase-all controls with explicit boundaries", async () => {
  const [panel, gateway] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("build/local-connections-gateway.ts"),
  ]);
  for (const phrase of [
    "Open credentials folder",
    "Erase all credentials",
    "Projects, assets and backups will remain untouched",
    "does not automatically invalidate GitHub or AI tokens",
    "separate provider files inside one private credentials folder",
    "/api/local-connections/credentials",
  ]) assert.ok(`${panel}\n${gateway}`.includes(phrase), `Credential controls are missing: ${phrase}`);
  assert.match(panel, /window\.confirm/);
  assert.match(gateway, /request\.method === "DELETE"/);
  assert.match(gateway, /Google access was revoked|revokeGoogleConnection/);
});

test("eraseAllCredentials removes only the exact secrets directory", async () => {
  const temporaryHome = await mkdtemp(path.join(os.tmpdir(), "plotpickle-credentials-"));
  const previousHome = process.env.PLOTPICKLE_HOME;
  process.env.PLOTPICKLE_HOME = temporaryHome;
  try {
    const compiledVault = stripTypeScriptTypes(await source("build/local-credentials.ts"), { mode: "transform" });
    const vault = await import(`data:text/javascript;base64,${Buffer.from(compiledVault, "utf8").toString("base64")}`);
    await vault.writeCredentialJson("github-connection.json", { version: 1, token: "test-token" });
    await vault.writeCredentialJson("ai-connection.json", { version: 1, apiKey: "test-key" });
    await mkdir(path.join(temporaryHome, "projects"), { recursive: true });
    await mkdir(path.join(temporaryHome, "backups"), { recursive: true });
    await mkdir(path.join(temporaryHome, "assets"), { recursive: true });
    await writeFile(path.join(temporaryHome, "projects", "story.ppf"), "project");
    await writeFile(path.join(temporaryHome, "backups", "story.ppf"), "backup");
    await writeFile(path.join(temporaryHome, "assets", "frame.webp"), "asset");

    const inventory = await vault.credentialInventory();
    assert.equal(inventory.files.length, 2);
    assert.deepEqual(await vault.readCredentialJson("github-connection.json"), { version: 1, token: "test-token" });

    const erased = await vault.eraseAllCredentials();
    assert.equal(erased.removed, 2);
    await assert.rejects(access(path.join(temporaryHome, "secrets")));
    assert.equal(await readFile(path.join(temporaryHome, "projects", "story.ppf"), "utf8"), "project");
    assert.equal(await readFile(path.join(temporaryHome, "backups", "story.ppf"), "utf8"), "backup");
    assert.equal(await readFile(path.join(temporaryHome, "assets", "frame.webp"), "utf8"), "asset");
  } finally {
    if (previousHome === undefined) delete process.env.PLOTPICKLE_HOME;
    else process.env.PLOTPICKLE_HOME = previousHome;
    await rm(temporaryHome, { recursive: true, force: true });
  }
});

test("issue #144 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-144-connection-trust\.test\.mjs/);
  assert.equal(packageJson.scripts["test:connection-trust"], "node --test tests/issue-144-connection-trust.test.mjs");
});
