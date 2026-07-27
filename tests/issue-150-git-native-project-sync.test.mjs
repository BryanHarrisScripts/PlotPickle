import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function syncContract() {
  const raw = await source("lib/project-folder-sync.ts");
  const withoutRelativeImports = raw.replace(/import\s+(?:type\s+)?[\s\S]*?from\s+"\.\/[^\"]+";\n/g, "");
  const compiled = stripTypeScriptTypes(withoutRelativeImports, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("issue #150 produces deterministic text and SHA-256 file inventories", async () => {
  const contract = await syncContract();
  assert.equal(contract.deterministicJson({ z: 1, a: { y: 2, b: 3 } }), '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n');
  assert.equal(contract.deterministicText("A\r\nB\rC"), "A\nB\nC\n");
  assert.equal(contract.sha256Text("same"), contract.sha256Text("same"));
  assert.match(contract.sha256Text("same"), /^[a-f0-9]{64}$/);
  assert.equal(contract.safeProjectRoot("/project/"), "project");
  assert.throws(() => contract.safeProjectRoot("../project"), /safe repository folder/i);

  const fixed = "2026-07-27T00:00:00.000Z";
  const local = contract.inventoryFromContents({
    "project/manifest.json": '{"format":"plotpickle-project","formatVersion":"2.3.0"}\n',
    "project/story/premise.json": '{"premise":"local"}\n',
    "project/characters/new.json": '{"name":"New"}\n',
  }, "project", fixed);
  const remote = contract.inventoryFromContents({
    "project/manifest.json": '{"format":"plotpickle-project","formatVersion":"2.3.0"}\n',
    "project/story/premise.json": '{"premise":"remote"}\n',
    "project/review/old.json": '{}\n',
    "README.md": "unmanaged\n",
  }, "project", fixed);
  const diff = contract.diffProjectSyncInventories(local, remote);
  assert.deepEqual(diff.create.map((file) => file.path), ["project/characters/new.json"]);
  assert.deepEqual(diff.update.map((file) => file.path), ["project/story/premise.json"]);
  assert.deepEqual(diff.delete.map((file) => file.path), ["project/review/old.json"]);
  assert.equal(diff.unchanged.length, 1);
  assert.equal(diff.changedCount, 3);
  assert.equal(remote.files.some((file) => file.path === "README.md"), false);
});

test("issue #150 restricts deletions and rejects unsupported remote folders", async () => {
  const contract = await syncContract();
  assert.equal(contract.safeManagedDeletionPath("project/story/premise.json"), true);
  assert.equal(contract.safeManagedDeletionPath("README.md"), false);
  assert.equal(contract.safeManagedDeletionPath("project/../README.md"), false);
  assert.throws(() => contract.parseProjectSyncContents({}, "project"), /does not contain a canonical/i);
  assert.throws(() => contract.parseProjectSyncContents({
    "project/manifest.json": '{"format":"plotpickle-project","formatVersion":"99.0.0"}\n',
  }, "project"), /upgrade or migrate/i);
});

test("issue #150 uses one guarded Git tree and preserves unrelated repository content", async () => {
  const [gateway, syncSource] = await Promise.all([
    source("build/github-project-sync-gateway.ts"),
    source("lib/project-folder-sync.ts"),
  ]);
  for (const contract of [
    "/git/blobs",
    "/git/trees",
    "/git/commits",
    "/git/refs/heads/",
    "expectedRemoteCommit",
    "safeManagedDeletionPath",
    "base_tree",
    "force: false",
    "Remote divergence detected",
    "allowLegacyMigration",
    "migrationCompleted",
    "createPortableReleaseSnapshot",
    "exports/releases/",
  ]) assert.ok(`${gateway}\n${syncSource}`.includes(contract), `Git-native synchronization is missing: ${contract}`);
  assert.doesNotMatch(gateway, /Promise\.all\([^)]*(?:PUT|DELETE)/s);
  assert.match(gateway, /tree:\s+treeEntries/);
  assert.match(gateway, /parents:\s+\[remote\.commitSha\]/);
});

test("issue #150 exposes compare, review, migration and Project Lead publishing", async () => {
  const [collaboration, component, styles, docs] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("app/github-project-sync.tsx"),
    source("app/github-collaboration.module.css"),
    source("docs/issue-150-git-native-project-sync.md"),
  ]);
  assert.match(collaboration, /import GitHubProjectSync from "\.\/github-project-sync"/);
  assert.match(collaboration, /<GitHubProjectSync/);
  for (const phrase of [
    "Canonical Git synchronization",
    "Compare project files",
    "Get approved project folder",
    "Project Lead: publish approved version",
    "Approve legacy migration",
    "Create release snapshot only",
    "approved branch moved after this preview",
  ]) assert.ok(component.includes(phrase), `Synchronization UI is missing: ${phrase}`);
  for (const className of ["syncArchitecture", "syncPreview", "syncSummary", "syncPaths", "syncConsent", "syncMessage"]) {
    assert.ok(styles.includes(`.${className}`), `Synchronization styling is missing: ${className}`);
  }
  for (const phrase of ["canonical source of truth", "SHA-256", "one atomic commit", "Legacy .ppf migration", "Remote divergence", "release snapshots"]) {
    assert.ok(docs.includes(phrase), `Phase 3 documentation is missing: ${phrase}`);
  }
});

test("issue #150 promotes project/ to canonical and keeps .ppf as exchange", async () => {
  const [schema, templateManifest, repositorySource, vite] = await Promise.all([
    source("schema/github-story-project-manifest.schema.json").then(JSON.parse),
    source("templates/github-story-project/plotpickle-project.json").then(JSON.parse),
    source("lib/story-project-repository.ts"),
    source("vite.config.ts"),
  ]);
  assert.equal(schema.properties.formatVersion.const, "1.1.0");
  assert.equal(schema.properties.canonicalProject.properties.mode.const, "modular-folder");
  assert.equal(schema.properties.canonicalProject.properties.root.const, "project");
  assert.equal(templateManifest.canonicalProject.mode, "modular-folder");
  assert.equal(templateManifest.canonicalProject.root, "project");
  assert.equal(templateManifest.portableExchange.mode, "ppf");
  assert.match(repositorySource, /STORY_PROJECT_FORMAT_VERSION = "1\.1\.0"/);
  assert.match(repositorySource, /mode: "modular-folder"/);
  assert.match(repositorySource, /portableExchange/);
  assert.match(vite, /githubProjectSyncGateway\(\)/);
});

test("issue #150 leaves no temporary write-enabled integration workflow", async () => {
  for (const filePath of [
    ".github/workflows/phase-3-integrate.yml",
    ".github/workflows/phase-3-source-integrate.yml",
  ]) {
    await assert.rejects(source(filePath), /ENOENT/);
  }
  const quality = await source(".github/workflows/quality.yml");
  assert.match(quality, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(quality, /git push|contents: write|Apply Phase 3 integration patch/);
});

test("issue #150 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-150-git-native-project-sync\.test\.mjs/);
  assert.equal(packageJson.scripts["test:git-native-sync"], "node --test tests/issue-150-git-native-project-sync.test.mjs");
});
