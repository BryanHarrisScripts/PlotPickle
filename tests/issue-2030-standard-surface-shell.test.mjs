import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const layout = read("app/layout.tsx");
const shell = read("app/skin-v1-standard-surface-shell.css");

test("#2030 loads the standard subordinate shell after the established Skin V1 directory rules", () => {
  const directory = layout.indexOf('import "./skin-v1-settings-directory.css";');
  const normalized = layout.indexOf('import "./skin-v1-standard-surface-shell.css";');
  assert.ok(directory >= 0 && normalized > directory);
});

test("#2030 normalizes every connected subordinate root captured by WebMCP", () => {
  for (const selector of [
    'section[aria-label="PlotPickle Community"]',
    'section[aria-label="General settings"]',
    'section[aria-label="Cloud Story Mode setup"]',
    'section[aria-label="Local Story Mode setup"]',
    'section[aria-label="Node information"]',
    'section[aria-label="PlotPickle Agents setup"]',
    'section[aria-label="Issue Log"][data-dashboard-review-surface="help"]',
    'section[aria-label="Open Source"][data-dashboard-review-surface="open-source"]',
    'section[aria-label="User Profile"].pp-skin-v1-profile-surface',
  ]) assert.ok(shell.includes(selector), `${selector} missing from standard shell`);

  assert.match(shell, /width:\s*min\(var\(--pp-skin-shell-max\), calc\(100vw - 40px\)\) !important;/u);
  assert.match(shell, /background:\s*var\(--pp-skin-accent-deep\) !important;/u);
  assert.match(shell, /background-image:\s*none !important;/u);
});

test("#2030 keeps General content but removes its alternate stepped header treatment", () => {
  assert.match(shell, /section\[aria-label="General settings"\][\s\S]*\[data-settings-workspace-surface="general"\] > section:first-child/u);
  assert.match(shell, /min-height:\s*0 !important;/u);
});


test("#2272 standard subordinate content resolves inside the registered outer shell", () => {
  const ordinaryStart = shell.indexOf(') > :not(.pp-skin-v1-surface-actions):not(.pp-skin-v1-bbs-banner) {');
  const ordinaryEnd = shell.indexOf('\n}', ordinaryStart);
  const ordinary = shell.slice(ordinaryStart, ordinaryEnd);

  assert.match(ordinary, /width:\s*100% !important;/u);
  assert.match(ordinary, /max-width:\s*100% !important;/u);
  assert.doesNotMatch(ordinary, /calc\(100vw - 40px\)|var\(--pp-skin-shell-max\)/u);

  const profileStart = shell.indexOf('.pp-skin-v1-profile-surface > :not(.pp-skin-v1-profile-banner) {');
  const profileEnd = shell.indexOf('\n}', profileStart);
  const profile = shell.slice(profileStart, profileEnd);

  assert.match(profile, /width:\s*100% !important;/u);
  assert.match(profile, /max-width:\s*100% !important;/u);
  assert.doesNotMatch(profile, /calc\(100vw - 40px\)|var\(--pp-skin-shell-max\)/u);
});
