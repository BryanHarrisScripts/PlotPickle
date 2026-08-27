import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

const moved = [
  ["build/afterglow-project-gateway.ts", "build/projects/afterglow-project-gateway.ts"],
  ["build/portable-ppf-reader.ts", "build/projects/portable-ppf-reader.ts"],
];

test("#1462 Projects batch retires flat build sources into the ratified domain without compatibility shims", async () => {
  for (const [source, target] of moved) {
    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the move`);
    await access(new URL(target, root));
  }

  const [vite, foundations, library, decisions] = await Promise.all([
    read("vite.config.ts"),
    read("build/foundations-ppf-gateway.ts"),
    read("build/library-ppf-import-gateway.ts"),
    read("build/story-decisions/gateway.ts"),
  ]);
  assert.match(vite, /\.\/build\/projects\/afterglow-project-gateway/);
  assert.match(foundations, /\.\/projects\/portable-ppf-reader/);
  assert.match(library, /\.\/projects\/portable-ppf-reader/);
  assert.match(decisions, /\.\.\/projects\/portable-ppf-reader/);
  for (const source of [vite, foundations, library, decisions]) {
    assert.doesNotMatch(source, /build\/afterglow-project-gateway|(?:\.\/|\.\.\/)portable-ppf-reader["']/);
  }
});

test("#1462 Projects move preserves the Afterglow and local PPF runtime/security contracts", async () => {
  const [afterglow, reader] = await Promise.all([
    read("build/projects/afterglow-project-gateway.ts"),
    read("build/projects/portable-ppf-reader.ts"),
  ]);
  assert.match(afterglow, /const API = "\/api\/local-afterglow"/);
  assert.match(afterglow, /isLoopback/);
  assert.match(afterglow, /readOnly: true/);
  assert.match(afterglow, /response, 403/);
  assert.match(reader, /MAX_LOCAL_PPF_BYTES = 48 \* 1024 \* 1024/);
  assert.match(reader, /isLocalPlotPickleRequest/);
  assert.match(reader, /parsePortableProjectFile/);
  assert.match(reader, /projectFromPackage/);
});

test("#1462 architecture inventory records the Projects batch as completed rather than weakening empty-batch validation", async () => {
  const [configText, inventory] = await Promise.all([
    read("config/repository-architecture-target.json"),
    read("scripts/repository-architecture-inventory.mjs"),
  ]);
  const config = JSON.parse(configText);
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-projects");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, moved.map(([source]) => source));
  assert.deepEqual(batch?.completedTargets, moved.map(([, target]) => target));
  assert.match(inventory, /Completed move source still exists/);
  assert.match(inventory, /Completed move target does not exist/);
  assert.match(inventory, /batch\.status === "completed"/);
});
