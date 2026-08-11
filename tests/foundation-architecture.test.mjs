import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the reset locks the LEARN-first three-column product entry", async () => {
  const architecture = await read("docs/architecture/MODULAR-FOUNDATION.md");
  assert.match(architecture, /Left: curriculum only/);
  assert.match(architecture, /Centre: the active lesson/);
  assert.match(architecture, /Right: a persistent Creative Room/);
  assert.match(architecture, /new installation opens empty/i);
});

test("foundation modules declare small public contracts", async () => {
  const [contract, learn, room] = await Promise.all([
    read("core/contracts/module.ts"),
    read("modules/learn/manifest.ts"),
    read("modules/creative-room/manifest.ts"),
  ]);
  assert.match(contract, /FoundationModuleId = "learn" \| "creative-room"/);
  assert.match(learn, /id: "learn"/);
  assert.match(room, /id: "creative-room"/);
  assert.match(learn, /dependencies: \[\]/);
  assert.match(room, /dependencies: \[\]/);
});

test("modules import only public core contracts", async () => {
  for (const path of ["modules/learn/manifest.ts", "modules/creative-room/manifest.ts"]) {
    const source = await read(path);
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    assert.ok(imports.length > 0, `${path} should use a public contract`);
    assert.ok(imports.every((specifier) => specifier.startsWith("../../core/contracts/")));
  }
});

test("one canonical project carries lesson and Creative Room state", async () => {
  const [project, commands, reducer, storage] = await Promise.all([
    read("core/project/project.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
    read("core/storage/project-store.ts"),
  ]);
  assert.match(project, /activeLessonId/);
  assert.match(project, /threadId/);
  assert.match(commands, /lesson\.complete/);
  assert.match(reducer, /revision: project\.revision \+ 1/);
  assert.match(storage, /expectedRevision/);
});
