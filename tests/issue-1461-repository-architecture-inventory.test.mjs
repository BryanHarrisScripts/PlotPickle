import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runRepositoryArchitectureInventory } from "../scripts/repository-architecture-inventory.mjs";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#1461 inventories repository breadth, fan-out and depth without treating hotspots as runtime failure", async () => {
  const report = await runRepositoryArchitectureInventory({ writeArtifact: false });
  assert.equal(report.status, "ratified-plan-ready", JSON.stringify(report.planIssues, null, 2));
  assert.equal(report.planIssues.length, 0);
  assert.ok(report.repository.fileCount > 0);
  assert.ok(report.repository.directoryCount > 0);

  const roots = new Map(report.topLevel.map((item) => [item.directory, item]));
  for (const root of ["app", "core", "modules", "lib", "build", "scripts", "tests", "docs", "public"]) {
    assert.ok(roots.has(root), `${root}/ must appear in the complete top-level inventory`);
  }
  for (const generated of [".sites-runtime", ".vinext", ".next", "node_modules", ".artifacts"]) {
    assert.equal(roots.has(generated), false, `${generated}/ is generated runtime/build state and must not contaminate repository architecture evidence`);
  }

  const build = roots.get("build");
  assert.ok(build.directSourceFiles >= 18, `build/ should remain evidenced as a flat-root hotspot until Phase 1; saw ${build.directSourceFiles}`);
  assert.ok(report.hotspots.some((item) => item.path === "build" && item.type === "flat-root"));
});

test("#1461 ratifies deterministic bounded structural batches for Architecture Phases 1 through 4", async () => {
  const report = await runRepositoryArchitectureInventory({ writeArtifact: false });
  const phases = new Set(report.batches.map((batch) => batch.phase));
  assert.deepEqual([...phases].sort(), [1, 2, 3, 4]);
  assert.ok(report.batches.every((batch) => batch.moveCount > 0 || batch.status === "completed"), JSON.stringify(report.batches, null, 2));

  const completedProjects = report.batches.find((batch) => batch.id === "phase1-build-projects");
  assert.equal(completedProjects?.status, "completed");
  assert.equal(completedProjects?.moveCount, 0, "completed Project sources must no longer expand from build/");
  assert.equal(completedProjects?.completedTargetCount, 2);

  const sources = report.plannedMoves.map((move) => move.source);
  assert.equal(new Set(sources).size, sources.length, "one current source must not belong to multiple move batches");
  assert.ok(report.plannedMoves.every((move) => move.source !== move.target));
  assert.ok(report.plannedMoves.every((move) => Array.isArray(move.directImportConsumers) && Array.isArray(move.hardcodedPathConsumers)));

  const bridgeRetirement = report.plannedMoves.filter((move) => move.batchId === "phase4-retire-agent-compatibility-bridges");
  assert.ok(bridgeRetirement.length >= 1, "Phase 4 must keep inventorying any compatibility bridges that remain until the batch is marked completed");
  assert.ok(bridgeRetirement.every((move) => move.mode === "retire-bridge" && move.target.startsWith("lib/agents/")));
});

test("#1461 target architecture defines balanced ceilings and explicit semantic exceptions", async () => {
  const report = await runRepositoryArchitectureInventory({ writeArtifact: false });
  assert.equal(report.structuralCeilings.maxDirectSourceFiles, 16);
  assert.equal(report.structuralCeilings.maxDirectChildDirectories, 20);
  assert.equal(report.structuralCeilings.maxRelativeDepth, 4);
  assert.match(report.structuralCeilings.singleFileDirectoryRule, /stable route|package|protocol/i);

  const exceptions = new Map(report.structuralCeilings.exceptions.map((item) => [item.path, item.reason]));
  for (const path of ["app", "tests", "docs", "public", ".agents", ".github"]) assert.ok(exceptions.has(path));

  assert.ok(report.targetTree.build.includes("buzz/"));
  assert.ok(report.targetTree.build.includes("ai/"));
  assert.ok(report.targetTree.modules.includes("story-workflow/council/"));
  assert.ok(report.targetTree.modules.includes("story-workflow/decisions/"));
  assert.ok(report.targetTree.app.includes("<route directories stay in place>"));
});

test("#1461 human architecture map locks ownership, sequencing and no-behavior-change discipline", async () => {
  const architecture = await read("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.match(architecture, /Inventory before moving/);
  assert.match(architecture, /No production behavior changes/);
  assert.match(architecture, /build\/buzz/);
  assert.match(architecture, /story-workflow\/council/);
  assert.match(architecture, /app\/_components\/community/);
  assert.match(architecture, /compatibility bridge/i);
  assert.match(architecture, /Phase 5 enforcement/);
  assert.match(architecture, /exact-head/i);
});
