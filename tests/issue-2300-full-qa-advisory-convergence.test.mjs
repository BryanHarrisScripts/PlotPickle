import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (target) => readFile(new URL("../" + target, import.meta.url), "utf8");

test("#2300 Interaction measures first-Tab entry from neutral browser focus", async () => {
  const source = await read("lib/verification/browser-probes/interaction.mjs");
  assert.match(source, /document\.activeElement/u);
  assert.match(source, /active instanceof HTMLElement && active !== document\.body/u);
  assert.match(source, /active\.blur\(\)/u);
  assert.match(source, /page\.keyboard\.press\("Tab"\)/u);
  assert.ok(source.indexOf("active.blur()") < source.indexOf('page.keyboard.press("Tab")'));
});

test("#2300 Runtime clipped-control evidence identifies the control and measured geometry", async () => {
  const source = await read("lib/verification/browser-probes/runtime.mjs");
  for (const field of [
    "accessibleName",
    "rootRect",
    "clippedLeftPx",
    "clippedRightPx",
  ]) assert.ok(source.includes(field), "missing clipped-control evidence field " + field);
  assert.match(source, /accessibleName\(node\).*slice\(0, 80\)/su);
  assert.match(source, /rect:\s*\{ left: round\(rect\.left\), right: round\(rect\.right\) \}/u);
});

test("#2300 Write governed editor frame grows with content", async () => {
  const css = await read("app/skin-v1-surface-orchestrator.css");
  const rule = css.match(/\[data-skin-v1-surface-id="write"\]\s*\{[\s\S]*?\n\}/u)?.[0] || "";
  assert.match(rule, /height:\s*auto !important/u);
  assert.match(rule, /min-height:\s*0 !important/u);
  assert.match(rule, /align-self:\s*start !important/u);
  assert.doesNotMatch(rule, /overflow:\s*hidden/u);
});

test("#2300 Storyboard and Previs size child frames to the governed root rather than the viewport", async () => {
  const [storyboard, previs] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);
  for (const source of [storyboard, previs]) {
    assert.doesNotMatch(source, /calc\(100vw - 40px\)/u);
    assert.match(source, /width:\s*min\(var\(--pp-skin-shell-max\), 100%\)/u);
    assert.match(source, /box-sizing:\s*border-box/u);
  }
  assert.match(storyboard, /\.tabRail\s*\{[\s\S]*box-sizing:\s*border-box/u);
  assert.match(previs, /\.tabRail\s*\{[\s\S]*box-sizing:\s*border-box/u);
});

test("#2300 Node does not manufacture a viewport-height inner shell", async () => {
  const source = await read("app/skin-v1/node-skin-panel.tsx");
  const shell = source.match(/const shell: React\.CSSProperties = \{[\s\S]*?\n\};/u)?.[0] || "";
  assert.match(shell, /minHeight:\s*"0"/u);
  assert.doesNotMatch(shell, /minHeight:\s*"100vh"/u);
});

test("#2300 Issue Log and General controls use the canonical four-pixel spacing rhythm", async () => {
  const [issueLog, general] = await Promise.all([
    read("app/skin-v1/dashboard-review-surface.module.css"),
    read("app/skin-v1/settings-review-system-panel.module.css"),
  ]);
  assert.doesNotMatch(issueLog, /padding:\s*9px 10px/u);
  assert.doesNotMatch(issueLog, /padding:\s*8px 10px/u);
  assert.doesNotMatch(issueLog, /padding-left:\s*10px/u);
  assert.match(issueLog, /padding:\s*var\(--pp-skin-space-2\) var\(--pp-skin-space-3\)/u);
  assert.doesNotMatch(general, /padding:\s*8px 10px/u);
  assert.doesNotMatch(general, /padding:\s*3px 6px/u);
  assert.match(general, /padding:\s*var\(--pp-skin-space-2\) var\(--pp-skin-space-3\)/u);
});

test("#2300 Profile exposes one content-level heading above supporting section labels", async () => {
  const css = await read("app/skin-v1-settings-directory.css");
  assert.match(
    css,
    /\[data-profile-identity-surface="v2"\] #profile-identity-heading\s*\{[\s\S]*font-size:\s*var\(--pp-skin-font-body\) !important/u,
  );
  assert.match(
    css,
    /\[data-profile-identity-surface="v2"\] :is\(header h2, header h3\)\s*\{[\s\S]*font-size:\s*var\(--pp-skin-font-meta\) !important/u,
  );
});
