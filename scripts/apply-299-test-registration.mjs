import { readFile, writeFile } from "node:fs/promises";

const packagePath = "package.json";
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const mainTests = [
  "tests/issue-299-credential-boundary-audit.test.mjs",
  "tests/issue-299-local-credential-audit.test.mjs",
];
if (!packageJson.scripts.test.includes("tests/issue-298-settings-sitemap.test.mjs")) {
  throw new Error("Expected issue 298 test anchor is missing from package.json.");
}
for (const testPath of mainTests) {
  if (!packageJson.scripts.test.includes(testPath)) packageJson.scripts.test += ` ${testPath}`;
}
packageJson.scripts["audit:credentials"] = "node scripts/credential-boundary-audit.mjs --mode source";
packageJson.scripts["audit:credentials:local"] = "node scripts/local-credential-audit.mjs --root . --strict";
packageJson.scripts["test:credential-boundary-audit"] = `node --test ${mainTests.join(" ")}`;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const contractPath = "tests/issue-299-credential-boundary-audit.test.mjs";
let contract = await readFile(contractPath, "utf8");
const anchor = '    "github-selected-connection",\n';
if (!contract.includes(anchor)) throw new Error("Credential registry test anchor is missing.");
if (!contract.includes('    "github-project-sync-state",\n')) {
  contract = contract.replace(anchor, `${anchor}    "github-project-sync-state",\n`);
}
const docsAnchor = "  assert.match(audit, /release archives/i);\n";
if (!contract.includes(docsAnchor)) throw new Error("Credential documentation test anchor is missing.");
if (!contract.includes("audit:credentials:local")) {
  contract = contract.replace(docsAnchor, `${docsAnchor}  assert.match(audit, /audit:credentials:local/);\n  assert.match(audit, /owner-accepted historical risk/i);\n`);
}
await writeFile(contractPath, contract);
