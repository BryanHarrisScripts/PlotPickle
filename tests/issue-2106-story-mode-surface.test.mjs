import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2106 Settings exposes one parent Story Mode destination", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  assert.match(dashboard, /id: "story-mode"[\s\S]*label: "Story Mode"/u);
  assert.match(dashboard, /shortcut: SETTINGS_SHORTCUTS\["story-mode"\]/u);
  assert.match(dashboard, /<StoryModeHost \/>/u);
  assert.match(dashboard, /onSurfaceNameChange\("STORY MODE"\)/u);
  assert.doesNotMatch(dashboard, /id: "local-story-mode"/u);
  assert.doesNotMatch(dashboard, /id: "cloud"[\s\S]*label: "Cloud Story Mode"/u);
  assert.doesNotMatch(dashboard, /setLocalStoryModeOpen|setCloudStoryModeOpen/u);
});

test("#2106 Story Mode uses the required Local Cloud Hybrid keyboard directory", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");

  assert.match(host, /mode: "local"[\s\S]*shortcut: "L"[\s\S]*label: "LOCAL"/u);
  assert.match(host, /mode: "cloud"[\s\S]*shortcut: "C"[\s\S]*label: "CLOUD"/u);
  assert.match(host, /mode: "hybrid"[\s\S]*shortcut: "H"[\s\S]*label: "HYBRID"/u);
  assert.match(host, /data-story-mode-policy=\{item\.mode\}/u);
  assert.match(host, /event\.key === "ArrowDown"/u);
  assert.match(host, /event\.key === "ArrowUp"/u);
  assert.match(host, /event\.key === "Enter" \|\| event\.key === " "/u);
});

test("#2106 parent reuses current Local and Cloud configuration owners", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");

  assert.match(host, /import CloudStoryModeHost from "\.\/cloud-story-mode-host"/u);
  assert.match(host, /import LocalAiSkinHost from "\.\/local-ai-skin-host"/u);
  assert.match(host, /<LocalAiSkinHost \/>/u);
  assert.match(host, /<CloudStoryModeHost \/>/u);
  assert.match(host, /aria-label="Local Story Mode setup"/u);
  assert.match(host, /aria-label="Cloud Story Mode setup"/u);
  assert.match(host, /data-story-mode-hybrid="policy-only"/u);
  assert.doesNotMatch(host, /Ollama Hybrid|ollama-hybrid|new provider registry|multiplexer/iu);
});

test("#2106 readiness and active mode are derived from current runtime truth", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");

  assert.match(host, /fetch\("\/api\/story-mode\/policy"/u);
  assert.match(host, /fetch\("\/api\/ai-routing\/status"/u);
  assert.match(host, /fetch\("\/api\/local-ai\/runtime"/u);
  assert.match(host, /route\.locality === locality && route\.ready === true/u);
  assert.match(host, /status\.activeRuntime\?\.reachable !== true/u);
  assert.match(host, /role\.available === true/u);
  assert.match(host, /const hybridReady = localReady && cloudReady/u);
  assert.match(host, /LOCAL: \{readinessLabel\(localReady, loaded\)\}/u);
  assert.match(host, /CLOUD: \{readinessLabel\(cloudReady, loaded\)\}/u);
  assert.match(host, /HYBRID: \{readinessLabel\(hybridReady, loaded\)\}/u);
  assert.match(host, /MODE: \{mode\.toUpperCase\(\)\}/u);
});

test("#2106 choosing a directory policy updates the execution policy boundary", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");

  assert.match(host, /method: "POST"/u);
  assert.match(host, /body: JSON\.stringify\(\{ mode: nextMode \}\)/u);
  assert.match(host, /setMode\(nextMode\)/u);
  assert.match(host, /setView\(nextMode\)/u);
  assert.match(host, /Existing capability selection and cloud consent rules remain authoritative/u);

  const activateStart = host.indexOf("async function activate");
  const viewIndex = host.indexOf("setView(nextMode)", activateStart);
  const policyWriteIndex = host.indexOf('fetch("/api/story-mode/policy"', activateStart);
  const modeIndex = host.indexOf("setMode(nextMode)", activateStart);
  assert.ok(activateStart >= 0 && viewIndex > activateStart, "Story Mode activation must expose the selected setup view.");
  assert.ok(viewIndex < policyWriteIndex, "Local/Cloud/Hybrid setup must remain reachable while the policy write is pending.");
  assert.ok(modeIndex > policyWriteIndex, "The active Story Mode policy must change only after the policy authority confirms the write.");
});
