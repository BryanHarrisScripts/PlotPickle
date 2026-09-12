import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1923 Profile v2 interactive controls consume the Skin V1 control-height token", async () => {
  const [surfaceCss, definitionCss] = await Promise.all([
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/skin-v1-definition.css"),
  ]);

  assert.match(definitionCss, /--pp-skin-control-height:\s*34px;/u);
  assert.match(
    surfaceCss,
    /\.pp-skin-v1-profile-surface \[data-profile-identity-surface="v2"\] :is\(button, a, input, textarea\) \{[\s\S]*min-height:\s*var\(--pp-skin-control-height\) !important;/u,
  );
});

test("#1923 keeps the Profile control contract at the canonical token instead of weakening the observer", async () => {
  const [surfaceCss, webmcp] = await Promise.all([
    read("app/skin-v1-bbs-surfaces.css"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
  ]);

  assert.match(surfaceCss, /min-height:\s*var\(--pp-skin-control-height\) !important;/u);
  assert.match(webmcp, /--pp-skin-control-height/u);
  assert.doesNotMatch(surfaceCss, /25\.25px/u);
});
