import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function exampleContract() {
  const sourceText = await source("lib/afterglow-example.ts");
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  const originalProjectId = "afterglow-echoes-of-sentience";
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require(specifier) {
      if (specifier === "./afterglow-persistence") {
        return {
          AFTERGLOW_PROJECT_ID: originalProjectId,
          AFTERGLOW_PROJECT_TITLE: "Afterglow: Reflections of Sentience",
        };
      }
      if (specifier === "./project") {
        return {
          cloneProject: (value) => JSON.parse(JSON.stringify(value)),
          createBlankCollaboration: () => ({
            provider: "none",
            repositoryUrl: "",
            sourceRepositoryUrl: "",
            owner: "",
            repo: "",
            branch: "main",
            projectPath: "",
            syncEnabled: false,
            lastPulledCommit: "",
            lastPushedCommit: "",
            connectedAt: "",
            updatedAt: "2026-08-02T20:00:00.000Z",
          }),
        };
      }
      throw new Error(`Unexpected test import: ${specifier}`);
    },
    Math,
    Date,
  });
  return runtimeModule.exports;
}

function exampleProject() {
  return {
    id: "afterglow-echoes-of-sentience",
    metadata: {
      title: "Afterglow: Reflections of Sentience",
      subtitle: "A 24 Blocks story project",
      status: "Imported",
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
    },
    story: { premise: "Example canon" },
    characters: [{ id: "ren", name: "Ren" }],
    blocks: [{ id: "block-01", number: 1 }],
    collaboration: {
      provider: "github",
      owner: "BryanHarrisScripts",
      repo: "Afterglow-Echoes-of-Sentience",
      branch: "main",
      syncEnabled: true,
    },
    extensions: { retained: { value: true } },
  };
}

test("phase 5 creates an independent editable copy with a new identity and no repository destination", async () => {
  const contract = await exampleContract();
  const example = exampleProject();
  const before = JSON.stringify(example);
  const copy = contract.createAfterglowEditableCopy(example, {
    id: "afterglow-copy-test",
    now: "2026-08-02T20:30:00.000Z",
    title: "My Afterglow Study",
  });

  assert.equal(JSON.stringify(example), before, "The bundled example was mutated");
  assert.equal(copy.id, "afterglow-copy-test");
  assert.equal(copy.metadata.title, "My Afterglow Study");
  assert.equal(copy.metadata.subtitle, "Personal PlotPickle project copied from the Afterglow example");
  assert.equal(copy.metadata.status, "Planning");
  assert.equal(copy.metadata.createdAt, "2026-08-02T20:30:00.000Z");
  assert.notStrictEqual(copy.story, example.story);
  assert.deepEqual(JSON.parse(JSON.stringify(copy.collaboration)), {
    provider: "none",
    repositoryUrl: "",
    sourceRepositoryUrl: "",
    owner: "",
    repo: "",
    branch: "main",
    projectPath: "",
    syncEnabled: false,
    lastPulledCommit: "",
    lastPushedCommit: "",
    connectedAt: "",
    updatedAt: "2026-08-02T20:00:00.000Z",
  });
  assert.equal(copy.extensions[contract.AFTERGLOW_EXAMPLE_SOURCE_EXTENSION].projectId, example.id);
  assert.equal(copy.extensions[contract.AFTERGLOW_EXAMPLE_SOURCE_EXTENSION].readOnlySource, true);
  assert.equal(contract.isAfterglowExampleProject(example), true);
  assert.equal(contract.isAfterglowExampleProject(copy), false);
  assert.equal(contract.isAfterglowDerivedCopy(copy), true);
  assert.equal(contract.afterglowCopyFileName(copy), "afterglow-copy-test.ppf");
  assert.throws(
    () => contract.createAfterglowEditableCopy(example, { id: example.id }),
    /new project ID/i,
  );
  assert.throws(
    () => contract.createAfterglowEditableCopy({ ...example, id: "another-project" }),
    /Only the bundled Afterglow example/i,
  );
});

test("phase 5 makes the fixed-ID example read-only and preserves legacy work as a recovered copy", async () => {
  const page = await source("app/page.tsx");
  for (const contract of [
    "AFTERGLOW_EXAMPLE_ACTIVE_KEY",
    "A previously editable Afterglow project was preserved as a new local copy",
    "createAfterglowEditableCopy(normalized, { title:",
    "Read-only PlotPickle example",
    "isAfterglowExampleProject(project) && isAfterglowExampleProject(next)",
    "Choose Make My Own Copy before changing canon, images, dialogue or project settings",
    "window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createAfterglowProject()))",
    "Replace the current project with the read-only Afterglow example",
  ]) assert.ok(page.includes(contract), `Missing read-only or migration contract: ${contract}`);

  assert.doesNotMatch(page, /useAfterglowPersistence|afterglowPersistence\.|toggleAfterglowGitHub/);
  assert.doesNotMatch(page, /\/api\/local-afterglow\/(?:enable|disable)/);
});

test("phase 5 saves Make My Own Copy through the normal local project service before opening it", async () => {
  const page = await source("app/page.tsx");
  for (const contract of [
    "async function saveProjectToLocalLibrary",
    'fetch("/api/local-projects/save"',
    "fileName: afterglowCopyFileName(next)",
    "async function makeAfterglowCopy",
    "createAfterglowEditableCopy(project)",
    "await saveProjectToLocalLibrary(copy)",
    "setProject(copy)",
    "new project ID, local PPF and rolling-backup path",
    "No GitHub repository is connected until you choose one",
  ]) assert.ok(page.includes(contract), `Missing copy workflow contract: ${contract}`);
  assert.ok(page.indexOf("await saveProjectToLocalLibrary(copy)") < page.indexOf("setProject(copy)"));
});

test("phase 5 exposes View, Copy, Reset and sample Graphic Novel actions without an original-repository switch", async () => {
  const [banner, dashboard] = await Promise.all([
    source("app/afterglow-example-boundary.tsx"),
    source("app/dashboard-command-centre.tsx"),
  ]);
  for (const phrase of [
    "Afterglow — PlotPickle Example Story",
    "Make My Own Copy",
    "Open Sample Graphic Novel",
    "Reset Example",
    "read-only",
  ]) assert.ok(`${banner}\n${dashboard}`.includes(phrase), `Missing example action or label: ${phrase}`);
  assert.match(dashboard, /Example source only — never a user destination/);
  assert.match(dashboard, /No edits, autosaves, pulls or publishes are allowed/);
  assert.doesNotMatch(`${banner}\n${dashboard}`, /Use the example’s GitHub working copy|role="switch"|type="checkbox"/);
});

test("phase 5 locks the original Afterglow gateway and removes credential or write paths", async () => {
  const gateway = await source("build/afterglow-project-gateway.ts");
  for (const contract of [
    'const API = "/api/local-afterglow"',
    'request.method === "GET"',
    "readOnly: true",
    "Make My Own Copy",
    "response, 409",
    "cannot be enabled as a working project",
    "without an Afterglow repository destination",
  ]) assert.ok(gateway.includes(contract), `Missing locked gateway contract: ${contract}`);
  assert.doesNotMatch(gateway, /readCredentialJson|writeState|mkdir|rename|\/api\/local-github-sync|github-connection\.json/);
});

test("phase 5 removes the old persistence hook while retaining the focused regression entry", async () => {
  await assert.rejects(access(new URL("app/use-afterglow-persistence.ts", root)));
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-190-afterglow-persistence\.test\.mjs/);
  assert.equal(
    packageJson.scripts["test:afterglow-persistence"],
    "node --test tests/issue-190-afterglow-persistence.test.mjs",
  );
});
