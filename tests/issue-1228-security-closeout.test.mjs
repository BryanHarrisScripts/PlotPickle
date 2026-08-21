import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function versionAtLeast(actual, minimum) {
  const left = String(actual || "0.0.0").split(".").map(Number);
  const right = String(minimum || "0.0.0").split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a !== b) return a > b;
  }
  return true;
}

test("#1228 keeps compatible dependency patches above reviewed advisory floors", async () => {
  const [packageText, lockText] = await Promise.all([read("package.json"), read("package-lock.json")]);
  const pkg = JSON.parse(packageText);
  const lock = JSON.parse(lockText);
  const packages = lock.packages || {};

  assert.equal(pkg.overrides?.nanoid, "3.3.18");
  assert.equal(pkg.overrides?.["js-yaml"], "4.3.1");
  assert.equal(pkg.overrides?.["@babel/core"], "7.29.6");
  assert.equal(pkg.overrides?.["@esbuild-kit/core-utils"]?.esbuild, "0.25.12");

  assert.ok(versionAtLeast(packages["node_modules/nanoid"]?.version, "3.3.18"), "nanoid must include the 3.x zero-size loop fix");
  assert.ok(versionAtLeast(packages["node_modules/js-yaml"]?.version, "4.3.1"), "js-yaml 4.x must include merge-chain and !!omap DoS fixes");
  assert.ok(versionAtLeast(packages["node_modules/gray-matter/node_modules/js-yaml"]?.version, "3.15.1"), "legacy js-yaml 3.x copy must include the backported !!omap fix");
  assert.ok(versionAtLeast(packages["node_modules/@babel/core"]?.version, "7.29.6"), "@babel/core must include the sourceMappingURL file-read fix");
  assert.ok(versionAtLeast(packages["node_modules/@esbuild-kit/core-utils/node_modules/esbuild"]?.version, "0.25.0"), "deprecated esbuild-kit must not retain the vulnerable esbuild development server");
});

test("#1228 restricts flagged GitHub Actions workflows to read-only repository access", async () => {
  for (const path of [".github/workflows/writer-e2e-observer.yml", ".github/workflows/learn-agent-portraits.yml"]) {
    const source = await read(path);
    assert.match(source, /^permissions:\s*\n\s+contents:\s*read\s*$/m, `${path} must declare least-privilege contents: read`);
    assert.doesNotMatch(source, /contents:\s*write/, `${path} must not request repository write access`);
  }
});

test("#1228 hardens Windows batch execution before cmd.exe receives values", async () => {
  const source = await read("scripts/spawn-command.mjs");
  assert.match(source, /shell:\s*false/, "shared process wrapper must keep Node shell execution disabled");
  assert.match(source, /unsupported command-shell characters/, "Windows batch arguments must fail closed on cmd.exe metacharacters");
  assert.match(source, /[&|<>^%!]/, "Windows metacharacter rejection must remain explicit");
  assert.match(source, /windowsBatchArguments\(command, args\)/, "cmd.exe path must use the validated argument builder");
});

test("#1228 durable creative IDs never fall back to time or Math.random", async () => {
  for (const path of ["lib/table-read.ts", "lib/writers-room.ts"]) {
    const source = await read(path);
    assert.doesNotMatch(source, /Math\.random\s*\(/, `${path} must not use Math.random for IDs`);
    assert.doesNotMatch(source, /Date\.now\s*\(/, `${path} must not use timestamps as uniqueness fallbacks`);
    assert.match(source, /randomUUID/, `${path} should prefer crypto.randomUUID`);
    assert.match(source, /getRandomValues/, `${path} should retain a cryptographic fallback`);
    assert.match(source, /Secure randomness is unavailable/, `${path} must fail closed if crypto is unavailable`);
  }
});

test("#1228 retains the source-level fixes behind older CodeQL records", async () => {
  const [build, characterImage, screenplay] = await Promise.all([
    read("scripts/build-verified.mjs"),
    read("app/character-image-generator.tsx"),
    read("lib/screenplay.ts"),
  ]);

  assert.match(build, /main\(\)\.catch\(\(\) => \{/, "build failure boundary should not log caught exception contents");
  assert.doesNotMatch(build, /console\.error\([^\n]*error/i, "build failure boundary must not echo arbitrary caught error values");
  assert.doesNotMatch(characterImage, /dangerouslySetInnerHTML|\.innerHTML\s*=/, "character image UI must not reinterpret text as HTML");
  assert.match(screenplay, /finalDraftPlainText/, "Final Draft import must retain bounded plain-text normalization");
});
