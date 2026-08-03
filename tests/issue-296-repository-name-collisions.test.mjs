import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function repositoryContract() {
  const compiled = stripTypeScriptTypes(await source("lib/story-project-repository.ts"), { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("issue #296 extracts clean repository names from GitHub URLs", async () => {
  const contract = await repositoryContract();
  assert.equal(contract.repositoryNameFromInput("https://github.com/BryanHarrisScripts/Afterglow"), "Afterglow");
  assert.equal(contract.normalizeRepositoryName("https://github.com/BryanHarrisScripts/Afterglow.git"), "Afterglow");
  assert.equal(contract.normalizeRepositoryName("github.com/BryanHarrisScripts/Afterglow/"), "Afterglow");
  assert.equal(contract.normalizeRepositoryName("git@github.com:BryanHarrisScripts/Afterglow.git"), "Afterglow");
  assert.equal(contract.normalizeRepositoryName("Afterglow: Story / Draft"), "Afterglow-Story-Draft");
});

test("issue #296 proposes deterministic case-insensitive sequential names", async () => {
  const contract = await repositoryContract();
  assert.equal(contract.nextAvailableRepositoryName("Afterglow", []), "Afterglow");
  assert.equal(contract.nextAvailableRepositoryName("Afterglow", ["afterglow"]), "Afterglow-2");
  assert.equal(contract.nextAvailableRepositoryName("Afterglow", ["AFTERGLOW", "afterglow-2"]), "Afterglow-3");
  assert.equal(contract.nextAvailableRepositoryName("A".repeat(100), ["A".repeat(100)]).length, 100);
});

test("issue #296 checks availability on the server immediately before creation", async () => {
  const [gateway, component] = await Promise.all([
    source("build/github-app-gateway.ts"),
    source("app/github-app-connection.tsx"),
  ]);
  for (const contract of [
    "repositoryExists",
    "availableRepositoryName",
    "/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}",
    "await availableRepositoryName(authorization.accessToken, owner, validatedRequestedName)",
    "`${API}/name-suggestion`",
    "collisionAdjusted",
  ]) assert.ok(gateway.includes(contract), `Server collision contract is missing: ${contract}`);
  for (const contract of [
    "localRepositorySuggestion",
    "/api/local-github-app/name-suggestion",
    "checking availability",
    "next available name proposed",
    "repositoryFrom(result.repository)",
  ]) assert.ok(component.includes(contract), `UI collision contract is missing: ${contract}`);
  assert.doesNotMatch(component, /https-github\.com-BryanHarrisScripts-Afterglow/);
});

test("issue #296 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-296-repository-name-collisions\.test\.mjs/);
  assert.equal(packageJson.scripts["test:repository-name-collisions"], "node --test tests/issue-296-repository-name-collisions.test.mjs");
});
