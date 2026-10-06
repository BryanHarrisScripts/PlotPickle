import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relative, encoding = "utf8") => readFile(new URL(relative, root), encoding);
const VENDOR_PATH = "vendor/braces-3.0.3-depth-guard";
const PATCH_SHA = "28d440b5dd449dbf1fe6f3506cf94ecca4d02660";
const TREE_SHA = "0ffbc33a63a6f2365865e69b4217683268067847";
const MANIFEST_DIGEST = "ac95a324f10b8423b6f9ac317c7dacc61a73d9291c9c536170b487608418bba5";
const RUNTIME_PACKAGE_SHA256 = "1816c57094de9ee834e5953417dae5c8875cbd1810bdf7539ed870184f3ff665";

test("#2789 braces security bridge is repository-owned, hash-provenanced, and Git-transport-free", async () => {
  const [manifest, lock, provenance, gitAttributes] = await Promise.all([
    read("package.json").then(JSON.parse),
    read("package-lock.json").then(JSON.parse),
    read(`${VENDOR_PATH}/SECURITY-PROVENANCE.json`).then(JSON.parse),
    read(".gitattributes"),
  ]);

  assert.equal(manifest.dependencies.braces, `file:./${VENDOR_PATH}`);
  assert.equal(manifest.overrides.braces, "$braces");
  assert.equal(manifest.plotpickleVendoredPackages.braces.upstreamCommit, PATCH_SHA);
  assert.equal(manifest.plotpickleVendoredPackages.braces.upstreamTree, TREE_SHA);
  assert.equal(manifest.plotpickleVendoredPackages.braces.manifestDigest, `sha256-${MANIFEST_DIGEST}`);
  assert.equal(manifest.plotpickleVendoredPackages.braces.runtimePackageSha256, RUNTIME_PACKAGE_SHA256);

  assert.equal(provenance.upstreamCommit, PATCH_SHA);
  assert.equal(provenance.upstreamTree, TREE_SHA);
  assert.equal(provenance.manifestDigest, MANIFEST_DIGEST);
  assert.equal(provenance.runtimePackageSha256, RUNTIME_PACKAGE_SHA256);
  assert.equal(createHash("sha256").update(await read(`${VENDOR_PATH}/package.json`, null)).digest("hex"), RUNTIME_PACKAGE_SHA256);
  assert.equal(provenance.policy.gitDependencyFetchRequired, false);
  assert.equal(provenance.policy.movingRefAllowed, false);
  assert.match(gitAttributes, /vendor\/braces-3\.0\.3-depth-guard\/\*\* text eol=lf/u);

  let canonical = "";
  for (const relativeFile of Object.keys(provenance.files).sort()) {
    const bytes = await read(`${VENDOR_PATH}/${relativeFile}`, null);
    const blobHash = createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`))
      .update(bytes)
      .digest("hex");
    assert.equal(blobHash, provenance.files[relativeFile], relativeFile);
    canonical += `${relativeFile}\0${blobHash}\n`;
  }
  assert.equal(createHash("sha256").update(canonical).digest("hex"), MANIFEST_DIGEST);

  assert.deepEqual(lock.packages["node_modules/braces"], { resolved: VENDOR_PATH, link: true });
  assert.equal(lock.packages[VENDOR_PATH].version, "3.0.3");

  const forbidden = /^(?:git(?:\+[^:]+)?:|github:|git@)/iu;
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    assert.doesNotMatch(entry?.resolved || "", forbidden, packagePath);
  }
});

test("#2789 npm runtime policy rejects Git transport before installation", async () => {
  const policy = await read("scripts/npm-runtime-policy.mjs");
  assert.match(policy, /EALLOWGIT/u);
  assert.match(policy, /process\.exitCode = 42/u);
  assert.match(policy, /production dependency installation may not fetch Git packages/u);

  const result = spawnSync(process.execPath, ["scripts/npm-runtime-policy.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Production dependency transport policy is Git-free/u);
});

test("#2789 Windows runtime verifies and stages vendored packages with bounded EPERM cleanup", async () => {
  const [runtime, launcher, setup] = await Promise.all([
    read("scripts/windows-runtime.mjs"),
    read("Start-PlotPickle.bat"),
    read("scripts/windows-setup-report.mjs"),
  ]);

  for (const contract of [
    "verifiedVendoredPackages",
    "stageVendoredPackages",
    "SECURITY-PROVENANCE.json",
    'createHash("sha1")',
    'createHash("sha256")',
    "manifest digest changed",
    "runtime package metadata digest changed",
    "file hash changed",
    "maxRetries: 5",
    "retryDelay: 200",
  ]) assert.ok(runtime.includes(contract), `Missing runtime contract: ${contract}`);
  assert.match(runtime, /copyRuntimeManifests\(info\)[\s\S]*stageVendoredPackages\(info\)/u);

  assert.match(launcher, /NPM_RUNTIME_POLICY=scripts\\npm-runtime-policy\.mjs/u);
  assert.match(launcher, /NPM_POLICY_RESULT.*ERRORLEVEL/u);
  assert.match(launcher, /if "!NPM_POLICY_RESULT!"=="42"[\s\S]*SETUP_FAILURE_REASON=dependency-policy[\s\S]*exit \/b 1/u);
  assert.match(launcher, /NPM_INSTALL_RESULT.*ERRORLEVEL/u);
  assert.match(launcher, /goto :dependency_retry/u);
  assert.match(launcher, /NPM_REPAIR_RESULT.*ERRORLEVEL/u);
  assert.match(launcher, /repeating the same install would fail again/u);
  assert.match(launcher, /open a named surface from PlotPickle/u);
  assert.doesNotMatch(launcher, /open a named surface in Settings/u);

  assert.match(setup, /Reviewed brace expansion security bridge/u);
  assert.match(setup, /hash-verified from repository-owned source/u);
});

test("#2789 installed braces still enforces the reviewed depth guard", async (t) => {
  let braces;
  try {
    const { createRequire } = await import("node:module");
    braces = createRequire(import.meta.url)("braces");
  } catch (error) {
    if (error?.code === "MODULE_NOT_FOUND") {
      t.skip("Installed-package behavior runs after npm ci.");
      return;
    }
    throw error;
  }
  assert.deepEqual(braces.expand("a/{b,c}/d"), ["a/b/d", "a/c/d"]);
  const hostile = "{".repeat(101) + "a,b" + "}".repeat(101);
  assert.throws(() => braces.expand(hostile), /exceeds max depth/u);
});
