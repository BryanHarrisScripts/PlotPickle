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

test("#1111 exposes more than five major Settings destinations without returning to a Settings home screen", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  for (const id of ["overview", "updates", "help", "models", "routing", "media", "ollama", "openai", "minimax", "activity", "buzz", "runtime"]) {
    assert.match(source, new RegExp(`id: ["']${id}["']`), `missing Settings destination ${id}`);
  }
  assert.match(source, /SETTINGS_GROUPS/);
  assert.match(source, /Start/);
  assert.match(source, /Local AI/);
  assert.match(source, /Providers/);
  assert.match(source, /System/);
});

test("#1111 Settings deep links are bookmarkable and browser back/forward restores the active center section", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  assert.match(source, /const SETTINGS_QUERY_KEY = "settings"/);
  assert.match(source, /url\.searchParams\.set\(SETTINGS_QUERY_KEY, section\)/);
  assert.match(source, /window\.history\.pushState/);
  assert.match(source, /window\.history\.replaceState/);
  assert.match(source, /window\.addEventListener\("popstate", sync\)/);
  assert.match(source, /window\.sessionStorage\.setItem\(SETTINGS_SECTION_KEY, section\)/);
  assert.match(source, /LEGACY_TARGETS/, "old Settings deep links must continue to resolve into the new navigation model");
  const hashIndex = source.indexOf("if (url.hash)");
  const queryIndex = source.indexOf("const querySection = url.searchParams.get(SETTINGS_QUERY_KEY)");
  assert.ok(hashIndex >= 0 && queryIndex >= 0 && hashIndex < queryIndex, "legacy hash destinations must win over a stale settings query so HELP, AI Routing, ComfyUI and provider links remain usable");
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

test("#1111 overview distinguishes process-running from capability-ready and deep-links each status to configure/test", async () => {
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

test("#1111 reuses existing configure and test owners for text media providers BUZZ and runtime", async () => {
  const source = await read("app/sage-settings-workspace.tsx");
  for (const component of [
    "SageFastModelSetup",
    "AiRoutingPanel",
    "MediaRoutingPanel",
    "AiProviderSetupPanel",
    "WritingAssistantConsole",
    "BuzzSettingsPanel",
    "BuzzLiveHealthCard",
    "AgentObservabilityPanel",
    "LocalRuntimePanel",
  ]) {
    assert.match(source, new RegExp(`<${component}\\b`), `${component} must remain reachable in the unified Settings workspace`);
  }
  assert.match(source, /No silent cloud fallback/);
  assert.match(source, /paid calls remain explicit/i);
  assert.match(source, /Credentials stay protected/i);
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
