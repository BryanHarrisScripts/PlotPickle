import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalSurface } from "../lib/verification/skin-v1-surface-registry.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2226 Phase 3 records the Human-approved canonical shell geometry", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  const decision = grammar.canonicalShellDecision;

  assert.equal(decision.issue, 2226);
  assert.equal(decision.phase, 3);
  assert.equal(decision.approval, "human-approved");
  assert.equal(decision.outerShellMaxPx, 1180);
  assert.equal(decision.desktopViewportInsetPx, 40);
  assert.equal(decision.desktopGutterPerSidePx, 20);
  assert.equal(decision.directoryBodyMaxPx, 1060);
  assert.equal(decision.directoryBodyToken, "--pp-skin-menu-max");
  assert.equal(decision.workspaceFullShellAllowed, true);
  assert.equal(decision.outerFrame.widthPx, 2);
  assert.equal(decision.outerFrame.style, "solid");
  assert.equal(decision.insetFrame.widthPx, 1);
  assert.equal(decision.insetFrame.style, "solid");
  assert.equal(decision.radiusPx, 0);
  assert.equal(decision.selectedStateProfile, "canonical-dark-accent");
  assert.equal(
    decision.baselineReplacement,
    "requires-separate-human-acceptance-of-resulting-dashboard-candidate"
  );
});

test("#2226 Phase 3 binds Dashboard to the approved directory measure and layered frame", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  const dashboard = canonicalSurface("dashboard");
  const shell = grammar.shellProfiles[dashboard.formatProfile.shell];
  const measure = grammar.bodyMeasureProfiles[shell.bodyMeasure];
  const frame = grammar.frameProfiles[shell.frame];

  assert.equal(grammar.profileContract.dashboardMeasureDecision, "human-approved-phase-3");
  assert.equal(dashboard.formatProfile.frame, "layered-inset");
  assert.equal(shell.bodyMeasure, "canonical-directory");
  assert.equal(shell.frame, "layered-inset");
  assert.equal(measure.maxPx, 1180);
  assert.equal(measure.desktopViewportInsetPx, 40);
  assert.equal(measure.innerMaxPx, 1060);
  assert.equal(measure.innerToken, "--pp-skin-menu-max");
  assert.equal(measure.innerExpression, "min(var(--pp-skin-menu-max), calc(100% - 72px))");
  assert.equal(frame.outerBorderToken, "--pp-skin-border-strong");
  assert.equal(frame.insetBorderToken, "--pp-skin-border-thin");
  assert.equal(frame.insetLineToken, "--pp-skin-line");
  assert.equal(frame.fillToken, "--pp-skin-fill-panel");
});

test("#2226 Phase 3 Dashboard CSS renders the approved 2px + 1px matte frame without changing composition", async () => {
  const css = await read("app/skin-v1-dashboard-reference.css");

  assert.match(
    css,
    /width: min\(var\(--pp-skin-shell-max\), calc\(100vw - 40px\)\) !important;/
  );
  assert.match(
    css,
    /border: var\(--pp-skin-border-strong\) solid var\(--pp-skin-line-strong\) !important;/
  );
  assert.match(css, /background: var\(--pp-skin-fill-panel\) !important;/);
  assert.match(
    css,
    /box-shadow: var\(--pp-skin-shadow-panel\), inset 0 0 0 var\(--pp-skin-border-thin\) var\(--pp-skin-line\), var\(--pp-skin-inset-highlight\) !important;/
  );
  assert.match(
    css,
    /width: min\(var\(--pp-skin-menu-max\), calc\(100% - 72px\)\) !important;/
  );
  assert.match(
    css,
    /\.pp-skin-v1-menu-item\.pp-skin-v1-dashboard-row\.is-selected[\s\S]*background: var\(--pp-skin-accent-deep\) !important;[\s\S]*color: var\(--pp-skin-ink\) !important;/
  );
});

test("#2226 Phase 3 does not authorize locked Dashboard baseline replacement yet", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  assert.match(grammar.canonicalShellDecision.baselineReplacement, /^requires-separate-human-acceptance/);
});
