import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packages = [
  ["types", "@plotpickle/types"],
  ["core", "@plotpickle/sdk"],
  ["plugin", "@plotpickle/plugin-sdk"],
  ["testing", "@plotpickle/testing"],
];

test("SDK packages are coordinated and intentionally allow-listed", () => {
  const versions = new Set();
  for (const [folder, name] of packages) {
    const pkg = JSON.parse(readFileSync(`sdk/${folder}/package.json`, "utf8"));
    assert.equal(pkg.name, name);
    assert.match(pkg.version, /preview/);
    assert.deepEqual(pkg.files, ["dist", "README.md", "LICENSE"]);
    assert.equal(pkg.publishConfig.provenance, true);
    assert.equal(pkg.private, undefined);
    versions.add(pkg.version);
  }
  assert.equal(versions.size, 1);
});

test("release tooling keeps publishing manually locked", () => {
  const script = readFileSync("scripts/sdk-release.mjs", "utf8");
  assert.match(script, /PLOTPICKLE_APPROVE_SDK_PUBLISH/);
  assert.match(script, /Clean external consumer installation verified/);
  assert.match(script, /--declarationMap/);
  assert.match(script, /run\("npm", \["pack"/);
});

test("release policy documents compatibility, migration and rollback", () => {
  const policy = readFileSync("docs/developer/sdk-release.md", "utf8");
  assert.match(policy, /semantic version/i);
  assert.match(policy, /migration/i);
  assert.match(policy, /Rollback/);
  assert.match(readFileSync("sdk/COMPATIBILITY.md", "utf8"), /compatibility matrix/i);
});
