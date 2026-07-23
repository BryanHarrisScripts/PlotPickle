import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const folder = await readFile(new URL("../lib/project-folder.ts", import.meta.url), "utf8");
const modules = await readFile(new URL("../lib/project-modules.ts", import.meta.url), "utf8");
const gateway = await readFile(new URL("../build/folder-project-gateway.ts", import.meta.url), "utf8");

test("Phase 3 registers independent story modules", () => {
  for (const moduleName of ["characters", "voiceprints", "screenplay", "structure", "miniBlocks", "storyboard", "production", "research", "canon", "imports", "plugins"]) {
    assert.match(modules, new RegExp(`key: \\\"${moduleName}\\\"`));
  }
  assert.match(modules, /dependencies:/);
  assert.match(modules, /collection:/);
});

test("characters, voiceprints and 24 Blocks serialize as individual files", () => {
  assert.match(modules, /characters\/\$\{stem\}\.json/);
  assert.match(modules, /voiceprints\/\$\{stem\}\.voice\.json/);
  assert.match(modules, /24-blocks\/block-/);
  assert.match(folder, /96-blocks\/block-/);
});

test("folder creation includes screenplay Fountain, canon and plugin registries", () => {
  assert.match(folder, /screenplay\/main\.fountain/);
  assert.match(folder, /canon\/continuity\.json/);
  assert.match(folder, /canon\/timeline\.json/);
  assert.match(folder, /canon\/glossary\.json/);
  assert.match(folder, /plugins\/registry\.json/);
  assert.match(folder, /research\/index\.json/);
});

test("Phase 2 folders migrate and unknown JSON modules remain harmless", () => {
  assert.match(folder, /manifest\.formatVersion === "2\.0\.0"/);
  assert.match(gateway, /collectFolderFiles/);
  assert.match(gateway, /entry\.name === "\.git"/);
  assert.match(gateway, /storage: "modular-folder"/);
});

test("module saves use a staged folder replacement", () => {
  assert.match(gateway, /temporaryFolder/);
  assert.match(gateway, /await rename\(temporaryFolder, folder\)/);
  assert.match(gateway, /createPortableProjectFile\(previous\)/);
});
