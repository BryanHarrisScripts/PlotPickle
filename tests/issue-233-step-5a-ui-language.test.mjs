import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function readCopy() {
  return JSON.parse(await source("config/collaboration-copy.json"));
}

async function loadTranslator() {
  const [adapter, copy] = await Promise.all([
    source("app/writer-facing-collaboration-language.tsx"),
    readCopy(),
  ]);
  const compiled = ts.transpileModule(adapter, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: cjsModule.exports,
    module: cjsModule,
    require(specifier) {
      if (specifier === "react") return { useEffect() {} };
      if (specifier === "@/config/collaboration-copy.json") return { __esModule: true, default: copy };
      throw new Error(`Unexpected translator dependency: ${specifier}`);
    },
  }, { filename: "writer-facing-collaboration-language.js" });
  return { copy, translate: cjsModule.exports.translate };
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
  assert.match(adapter, /const refreshCopy = \(root: ParentNode\) => \{[\s\S]*markStableCopyKeys\(root\);[\s\S]*translateTree\(root\);[\s\S]*markStableCopyKeys\(root\);[\s\S]*\};[\s\S]*refreshCopy\(document\.body\)/);
  assert.equal(copy.settings.repository.key, "settings.repository");
  assert.doesNotMatch(adapter, /smokeCompatibility|aria-hidden|clipPath|compatibilityLabel/);
});

test("Issue #208 keeps writer-facing translations stable across repeated observer passes", async () => {
  const { copy, translate } = await loadTranslator();
  const samples = [
    "GitHub repository",
    "GitHub repositories",
    "repository connection",
    "repository",
    "repositories",
    "Open the GitHub repository and check the repository connection.",
    ...copy.replacements.map((item) => item.replacement),
  ];

  assert.equal(translate("GitHub repository"), "story repository");
  assert.equal(translate("repository connection"), "story repository connection");
  for (const sample of samples) {
    const once = translate(sample);
    let repeated = once;
    for (let pass = 0; pass < 25; pass += 1) repeated = translate(repeated);
    assert.equal(repeated, once, `Translation changed after the first pass: ${sample}`);
    assert.doesNotMatch(repeated, /story story repository/i);
  }
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
