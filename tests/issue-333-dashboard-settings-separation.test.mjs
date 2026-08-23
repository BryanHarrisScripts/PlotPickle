import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issues #329-#333 keep Dashboard read-only and tri-colour", async () => {
  const [layout, dashboard] = await Promise.all([
    source("app/layout.tsx"),
    source("app/setup-connections-dashboard.tsx"),
  ]);
  assert.doesNotMatch(layout, /ConfigurationDashboardHost/);
  assert.match(dashboard, /type SetupTone = "green" \| "yellow" \| "red"/);
  assert.doesNotMatch(dashboard, /"grey"|Test all connections|<input|<select|<textarea/);
  assert.doesNotMatch(dashboard, /target="_blank"/);
  assert.match(dashboard, /Open settings/);
  for (const target of ["ollama", "openai", "minimax", "comfyui"]) {
    assert.match(dashboard, new RegExp(`settingsSection: "${target}"`));
  }
});

test("issues #327-#331 provide stable independent component sections", async () => {
  const [settings, legacy, assistant, taxonomyText] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("app/settings-panel-legacy.tsx"),
    source("app/writing-assistant-console.tsx"),
    source("config/settings-system-taxonomy.json"),
  ]);
  for (const target of ["ollama", "openai", "minimax", "comfyui"]) {
    assert.ok(settings.includes(`activeItem.target === "${target}"`) || settings.includes(`target === "${target}"`), `Missing component section: ${target}`);
    assert.ok(taxonomyText.includes(`"target": "${target}"`), `Missing taxonomy target: ${target}`);
  }
  assert.match(settings, /WritingAssistantConsole/);
  assert.match(settings, /MediaRoutingPanel/);
  assert.match(settings, /H3NativePanel/);
  assert.match(settings, /window\.sessionStorage\.setItem\(SETTINGS_SECTION_KEY, target\)/);
  assert.match(legacy, /forcedSection/);
  assert.match(legacy, /forcedProvider/);
  assert.match(assistant, /focusProvider/);
});
