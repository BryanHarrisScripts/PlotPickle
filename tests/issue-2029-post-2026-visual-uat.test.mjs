import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2029 restores the approved Dashboard dragon without restoring Score", async () => {
  const css = await read("app/skin-v1-dashboard-menu-reset.css");

  assert.match(css, /\.pp-skin-v1-dashboard-art\s*\{[\s\S]*display:\s*block !important/u);
  assert.match(css, /\[data-plotpickle-score="v1"\][\s\S]*display:\s*none !important/u);
});

test("#2029 sends Writer's Craft All Curriculum directly back to Dashboard", async () => {
  const [explore, host, audit] = await Promise.all([
    read("app/skin-v1/learn-explore.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(explore, /Back to Dashboard/u);
  assert.match(explore, /plotpickle:return-dashboard/u);
  assert.match(explore, /ESC RETURNS TO DASHBOARD/u);
  assert.doesNotMatch(explore, /Back to Journey/u);
  assert.doesNotMatch(explore, /<strong>\{exploreRowPrimary\(entry\)\}<\/strong><br/u);
  assert.match(host, /addEventListener\("plotpickle:return-dashboard"/u);
  assert.match(host, /key=\{dashboardGeneration\}/u);
  assert.match(audit, /getByRole\("button", \{ name: "Back to Dashboard" \}\)\.click\(\)/u);
  assert.doesNotMatch(audit, /name: "Back to Journey"/u);
  assert.match(audit, /await page\.locator\("\[data-skin-menu='dashboard'\]"\)\.waitFor/u);
});

test("#2029 gives Writer's Craft rows desktop breathing room", async () => {
  const surfaces = await read("app/skin-v1-bbs-surfaces.css");

  assert.match(surfaces, /LEARN Explore All Curriculum/u);
  assert.match(surfaces, /All Curriculum results/u);
  assert.match(surfaces, /width:\s*min\(var\(--pp-skin-shell-max\), calc\(100% - 40px\)\) !important/u);
  assert.match(surfaces, /white-space:\s*normal !important/u);
});

test("#2029 stacks Profile readiness instead of squeezing a third column", async () => {
  const surfaces = await read("app/skin-v1-bbs-surfaces.css");

  assert.match(surfaces, /\[aria-label="Profile readiness"\][\s\S]*grid-column:\s*1 \/ -1 !important/u);
  assert.match(surfaces, /\[aria-label="Profile readiness"\][\s\S]*grid-template-columns:\s*1fr !important/u);
  assert.match(surfaces, /:has\(> \[aria-label="Profile readiness"\]\)[\s\S]*grid-template-columns:\s*118px minmax\(0, 1fr\) !important/u);
});

test("#2029 keeps Issue Log, Licensing and Agents on Community's Skin V1 palette", async () => {
  const surfaces = await read("app/skin-v1-bbs-surfaces.css");

  assert.match(surfaces, /data-issue-log-panel="ready"/u);
  assert.match(surfaces, /data-open-source-skin-panel="ready"/u);
  assert.match(surfaces, /background:\s*var\(--pp-skin-canvas\) !important/u);
  assert.match(surfaces, /box-shadow:\s*inset 3px 0 var\(--pp-skin-accent-bright\)/u);
  assert.match(surfaces, /data-skin-v1-plotpickle-agents="true"/u);
  assert.match(surfaces, /thead tr[\s\S]*background:\s*var\(--pp-skin-accent-deep\) !important/u);
  assert.match(surfaces, /font-family:\s*var\(--pp-skin-font-ui\) !important/u);
});
