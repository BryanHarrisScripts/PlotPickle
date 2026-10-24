import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { inventoryFactoryStorage, previewFactoryRetention } from "../scripts/engineering-team/queue/storage/inventory.mjs";
import { factoryStorageRoots, planFactoryStorageRoots } from "../scripts/engineering-team/queue/storage/report.mjs";

async function sandbox(fn) {
  const base = await mkdtemp(path.join(os.tmpdir(), "pp-storage-3241-"));
  try { await fn(base); } finally { await rm(base, { recursive: true, force: true }); }
}
const selection = (directory, kind = "factory") => [{ id: "test-root", kind, directory }];

test("#3241 inventory reports exact apparent lengths, immediate children and hard-link-aware totals without mutation", () => sandbox(async base => {
  const root = path.join(base, "factory");
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "receipt.json"), "KEEP");
  await writeFile(path.join(root, "queue.json"), "12345");
  await link(path.join(root, "queue.json"), path.join(root, "queue-copy.json"));
  const progress = [];
  const r = await inventoryFactoryStorage({ roots: selection(root), onProgress: v => progress.push(v) });
  assert.equal(r.roots[0].state, "COMPLETE");
  assert.equal(r.roots[0].apparentBytes, "14");
  assert.equal(r.roots[0].uniqueFileBytes, "9");
  assert.equal(r.roots[0].files, 3);
  assert.deepEqual(r.roots[0].children.map(c => c.name), ["evidence", "queue-copy.json", "queue.json"]);
  assert.equal(r.roots[0].children.find(c => c.name === "evidence").apparentBytes, "4");
  assert.ok(r.roots[0].children.every(c => /^\d+$/u.test(c.modifiedAtMs)));
  assert.equal(r.bytesAreReclaimable, false);
  assert.equal(r.cleanupAuthorized, false);
  assert.ok(progress.length > 0);
  assert.equal(JSON.stringify([r, progress]).includes(base), false);
  assert.equal(await readFile(path.join(root, "evidence", "receipt.json"), "utf8"), "KEEP");
  assert.deepEqual((await readdir(root)).sort(), ["evidence", "queue-copy.json", "queue.json"]);
}));

test("#3241 never traverses outside junctions or accepts a redirected root or ancestor", () => sandbox(async base => {
  const root = path.join(base, "factory"), outside = path.join(base, "outside");
  await mkdir(root); await mkdir(path.join(outside, "nested"), { recursive: true });
  await writeFile(path.join(outside, "nested", "private"), "DO_NOT_COUNT");
  await symlink(outside, path.join(root, "redirect"), "junction");
  const r = await inventoryFactoryStorage({ roots: selection(root) });
  assert.equal(r.roots[0].apparentBytes, "0");
  assert.equal(r.roots[0].skippedLinks, 1);
  assert.equal(r.roots[0].children[0].files, 0);
  for (const directory of [path.join(root, "redirect"), path.join(root, "redirect", "nested")]) {
    const denied = await inventoryFactoryStorage({ roots: selection(directory) });
    assert.equal(denied.roots[0].state, "BLOCKED");
    assert.equal(denied.roots[0].files, 0);
    assert.equal(denied.visitedEntries, 0);
  }
  assert.equal(await readFile(path.join(outside, "nested", "private"), "utf8"), "DO_NOT_COUNT");
}));

test("#3241 limits are global and partial totals cannot become cleanup candidates", () => sandbox(async base => {
  const roots = [path.join(base, "first"), path.join(base, "second")];
  for (const root of roots) { await mkdir(root); for (let i = 0; i < 4; i++) await writeFile(path.join(root, `${i}.txt`), "abc"); }
  const result = await inventoryFactoryStorage({ roots: roots.map((directory, i) => ({ id: `root-${i}`, kind: "runtimes", directory })), maxEntries: 2 });
  assert.equal(result.visitedEntries, 2);
  assert.equal(result.roots[0].state, "PARTIAL");
  assert.equal(result.roots[0].apparentBytes, "6");
  assert.equal(result.roots[1].state, "PARTIAL");
  assert.equal(previewFactoryRetention(result).candidates.length, 0);
  let clock = 0;
  const timed = await inventoryFactoryStorage({ roots: selection(roots[0]), maxDurationMs: 2, now: () => clock++ });
  assert.equal(timed.roots[0].state, "PARTIAL");
  assert.equal(timed.roots[0].code, "TIME_LIMIT_REACHED");
  await mkdir(path.join(roots[0], "deep", "child"), { recursive: true });
  const deep = await inventoryFactoryStorage({ roots: selection(roots[0]), maxDepth: 1 });
  assert.equal(deep.roots[0].state, "PARTIAL");
  assert.equal(deep.roots[0].code, "DEPTH_LIMIT_REACHED");
}));

test("#3241 missing roots, unsafe/overlapping selections and observer failures remain explicit", () => sandbox(async base => {
  const missing = await inventoryFactoryStorage({ roots: selection(path.join(base, "missing")) });
  assert.equal(missing.roots[0].state, "MISSING");
  await assert.rejects(inventoryFactoryStorage({ roots: selection("relative") }), /STORAGE_SELECTION_INVALID/u);
  await assert.rejects(inventoryFactoryStorage({ roots: [...selection(base), { id: "nested", kind: "factory", directory: path.join(base, "child") }] }), /STORAGE_ROOTS_OVERLAP/u);
  await writeFile(path.join(base, "file"), "x");
  const r = await inventoryFactoryStorage({ roots: selection(base), onProgress: () => { throw Error("OBSERVER_FAILURE"); } });
  assert.equal(r.roots[0].state, "COMPLETE");
  assert.equal(r.roots[0].files, 1);
  assert.equal(r.progressObserverErrors, 1);
}));

test("#3241 retention protects active, fallback, ten selected histories, references and all unidentified Factory content", () => {
  const names = Array.from({ length: 15 }, (_, i) => `${(i + 1).toString(16).padStart(20, "0")}-win32-x64`);
  const child = name => ({ name, apparentBytes: "2048", directories: 1, files: 1, errors: 0, skippedLinks: 0 });
  const inventory = { roots: [
    { id: "runtime", kind: "runtimes", state: "COMPLETE", children: [...names.map(child), child("curriculum-rag"), child("pi-durable-special")] },
    { id: "factory", kind: "factory", state: "COMPLETE", children: [child("evidence"), child("projects"), child("chat-candidate-stages"), child("unidentified")] },
    { id: "cache", kind: "npm-cache", state: "COMPLETE", children: [child("_cacache")] },
  ] };
  assert.equal(previewFactoryRetention(inventory).candidates.length, 0);
  const reference = { referencesVerified: true, activeRuntime: names[0], fallbackRuntime: names[1],
    retainedHistorical: names.slice(2, 12), referencedRuntimes: [names[12]], ownedRuntimes: names.slice(0, 14) };
  const r = previewFactoryRetention(inventory, reference);
  assert.deepEqual(r.candidates.map(c => c.name), [names[13]]);
  assert.ok(r.kept.some(c => c.name === names[14] && c.reason === "RUNTIME_OWNERSHIP_UNVERIFIED"));
  assert.equal(r.mode, "DRY_RUN");
  assert.equal(r.deletionImplemented, false);
  assert.equal(r.cleanupAuthorized, false);
  assert.equal(r.estimatedReclaimedBytes, null);
  for (const change of [{ referencesVerified: false }, { retainedHistorical: null },
    { retainedHistorical: [names[0], ...names.slice(3, 12)] }, { fallbackRuntime: names[0] }, { ownedRuntimes: [] }])
    assert.equal(previewFactoryRetention(inventory, { ...reference, ...change }).candidates.length, 0);
  inventory.roots[0].state = "PARTIAL";
  assert.equal(previewFactoryRetention(inventory, reference).candidates.length, 0);
});

test("#3241 report confines discovery to operational roots and never includes profiles, media or projects", () => {
  const appHome = path.resolve("test-app-home"), repoRoot = path.resolve("test-repo-root");
  const roots = factoryStorageRoots({ appHome, repoRoot });
  assert.deepEqual(roots.map(r => r.directory), [path.join(appHome, "runtimes"), path.join(appHome, "npm-cache"),
    path.join(appHome, "engineering-team"), path.join(repoRoot, ".artifacts")]);
});

test("#3241 real CLI works when an isolated Windows-style app home is nested beneath repository artifacts", async () => {
  const repoRoot = fileURLToPath(new URL("../", import.meta.url));
  const appHome = path.join(repoRoot, ".artifacts", "engineering-localappdata", "PlotPickle");
  const plan = planFactoryStorageRoots({ appHome, repoRoot });
  assert.deepEqual(plan.roots.map(r => r.id), ["runtimes", "npm-cache", "engineering-team"]);
  assert.deepEqual(plan.excludedRoots, [{ id: "repository-artifacts", code: "BROADER_OPERATIONAL_ROOT_OMITTED" }]);
  const report = fileURLToPath(new URL("../scripts/engineering-team/queue/storage/report.mjs", import.meta.url));
  const { stdout } = await promisify(execFile)(process.execPath, [report], {
    env: { ...process.env, PLOTPICKLE_HOME: appHome }, timeout: 15000, maxBuffer: 262144, windowsHide: true,
  });
  const observed = JSON.parse(stdout);
  assert.equal(observed.retention.cleanupAuthorized, false);
  assert.equal(observed.retention.candidates.length, 0);
  assert.deepEqual(observed.excludedRoots, plan.excludedRoots);
  assert.equal(JSON.stringify(observed).includes(repoRoot), false);
});
