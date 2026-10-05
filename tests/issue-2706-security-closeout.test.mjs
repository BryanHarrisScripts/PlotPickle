import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const PATCH_SHA = "28d440b5dd449dbf1fe6f3506cf94ecca4d02660";

function packageEntries(lock, name) {
  const suffix = `node_modules/${name}`;
  return Object.entries(lock.packages || {})
    .filter(([path]) => path === suffix || path.endsWith(`/${suffix}`))
    .map(([path, entry]) => ({ path, ...entry }));
}

test("#2706 every root braces install path uses the exact reviewed depth-guard patch", async () => {
  const [manifestSource, lockSource] = await Promise.all([read("package.json"), read("package-lock.json")]);
  const manifest = JSON.parse(manifestSource);
  const lock = JSON.parse(lockSource);
  assert.equal(manifest.overrides?.braces, `github:FSDevelop/braces#${PATCH_SHA}`);

  const entries = packageEntries(lock, "braces");
  assert.ok(entries.length >= 1, "root lock must contain braces");
  for (const entry of entries) {
    assert.equal(entry.version, "3.0.3");
    assert.match(entry.resolved || "", new RegExp(`FSDevelop/braces\\.git#${PATCH_SHA}$`, "u"));
    assert.doesNotMatch(entry.resolved || "", /registry\.npmjs\.org\/braces/u);
  }
});

test("#2706 installed braces keeps ordinary expansion and rejects hostile nesting", () => {
  const braces = require("braces");
  assert.deepEqual(braces.expand("a/{b,c}/d"), ["a/b/d", "a/c/d"]);
  const hostile = "{".repeat(101) + "a,b" + "}".repeat(101);
  assert.throws(() => braces.expand(hostile), /exceeds max depth/u);
});

test("#2706 root Undici 7 stays at or above the compatible 7.29.1 floor", async () => {
  const lock = JSON.parse(await read("package-lock.json"));
  const entries = packageEntries(lock, "undici").filter((entry) => String(entry.version || "").startsWith("7."));
  assert.ok(entries.length >= 1, "root lock must contain the supported Undici 7 line");
  for (const entry of entries) {
    const [major, minor, patch] = String(entry.version).split(".").map(Number);
    assert.equal(major, 7);
    assert.ok(minor > 29 || (minor === 29 && patch >= 1), `${entry.path} must be >= 7.29.1`);
  }
});

test("#2706 both managed Pi locks remain on brace-expansion 5.0.12", async () => {
  for (const path of [".pi/npm/package-lock.json", ".pi/managed/package-lock.json"]) {
    const lock = JSON.parse(await read(path));
    assert.equal(lock.packages?.["node_modules/brace-expansion"]?.version, "5.0.12", path);
  }
});

test("#2706 Story Architect fixture does not reflect exception text as HTML", async () => {
  const source = await read("scripts/pi/durable/story-architect-proof.mjs");
  assert.match(source, /Content-Type["']\s*:\s*["']application\/json; charset=utf-8/u);
  assert.match(source, /X-Content-Type-Options["']\s*:\s*["']nosniff/u);
  assert.doesNotMatch(source, /response\.end\(error\.message\)/u);
});

test("#2706 closeout brief remains truthful while upstream has no official patched braces release", async () => {
  const brief = await read("docs/developer-briefs/2706-braces-depth-guard.md");
  assert.match(brief, /temporary security bridge/u);
  assert.match(brief, /official patched release/u);
  assert.match(brief, /GitHub Security UI/u);
  assert.doesNotMatch(brief, /all security alerts are closed|Dependabot alert is closed/iu);
});
