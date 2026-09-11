import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditThirdPartyOss } from "../scripts/third-party-oss-audit.mjs";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await text(path));

test("#1892 canonical OSS registry covers current direct npm graph and named runtimes", async () => {
  const registry = await json("config/third-party-oss.json");
  const packageJson = await json("package.json");

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.npm.manifest, "package.json");
  assert.equal(registry.npm.lockfile, "package-lock.json");
  assert.equal(registry.npm.transitivePolicy, "inventory-and-report");

  const ids = new Set(registry.systems.map((item) => item.id));
  for (const required of [
    "nodejs",
    "react",
    "vite",
    "vinext",
    "mastra",
    "vercel-ai-sdk",
    "drizzle-orm",
    "libsodium",
    "buzz",
    "ollama",
    "llama-cpp",
    "comfyui",
    "lazy-frames",
    "portless",
    "pi-coding-agent",
    "cline",
  ]) assert.ok(ids.has(required), `missing OSS system ${required}`);

  const registeredPackages = new Set(registry.systems.map((item) => item.package).filter(Boolean));
  for (const highlighted of ["react", "vite", "vinext", "@mastra/core", "ai", "drizzle-orm", "libsodium-wrappers-sumo"]) {
    assert.ok(packageJson.dependencies?.[highlighted], `${highlighted} should be a runtime dependency`);
    assert.ok(registeredPackages.has(highlighted), `${highlighted} should have a named OSS system record`);
  }

  const buzz = registry.systems.find((item) => item.id === "buzz");
  assert.equal(buzz.noticePath, "runtime/buzz/LICENSE.buzz.txt");
  assert.equal(buzz.license, "Apache-2.0");
  assert.equal(buzz.version, "0.4.26");

  const node = registry.systems.find((item) => item.id === "nodejs");
  assert.equal(node.usage, "bundled");
  assert.equal(node.version, "24.19.0");

  const nonOss = new Set(registry.nonOssConnections.map((item) => item.id));
  assert.ok(nonOss.has("lm-studio"));
  assert.ok(nonOss.has("cloud-byok"));
});

test("#1892 deterministic audit inventories transitive licence expressions instead of hiding them", () => {
  const result = auditThirdPartyOss();
  assert.deepEqual(result.failures, [], result.failures.join("\n"));
  assert.ok(result.summary.directNpmDependencies > 0);
  assert.ok(result.summary.installedPackageRecords >= result.summary.directNpmDependencies);
  assert.ok(Object.keys(result.summary.npmLicenseExpressions).length > 0);
  assert.ok(result.summary.npmLicenseExpressions["BlueOak-1.0.0"] > 0, "current transitive BlueOak packages should be visible in the inventory");
});

test("#1892 README publishes the OSS acknowledgement without mislabelling proprietary connections", async () => {
  const [readme, registry] = await Promise.all([text("README.md"), json("config/third-party-oss.json")]);
  const start = readme.indexOf(registry.readme.startMarker);
  const end = readme.indexOf(registry.readme.endMarker);
  assert.ok(start >= 0 && end > start);
  const section = readme.slice(start, end);

  assert.match(section, /## Built with open source/);
  assert.match(section, /config\/third-party-oss\.json/);
  assert.match(section, /package-lock\.json/);
  for (const item of registry.systems.filter((entry) => entry.readme === true)) assert.ok(section.includes(item.name), `README should acknowledge ${item.name}`);
  assert.doesNotMatch(section, /\| LM Studio \|/);
  assert.match(section, /LM Studio.*excluded|excluded.*LM Studio/i);
});

test("#1892 public-readiness, licence scope and release package consume the canonical notices", async () => {
  const [publicReadiness, licences, notice, packagePlatform] = await Promise.all([
    text("scripts/public-readiness.mjs"),
    text("LICENSES.md"),
    text("NOTICE.md"),
    text("scripts/package-platform.mjs"),
  ]);
  assert.match(publicReadiness, /auditThirdPartyOss/);
  assert.match(publicReadiness, /config\/third-party-oss\.json/);
  assert.match(licences, /config\/third-party-oss\.json/);
  assert.match(licences, /scripts\/third-party-oss-audit\.mjs/);
  assert.match(notice, /config\/third-party-oss\.json/);
  assert.match(packagePlatform, /"NOTICE\.md"/);
  assert.match(packagePlatform, /"LICENSES\.md"/);
});
