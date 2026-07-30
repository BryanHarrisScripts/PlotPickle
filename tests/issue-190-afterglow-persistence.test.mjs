import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function persistenceContract() {
  const compiled = stripTypeScriptTypes(await source("lib/afterglow-persistence.ts"), { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("issue #190 derives the three Afterglow Dashboard states from verified state", async () => {
  const contract = await persistenceContract();
  const empty = {
    ...contract.EMPTY_AFTERGLOW_PERSISTENCE_STATUS,
    available: true,
  };

  const notLoaded = contract.deriveAfterglowDashboardState("untitled-story", empty);
  assert.equal(notLoaded.id, "not-loaded");
  assert.equal(notLoaded.label, "Afterglow not loaded");
  assert.equal(notLoaded.enabled, false);

  const local = contract.deriveAfterglowDashboardState(contract.AFTERGLOW_PROJECT_ID, empty);
  assert.equal(local.id, "loaded-locally");
  assert.equal(local.label, "Afterglow loaded locally");
  assert.match(local.detail, /today’s default/i);

  const connectedStatus = contract.normalizeAfterglowPersistenceStatus({
    available: true,
    enabled: true,
    repository: {
      owner: contract.AFTERGLOW_REPOSITORY_OWNER,
      repo: contract.AFTERGLOW_REPOSITORY_NAME,
      branch: "main",
      projectPath: contract.AFTERGLOW_REPOSITORY_PROJECT_PATH,
      ready: true,
      verifiedAt: "2026-07-29T10:00:00.000Z",
    },
  }, true);
  const connected = contract.deriveAfterglowDashboardState(contract.AFTERGLOW_PROJECT_ID, connectedStatus);
  assert.equal(connected.id, "github-repository-connected");
  assert.equal(connected.label, "Afterglow GitHub repository connected");
  assert.equal(connected.localProjectAvailable, true);

  const wrongRepository = contract.normalizeAfterglowPersistenceStatus({
    available: true,
    enabled: true,
    repository: { owner: "BryanHarrisScripts", repo: "Another-Story", ready: true },
  }, true);
  assert.equal(wrongRepository.repository.ready, false);
  assert.equal(
    contract.deriveAfterglowDashboardState(contract.AFTERGLOW_PROJECT_ID, wrongRepository).id,
    "loaded-locally",
  );
});

test("issue #190 accepts only the stable Afterglow project and repository identities", async () => {
  const contract = await persistenceContract();
  assert.equal(contract.isAfterglowProjectId("afterglow-echoes-of-sentience"), true);
  assert.equal(contract.isAfterglowProjectId("afterglow-copy"), false);
  assert.equal(
    contract.isExpectedAfterglowRepository("bryanharrisscripts", "afterglow-echoes-of-sentience"),
    true,
  );
  assert.equal(contract.isExpectedAfterglowRepository("BryanHarrisScripts", "PlotPickle"), false);
  assert.throws(
    () => contract.afterglowCollaborationPatch({ owner: "BryanHarrisScripts", repo: "PlotPickle", ready: true }),
    /expected Afterglow repository/i,
  );
  const patch = contract.afterglowCollaborationPatch({
    owner: contract.AFTERGLOW_REPOSITORY_OWNER,
    repo: contract.AFTERGLOW_REPOSITORY_NAME,
    ready: true,
    branch: "main",
  }, "2026-07-29T10:00:00.000Z");
  assert.equal(patch.provider, "github");
  assert.equal(patch.syncEnabled, true);
  assert.equal(patch.repositoryUrl, contract.AFTERGLOW_REPOSITORY_URL);
});

test("issue #190 persists only the opt-in preference outside the installation", async () => {
  const gateway = await source("build/afterglow-project-gateway.ts");
  for (const contract of [
    'const STATE_FILE = "afterglow-persistence.json"',
    "process.env.LOCALAPPDATA",
    "process.env.PLOTPICKLE_HOME",
    "readCredentialJson<GitHubConnection>(GITHUB_CONNECTION_FILE)",
    "isExpectedAfterglowRepository",
    "readiness?.ready !== true",
    "${API}/status",
    "${API}/enable",
    "${API}/disable",
    "The persistent local project has not been removed",
  ]) assert.ok(gateway.includes(contract), `Afterglow gateway contract is missing: ${contract}`);
  assert.doesNotMatch(gateway, /response\.end\(JSON\.stringify\(connection\)\)/);
  assert.doesNotMatch(gateway, /\brm\(|unlink|deleteFile/);
});

test("issue #190 reuses guarded repository setup, local folders and reviewed synchronization", async () => {
  const hook = await source("app/use-afterglow-persistence.ts");
  for (const contract of [
    "/api/local-github-app/select",
    "AFTERGLOW_REPOSITORY_FULL_NAME",
    "initializeMissingManifest",
    "Existing repository files will be preserved",
    "/api/local-github/connection/check",
    "/api/local-github-sync/preview",
    "/api/local-github-sync/pull",
    "/api/local-projects/save",
    "/api/local-projects/load?file=",
    "fileName: AFTERGLOW_PROJECT_FILE",
    "Opening the existing persistent Afterglow project",
    "was not overwritten",
    "/api/local-afterglow/enable",
    "/api/local-afterglow/disable",
    "GitHub publication remains a reviewed action",
    "persistent Afterglow project opened locally",
  ]) assert.ok(hook.includes(contract), `Afterglow client contract is missing: ${contract}`);
  assert.doesNotMatch(hook, /\/api\/local-github-sync\/publish/);
  assert.doesNotMatch(hook, /force-push|--force/);
});

test("issue #190 keeps bundled loading explicit while the Dashboard stays project-generic", async () => {
  const [page, dashboard] = await Promise.all([
    source("app/page.tsx"),
    source("app/dashboard-command-centre.tsx"),
  ]);
  for (const phrase of [
    "Current project source",
    "Local project on this device",
    "Repository configured; local project still loaded",
    "GitHub repository working copy",
    "Bundled example loaded locally",
    "Use the example’s GitHub working copy",
  ]) assert.ok(dashboard.includes(phrase), `Dashboard is missing: ${phrase}`);
  assert.match(dashboard, /source\.isBundledExample/);
  assert.match(dashboard, /type="checkbox"/);
  assert.match(dashboard, /role="switch"/);
  assert.match(page, /createAfterglowProject\(\)/);
  assert.match(page, /afterglowPersistence\.load\(\)/);
  assert.match(page, /afterglowPersistence\.save\(project\)/);
  assert.match(page, /afterglowPersistence\.enable\(target\)/);
  assert.match(page, /afterglowPersistence\.disable\(project\)/);
});

test("issue #190 gateway and focused test are registered", async () => {
  const [vite, packageJson] = await Promise.all([
    source("vite.config.ts"),
    source("package.json").then(JSON.parse),
  ]);
  assert.match(vite, /afterglowProjectGateway/);
  assert.match(packageJson.scripts.test, /issue-190-afterglow-persistence\.test\.mjs/);
  assert.equal(
    packageJson.scripts["test:afterglow-persistence"],
    "node --test tests/issue-190-afterglow-persistence.test.mjs",
  );
});
