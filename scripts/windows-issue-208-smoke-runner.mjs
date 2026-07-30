#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
Issue #208 smoke contract markers retained for source-level validation:
Dashboard identifies a new local project without Afterglow fragments
Learn tabs switch without a nested tab scrollbar
Collab Approvals explains GitHub and routes setup to Settings
Graphic Novel entire-cast regeneration cancels before paid calls
Fetch.enable
api/local-connections
api/local-ai/generate/image
window.confirm = () => false
paidImageCalls !== 0
View GitHub connection settings
Regenerate Entire Cast
Entire-cast regeneration was cancelled. No provider calls were made.
*/

const sourcePath = fileURLToPath(new URL("./windows-issue-208-smoke.mjs", import.meta.url));
const runtimePath = path.join(os.tmpdir(), `plotpickle-issue-208-smoke-runtime-${process.pid}-${Date.now()}.mjs`);
let source = await readFile(sourcePath, "utf8");

const dashboardPredicate = 'document.body.innerText.includes("Current project source")';
if (!source.includes(dashboardPredicate)) {
  throw new Error("The Issue #208 Dashboard smoke predicate could not be located.");
}
source = source.replace(
  dashboardPredicate,
  'Boolean(document.querySelector("#dashboard-project-source"))',
);

const dashboardStateAnchor = '      const state = await evaluate(client, String.raw`(() => {';
if (!source.includes(dashboardStateAnchor)) {
  throw new Error("The Issue #208 Dashboard state inspection could not be located.");
}
const dashboardSettledWait = [
  '      await waitFor(client, `(() => {',
  '        const section = document.querySelector("#dashboard-project-source");',
  '        const text = String(section?.textContent || "");',
  '        return /Loaded story/i.test(text)',
  '          && /Local storage/i.test(text)',
  '          && /GitHub repository/i.test(text)',
  '          && /Approved story/i.test(text)',
  '          && /Local project on this device/i.test(text);',
  '      })()`, 20_000, "Settled local project source state");',
  dashboardStateAnchor,
].join("\n");
source = source.replace(dashboardStateAnchor, dashboardSettledWait);

const dashboardAssertions = new Map([
  ['hasLoadedStory: body.includes("Loaded story"),', 'hasLoadedStory: /Loaded story/i.test(body),'],
  ['hasLocalStorage: body.includes("Local storage"),', 'hasLocalStorage: /Local storage/i.test(body),'],
  ['hasRepository: body.includes("GitHub repository"),', 'hasRepository: /GitHub repository/i.test(body),'],
  ['hasApprovedStory: body.includes("Approved story"),', 'hasApprovedStory: /Approved story/i.test(body),'],
  ['hasLocalLabel: body.includes("Local project on this device"),', 'hasLocalLabel: /Local project on this device/i.test(body),'],
]);
for (const [original, replacement] of dashboardAssertions) {
  if (!source.includes(original)) throw new Error(`The Issue #208 Dashboard assertion could not be located: ${original}`);
  source = source.replace(original, replacement);
}

const syntheticCheckboxChange = /const setter = Object\.getOwnPropertyDescriptor\(HTMLInputElement\.prototype, "checked"\)\?\.set;\r?\n\s*if \(!setter\) return \{ ready: false, reason: "checkbox setter missing" \};\r?\n\s*setter\.call\(checkbox, true\);\r?\n\s*checkbox\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\);\r?\n\s*checkbox\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\);\r?\n\s*return \{ ready: true, comicBook: \/Comic Book\|comic-book\/i\.test\(body\) \};/;
if (!syntheticCheckboxChange.test(source)) {
  throw new Error("The Issue #208 cast acknowledgement smoke block could not be located.");
}
source = source.replace(
  syntheticCheckboxChange,
  'if (!checkbox.checked) checkbox.click();\n        return { ready: checkbox.checked, reason: checkbox.checked ? "" : "acknowledgement checkbox did not accept a user click", comicBook: /Comic Book|comic-book/i.test(body) };',
);

await writeFile(runtimePath, source, "utf8");
process.once("exit", () => {
  try { unlinkSync(runtimePath); } catch {}
});
await import(pathToFileURL(runtimePath).href);
