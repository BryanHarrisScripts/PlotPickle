import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const PATCH_SHA = "28d440b5dd449dbf1fe6f3506cf94ecca4d02660";

test("#2706 root braces uses the exact reviewed depth-guard patch", async () => {
  const [manifestSource, lockSource] = await Promise.all([read("package.json"), read("package-lock.json")]);
  const manifest = JSON.parse(manifestSource);
  const lock = JSON.parse(lockSource);
  assert.equal(manifest.overrides?.braces, `github:FSDevelop/braces#${PATCH_SHA}`);
  const entry = lock.packages?.["node_modules/braces"];
  assert.equal(entry?.version, "3.0.3");
  assert.match(entry?.resolved || "", new RegExp(`FSDevelop/braces\\.git#${PATCH_SHA}$`, "u"));
  assert.doesNotMatch(entry?.resolved || "", /registry\.npmjs\.org\/braces/u);
});

test("#2706 installed braces rejects hostile nesting without stack exhaustion", () => {
  const braces = require("braces");
  assert.deepEqual(braces.expand("a/{b,c}/d"), ["a/b/d", "a/c/d"]);
  const hostile = "{".repeat(101) + "a,b" + "}".repeat(101);
  assert.throws(() => braces.expand(hostile), /exceeds max depth/u);
});

test("#2706 managed Pi brace-expansion remains on the patched 5.0.12 line", async () => {
  const lock = JSON.parse(await read(".pi/npm/package-lock.json"));
  assert.equal(lock.packages?.["node_modules/brace-expansion"]?.version, "5.0.12");
});

test("#2706 Story Architect fixture does not reflect exception text as HTML", async () => {
  const source = await read("scripts/pi/durable/story-architect-proof.mjs");
  assert.match(source, /Content-Type["']\s*:\s*["']application\/json; charset=utf-8/u);
  assert.match(source, /X-Content-Type-Options["']\s*:\s*["']nosniff/u);
  assert.doesNotMatch(source, /response\.end\(error\.message\)/u);
});
