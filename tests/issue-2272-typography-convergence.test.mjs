import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2272 Phase 4 projects the existing semantic typography authority after legacy surface CSS", async () => {
  const [layout, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1-semantic-typography.css"),
  ]);

  const importIndex = layout.indexOf('import "./skin-v1-semantic-typography.css";');
  const orchestratorIndex = layout.indexOf('import "./skin-v1-surface-orchestrator.css";');
  const legacyTailIndex = layout.indexOf('import "./issue-2061.css";');

  assert.ok(importIndex > orchestratorIndex, "semantic typography must load after the Skin V1 orchestrator");
  assert.ok(importIndex > legacyTailIndex, "semantic typography must be the final Skin V1 presentation projection");

  for (const token of [
    "--pp-skin-font-h1",
    "--pp-skin-font-h2",
    "--pp-skin-font-h3",
    "--pp-skin-font-h4",
    "--pp-skin-font-h5",
    "--pp-skin-font-h6",
    "--pp-skin-font-body",
    "--pp-skin-font-meta",
    "--pp-skin-font-detail",
    "--pp-skin-font-note",
    "--pp-skin-font-sm",
    "--pp-skin-weight-regular",
    "--pp-skin-weight-semibold",
    "--pp-skin-weight-bold",
  ]) {
    assert.ok(css.includes(token), `missing semantic token ${token}`);
  }

  assert.match(css, /body h1[\s\S]*font-size:\s*var\(--pp-skin-font-h1\) !important/u);
  assert.match(css, /body h2[\s\S]*font-size:\s*var\(--pp-skin-font-h2\) !important/u);
  assert.match(css, /body h3[\s\S]*font-weight:\s*var\(--pp-skin-weight-semibold\) !important/u);
  assert.match(css, /data-settings-menu/u);
  assert.match(css, /data-library-shortcut/u);
  assert.match(css, /data-skin-typography="status"/u);

  assert.doesNotMatch(css, /body\s+p\s*\{/u, "generic paragraph fallback must remain ungoverned");
  assert.doesNotMatch(css, /body\s+button\s*\{/u, "generic button fallback must remain ungoverned");
  assert.doesNotMatch(css, /pp-skin-v1-dashboard-brand/u, "Dashboard display typography stays owned by the canonical Dashboard reference");
});

test("#2272 Phase 4 keeps colour out of the typography convergence layer", async () => {
  const css = await read("app/skin-v1-semantic-typography.css");
  assert.doesNotMatch(css, /\bcolor\s*:/u);
  assert.doesNotMatch(css, /background(?:-color)?\s*:/u);
  assert.doesNotMatch(css, /border(?:-[a-z]+)?\s*:/u);
});
