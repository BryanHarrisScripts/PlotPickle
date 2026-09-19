import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2272 residual typography uses the canonical H1 semantic token at the shared orchestrator root", async () => {
  const css = await read("app/skin-v1-surface-orchestrator.css");
  const activeH1 = css.match(/\[data-skin-v1-orchestrated="true"\]\[data-skin-v1-orchestrator-active="true"\][\s\S]*?:is\(h1, \[role="heading"\]\[aria-level="1"\]\) \{[\s\S]*?\n\}/u)?.[0] || "";
  assert.match(activeH1, /var\(--pp-skin-font-h1\)/u);
  assert.match(activeH1, /var\(--pp-skin-weight-bold\)/u);
  assert.doesNotMatch(activeH1, /var\(--pp-skin-font-title\)/u);
});

test("#2272 Library no longer manufactures viewport-height dead space", async () => {
  const css = await read("modules/library/ui/library-workspace.module.css");
  assert.match(css, /\.workspace\s*\{[\s\S]*?min-height:\s*0;/u);
  assert.doesNotMatch(css, /min-height:\s*calc\(100dvh\s*-\s*82px\)/u);
});

test("#2272 preserves the Human-approved continuous Library green menu as an explicit visual exception", async () => {
  const [workspace, profile, director] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("lib/verification/skin-v1/rendered-surface-profile.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
  ]);

  assert.match(workspace, /data-skin-visual-treatment="flat-approved"/u);
  assert.match(profile, /visualTreatment:\s*node\.getAttribute\("data-skin-visual-treatment"\) \|\| ""/u);
  assert.match(director, /item\.visualTreatment !== "flat-approved"/u);
});
