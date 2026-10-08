import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2841 Settings exposes Local Cloud Hybrid destinations backed by the same host", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");
  for (const mode of ["local", "cloud", "hybrid"]) assert.ok(dashboard.includes(`id: "${mode}"`));
  assert.match(dashboard, /<StoryModeHost initialView=\{storyModeView\}/u);
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
  assert.match(host, /import HybridStoryModePanel from "\.\/hybrid-story-mode-panel"/u);
  assert.match(host, /<HybridStoryModePanel onChanged=\{\(\) => void refresh\(\)\} \/>/u);
  assert.doesNotMatch(host, /Ollama Hybrid|ollama-hybrid|new provider registry|multiplexer/iu);
});

test("#2106 readiness and active mode are derived from current runtime truth", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");

  assert.match(host, /fetch\("\/api\/story-mode\/policy"/u);
  assert.match(host, /fetch\("\/api\/ai-routing\/status"/u);
  assert.match(host, /fetch\("\/api\/local-ai\/runtime"/u);
  assert.match(host, /filter\(\(route\) => route\.locality === locality\)/u);
  assert.match(host, /routes\.some\(\(route\) => route\.ready === true\)/u);
  assert.match(host, /const hybridReady = hybridSelectionReady\(routingStatus\)/u);
  assert.match(host, /const ready = item\.mode === "local" \? localReady : item\.mode === "cloud" \? cloudReady : hybridReady/u);
  assert.match(host, /active && ready \? " is-active" : ""/u);
  assert.match(host, /return selected\.every\(Boolean\)/u);
  assert.match(host, /\{ label: "LOCAL", ready: localCoverage\.ready === localCoverage\.total/u);
  assert.match(host, /\{ label: "CLOUD", ready: cloudCoverage\.ready === cloudCoverage\.total/u);
  assert.match(host, /\{ label: "HYBRID", ready: hybridReady,/u);
  assert.match(host, /<strong>MODE<\/strong>: \{mode\.toUpperCase\(\)\}/u);
  assert.match(host, /data-story-mode-readiness=\{readinessState\(status\.ready, loaded\)\}/u);
});

test("#2841 opening a setup directory never changes execution policy", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");
  const activate = host.slice(host.indexOf("async function activate"), host.indexOf("function handleKeyDown"));
  assert.match(activate, /setView\(nextMode\)/u);
  assert.match(activate, /Route selection stays in Hybrid/u);
  assert.doesNotMatch(activate, /method: "POST"|setMode\(nextMode\)/u);
});
