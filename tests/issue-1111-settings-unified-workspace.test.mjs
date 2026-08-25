import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1111 live Settings uses one persistent Community-style rail and one active center workspace", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  assert.match(source, /data-settings-rail="navigation"/);
  assert.match(source, /data-settings-main/);
  assert.match(source, /data-settings-rail="context"/);
  assert.match(source, /data-settings-active=\{activeSection\}/);
  assert.match(source, /data-settings-section=\{activeSection\}/);
  assert.match(source, /aria-current=\{activeSection === item\.id \? "page" : undefined\}/);
  assert.doesNotMatch(source, /scrollIntoView\(/, "switching Settings areas should replace the center rather than scroll a long page of mini-apps");
});

test("#1111/#1377 exposes compute-first Settings destinations without returning to a Settings home screen", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  for (const id of ["overview", "updates", "help", "local-compute", "cloud-compute", "comfyui", "buzz", "activity", "runtime"]) {
    assert.match(source, new RegExp(`id: ["']${id}["']`), `missing Settings destination ${id}`);
  }
  for (const group of ["START", "AI COMPUTE", "COMMUNITY", "SYSTEM"]) {
    assert.match(source, new RegExp(`label: ["']${group}["']`), `missing Settings group ${group}`);
  }
  for (const label of ["Overview", "What’s New", "Help", "Local Compute", "Cloud Compute", "ComfyUI Setup", "BUZZ Setup", "Agent Activity", "Advanced Runtime"]) {
    assert.match(source, new RegExp(`label: ["']${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`), `missing Settings label ${label}`);
  }
  assert.doesNotMatch(source, /label: ["'](?:Sage Setup|PLAN Setup|LLM Routing|Images Setup|Video Setup|Ollama|OpenAI Cloud|MiniMax Cloud)["']/);
  assert.doesNotMatch(source, /Profiles\s*&\s*Security/i, "Profile remains the sole owner of profile and security actions");
});

test("#1111 Settings deep links are bookmarkable and legacy AI links resolve into their current owners", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  assert.match(source, /const SETTINGS_QUERY_KEY = "settings"/);
  assert.match(source, /url\.searchParams\.set\(SETTINGS_QUERY_KEY, section\)/);
  assert.match(source, /window\.history\.pushState/);
  assert.match(source, /window\.history\.replaceState/);
  assert.match(source, /window\.addEventListener\("popstate", sync\)/);
  assert.match(source, /window\.sessionStorage\.setItem\(SETTINGS_SECTION_KEY, section\)/);
  assert.match(source, /LEGACY_TARGETS/, "old Settings deep links must continue to resolve into the new navigation model");
  assert.match(source, /"settings-models": "local-compute"/);
  assert.match(source, /"settings-comfyui": "comfyui"/);
  assert.match(source, /"settings-openai": "cloud-compute"/);
  assert.match(source, /"settings-minimax": "cloud-compute"/);
  const hashIndex = source.indexOf("if (url.hash)");
  const queryIndex = source.indexOf("const querySection = url.searchParams.get(SETTINGS_QUERY_KEY)");
  assert.ok(hashIndex >= 0 && queryIndex >= 0 && hashIndex < queryIndex, "legacy hash destinations must win over a stale settings query");
});

test("#1111 common overview reads existing runtime media and BUZZ authorities without creating a second status store", async () => {
  const overview = await read("app/settings-readiness-overview.tsx");
  assert.match(overview, /\/api\/local-ai\/runtime/);
  assert.match(overview, /\/api\/media-routing\/status/);
  assert.match(overview, /\/api\/local-buzz\/status/);
  assert.match(overview, /Promise\.allSettled/);
  assert.match(overview, /plotpickle:setup-status-refresh/);
  assert.match(overview, /plotpickle:connection-status-refresh/);
  assert.doesNotMatch(overview, /localStorage|indexedDB|sessionStorage/, "overview readiness must stay derived from existing authorities");
});

test("#1111 overview distinguishes process-running from capability-ready and legacy configure links remain resolvable", async () => {
  const overview = await read("app/settings-readiness-overview.tsx");
  assert.match(overview, /comfyui\?\.reachable/);
  assert.match(overview, /imageNodesReady/);
  assert.match(overview, /checkpoint|selectedCheckpoint/);
  assert.match(overview, /Process reachable; capability not ready/);
  assert.match(overview, /Configure and test \{card\.label\}/);
  for (const capability of ["sage", "plan", "images", "video", "buzz", "runtime"]) {
    assert.match(overview, new RegExp(`id: ["']${capability}["']`));
  }
});

test("#1111/#1377 reuses existing configure and test owners without duplicating ComfyUI", async () => {
  const [settings, compute] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);
  for (const component of [
    "AiRoutingPanel",
    "SageFastModelSetup",
    "AiProviderSetupPanel",
    "LocalRuntimePanel",
  ]) {
    assert.match(compute, new RegExp(`<${component}\\b`), `${component} must remain reachable in the shared Compute workspace`);
  }
  assert.match(settings, /<MediaRoutingPanel\b/, "MediaRoutingPanel must remain reachable in dedicated ComfyUI Settings");
  assert.doesNotMatch(compute, /<MediaRoutingPanel\b/, "Local and Cloud Compute must not duplicate detailed ComfyUI configuration");
  for (const component of ["BuzzSettingsPanel", "BuzzLiveHealthCard", "AgentObservabilityPanel", "LocalRuntimePanel"]) {
    assert.match(settings, new RegExp(`<${component}\\b`), `${component} must remain reachable in Settings`);
  }
  assert.match(settings, /No silent cloud fallback/);
  assert.match(compute, /paid routes remain explicit/i);
  assert.match(compute, /Credentials stay outside story projects/i);
});

test("#1111 dark surface guard still scopes every dynamically mounted Settings section", async () => {
  const [guard, source] = await Promise.all([
    read("app/settings-dark-surface-guard.css"),
    read("app/sage-settings-workspace.tsx"),
  ]);
  assert.match(source, /data-plotpickle-settings="v2"/);
  assert.match(guard, /\[data-plotpickle-settings="v2"\]/);
  assert.match(guard, /\[data-settings-section\]/);
  assert.doesNotMatch(guard, /background(?:-color)?\s*:\s*(?:white|#fff(?:fff)?\b)/i);
});

test("#1111 active navigation remains keyboard-visible and center content avoids a second horizontal layout system", async () => {
  const css = await read("app/sage-settings-workspace.module.css");
  assert.match(css, /button:focus-visible/);
  assert.match(css, /button\[aria-current="page"\]/);
  assert.match(css, /width:\s*100%/);
  assert.doesNotMatch(css, /grid-template-columns:\s*[^;]*19%[^;]*56%[^;]*25%/i, "the shared workspace continuity layer must remain the one owner of three-column proportions");
});
