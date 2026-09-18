import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("#2226 composition reference is subordinate to the existing Skin V1 authority chain", async () => {
  const [reference, grammar] = await Promise.all([
    readJson("config/skin-v1-surface-composition-reference.json"),
    readJson("config/skin-v1-surface-grammar.json"),
  ]);

  assert.equal(reference.issue, 2226);
  assert.equal(reference.authority.parentProductStandard, "docs/UI-UX-DESIGN-STANDARD.md");
  assert.equal(reference.authority.tokenSource, "app/skin-v1-definition.css");
  assert.equal(reference.authority.grammarSource, "config/skin-v1-surface-grammar.json");
  assert.equal(reference.authority.registrySource, "config/skin-v1-surface-registry.json");
  assert.equal(reference.authority.mayCreateSecondDesignSystem, false);
  assert.equal(grammar.compositionReference, "config/skin-v1-surface-composition-reference.json");
});

test("#2226 composition reference records the Human-approved shell, frame and selected-state geometry", async () => {
  const reference = await readJson("config/skin-v1-surface-composition-reference.json");

  assert.equal(reference.shell.maxWidthPx, 1180);
  assert.equal(reference.shell.minimumDesktopGutterPerSidePx, 20);
  assert.equal(reference.shell.directoryBodyMaxPx, 1060);
  assert.equal(reference.bordersAndFrames.onePixel.px, 1);
  assert.equal(reference.bordersAndFrames.twoPixel.px, 2);
  assert.equal(reference.bordersAndFrames.outerFrame.style, "solid");
  assert.equal(reference.bordersAndFrames.insetFrame.style, "solid");
  assert.equal(reference.bordersAndFrames.dottedStructuralBordersAllowed, false);
  assert.equal(reference.bordersAndFrames.dashedStructuralBordersAllowed, false);
  assert.equal(reference.interactionStates.selected.backgroundToken, "--pp-skin-accent-deep");
  assert.equal(reference.interactionStates.selected.borderColorToken, "--pp-skin-accent-bright");
  assert.equal(reference.interactionStates.selected.starkWhiteFillAllowed, false);
});

test("#2226 composition reference defines menu, submenu, header, footer, eyebrow and typography wrappers", async () => {
  const reference = await readJson("config/skin-v1-surface-composition-reference.json");

  assert.deepEqual(reference.headers.global.textPattern, ["PLOTPICKLE", "<CURRENT SURFACE>", "SKIN V1"]);
  assert.equal(reference.headers.global.minHeightPx, 42);
  assert.equal(reference.headers.global.backgroundToken, "--pp-skin-accent-deep");
  assert.equal(reference.surfaceActions.horizontalAlignment, "right");
  assert.equal(reference.menus.directory.bodyWidthPx, 1060);
  assert.equal(reference.menus.submenu.inheritsDirectoryGeometry, true);
  assert.equal(reference.eyebrowHighlights.standard.fontSizeToken, "--pp-skin-font-meta");
  assert.equal(reference.footer.requiredForGovernedSurfaces, true);
  assert.equal(reference.typography.rules.localFontFamiliesAllowed, false);
  assert.equal(reference.typography.rules.localTitleScaleAllowed, false);
});

test("#2226 composition reference exposes only census-backed shell compositions", async () => {
  const reference = await readJson("config/skin-v1-surface-composition-reference.json");
  const layouts = reference.layoutPatterns;

  assert.equal(layouts.oneColumn.columns, 1);
  assert.equal(layouts.twoColumn.columns, 2);
  assert.equal(layouts.threeColumn.columns, 3);
  assert.equal(layouts.threeColumnWithNestedOneColumn.columns, 3);
  assert.equal(layouts.threeColumnWithNestedOneColumn.nestedColumnFlow, "row");
  assert.equal(layouts.oneColumnWithOneColumnPills.nested, "pillPatterns.oneColumnStack");
  assert.equal(layouts.oneColumnWithTwoColumnPills.nested, "pillPatterns.twoColumnGrid");
  assert.equal(layouts.oneColumnWithThreeColumnPills.nested, "pillPatterns.threeColumnGrid");
  assert.equal(layouts.fourColumnShell.allowed, false);
});

test("#2226 Skin V1 pill recipes remain square and support 1/2/3-column arrangements", async () => {
  const reference = await readJson("config/skin-v1-surface-composition-reference.json");
  const pills = reference.pillPatterns;

  assert.equal(pills.oneColumnStack.columns, 1);
  assert.equal(pills.twoColumnGrid.columns, 2);
  assert.equal(pills.threeColumnGrid.columns, 3);
  assert.equal(pills.styling.radiusPx, 0);
  assert.equal(pills.styling.selectedBackgroundToken, "--pp-skin-accent-deep");
  assert.equal(pills.styling.selectedBorderColorToken, "--pp-skin-accent-bright");
});

test("#2226 composition reference carries the anti-drift constraints discussed with Human review", async () => {
  const reference = await readJson("config/skin-v1-surface-composition-reference.json");
  const rules = reference.antiDriftRules;

  for (const expected of [
    "No local font family.",
    "No local structural palette.",
    "No dotted structural frames.",
    "No stark-white selected state.",
    "No duplicate global headers.",
    "No invented four-column shell.",
    "No 1500px local production shell.",
  ]) {
    assert.ok(rules.includes(expected), "missing anti-drift rule: " + expected);
  }
});
