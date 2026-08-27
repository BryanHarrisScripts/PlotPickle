import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function versionAtLeast(actual, minimum) {
  const left = actual.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a !== b) return a > b;
  }
  return true;
}

test("#1226 removes residual weak/dynamic security sinks", async () => {
  const [coreModel, onboarding, starter, spawnCommand] = await Promise.all([
    read("lib/projects/core-model.ts"),
    read("build/ai/comfyui-onboarding-gateway.ts"),
    read("build/ai/comfyui-sdxl-starter-gateway.ts"),
    read("scripts/spawn-command.mjs"),
  ]);

  assert.doesNotMatch(coreModel, /Math\.random\s*\(/, "durable core-model IDs must not fall back to Math.random");
  assert.match(coreModel, /getRandomValues/, "core-model IDs should retain a cryptographically strong fallback when randomUUID is unavailable");

  for (const source of [onboarding, starter]) {
    assert.doesNotMatch(source, /new RegExp\s*\(/, "fixed installer marker names do not require dynamic regular expressions");
    assert.match(source, /output\.split\(\/\\r\?\\n\/\)/, "installer output should be parsed as bounded lines");
  }

  assert.match(
    spawnCommand,
    /const spawnOptions = \{ \.\.\.options, shell: false \};/,
    "the shared command wrapper must override caller options and keep shell execution disabled",
  );
});

test("#1226 lockfile keeps reviewed patched dependency floors", async () => {
  const lock = JSON.parse(await read("package-lock.json"));
  const packages = lock.packages || {};
  const undici = packages["node_modules/undici"]?.version || "0.0.0";
  const braceExpansion = packages["node_modules/brace-expansion"]?.version || "0.0.0";
  const minimatch = packages["node_modules/minimatch"]?.version || "0.0.0";

  assert.ok(versionAtLeast(undici, "7.29.0"), `undici ${undici} is below the reviewed 7.29.0 floor`);
  assert.ok(versionAtLeast(braceExpansion, "1.1.18"), `brace-expansion ${braceExpansion} is below the patched 1.1.18 backport`);
  assert.ok(versionAtLeast(minimatch, "3.1.4"), `minimatch ${minimatch} is below the patched 3.x ReDoS floor`);
});
