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

test("issue #86 keeps an all-route Lighthouse diagnostic", async () => {
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

test("issue #86 keeps Lighthouse category scores as diagnostic evidence", async () => {
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

test("issue #86 provides optional Lighthouse desktop and mobile reports", async () => {
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

test("issue #86 defines the packaged Windows interaction release gate", async () => {
  const smoke = await source("scripts/windows-interaction-smoke.mjs");
  for (const contract of [
    "PLOTPICKLE_HOME",
    "Page.addScriptToEvaluateOnNewDocument",
    "Runtime.exceptionThrown",
    "Runtime.consoleAPICalled",
    "Network.responseReceived",
    "Network.loadingFailed",
    "button, a[href]",
    "input[type='checkbox']",
    "input[type='radio']",
    "summary",
    "select",
    "Failed to execute 'removeChild'",
    "skippedActions",
    "maximumActions",
    "maximumStates",
    "taskkill.exe",
    "windows-interaction-smoke.json",
    "windows-interaction-smoke.md",
  ]) assert.ok(smoke.includes(contract), `Windows interaction smoke is missing: ${contract}`);
  assert.match(smoke, /externalOrCostlyAction/);
  assert.match(smoke, /directMutationAction/);
  assert.match(smoke, /terminateProcessTree/);
  assert.match(smoke, /process\.exit\(124\)/);
});

test("issue #86 runs the packaged interaction gate in the Windows release workflow", async () => {
  const workflow = await source(".github/workflows/release-candidate.yml");
  assert.match(workflow, /name: Run packaged Windows interaction smoke/);
  assert.match(workflow, /node scripts\/windows-interaction-smoke\.mjs/);
  assert.match(workflow, /PLOTPICKLE_SMOKE_TOTAL_TIMEOUT_MS/);
  assert.match(workflow, /name: plotpickle-windows-interaction-smoke-/);
  assert.match(workflow, /reports\/windows-interaction-smoke\//);
});

test("issue #86 keeps the authoritative quality workflow bounded", async () => {
  const workflow = await source(".github/workflows/quality.yml");
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /node --check scripts\/windows-interaction-smoke\.mjs/);
  assert.doesNotMatch(workflow, /run: npm run audit:lighthouse/);
});

test("issue #86 provides a native Windows Lighthouse launcher for optional diagnostics", async () => {
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
  assert.match(docs, /Windows packaged interaction smoke/);
  assert.match(docs, /Lighthouse remains an optional diagnostic/);
  assert.match(docs, /every discoverable visible safe control/);
});

test("issue #108 terminates Lighthouse server process trees and bounds commands", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /terminateProcessTree/);
  assert.match(audit, /timeoutMs/);
  assert.match(audit, /await terminateProcessTree\(preview/);
  assert.match(audit, /process\.execPath/);
  assert.doesNotMatch(audit, /preview\.kill\("SIGTERM"\)/);
});
