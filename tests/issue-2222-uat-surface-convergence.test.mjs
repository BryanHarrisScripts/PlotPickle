import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2222 UAT start authenticates first, saves Afterglow with explicit authority and never reloads the page", async () => {
  const [panel, privateBrowser] = await Promise.all([
    read("app/skin-v1/uat-guide-panel.tsx"),
    read("core/storage/profile-private-browser.ts"),
  ]);

  const authIndex = panel.indexOf("const csrf = await csrfToken()");
  const prepareIndex = panel.indexOf("await ensureAfterglowWorkingCopy(csrf)");
  const runIndex = panel.indexOf('action: "start"');

  assert.ok(authIndex >= 0, "UAT must verify the current Human session.");
  assert.ok(prepareIndex > authIndex, "Afterglow persistence must follow successful Human authentication.");
  assert.ok(runIndex > prepareIndex, "The deterministic runner must start only after the working copy is durable.");
  assert.match(panel, /await persistActiveProfileProject\(csrf\)/u);
  assert.doesNotMatch(panel, /window\.location\.reload|location\.reload/u);
  assert.match(panel, /normal profile control/u);

  assert.match(privateBrowser, /function queueWrite\(action: string, payload: Record<string, unknown>, explicitToken = ""\)/u);
  assert.match(privateBrowser, /const token = explicitToken \|\| csrfToken/u);
  assert.match(privateBrowser, /persistActiveProfileProject\(explicitToken = ""\)/u);
});

test("#2222 UAT evidence stays in Semantic Review instead of opening Full Verification Inbox", async () => {
  const [panel, route, runner] = await Promise.all([
    read("app/skin-v1/uat-guide-panel.tsx"),
    read("app/api/auth/uat-guide/route.ts"),
    read("scripts/run-uat-guide.mjs"),
  ]);

  assert.doesNotMatch(panel, />Verification Inbox<|\/verification-inbox/u);
  assert.doesNotMatch(route, /verificationInbox|\/verification-inbox/u);
  assert.doesNotMatch(runner, /Verification Inbox|verificationInbox|\/verification-inbox/u);
  assert.match(panel, /In-page command window/u);
  assert.match(runner, /The in-page review retains the bounded result and linked evidence/u);
});

test("#2224 Human UAT exposes only the current three pre-production buckets and the persistent project id", async () => {
  const panel = await read("app/skin-v1/uat-guide-panel.tsx");

  assert.match(panel, /const PREPRODUCTION_UAT_BUCKETS = \[/u);
  for (const route of [
    "/?workspace=dashboard&block=17&mini=1",
    "/storyboard?block=17&mini=1",
    "/previs?block=17&mini=1",
  ]) assert.ok(panel.includes(route), `Missing current pre-production UAT bucket: ${route}`);

  assert.match(panel, /setWorkingProjectId\(prepared\.project\.id\)/u);
  assert.match(panel, /<b>Project ID<\/b>\{workingProjectId/u);
  assert.match(panel, /data-uat-project-id=\{workingProjectId \|\| undefined\}/u);
  assert.match(panel, /data-uat-bucket=\{surface\.id\}/u);
  assert.match(panel, /three pre-production buckets: Outline, Storyboard and Previs/u);
  assert.match(panel, /planned five-bucket pre-production model/u);

  const bucketBlock = panel.slice(
    panel.indexOf("const PREPRODUCTION_UAT_BUCKETS"),
    panel.indexOf("] as const;", panel.indexOf("const PREPRODUCTION_UAT_BUCKETS")) + "] as const;".length,
  );
  assert.doesNotMatch(bucketBlock, /Story Cards|Write|Scene Workspace|Production inspection/u);
  assert.doesNotMatch(bucketBlock, /\/structure|\/production/u);
});

test("#2222 pre-production context is a compact Matrix header, not a legacy full-page section", async () => {
  const [nav, css] = await Promise.all([
    read("app/_components/preproduction/preproduction-context-nav.tsx"),
    read("app/_components/preproduction/preproduction-context-nav.module.css"),
  ]);

  assert.match(nav, /<header className=\{styles\.context\} aria-label="PRE-PRODUCTION context" data-matrix-preproduction-context="current">/u);
  assert.doesNotMatch(nav, /<section className=\{styles\.context\}/u);
  assert.match(css, /grid-template-columns: minmax\(180px, 0\.8fr\)/u);
  assert.match(css, /font-family: var\(--pp-skin-font-ui\)/u);
  assert.match(css, /background: var\(--pp-skin-fill-panel\)/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

test("#2222 Write keeps current authority while making the editor the dominant Matrix work area", async () => {
  const [write, css] = await Promise.all([
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("modules/write/ui/block-native-write-workspace.module.css"),
  ]);

  assert.match(write, /loadActiveLibraryProject\(\)/u);
  assert.match(write, /saveActiveLibraryProject\(next\)/u);
  assert.match(write, /IMMUTABLE SOURCE EVIDENCE/u);
  assert.match(write, /WORKING SCREENPLAY TEXT/u);
  assert.match(css, /grid-template-columns: minmax\(0, 1\.7fr\) minmax\(280px, 0\.72fr\)/u);
  assert.match(css, /\.editorPanel \{[\s\S]*order: 1/u);
  assert.match(css, /\.sourcePanel \{[\s\S]*order: 2/u);
  assert.match(css, /min-height: 58vh/u);
  assert.match(css, /font-family: var\(--pp-skin-font-ui\)/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/iu);
});

test("#2222 Storyboard and Previs keep current PPF authority while using compact Matrix hierarchy", async () => {
  const [storyboardPage, storyboardCss, previsCss] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);

  assert.match(storyboardPage, /legacyProject=\{null\}/u);
  assert.match(storyboardPage, /loadFoundationProject\(\)/u);
  assert.match(storyboardCss, /padding: var\(--pp-skin-space-3\) var\(--pp-skin-space-3\) var\(--pp-skin-space-6\)/u);
  assert.match(storyboardCss, /max-height: 150px/u);
  assert.match(storyboardCss, /grid-template-columns: repeat\(24, minmax\(38px, 1fr\)\)/u);
  assert.match(previsCss, /#2222 — keep canonical Previs authority/u);
  assert.match(previsCss, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/u);

  for (const css of [storyboardCss, previsCss]) {
    assert.match(css, /var\(--pp-skin-/u);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//gu, ""), /#[0-9a-f]{3,8}\b|rgba?\(/iu);
  }
});
