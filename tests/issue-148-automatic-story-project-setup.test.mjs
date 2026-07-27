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

test("issue #148 creates a versioned repository manifest and deterministic bootstrap", async () => {
  const contract = await repositoryContract();
  assert.equal(contract.normalizeRepositoryName("  Afterglow: Story / Draft  "), "Afterglow-Story-Draft");
  assert.equal(contract.validateRepositoryName("My_Story.2026"), "My_Story.2026");
  assert.throws(() => contract.validateRepositoryName("///"), /repository name/i);
  assert.throws(() => contract.safeCanonicalProjectPath("../secret.ppf"), /safe \.ppf/i);

  const manifest = contract.createStoryProjectManifest({
    projectId: "project-148",
    title: "Afterglow",
    owner: "BryanHarrisScripts",
    repository: "Afterglow Story",
    defaultBranch: "trunk",
    canonicalProjectPath: "stories/afterglow.ppf",
    createdAt: "2026-07-27T00:00:00.000Z",
  });
  assert.equal(manifest.format, "plotpickle-story-project");
  assert.equal(manifest.formatVersion, "1.0.0");
  assert.equal(manifest.schemaVersion, "2.3.0");
  assert.equal(manifest.repository.name, "Afterglow-Story");
  assert.equal(manifest.repository.defaultBranch, "trunk");
  assert.equal(manifest.canonicalProject.path, "stories/afterglow.ppf");
  assert.equal(manifest.collaboration.approvalAuthority, "project-lead");
  assert.equal(manifest.collaboration.proposalMode, "pull-request");

  const files = contract.storyProjectBootstrapFiles(manifest);
  for (const filePath of [
    "plotpickle-project.json",
    "README.md",
    ".gitignore",
    ".github/pull_request_template.md",
    "stories/.gitkeep",
    "canon/.gitkeep",
    "assets/.gitkeep",
    "exports/.gitkeep",
    "collaboration/.gitkeep",
  ]) assert.ok(filePath in files, `Bootstrap is missing ${filePath}`);
  assert.doesNotMatch(JSON.stringify(files), /accessToken|refreshToken|clientSecret|privateKey/);

  const parsed = contract.parseStoryProjectManifest(JSON.parse(files["plotpickle-project.json"]));
  assert.equal(parsed.projectId, "project-148");
  assert.throws(() => contract.parseStoryProjectManifest({ ...manifest, formatVersion: "9.0.0" }), /upgrade or migrate/i);
  assert.throws(() => contract.parseStoryProjectManifest({ format: "another-format" }), /different project format/i);
});

test("issue #148 supports template generation, bootstrap fallback and owner selection", async () => {
  const gateway = await source("build/github-app-gateway.ts");
  for (const contract of [
    "PLOTPICKLE_GITHUB_TEMPLATE_REPOSITORY",
    "/generate",
    '"/user/repos"',
    "/orgs/${encodeURIComponent(owner)}/repos",
    "auto_init: true",
    "Administration: Read and write",
    "availableOwners",
    "${API}/owners",
    "${API}/create",
    "createRepository",
    "privateRepository = input.private !== false",
    "templateRepository() ? \"template\" : \"bootstrap\"",
  ]) assert.ok(gateway.includes(contract), `Repository creation is missing: ${contract}`);
  assert.match(gateway, /for \(const filePath of order\)/);
  assert.doesNotMatch(gateway, /Promise\.all\(.*upsertRepositoryFile/s);
});

test("issue #148 detects manifests and requires explicit initialization without overwriting", async () => {
  const [gateway, component] = await Promise.all([
    source("build/github-app-gateway.ts"),
    source("app/github-app-connection.tsx"),
  ]);
  for (const contract of [
    "STORY_PROJECT_MANIFEST_PATH",
    "storyManifest",
    "parseStoryProjectManifest",
    "requiresInitialization: true",
    "initializeMissingManifest",
    "preserveExisting",
    "PlotPickle did not overwrite it",
    "manifest.canonicalProject.path",
    "repository.defaultBranch",
  ]) assert.ok(gateway.includes(contract), `Manifest detection is missing: ${contract}`);
  for (const phrase of [
    "Use existing project",
    "Create new story project",
    "Private by default",
    "Keep this story project private",
    "Initialize this repository",
    "Existing files are preserved",
    "plotpickle-project.json",
    "approved default branch",
  ]) assert.ok(component.includes(phrase), `Story project setup UI is missing: ${phrase}`);
  assert.match(component, /useState\(true\)/);
  assert.match(component, /\/api\/local-github-app\/create/);
  assert.match(component, /\/api\/local-github-app\/owners/);
});

test("issue #148 retains the schema, template source and implementation guide", async () => {
  const [schema, templateManifest, templateReadme, pullRequestTemplate, docs] = await Promise.all([
    source("schema/github-story-project-manifest.schema.json").then(JSON.parse),
    source("templates/github-story-project/plotpickle-project.json").then(JSON.parse),
    source("templates/github-story-project/README.md"),
    source("templates/github-story-project/.github/pull_request_template.md"),
    source("docs/issue-148-automatic-story-project-setup.md"),
  ]);
  assert.equal(schema.properties.format.const, "plotpickle-story-project");
  assert.equal(schema.properties.formatVersion.const, "1.0.0");
  assert.equal(schema.properties.schemaVersion.const, "2.3.0");
  assert.equal(templateManifest.canonicalProject.path, "stories/plotpickle-story.ppf");
  assert.match(templateReadme, /PLOTPICKLE_GITHUB_TEMPLATE_REPOSITORY/);
  assert.match(pullRequestTemplate, /PlotPickle Story Proposal/);
  for (const phrase of ["Configured GitHub template", "Built-in bootstrap", "Administration: Read and write", "incompatible manifest is never overwritten", "Phase 3"]) {
    assert.ok(docs.includes(phrase), `Phase 2 documentation is missing: ${phrase}`);
  }
});

test("issue #148 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-148-automatic-story-project-setup\.test\.mjs/);
  assert.equal(packageJson.scripts["test:automatic-story-project"], "node --test tests/issue-148-automatic-story-project-setup.test.mjs");
});
