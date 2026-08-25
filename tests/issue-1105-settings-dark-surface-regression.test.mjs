import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reviewRenderedUi } from "../scripts/writer-visual-observer-v3.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const SETTINGS_SECTIONS = [
  "settings-quick",
  "settings-updates",
  "settings-help",
  "settings-sage-plan",
  "settings-local-compute",
  "settings-cloud-compute",
  "settings-comfyui",
  "settings-buzz",
  "settings-activity",
  "settings-advanced",
];

test("#1105/#1377 inventories every active Settings route and nested provider/runtime panel under one dark workspace root", async () => {
  const [workspace, compute] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);

  assert.ok(workspace.includes('data-plotpickle-settings="v2"'));
  assert.ok(workspace.includes("data-settings-main"));
  for (const section of SETTINGS_SECTIONS) {
    assert.ok(workspace.includes(`id="${section}"`), `${section} must remain in the Settings route inventory`);
  }
  assert.match(workspace, /"settings-models": "local-compute"/);
  assert.match(workspace, /"settings-comfyui": "comfyui"/);
  assert.match(workspace, /"settings-openai": "cloud-compute"/);

  for (const component of [
    "SettingsHelperDirectory",
    "AgentObservabilityPanel",
    "BuzzLiveHealthCard",
    "DeepSeekHarnessPanel",
    "LocalRuntimePanel",
  ]) {
    assert.ok(workspace.includes(`<${component}`), `${component} must remain covered by the Settings surface root`);
  }
  assert.ok(workspace.includes("<MediaRoutingPanel"), "MediaRoutingPanel must remain covered by the dedicated ComfyUI Settings surface");
  for (const component of ["SageFastModelSetup", "AiRoutingPanel", "AiProviderSetupPanel", "LocalRuntimePanel"]) {
    assert.ok(compute.includes(`<${component}`), `${component} must remain covered by the shared Compute surface root`);
  }
  assert.doesNotMatch(compute, /<MediaRoutingPanel/, "detailed ComfyUI configuration must have only one Settings owner");
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
    assert.ok(guard.includes(token), `${token} must remain part of the Settings surface contract`);
  }

  assert.ok(guard.includes('[data-plotpickle-settings="v2"]'));
  assert.ok(guard.includes("[data-settings-main]"));
  assert.ok(guard.includes("[data-settings-section]"));
  assert.doesNotMatch(guard, /background(?:-color)?\s*:\s*(?:white|#fff(?:fff)?\b|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/i);
});

test("#1215/#1377/#1392 keeps provider panels inside their guarded Settings surfaces", async () => {
  const [guard, workspace, compute] = await Promise.all([
    read("app/settings-dark-surface-guard.css"),
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);

  assert.ok(guard.includes(":where(div, header, footer, figure)"));
  assert.ok(guard.includes("background-image: none !important"));
  for (const section of ["local-compute", "cloud-compute", "comfyui", "buzz"]) {
    assert.ok(workspace.includes(`case "${section}"`), `${section} must remain routed through the shared Settings dark boundary`);
  }
  for (const component of ["AiProviderSetupPanel", "SageFastModelSetup"]) {
    assert.ok(compute.includes(`<${component}`), `${component} must remain inside the guarded Compute workspace`);
  }
  for (const component of ["MediaRoutingPanel", "BuzzSettingsPanel", "BuzzLiveHealthCard"]) {
    assert.ok(workspace.includes(`<${component}`), `${component} must remain inside the guarded Settings workspace`);
  }
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

test("#1105 preserves the existing dark AI/media routing expectations while adding the shared Compute shell", async () => {
  const [mediaCss, routingCss, computeCss] = await Promise.all([
    read("app/media-routing-panel.module.css"),
    read("app/ai-routing-panel.module.css"),
    read("app/settings/compute/ai-compute-workspace.module.css"),
  ]);

  assert.doesNotMatch(mediaCss, /#f9fffd|#f2f8f7|#fbfdfd|#f5fbf9|#f4f8f7|#edf7f4|#eef8f5|background:\s*#fff\b|background:\s*white\b/i);
  assert.match(mediaCss, /--pp-matte/);
  assert.match(mediaCss, /--pp-surface/);

  assert.match(routingCss, /--routing-bg:\s*#090a0b/);
  assert.match(routingCss, /--routing-panel:\s*#111315/);
  assert.doesNotMatch(routingCss, /background:\s*#fff\b|background:\s*white\b/i);
  assert.doesNotMatch(computeCss, /background(?:-color)?\s*:\s*(?:white|#fff(?:fff)?\b)/i);
});
