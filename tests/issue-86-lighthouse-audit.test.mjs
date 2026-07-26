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

test("issue #86 provides a native Windows launcher without Bash or WSL", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts.build, "node scripts/build-verified.mjs");
  assert.doesNotMatch(packageJson.scripts.build, /bash/i);

  const build = await source("scripts/build-verified.mjs");
  assert.match(build, /process\.platform === "win32" \? "vinext\.cmd" : "vinext"/);
  assert.match(build, /run-command-with-timeout\.mjs/);
  assert.match(build, /dist["'], "server["'], "index\.js/);
  assert.match(build, /dist["'], "\.openai["'], "hosting\.json/);

  const launcher = await source("Run-Lighthouse.bat");
  assert.match(launcher, /npm ci/);
  assert.match(launcher, /audit:lighthouse/);
  assert.match(launcher, /desktop/);
  assert.match(launcher, /mobile/);
  assert.match(launcher, /zip/);
  assert.doesNotMatch(launcher, /bash scripts\//i);
  assert.doesNotMatch(launcher, /wsl\.exe/i);
});

test("issue #86 documents the one-command Windows review package", async () => {
  const docs = await source("public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md");
  assert.match(docs, /Whole-app Lighthouse review package/);
  assert.match(docs, /Double-click `Run-Lighthouse\.bat`/);
  assert.match(docs, /does not open Ubuntu/);
  assert.match(docs, /npm run audit:lighthouse/);
  assert.match(docs, /creates an uploadable ZIP automatically/);
  assert.match(docs, /reports\\lighthouse\\<timestamp>/);
});


test("issue #108 waits for Lighthouse log streams before child-process stdio", async () => {
  const audit = await source("scripts/lighthouse-audit.mjs");
  assert.match(audit, /export function waitForWritableOpen/);
  assert.match(audit, /stream\.once\("open"/);
  assert.match(audit, /await waitForWritableOpen\(log\)/);
  assert.match(audit, /export function closeWritable/);
  assert.match(audit, /stream\.once\("close"/);
  assert.match(audit, /await closeWritable\(log\)/);
  assert.doesNotMatch(audit, /finally \{\s*log\.end\(\);/);
});
