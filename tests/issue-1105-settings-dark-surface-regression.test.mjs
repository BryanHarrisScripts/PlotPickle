import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reviewRenderedUi } from "../scripts/writer-visual-observer-v3.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const SETTINGS_SECTIONS = [
  "settings-quick",
  "settings-help",
  "settings-models",
  "settings-activity",
  "settings-routing",
  "settings-ollama",
  "settings-openai",
  "settings-minimax",
  "settings-comfyui",
  "settings-advanced",
];

test("#1105 inventories every active Settings route and nested provider/runtime panel under one dark workspace root", async () => {
  const workspace = await read("app/sage-settings-workspace.tsx");

  assert.match(workspace, /data-plotpickle-settings="v2"/);
  assert.match(workspace, /data-settings-main/);
  for (const section of SETTINGS_SECTIONS) {
    assert.match(workspace, new RegExp(`id=["']${section}["']`), `${section} must remain in the Settings route inventory`);
  }

  for (const component of [
    "SettingsHelperDirectory",
    "SageFastModelSetup",
    "AgentObservabilityPanel",
    "BuzzLiveHealthCard",
    "AiRoutingPanel",
    "AiProviderSetupPanel",
    "WritingAssistantConsole",
    "MediaRoutingPanel",
    "DeepSeekHarnessPanel",
    "LocalRuntimePanel",
  ]) {
    assert.match(workspace, new RegExp(`<${component}\\b`), `${component} must remain covered by the Settings surface root`);
  }
});

test("#1105 loads one shared Settings surface guard after workspace continuity and uses only semantic PlotPickle tokens", async () => {
  const [layout, guard] = await Promise.all([
    read("app/layout.tsx"),
    read("app/settings-dark-surface-guard.css"),
  ]);

  const continuityImport = layout.indexOf('import "./workspace-continuity.css";');
  const guardImport = layout.indexOf('import "./settings-dark-surface-guard.css";');
  assert.ok(continuityImport >= 0, "workspace continuity must remain loaded");
  assert.ok(guardImport > continuityImport, "Settings guard must load after continuity so nested legacy surfaces cannot win the cascade");

  for (const token of [
    "--pp-matte",
    "--pp-surface",
    "--pp-surface-raised",
    "--pp-surface-hover",
    "--pp-line",
    "--pp-line-strong",
    "--pp-text",
    "--pp-muted",
    "--pp-teal",
    "--pp-orange",
  ]) {
    assert.match(guard, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(guard, /\[data-plotpickle-settings="v2"\]/);
  assert.match(guard, /\[data-settings-main\]/);
  assert.match(guard, /\[data-settings-section\]/);
  assert.doesNotMatch(guard, /background(?:-color)?\s*:\s*(?:white|#fff(?:fff)?\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i);
});

test("#1105 covers embedded cards, forms, controls, loading, empty, error and overlay-like surfaces without changing their runtime owners", async () => {
  const guard = await read("app/settings-dark-surface-guard.css");

  for (const selectorTerm of [
    "section",
    "article",
    "aside",
    "nav",
    "form",
    "fieldset",
    "details",
    "table",
    "dialog",
    '[role="dialog"]',
    '[role="tabpanel"]',
    '[role="menu"]',
    '[role="listbox"]',
    "textarea",
    "select",
    '[role="status"]',
    '[role="alert"]',
    '[aria-busy="true"]',
    "[data-empty]",
    "[data-loading]",
    "[data-error]",
  ]) {
    assert.ok(guard.includes(selectorTerm), `${selectorTerm} must inherit the Settings dark surface contract`);
  }

  assert.match(guard, /color-scheme:\s*dark/);
  assert.match(guard, /:focus-visible/);
  assert.match(guard, /:hover:not\(:disabled\)/);
});

test("#1105 keeps rendered Settings light surfaces actionable in the Writer visual UAT", () => {
  const baseFacts = {
    theme: "dark",
    viewport: { width: 1440, height: 900 },
    horizontalOverflow: 0,
    clippedControls: [],
    overlaps: [],
    main: { rect: { width: 1380 }, gapImbalance: 0 },
  };

  const failing = reviewRenderedUi("SETTINGS", {
    ...baseFacts,
    lightSurfaces: [{ tag: "section", background: "rgb(255, 255, 255)" }],
  });
  assert.ok(failing.some((finding) => finding.actionable && /large light-coloured surfaces remain/i.test(finding.summary)));

  const clean = reviewRenderedUi("SETTINGS", { ...baseFacts, lightSurfaces: [] });
  assert.equal(clean.some((finding) => /large light-coloured surfaces remain/i.test(finding.summary)), false);
});

test("#1105 preserves the existing #1046 dark AI/media routing expectations while adding the Settings-wide guard", async () => {
  const [mediaCss, routingCss] = await Promise.all([
    read("app/media-routing-panel.module.css"),
    read("app/ai-routing-panel.module.css"),
  ]);

  assert.doesNotMatch(mediaCss, /#f9fffd|#f2f8f7|#fbfdfd|#f5fbf9|#f4f8f7|#edf7f4|#eef8f5|background:\s*#fff\b|background:\s*white\b/i);
  assert.match(mediaCss, /--pp-matte/);
  assert.match(mediaCss, /--pp-surface/);

  assert.match(routingCss, /--routing-bg:\s*#090a0b/);
  assert.match(routingCss, /--routing-panel:\s*#111315/);
  assert.doesNotMatch(routingCss, /background:\s*#fff\b|background:\s*white\b/i);
});
