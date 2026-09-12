import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1923 Profile readiness controls own the Skin V1 control-height token", async () => {
  const [profileCss, surfaceCss, definitionCss, profilePanel] = await Promise.all([
    read("app/profile-access/profile-identity-panel.module.css"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/skin-v1-definition.css"),
    read("app/profile-access/profile-identity-panel.tsx"),
  ]);

  assert.match(definitionCss, /--pp-skin-control-height:\s*34px;/u);
  assert.match(
    profileCss,
    /\.statusLink\s*\{[\s\S]*min-height:\s*var\(--pp-skin-control-height\);[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;/u,
  );
  assert.match(profilePanel, /className=\{styles\.statusLink\}/u);
  assert.match(profilePanel, /aria-label=\{`Configure \$\{label\}`\}/u);

  // Keep the Skin wrapper fallback as defence in depth while the component owns
  // the five readiness controls that produced the live WebMCP finding.
  assert.match(
    surfaceCss,
    /\.pp-skin-v1-profile-surface \[data-profile-identity-surface="v2"\] :is\(button, a, input, textarea\) \{[\s\S]*min-height:\s*var\(--pp-skin-control-height\) !important;/u,
  );
});

test("#1923 keeps the Profile control contract at the canonical token instead of weakening the observer", async () => {
  const [profileCss, surfaceCss, webmcp] = await Promise.all([
    read("app/profile-access/profile-identity-panel.module.css"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
  ]);

  assert.match(profileCss, /min-height:\s*var\(--pp-skin-control-height\);/u);
  assert.match(surfaceCss, /min-height:\s*var\(--pp-skin-control-height\) !important;/u);
  assert.match(webmcp, /--pp-skin-control-height/u);
  assert.doesNotMatch(`${profileCss}\n${surfaceCss}`, /25\.25px/u);
});
