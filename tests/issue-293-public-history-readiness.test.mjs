import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("full history readiness uses a complete clone and exact documented exceptions", async () => {
  const workflow = await text(".github/workflows/public-history-readiness.yml");
  const audit = await text("scripts/public-history-readiness.mjs");
  const settings = JSON.parse(await text("config/public-repository.settings.json"));
  const exceptions = JSON.parse(await text("config/public-history-exceptions.json"));

  assert.match(workflow, /name: Full history audit/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /node scripts\/public-history-readiness\.mjs/);
  assert.match(workflow, /node --test tests\/issue-293-public-history-readiness\.test\.mjs/);
  assert.ok(settings.main_branch.required_checks.includes("Full history audit"));
  assert.match(audit, /--is-shallow-repository/);
  assert.match(audit, /Buzz invitation token/);
  assert.match(audit, /pending-revocation/);
  assert.match(audit, /owner-accepted-risk/);
  assert.match(audit, /documented owner-accepted risk/);
  assert.match(audit, /No secret values are printed/);
  assert.doesNotMatch(audit, /console\.error\(`[^`]*\$\{text\}/);

  assert.equal(exceptions.exceptions.length, 1);
  const [accepted] = exceptions.exceptions;
  assert.equal(accepted.status, "owner-accepted-risk");
  assert.equal(accepted.accepted_by, "BryanHarrisScripts");
  assert.ok(Number.isFinite(Date.parse(accepted.accepted_at)));
  assert.equal(accepted.tracking_issue, 294);
  assert.match(accepted.reason, /invitation remain unchanged/i);
  assert.ok(accepted.occurrences.length >= 1);
  for (const occurrence of accepted.occurrences) {
    assert.match(occurrence.commit, /^[0-9a-f]{12,40}$/);
    assert.ok(occurrence.path && !/[*?]/.test(occurrence.path));
  }
});
