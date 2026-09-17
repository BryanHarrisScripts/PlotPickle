import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#2124 records the Human visual-review evidence, including Avery's 140 palette and 60 spacing deviations", async () => {
  const brief = await read("docs/developer-briefs/2124-human-visual-review-fixes.md");
  assert.match(brief, /140 rendered palette deviations/u);
  assert.match(brief, /60 padding values/u);
  assert.match(brief, /26 registered surfaces/u);
  assert.match(brief, /0 automated blockers and 16 advisories/u);
});

test("#2124 WebMCP refuses an incomplete canonical Dashboard capture without PlotPickle Score", async () => {
  const catalogue = await read("lib/verification/webmcp-standard-surface-catalogue.mjs");
  assert.match(catalogue, /DASHBOARD_SCORE_SELECTOR/u);
  assert.match(catalogue, /\[data-plotpickle-score='v1'\]/u);
  assert.match(catalogue, /Dashboard is missing the visible PlotPickle Score mathematical panel/u);
  assert.match(catalogue, /if \(surface === "dashboard"\)/u);
});

test("#2124 Hybrid Story Mode reuses the Local\/Cloud subordinate shell", async () => {
  const [host, shell] = await Promise.all([
    read("app/skin-v1/story-mode-host.tsx"),
    read("app/skin-v1-standard-surface-shell.css"),
  ]);
  assert.match(host, /<h1>HYBRID STORY MODE<\/h1>/u);
  assert.doesNotMatch(host, /<h2>HYBRID<\/h2>/u);
  assert.match(shell, /section\[aria-label="Hybrid Story Mode"\]/u);
});

test("#2124 Avery uses canonical Skin V1 palette and spacing tokens instead of local teal presentation", async () => {
  const css = await read("modules/library/ui/avery-session-history/avery-session-history.module.css");
  assert.doesNotMatch(css, /--plotpickle-/u);
  assert.doesNotMatch(css, /rgba\(/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/iu);
  assert.match(css, /var\(--pp-skin-accent-bright\)/u);
  assert.match(css, /var\(--pp-skin-line-strong\)/u);
  assert.match(css, /var\(--pp-skin-space-8\)/u);

  const paddingDeclarations = [...css.matchAll(/padding(?:-(?:top|right|bottom|left))?\s*:\s*([^;]+);/gu)].map((match) => match[1].trim());
  assert.ok(paddingDeclarations.length > 0);
  for (const value of paddingDeclarations) {
    assert.ok(value === "0" || value.split(/\s+/u).every((part) => /^var\(--pp-skin-space-[1-9]\)$/u.test(part)), `Avery padding must stay on Skin V1 spacing tokens: ${value}`);
  }
});

test("#2124 Library Archive is normalized through the existing Skin V1 integration layer", async () => {
  const css = await read("app/skin-v1-library-archive.css");
  assert.match(css, /\[data-library-surface="archive"\]/u);
  assert.match(css, /font-size:\s*var\(--pp-skin-font-title\)\s*!important/u);
  assert.match(css, /background:\s*var\(--pp-skin-surface-0\)\s*!important/u);
  assert.match(css, /color:\s*var\(--pp-skin-accent-bright\)\s*!important/u);
  assert.match(css, /min-height:\s*var\(--pp-skin-control-height\)\s*!important/u);
});
