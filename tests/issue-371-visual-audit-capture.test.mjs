import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #371 covers every canonical UI/UX registry screen", async () => {
  const [registry, captures] = await Promise.all([
    source("config/ui-ux-screen-registry.json").then(JSON.parse),
    source("config/visual-audit-captures.json").then(JSON.parse),
  ]);
  const covered = new Set(captures.captures.map((capture) => capture.screenId));
  const missing = registry.screens.map((screen) => screen.id).filter((id) => !covered.has(id));
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(captures.viewports), ["desktop", "tablet", "mobile"]);
  assert.equal(captures.settingsSessionKey, "plotpickle.settings.section");
  assert.ok(captures.captures.every((capture) => capture.expectedText), "Every capture needs a screen-identity assertion");
  const overview = captures.captures.find((capture) => capture.screenId === "settings-overview-sitemap" && capture.variant === "overview");
  assert.equal(overview?.expectedText, "Choose how PlotPickle works today.");
});

test("issue #371 captures real rendered pages through Chrome DevTools", async () => {
  const script = await source("scripts/visual-audit-capture.mjs");
  for (const contract of [
    'client.send("Page.captureScreenshot"',
    'client.send("Page.getLayoutMetrics")',
    'client.send("Emulation.setDeviceMetricsOverride"',
    'client.send("Page.addScriptToEvaluateOnNewDocument"',
    "visual-audit-manifest.json",
    "index.html",
    "horizontalOverflow",
    "captureBeyondViewport: true",
  ]) assert.ok(script.includes(contract), `Missing visual capture contract: ${contract}`);
  assert.doesNotMatch(script, /lighthouse|puppeteer|playwright/i);
});

test("issue #371 waits for the requested visible screen before sampling metadata or pixels", async () => {
  const script = await source("scripts/visual-audit-capture.mjs");
  for (const contract of [
    "async function waitForExpectedText",
    "body.includes(${JSON.stringify(expected)})",
    "marketingVisible",
    "dashboardVisible",
    "Timed out waiting for visible screen identity",
    "await waitForExpectedText(client, capture.expectedText, capture.screenId)",
  ]) assert.ok(script.includes(contract), `Missing visible-screen readiness contract: ${contract}`);
  const readiness = "await waitForExpectedText(client, capture.expectedText, capture.screenId)";
  assert.ok((script.match(/await waitForExpectedText\(client, capture\.expectedText, capture\.screenId\)/g) ?? []).length >= 2, "Every route and viewport must revalidate its visible screen identity");
  assert.ok(script.indexOf(readiness) < script.indexOf("const redaction = await evaluate(client, redactScript)"));
  assert.ok(script.lastIndexOf(readiness) < script.indexOf("const summary = await pageSummary(client, viewport)"));
});

test("issue #371 isolates Windows-heavy captures, settles ports and warms each batch on its first destination", async () => {
  const [supervisor, captures] = await Promise.all([
    source("scripts/visual-audit-supervisor.mjs"),
    source("config/visual-audit-captures.json").then(JSON.parse),
  ]);
  for (const contract of [
    "PLOTPICKLE_VISUAL_BATCH_SIZE",
    "PLOTPICKLE_VISUAL_BATCH_SETTLE_MS",
    'process.platform === "win32" ? 3500 : 1000',
    "await pause(batchSettleMs)",
    "previous preview server and browser ports to close",
    "visual-audit-capture.mjs",
    "batch-${batchNumber}",
    "__visual-audit-warmup",
    "const firstCapture = batch[0]",
    "route: firstCapture.route",
    "settingsTarget: firstCapture.settingsTarget",
    "Internal warmup for ${firstCapture.label}",
    "originalConfigText",
    "originalRegistryText",
    "await writeFile(configPath, originalConfigText)",
    "await writeFile(registryPath, originalRegistryText)",
    "visual-audit-manifest.json",
    "capture.isolated",
    "result.push([capture])",
  ]) assert.ok(supervisor.includes(contract), `Missing isolated-batch contract: ${contract}`);
  assert.match(supervisor, /Math\.min\(Number\(process\.env\.PLOTPICKLE_VISUAL_BATCH_SIZE \|\| 6\), 8\)/);
  assert.doesNotMatch(supervisor, /route: "\/\?workspace=dashboard"/);
  const isolatedDestinations = [
    "learn",
    "planner",
    "visuals",
    "script",
    "pitch",
    "build",
    "feedback",
    "engines",
    "settings-appearance-accessibility",
    "settings-runtime",
    "settings-ollama",
    "settings-comfyui",
  ];
  for (const screenId of isolatedDestinations) {
    const capture = captures.captures.find((item) => item.screenId === screenId);
    assert.equal(capture?.isolated, true, `${screenId} must run in its own browser/server batch on Windows`);
  }
  for (const variant of ["general", "project-defaults"]) {
    const capture = captures.captures.find((item) => item.screenId === "settings-general" && item.variant === variant);
    assert.equal(capture?.isolated, true, `settings-general ${variant} must run in its own browser/server batch on Windows`);
  }
});

test("issue #371 rejects screenshots of the wrong application screen", async () => {
  const validator = await source("scripts/visual-audit-validate.mjs");
  for (const contract of [
    "expectedText",
    "Public marketing splash was captured instead of the requested application screen",
    "visual-audit-validation.json",
    "Screenshot missing",
    "Reference evidence only",
  ]) assert.ok(validator.includes(contract), `Missing screen-identity validation contract: ${contract}`);
});

test("issue #371 redacts sensitive values and local user paths", async () => {
  const script = await source("scripts/visual-audit-capture.mjs");
  for (const contract of [
    "input[type=password]",
    "data-visual-audit-redact",
    "PRIVATE KEY",
    "[A-Za-z]:\\\\Users\\\\",
    "/home/[user]",
    "/Users/[user]",
  ]) assert.ok(script.includes(contract), `Missing redaction contract: ${contract}`);
});

test("issue #371 captures direct provider screens and records unresolved references honestly", async () => {
  const captures = JSON.parse(await source("config/visual-audit-captures.json"));
  const directRoutes = new Map(captures.captures.map((capture) => [capture.label, capture.route]));
  assert.equal(directRoutes.get("AI routing"), "/ai-routing");
  for (const target of ["ollama", "comfyui", "buzz", "openai", "minimax", "github", "google", "storage", "privacy", "about"]) {
    assert.ok(captures.captures.some((capture) => capture.settingsTarget === target), `Missing Settings visual target: ${target}`);
  }
  const plugins = captures.captures.find((capture) => capture.screenId === "settings-plugins-connections");
  assert.equal(plugins?.referenceOnly, true);
  assert.equal(plugins?.settingsTarget, "sitemap");
});

test("issue #371 publishes and validates visual evidence in CI", async () => {
  const workflow = await source(".github/workflows/visual-audit-capture.yml");
  for (const contract of [
    "node scripts/visual-audit-supervisor.mjs",
    "node scripts/visual-audit-validate.mjs",
    "node --check scripts/visual-audit-capture.mjs",
    "node --check scripts/visual-audit-supervisor.mjs",
    "node --check scripts/visual-audit-validate.mjs",
    "PLOTPICKLE_VISUAL_BATCH_SIZE: \"6\"",
    "tests/issue-371-visual-audit-capture.test.mjs",
    "actions/upload-artifact",
    "reports/visual-audit/",
    "plotpickle-visual-audit-${{ github.sha }}",
  ]) assert.ok(workflow.includes(contract), `Missing visual workflow contract: ${contract}`);
});
