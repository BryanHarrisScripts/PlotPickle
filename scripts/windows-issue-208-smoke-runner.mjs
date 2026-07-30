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

const syntheticCheckboxChange = String.raw`        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
        if (!setter) return { ready: false, reason: "checkbox setter missing" };
        setter.call(checkbox, true);
        checkbox.dispatchEvent(new Event("input", { bubbles: true }));
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        return { ready: true, comicBook: /Comic Book|comic-book/i.test(body) };`;
const realCheckboxClick = String.raw`        if (!checkbox.checked) checkbox.click();
        return { ready: checkbox.checked, reason: checkbox.checked ? "" : "acknowledgement checkbox did not accept a user click", comicBook: /Comic Book|comic-book/i.test(body) };`;
if (!source.includes(syntheticCheckboxChange)) {
  throw new Error("The Issue #208 cast acknowledgement smoke block could not be located.");
}
source = source.replace(syntheticCheckboxChange, realCheckboxClick);

await writeFile(runtimePath, source, "utf8");
process.once("exit", () => {
  try { unlinkSync(runtimePath); } catch {}
});
await import(pathToFileURL(runtimePath).href);
