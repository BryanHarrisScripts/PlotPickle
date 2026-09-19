import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2283 keeps color convergence removable and late-loaded", async () => {
  const [layout, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1-color-convergence.css"),
  ]);

  const colorIndex = layout.indexOf('import "./skin-v1-color-convergence.css";');
  const typeIndex = layout.indexOf('import "./skin-v1-semantic-typography.css";');
  assert.ok(colorIndex > typeIndex, "color convergence must load after semantic typography and legacy presentation");

  for (const token of [
    "--pp-skin-surface-0",
    "--pp-skin-surface-1",
    "--pp-skin-surface-3",
    "--pp-skin-ink",
    "--pp-skin-ink-soft",
    "--pp-skin-line",
    "--pp-skin-line-strong",
    "--pp-skin-accent-deep",
    "--pp-skin-accent-bright",
    "--pp-skin-focus",
    "--pp-skin-disabled",
  ]) {
    assert.ok(css.includes(`var(${token})`), `missing existing Skin V1 semantic token ${token}`);
  }
});

test("#2283 introduces no raw colors, second palette, or geometry/typography authority", async () => {
  const css = await read("app/skin-v1-color-convergence.css");

  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla|oklab|oklch)\s*\(/iu);
  assert.doesNotMatch(css, /--pp-skin-[a-z0-9-]+\s*:/iu, "projection must consume tokens, not define them");

  for (const property of [
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "margin",
    "padding",
    "display",
    "position",
    "grid-template-columns",
    "gap",
    "font",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-transform",
  ]) {
    assert.doesNotMatch(css, new RegExp(`^\\s*${property.replace("-", "\\-")}\\s*:`, "imu"), `color phase must not own ${property}`);
  }
});

test("#2283 scopes existing semantic color roles to every current palette-finding family", async () => {
  const css = await read("app/skin-v1-color-convergence.css");

  for (const evidence of [
    'section[aria-label="PlotPickle Community"]',
    'section[aria-label="LEARN Explore All Curriculum"]',
    'main[data-library-workspace="v2"]',
    'section[data-library-destination="archive"]',
    '[data-progressive-story-map="24x96"]',
    'main[aria-labelledby="storyboard-readiness-title"]',
    'main[aria-labelledby="previs-title"]',
    '[data-block-native-write="24x96"]',
    '[data-pageflow-authority="ppf-block-writing-read-only"]',
    'section[aria-label="User Profile"].pp-skin-v1-profile-surface',
    'section[aria-label="Story Mode directory"]',
    'section[aria-label="Issue Log"][data-dashboard-review-surface="help"]',
  ]) {
    assert.ok(css.includes(evidence), `missing bounded color scope ${evidence}`);
  }
});
