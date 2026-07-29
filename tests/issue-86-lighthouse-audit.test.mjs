import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #86 discovers every supported static route and the main workspace variant", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /discoverRoutes/);
  assert.match(audit, /PAGE_FILE/);
  assert.match(audit, /\/\?workspace=1/);
  assert.match(audit, /Dynamic route needs a real sample parameter/);
  assert.match(audit, /for \(const item of inventory\.staticRoutes\)/);
});

test("issue #86 defines a real all-route Lighthouse smoke gate", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  for (const smokeAudit of [
    "http-status-code",
    "errors-in-console",
    "document-title",
    "meta-description",
    "network-requests",
  ]) assert.ok(audit.includes(`"${smokeAudit}"`), `Smoke audit is missing: ${smokeAudit}`);
  for (const signal of [
    "successfulDocument",
    "documentTitle",
    "metaDescription",
    "consoleClean",
    "browserErrorPage",
    "routeFailures",
    "assetFailures",
    "Lighthouse smoke failed",
    "Lighthouse smoke passed",
  ]) assert.ok(audit.includes(signal), `Smoke result is missing: ${signal}`);
  assert.match(audit, /--only-audits=\$\{SMOKE_AUDITS\.join\(","\)\}/);
  assert.match(audit, /summary\.smoke\.passed/);
});

test("issue #86 verifies required metadata and brand assets", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  for (const asset of [
    "/manifest.webmanifest",
    "/brand/favicon/plotpickle-icon-32.png",
    "/brand/plotpickle-header-horizontal-600.png",
    "/brand/plotpickle-logo-stacked-transparent-800.png",
  ]) assert.ok(audit.includes(asset), `Required smoke asset is missing: ${asset}`);
  assert.match(audit, /checkRequiredAssets/);
  assert.match(audit, /response\.ok && body\.byteLength > 0/);
  assert.match(audit, /Required metadata and brand assets/);
});

test("issue #86 keeps category scores as diagnostic evidence rather than thresholds", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  for (const phrase of [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
    "failedAudits",
    "seriousAccessibility",
    "consoleErrors",
    "summary.json",
    "summary.md",
    "category scores remain diagnostic",
  ]) assert.ok(audit.includes(phrase), `Lighthouse evidence is missing: ${phrase}`);
  assert.doesNotMatch(audit, /performance[^;\n]*>=|accessibility[^;\n]*>=|bestPractices[^;\n]*>=|seo[^;\n]*>=/);
});

test("issue #86 provides smoke by default and optional full desktop or mobile reports", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts["audit:lighthouse"], "node scripts/lighthouse-audit.mjs smoke");
  assert.equal(packageJson.scripts["audit:lighthouse:smoke"], "node scripts/lighthouse-audit.mjs smoke");
  assert.equal(packageJson.scripts["audit:lighthouse:full"], "node scripts/lighthouse-audit.mjs all");
  assert.equal(packageJson.scripts["audit:lighthouse:desktop"], "node scripts/lighthouse-audit.mjs desktop");
  assert.equal(packageJson.scripts["audit:lighthouse:mobile"], "node scripts/lighthouse-audit.mjs mobile");
  assert.equal(packageJson.scripts["audit:lighthouse:zip"], "node scripts/lighthouse-audit.mjs zip");

  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /process\.argv\[2\] \?\? "smoke"/);
  assert.match(audit, /PLOTPICKLE_LIGHTHOUSE_SKIP_BUILD/);
  assert.match(audit, /127\.0\.0\.1/);
  assert.match(audit, /No story project was sent to a remote audit service/);
  assert.match(audit, /await zipDirectory\(reportDirectory\)/);
});

test("issue #86 runs the smoke gate in the authoritative quality workflow", async () => {
  const workflow = await source(".github/workflows/quality.yml");
  assert.match(workflow, /name: Lighthouse all-route smoke/);
  assert.match(workflow, /PLOTPICKLE_LIGHTHOUSE_SKIP_BUILD: "1"/);
  assert.match(workflow, /run: npm run audit:lighthouse/);
  assert.match(workflow, /name: lighthouse-smoke/);
  assert.match(workflow, /path: reports\/lighthouse\//);
});

test("issue #86 provides a native Windows launcher and documents the smoke package", async () => {
  const [launcher, docs] = await Promise.all([
    source("Run-Lighthouse.bat"),
    source("public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md"),
  ]);
  assert.match(launcher, /All-route smoke test - recommended/);
  assert.match(launcher, /audit:lighthouse/);
  assert.match(launcher, /desktop/);
  assert.match(launcher, /mobile/);
  assert.match(launcher, /zip/);
  assert.doesNotMatch(launcher, /bash scripts\//i);
  assert.doesNotMatch(launcher, /wsl\.exe/i);
  assert.match(docs, /Whole-app Lighthouse smoke package/);
  assert.match(docs, /recommended all-route smoke/);
  assert.match(docs, /title and description metadata/);
  assert.match(docs, /scores remain available as diagnostic evidence/);
  assert.match(docs, /creates an uploadable ZIP automatically/);
});

test("issue #108 waits for Lighthouse log streams before child-process stdio", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /export function waitForWritableOpen/);
  assert.match(audit, /stream\.once\("open"/);
  assert.match(audit, /await waitForWritableOpen\(log\)/);
  assert.match(audit, /export function closeWritable/);
  assert.match(audit, /stream\.once\("close"/);
  assert.match(audit, /await closeWritable\(log\)/);
  assert.doesNotMatch(audit, /finally \{\s*log\.end\(\);/);
});
