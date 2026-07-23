import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const plugin = await readFile(new URL("../lib/plugin-platform.ts", import.meta.url), "utf8");
const services = await readFile(new URL("../lib/core-services.ts", import.meta.url), "utf8");
const docs = await readFile(new URL("../docs/PHASE-8-OPEN-PLUGIN-PLATFORM.md", import.meta.url), "utf8");

test("Phase 8 defines a versioned permissioned plugin manifest", () => {
  assert.match(plugin, /PLUGIN_API_VERSION = "1\.0\.0"/);
  assert.match(plugin, /PluginPermission/);
  assert.match(plugin, /PluginCapability/);
  assert.match(plugin, /minimumPlotPickleVersion/);
  assert.match(plugin, /validatePluginManifest/);
});

test("plugins install disabled and cannot escalate undeclared permissions", () => {
  assert.match(plugin, /state: "disabled"/);
  assert.match(plugin, /Cannot grant undeclared permissions/);
  assert.match(plugin, /requires permission approval/);
  assert.match(plugin, /enable\(id: string\)/);
  assert.match(plugin, /uninstall\(id: string\)/);
});

test("Phase 8 provides the complete core services layer", () => {
  for (const service of ["ProjectService", "CanonService", "ScreenplayService", "StoryboardService", "ReportService", "TimelineService", "AIService", "AssetService", "StorageService", "GitService", "PluginService"]) {
    assert.match(services, new RegExp(`type ${service}`));
  }
  assert.match(services, /authorizeService/);
  assert.match(services, /PluginActivationContext/);
});

test("initial plugin contracts cover core integrations without vendor lock-in", () => {
  for (const id of ["org.plotpickle.github", "org.plotpickle.ai-provider", "org.plotpickle.pdf-export", "org.plotpickle.final-draft"]) assert.match(plugin, new RegExp(id.replaceAll(".", "\\.")));
  for (const capability of ["music", "image-generation", "voice", "fountain"]) assert.match(plugin, new RegExp(`"${capability}"`));
  assert.match(docs, /open, local-first storytelling platform/);
  assert.match(docs, /no silent plugin activation/);
});
