import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("full history readiness uses a complete clone and a permanent required check", async () => {
  const workflow = await text(".github/workflows/public-history-readiness.yml");
  const audit = await text("scripts/public-history-readiness.mjs");
  const settings = JSON.parse(await text("config/public-repository.settings.json"));

  assert.match(workflow, /name: Full history audit/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /node scripts\/public-history-readiness\.mjs/);
  assert.match(workflow, /node --test tests\/issue-293-public-history-readiness\.test\.mjs/);
  assert.ok(settings.main_branch.required_checks.includes("Full history audit"));
  assert.match(audit, /--is-shallow-repository/);
  assert.match(audit, /Buzz invitation token/);
  assert.match(audit, /No secret values are printed/);
  assert.doesNotMatch(audit, /console\.error\(`[^`]*\$\{text\}/);
});
