import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function readCopy() {
  return JSON.parse(await source("config/collaboration-copy.json"));
}

test("Step 5A mounts one JSON-backed collaboration language adapter", async () => {
  const [layout, adapter] = await Promise.all([
    source("app/layout.tsx"),
    source("app/writer-facing-collaboration-language.tsx"),
  ]);
  assert.match(layout, /import WriterFacingCollaborationLanguage from "\.\/writer-facing-collaboration-language"/);
  assert.match(layout, /<WriterFacingCollaborationLanguage \/>/);
  assert.match(adapter, /import collaborationCopy from "@\/config\/collaboration-copy\.json"/);
  assert.match(adapter, /collaborationCopy\.replacements\.map/);
});

test("Step 5A exposes and protects a stable Settings test key without hidden compatibility text", async () => {
  const [adapter, copy] = await Promise.all([
    source("app/writer-facing-collaboration-language.tsx"),
    readCopy(),
  ]);
  assert.match(adapter, /button\.dataset\.uiCopyKey = collaborationCopy\.settings\.repository\.key/);
  assert.match(adapter, /\[data-ui-copy-key\]/);
  assert.match(adapter, /markStableCopyKeys\(document\.body\);[\s\S]*translateTree\(document\.body\)/);
  assert.equal(copy.settings.repository.key, "settings.repository");
  assert.doesNotMatch(adapter, /smokeCompatibility|aria-hidden|clipPath|compatibilityLabel/);
});

test("Step 5A keeps the Windows smoke label aligned with the JSON contract", async () => {
  const [smoke, copy] = await Promise.all([
    source("scripts/windows-release-smoke.mjs"),
    readCopy(),
  ]);
  assert.match(smoke, new RegExp(copy.settings.repository.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Step 5A arms Issue #208 interception before Dashboard and reads its repository label from JSON", async () => {
  const [runner, smoke] = await Promise.all([
    source("scripts/windows-issue-208-smoke-runner.mjs"),
    source("scripts/windows-issue-208-smoke.mjs"),
  ]);
  assert.match(runner, /createTarget\(debugPort, \"about:blank\"\)/);
  assert.doesNotMatch(runner, /createTarget\(debugPort, `\$\{baseUrl\}\/\?workspace=dashboard`\)/);
  assert.match(runner, /collaboration-copy\.json/);
  assert.match(runner, /terms\?\.repository\?\.primary/);
  assert.match(runner, /normalizedRepositoryLabel/);
  assert.doesNotMatch(runner, /&& \/GitHub repository\/i\.test\(text\)/);
  assert.ok(
    smoke.indexOf('client.send("Fetch.enable"') < smoke.indexOf('await runScenario(report, "Dashboard identifies a new local project'),
    "The synthetic local-connection response must be armed before the Dashboard scenario loads.",
  );
});

test("Step 5A preserves Advanced and machine-facing technical details", async () => {
  const adapter = await source("app/writer-facing-collaboration-language.tsx");
  assert.match(adapter, /closest\("details, code, pre, input, textarea, select/);
  assert.match(adapter, /\[data-technical-language\]/);
  assert.match(adapter, /MutationObserver/);
  assert.doesNotMatch(adapter, /fetch\(|syncEnabled|lastPulledCommit|lastPushedCommit|onChange\(/);
});
