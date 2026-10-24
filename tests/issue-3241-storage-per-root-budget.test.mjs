import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inventoryFactoryStoragePerRoot } from "../scripts/engineering-team/queue/storage/report.mjs";
import { previewFactoryRetention } from "../scripts/engineering-team/queue/storage/inventory.mjs";

const roots = ["runtimes", "npm-cache", "engineering-team", "repository-artifacts"]
  .map((id, i) => ({ id, kind: ["runtimes", "npm-cache", "factory", "artifacts"][i],
    directory: path.resolve("disposable", id) }));

test("#3241 timeout in runtimes does not starve later operational roots", async () => {
  const called = [], progress = [];
  const snapshot = await inventoryFactoryStoragePerRoot({
    roots, maxEntriesPerRoot: 31, maxDurationMsPerRoot: 7,
    onProgress: item => progress.push(item.rootId),
    scan: async ({ roots: selection, maxEntries, maxDurationMs, onProgress }) => {
      assert.equal(selection.length, 1);
      assert.equal(maxEntries, 31);
      assert.equal(maxDurationMs, 7);
      const root = selection[0];
      called.push(root.id);
      onProgress({ rootId: root.id, visitedEntries: 1, apparentBytes: "10" });
      return {
        schemaVersion: 1, startedAt: called.length, completedAt: called.length + 1,
        visitedEntries: 1, progressObserverErrors: 0,
        roots: [{ id: root.id, kind: root.kind,
          state: called.length === 1 ? "PARTIAL" : "COMPLETE",
          code: called.length === 1 ? "TIME_LIMIT_REACHED" : "INVENTORY_COMPLETE",
          children: [] }],
        metadataOnly: true, cleanupAuthorized: false, bytesAreReclaimable: false,
        measurement: "Synthetic metadata only.",
      };
    },
  });
  assert.deepEqual(called, roots.map(root => root.id));
  assert.deepEqual(progress, called);
  assert.deepEqual(snapshot.roots.map(root => root.state),
    ["PARTIAL", "COMPLETE", "COMPLETE", "COMPLETE"]);
  assert.equal(snapshot.visitedEntries, 4);
  assert.equal(snapshot.limits.rootsPlanned, 4);
  assert.equal(snapshot.limits.maxDurationMsPerRoot, 7);
  assert.equal(snapshot.metadataOnly, true);
  assert.equal(snapshot.cleanupAuthorized, false);
  assert.equal(snapshot.bytesAreReclaimable, false);
  assert.match(snapshot.measurement, /independent bounded scan budget/u);
  assert.equal(previewFactoryRetention(snapshot).candidates.length, 0);
});

test("#3241 real metadata inventory scans each small root and never changes content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-storage-roots-"));
  try {
    const names = ["runtimes", "npm-cache", "engineering-team", "repository-artifacts"];
    const entries = [];
    for (const [i, name] of names.entries()) {
      const directory = path.join(root, name);
      await mkdir(directory);
      await writeFile(path.join(directory, "keep.txt"), `KEEP-${i}`);
      entries.push({ id: name, kind: roots[i].kind, directory });
    }
    const result = await inventoryFactoryStoragePerRoot({
      roots: entries, maxDurationMsPerRoot: 5000, maxEntriesPerRoot: 1000,
    });
    assert.deepEqual(result.roots.map(item => item.state), names.map(() => "COMPLETE"));
    assert.deepEqual(result.roots.map(item => item.files), names.map(() => 1));
    assert.equal(result.visitedEntries, 4);
    assert.equal(result.cleanupAuthorized, false);
    assert.equal(result.bytesAreReclaimable, false);
    for (const [i, entry] of entries.entries())
      assert.equal(await readFile(path.join(entry.directory, "keep.txt"), "utf8"), `KEEP-${i}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#3241 refuses invalid selection or unverified scanner evidence without promoting status", async () => {
  await assert.rejects(inventoryFactoryStoragePerRoot({ roots: [] }), /STORAGE_SELECTION_INVALID/u);
  await assert.rejects(inventoryFactoryStoragePerRoot({ roots: [roots[0], roots[0]] }), /STORAGE_SELECTION_INVALID/u);
  await assert.rejects(inventoryFactoryStoragePerRoot({ roots, maxDurationMsPerRoot: 120001 }),
    /STORAGE_SELECTION_INVALID/u);
  await assert.rejects(inventoryFactoryStoragePerRoot({
    roots: roots.slice(0, 1),
    scan: async () => ({ roots: [{ id: "runtimes", state: "COMPLETE" }],
      metadataOnly: true, cleanupAuthorized: true, bytesAreReclaimable: false }),
  }), /STORAGE_REPORT_UNVERIFIED/u);
});
