import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #86 discovers application routes and preserves explicit workspace coverage", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /app["'],?[\s\S]*page\\\./);
  assert.match(audit, /discoverRoutes/);
  assert.match(audit, /\/?workspace=1/);
  assert.match(audit, /Dynamic route needs a real sample parameter/);
});

test("issue #86 records the required Lighthouse evidence", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  for (const phrase of [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
    "failedAudits",
    "seriousAccessibility",
    "consoleErrors",
    "finalUrl",
    "summary.json",
    "summary.md",
  ]) {
    assert.ok(audit.includes(phrase), `Lighthouse audit is missing ${phrase}`);
  }
});

test("issue #86 provides desktop, mobile, automatic ZIP and local-only commands", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts["audit:lighthouse"], "node scripts/lighthouse-audit.mjs all");
  assert.equal(packageJson.scripts["audit:lighthouse:desktop"], "node scripts/lighthouse-audit.mjs desktop");
  assert.equal(packageJson.scripts["audit:lighthouse:mobile"], "node scripts/lighthouse-audit.mjs mobile");
  assert.equal(packageJson.scripts["audit:lighthouse:zip"], "node scripts/lighthouse-audit.mjs zip");

  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /fileURLToPath/);
  assert.match(audit, /127\.0\.0\.1/);
  assert.match(audit, /No story project was sent to a remote audit service/);
  assert.match(audit, /Compress-Archive/);
  assert.match(audit, /await zipDirectory\(reportDirectory\)/);

  const gitignore = await source(".gitignore");
  assert.match(gitignore, /\/reports\/lighthouse\//);
});

test("issue #86 documents the one-command Windows review package", async () => {
  const docs = await source("public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md");
  assert.match(docs, /Whole-app Lighthouse review package/);
  assert.match(docs, /npm run audit:lighthouse/);
  assert.match(docs, /creates an uploadable ZIP automatically/);
  assert.match(docs, /reports\\lighthouse\\<timestamp>/);
});