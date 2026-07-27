import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("issue #124 makes Build the only full structural arrangement workspace", async () => {
  const [build, engines, page, readme] = await Promise.all([
    source("app/build-workspace.tsx"),
    source("app/engine-hub.tsx"),
    source("app/page.tsx"),
    source("README.md"),
  ]);
  assert.match(build, /Arrange the film/);
  assert.match(build, /24-Block and 96-mini-block structure/);
  assert.doesNotMatch(engines, /title: "Structure Engine"/);
  assert.doesNotMatch(engines, /href: "\/structure"/);
  assert.match(engines, /Build owns arrangement\. Refine reads the same structure for diagnosis\./);
  assert.match(engines, /onOpenBuild/);
  assert.match(page, /<EngineHub onOpenBuild=/);
  assert.match(readme, /Structural arrangement belongs only to Build/);
});

test("issue #124 moves all mini-blocks through one stable-ID canonical ordering path", async () => {
  const [order, wall] = await Promise.all([
    source("lib/mini-block-wall-order.ts"),
    source("app/mini-block-wall.tsx"),
  ]);
  for (const contract of [
    "canonicalMiniBlockOrder",
    "applyCanonicalMiniBlockOrder",
    "moveCanonicalMiniBlock",
    "orderedMiniBlockIds",
    "miniBlockById",
    "id: miniBlock.id",
    "assignedByScene",
    "blockNumber: position.blockNumber",
    "miniBlockNumber: position.miniBlockNumber",
    "sceneId: position.sceneId",
    "frameOwnerById",
    "screenplayOwnerById",
    "shotOwnerById",
    "feedbackThreadAtPosition",
  ]) assert.ok(order.includes(contract), `Mini-block movement is missing: ${contract}`);
  assert.doesNotMatch(order, /randomUUID|makeId|miniBlockDatabase|wallRecords/);
  for (const contract of [
    "draggable",
    "onDragStart",
    "onDragOver",
    "onDrop",
    "onDragEnd",
    "application/x-plotpickle-mini-block",
    "moveMiniBlock(sourceId, card.id)",
    "Drag",
  ]) assert.ok(wall.includes(contract), `Pointer movement is missing: ${contract}`);
});

test("issue #124 supplies equivalent keyboard movement with bounded undo redo", async () => {
  const wall = await source("app/mini-block-wall.tsx");
  for (const contract of [
    "Move earlier",
    "Move later",
    "Position",
    "Undo move",
    "Redo move",
    "undoOrders",
    "redoOrders",
    "orders.slice(-19)",
    "canonicalMiniBlockOrder(project)",
    "applyCanonicalMiniBlockOrder(project, previousOrder)",
    "applyCanonicalMiniBlockOrder(project, nextOrder)",
  ]) assert.ok(wall.includes(contract), `Keyboard movement or history is missing: ${contract}`);
  assert.match(wall, /role="status"/);
  assert.match(wall, /aria-live="polite"/);
  assert.match(wall, /aria-label=\{`Mini-block/);
});

test("issue #124 hardens autosave recovery and destructive restore", async () => {
  const [recovery, build, wall] = await Promise.all([
    source("lib/build-recovery.ts"),
    source("app/build-workspace.tsx"),
    source("app/mini-block-wall.tsx"),
  ]);
  for (const contract of [
    "BUILD_RECOVERY_STORAGE_PREFIX",
    "captureArrangementRecovery",
    "loadArrangementRecovery",
    "normalizePlotPickleProject",
    "window.localStorage.setItem",
  ]) assert.ok(recovery.includes(contract), `Build recovery is missing: ${contract}`);
  assert.match(build, /captureArrangementRecovery\(project, "block-move"\)/);
  assert.match(wall, /captureArrangementRecovery\(project, "mini-block-move"\)/);
  assert.match(build, /window\.confirm/);
  assert.match(wall, /window\.confirm/);
  assert.match(build + wall, /Restore last arrangement/);
  assert.doesNotMatch(recovery, /apiKey|accessToken|refreshToken|clientSecret/);
});

test("issue #124 deduplicates diagnostics and hardens the complete 96-card surface", async () => {
  const [model, wall, css] = await Promise.all([
    source("lib/mini-block-wall.ts"),
    source("app/mini-block-wall.tsx"),
    source("app/mini-block-wall.module.css"),
  ]);
  assert.match(model, /new Map\(warnings\.map/);
  assert.match(model, /\$\{item\.kind\}:\$\{item\.targetId\}:\$\{item\.miniBlockId\}:\$\{item\.message\}/);
  assert.match(wall, /loading="lazy"/);
  assert.match(wall, /decoding="async"/);
  assert.match(css, /content-visibility:auto/);
  assert.match(css, /contain-intrinsic-size/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
});

test("issue #124 audits stable story-thread and character-arc scene references after movement", async () => {
  const order = await source("lib/mini-block-wall-order.ts");
  for (const contract of [
    "miniBlockReferenceAudit",
    "project.storyThreads",
    "thread.sceneIds",
    "project.characters",
    "character.arcMatrix.checkpoints",
    "danglingStoryThreadSceneIds",
    "danglingCharacterArcSceneIds",
    "previousPositions",
  ]) assert.ok(order.includes(contract), `Reference audit is missing: ${contract}`);
});

test("issue #124 documents the no-duplication and privacy boundaries", async () => {
  const doc = await source("docs/issue-124-release-hardening.md");
  for (const phrase of [
    "Build is the only writer-facing structural arrangement workspace",
    "No Build-only or mini-block-only story database was added",
    "Connection credentials and tokens are not project fields",
    "Mini-block diagnostics are deduplicated",
    "No second screenplay, storyboard, Feedback, production, scene or mini-block model was introduced",
  ]) assert.ok(doc.includes(phrase), `Hardening documentation is missing: ${phrase}`);
});

test("issue #124 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-124-release-hardening\.test\.mjs/);
  assert.equal(packageJson.scripts["test:release-hardening"], "node --test tests/issue-124-release-hardening.test.mjs");
});
