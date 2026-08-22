import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source() {
  return readFile(path.join(repoRoot, "scripts", "creative-uat", "casebook-phase3b3-live.mjs"), "utf8");
}

test("#1273 attended BUZZ re-anchors a drifted browser before authenticated-Human verification", async () => {
  const text = await source();
  assert.match(text, /async function ensurePlotPickleBrowserPage/);
  assert.match(text, /const beforeUrl = clean\(current\?\.url, 2_000\)/);
  assert.match(text, /if \(expectedOrigin && httpOrigin\(beforeUrl\) === expectedOrigin\)/);
  assert.match(text, /await browser\.navigate\(target\)/);
  assert.match(text, /runState\.attendedPlotPickleOrigin = initialOrigin/);
  assert.match(text, /const anchor = await ensurePlotPickleBrowserPage\(browser, runState\.attendedPlotPickleOrigin \|\| initialOrigin\)/);
  assert.match(text, /re-anchored=\$\{anchor\.reanchored \? "yes" : "no"\}/);
});

test("#1273 authenticated Human authority remains profile API state, with URL diagnostics only", async () => {
  const text = await source();
  assert.match(text, /fetch\('\/api\/auth\/profile', \{ credentials: 'same-origin', cache: 'no-store' \}\)/);
  assert.match(text, /authenticated: response\.ok && body\.authenticated === true && Boolean\(profile\?\.profileId\)/);
  assert.match(text, /const url = location\.href/);
  assert.doesNotMatch(text, /csrfToken/);
  assert.doesNotMatch(text, /nsec1/);
  assert.doesNotMatch(text, /privateKey/);
});
