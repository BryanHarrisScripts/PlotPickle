import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inventoryRepositoryDependencyGraphs } from "../lib/verification/oss-dependency-inventory.mjs";

async function withRepository(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-oss-inventory-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("#3023 includes hidden nested locks and keeps missing licence and unresolved Python evidence visible", async () => {
  await withRepository(async (root) => {
    await mkdir(path.join(root, ".pi", "npm"), { recursive: true });
    await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ packages: {
      "": { name: "fixture" },
      "node_modules/linked": { link: true, resolved: "vendor/linked" },
      "vendor/linked": { name: "linked", version: "1.0.0", license: "MIT" },
    } }));
    await writeFile(path.join(root, ".pi/npm/package-lock.json"), JSON.stringify({ packages: {
      "node_modules/@fixture/package": { version: "2.0.0", integrity: "sha512-fixture", resolved: "https://fixture:private@example.invalid/package.tgz?token=private#private" },
    } }));
    await writeFile(path.join(root, "Cargo.lock"), 'version = 4\n[[package]]\nname = "fixture"\nversion = "3.0.0"\nchecksum = "fixture-digest"\n');
    await writeFile(path.join(root, "requirements.txt"), "numpy>=2,<3\nexact==1.0.0\n");
    const result = inventoryRepositoryDependencyGraphs(root, ["package-lock.json", ".pi/npm/package-lock.json", "Cargo.lock", "requirements.txt", "private-story.md"]);
    assert.equal(result.graphCount, 4);
    const nested = result.graphs.find((graph) => graph.source === ".pi/npm/package-lock.json");
    assert.equal(nested.records[0].name, "@fixture/package");
    assert.equal(nested.records[0].license, null);
    assert.equal(nested.records[0].disposition, "REVIEW_MISSING_LICENSE");
    assert.equal(nested.records[0].packageSource, "https://example.invalid/package.tgz");
    const linked = result.graphs.find((graph) => graph.source === "package-lock.json").records.find((record) => record.location === "node_modules/linked");
    assert.equal(linked.version, "1.0.0");
    assert.equal(linked.license, "MIT");
    const cargo = result.graphs.find((graph) => graph.kind === "cargo-lock");
    assert.equal(cargo.records[0].integrity, "fixture-digest");
    assert.equal(cargo.records[0].licenseEvidence, "UNKNOWN_NOT_IN_LOCK");
    const python = result.graphs.find((graph) => graph.kind === "python-requirements");
    assert.equal(python.records[0].version, null);
    assert.equal(python.records[0].disposition, "UNLOCKED_RANGE_REQUIRES_RESOLUTION");
    assert.equal(python.records[1].version, "1.0.0");
  });
});

test("#3023 malformed or unsupported graphs fail instead of claiming complete coverage", async () => {
  await withRepository(async (root) => {
    for (const [source, text] of [
      ["package-lock.json", '{"packages":[]}'],
      ["package-lock.json", '{"packages":{"node_modules/broken":null}}'],
      ["Cargo.lock", '[[package]]\nname = "missing-version"\n'],
      ["requirements.txt", "-r untracked-private-file.txt\n"],
      ["requirements.txt", "numpy this is not a requirement\n"],
      ["requirements.txt", "numpy==\n"],
      ["requirements.txt", "numpy=>2\n"],
      ["requirements.txt", "numpy>=2,wat\n"],
      ["requirements.txt", 'numpy==2; python_version>="3.10"\n'],
    ]) {
      await writeFile(path.join(root, source), text);
      assert.throws(() => inventoryRepositoryDependencyGraphs(root, [source]), /OSS dependency inventory/);
    }
  });
});

test("#3023 repository bounds reject traversal, Windows absolute paths and symlink escape", async () => {
  await withRepository(async (root) => {
    for (const source of ["../package-lock.json", "C:\\private\\package-lock.json", "/private/package-lock.json"]) {
      assert.throws(() => inventoryRepositoryDependencyGraphs(root, [source]), /path escapes repository/);
    }
    await withRepository(async (outside) => {
      await writeFile(path.join(outside, "package-lock.json"), '{"packages":{}}');
      await symlink(outside, path.join(root, "linked"), "junction");
      assert.throws(() => inventoryRepositoryDependencyGraphs(root, ["linked/package-lock.json"]), /path escapes repository/);
    });
  });
});

test("#3023 source evidence hashes treat Windows CRLF and LF editions equally", async () => {
  await withRepository(async (root) => {
    const source = path.join(root, "requirements.txt");
    await writeFile(source, "numpy==2.0.0\n");
    const lf = inventoryRepositoryDependencyGraphs(root, ["requirements.txt"]);
    await writeFile(source, "numpy==2.0.0\r\n");
    const crlf = inventoryRepositoryDependencyGraphs(root, ["requirements.txt"]);
    assert.equal(lf.graphs[0].sourceDigestLf, crlf.graphs[0].sourceDigestLf);
  });
});
