import "./issue-222-collaboration-mode-model.test.mjs";
import "./issue-226-unified-connection-lifecycle.test.mjs";
import "./issue-228-project-mode-controls.test.mjs";
import "./issue-233-step-5a-surface-language.test.mjs";
import "./issue-233-step-5a-ui-language.test.mjs";
import "./issue-235-safe-mode-transitions.test.mjs";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function compileTypeScriptModule(path) {
  const text = await source(path);
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require: () => ({}),
  });
  return { text, exports: runtimeModule.exports };
}

const [modeModule, lifecycleModule] = await Promise.all([
  compileTypeScriptModule("lib/collaboration-mode.ts"),
  compileTypeScriptModule("lib/connection-lifecycle.ts"),
]);

test("Step 7 validates the exact requirements for all three operating modes", () => {
  const expected = {
    "local-story": { localPpf: true, localBackups: true, buzz: "optional", github: "optional" },
    "writers-room": { localPpf: true, localBackups: true, buzz: "required", github: "optional" },
    "repository-collaboration": { localPpf: true, localBackups: true, buzz: "optional", github: "required" },
  };
  assert.deepEqual([...modeModule.exports.COLLABORATION_MODES], Object.keys(expected));
  for (const [mode, requirements] of Object.entries(expected)) {
    assert.equal(JSON.stringify(modeModule.exports.collaborationModeRequirements(mode)), JSON.stringify(requirements));
  }
});

test("Step 7 validates the complete neutral-to-failed connection lifecycle", () => {
  const cases = [
    [{ configured: false, previouslyConnected: false }, { state: "optional", tone: "neutral" }],
    [{ configured: true, previouslyConnected: false, connecting: true }, { state: "connecting", tone: "working" }],
    [{ configured: true, previouslyConnected: true, connected: true }, { state: "connected", tone: "healthy" }],
    [{ configured: true, previouslyConnected: false, failed: true }, { state: "attention", tone: "attention" }],
    [{ configured: true, previouslyConnected: true, failed: true }, { state: "failed", tone: "error" }],
  ];

  for (const [input, expected] of cases) {
    const presentation = lifecycleModule.exports.connectionLifecyclePresentation(input);
    assert.equal(presentation.state, expected.state);
    assert.equal(presentation.tone, expected.tone);
  }
  assert.equal(lifecycleModule.exports.mayUseErrorTone({ configured: false, previouslyConnected: false }), false);
  assert.equal(lifecycleModule.exports.mayUseErrorTone({ configured: true, previouslyConnected: false, failed: true }), false);
  assert.equal(lifecycleModule.exports.mayUseErrorTone({ configured: true, previouslyConnected: true, failed: true }), true);
});

test("Step 7 validates required service attention without automatic actions", () => {
  for (const [target, service] of [["writers-room", "buzz"], ["repository-collaboration", "github"]]) {
    const plan = modeModule.exports.planCollaborationModeTransition("local-story", target, {
      buzz: "unconfigured",
      github: "unconfigured",
    });
    assert.equal(plan.status, "attention");
    assert.deepEqual([...plan.missingRequiredServices], [service]);
    assert.deepEqual([...plan.automaticActions], []);
    assert.notEqual(plan.status, "failed");
  }
});

test("Step 7 validates Dashboard, Settings and copy all share the canonical contracts", async () => {
  const [dashboard, settings, adapter, copyText] = await Promise.all([
    source("app/project-collaboration-status.tsx"),
    source("app/github-collaboration.tsx"),
    source("app/writer-facing-collaboration-language.tsx"),
    source("config/collaboration-copy.json"),
  ]);
  const copy = JSON.parse(copyText);

  assert.match(dashboard, /normalizeCollaborationModeRecord\(project\.collaboration\)/);
  assert.match(dashboard, /collaborationModeRequirements\(collaboration\.mode\)/);
  assert.match(dashboard, /githubConnectionLifecycle\(collaboration\)/);
  assert.match(dashboard, /buzzConnectionLifecycle\(buzz\)/);
  assert.match(settings, /transitionCollaborationMode\(project, mode/);
  assert.match(settings, /collaborationTransitionConfirmation\(result\.plan\)/);
  assert.equal(copy.settings.repository.key, "settings.repository");
  assert.equal(copy.terms.repository.technical, "GitHub repository");
  assert.match(adapter, /collaborationCopy\.replacements\.map/);
  assert.match(adapter, /details, code, pre, input, textarea, select/);
  assert.match(adapter, /\[data-technical-language\]/);
  assert.match(adapter, /\[data-ui-copy-key\]/);
});

test("Step 7 validates the Settings selection path cannot call providers or mutate canon", async () => {
  const settings = await source("app/github-collaboration.tsx");
  const start = settings.indexOf("function selectMode");
  const end = settings.indexOf("\n\n  return (", start);
  assert.ok(start >= 0 && end > start, "Could not isolate the project mode selection path.");
  const selection = settings.slice(start, end);

  assert.match(selection, /transitionCollaborationMode/);
  assert.match(selection, /window\.confirm/);
  assert.ok(selection.indexOf("if (!confirmed) return") < selection.indexOf("onChange(result.project)"));
  assert.doesNotMatch(selection, /fetch\s*\(|connect|disconnect|sync|pull|push|publish|proposal|approve|canon/i);
  assert.doesNotMatch(modeModule.text, /\bfetch\s*\(|connectGitHub|disconnectGitHub|startBuzz|stopBuzz|syncProject|publishProject|createProposal|approveProposal/);
});

test("Step 7 is registered in the full Collab suite", async () => {
  const collabSuite = await source("tests/issue-182-collab-workspace.test.mjs");
  assert.match(collabSuite, /issue-237-collaboration-refinement-validation\.test\.mjs/);
});
