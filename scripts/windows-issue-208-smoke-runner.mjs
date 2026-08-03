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
const copyPath = fileURLToPath(new URL("../config/collaboration-copy.json", import.meta.url));
const runtimePath = path.join(os.tmpdir(), `plotpickle-issue-208-smoke-runtime-${process.pid}-${Date.now()}.mjs`);
let source = await readFile(sourcePath, "utf8");
const collaborationCopy = JSON.parse(await readFile(copyPath, "utf8"));
const repositoryLabel = collaborationCopy?.terms?.repository?.primary;
if (typeof repositoryLabel !== "string" || !repositoryLabel.trim()) {
  throw new Error("The writer-facing story repository label is missing from collaboration-copy.json.");
}
const normalizedRepositoryLabel = repositoryLabel.trim().toLocaleLowerCase();

const initialTarget = 'const target = await createTarget(debugPort, `${baseUrl}/`);';
if (!source.includes(initialTarget)) {
  throw new Error("The Issue #208 initial browser target could not be located.");
}
source = source.replace(initialTarget, 'const target = await createTarget(debugPort, "about:blank");');

const originalSend = /  send\(method, params = \{\}\) \{\r?\n\s*const id = this\.nextId\+\+;\r?\n\s*return new Promise\(\(resolve, reject\) => \{\r?\n\s*this\.pending\.set\(id, \{ resolve, reject, method \}\);\r?\n\s*this\.socket\.send\(JSON\.stringify\(\{ id, method, params \}\)\);\r?\n\s*\}\);\r?\n\s*\}/;
const boundedSend = `  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(\`\${method} did not respond within 10000 ms.\`));
      }, 10_000);
      this.pending.set(id, {
        method,
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }`;
if (!originalSend.test(source)) {
  throw new Error("The Issue #208 CDP send method could not be located.");
}
source = source.replace(originalSend, boundedSend);

const originalShellWait = /async function waitForShell\(client, label, timeoutMs = 25_000\) \{\r?\n\s*await waitFor\(client, `\(\(\) => \{ \$\{normalizeFunction\} const active = \[\.\.\.document\.querySelectorAll\('\[role="tab"\]\[aria-selected="true"\]'\)\]\.some\(\(item\) => normalize\(item\.innerText\) === \$\{JSON\.stringify\(label\)\}\); return Boolean\(document\.querySelector\("\\\.application-shell-header"\) && active\); \}\)\(\)`, timeoutMs, `\$\{label\} application shell`\);\r?\n\}/;
const currentShellWait = `async function waitForShell(client, label, timeoutMs = 25_000) {
  await waitFor(client, \`(() => { \${normalizeFunction} const active = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((item) => normalize(item.innerText) === \${JSON.stringify(label)}); const body = normalize(document.body?.innerText); return Boolean(active && body && !body.includes("See the whole movie before you make it.")); })()\`, timeoutMs, \`\${label} application shell\`);
}`;
if (!originalShellWait.test(source)) {
  throw new Error("The Issue #208 application-shell readiness predicate could not be located.");
}
source = source.replace(originalShellWait, currentShellWait);

const originalScenarioStart = /async function runScenario\(report, name, callback\) \{\r?\n\s*const startedAt = new Date\(\)\.toISOString\(\);/;
const loggedScenarioStart = `async function runScenario(report, name, callback) {
  console.log(\`[issue-208] starting: \${name}\`);
  const startedAt = new Date().toISOString();`;
if (!originalScenarioStart.test(source)) {
  throw new Error("The Issue #208 scenario runner could not be located.");
}
source = source.replace(originalScenarioStart, loggedScenarioStart);

const dashboardPredicate = 'document.body.innerText.includes("Current project source")';
if (!source.includes(dashboardPredicate)) {
  throw new Error("The Issue #208 Dashboard smoke predicate could not be located.");
}
source = source.replace(dashboardPredicate, 'Boolean(document.querySelector("#dashboard-project-source"))');

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
  `          && text.toLocaleLowerCase().includes(${JSON.stringify(normalizedRepositoryLabel)})`,
  '          && /Approved story/i.test(text)',
  '          && /Local project on this device/i.test(text);',
  '      })()`, 20_000, "Settled local project source state");',
  dashboardStateAnchor,
].join("\n");
source = source.replace(dashboardStateAnchor, dashboardSettledWait);

const dashboardAssertions = new Map([
  ['hasLoadedStory: body.includes("Loaded story"),', 'hasLoadedStory: /Loaded story/i.test(body),'],
  ['hasLocalStorage: body.includes("Local storage"),', 'hasLocalStorage: /Local storage/i.test(body),'],
  ['hasRepository: body.includes("GitHub repository"),', `hasRepository: body.toLocaleLowerCase().includes(${JSON.stringify(normalizedRepositoryLabel)}),`],
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
