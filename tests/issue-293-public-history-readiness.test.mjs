import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("history readiness scans introduced PR commits and retains complete main history validation", async () => {
  const workflow = await text(".github/workflows/safety.yml");
  const audit = await text("scripts/public-history-readiness.mjs");
  const settings = JSON.parse(await text("config/public-repository.settings.json"));
  const exceptions = JSON.parse(await text("config/public-history-exceptions.json"));

  assert.match(workflow, /name: PlotPickle Safety Gate/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /node scripts\/public-history-readiness\.mjs --range/);
  assert.match(workflow, /Scan complete reachable Git history/);
  assert.match(workflow, /node scripts\/public-history-readiness\.mjs\n/);
  assert.match(workflow, /tests\/issue-293-public-history-readiness\.test\.mjs/);
  assert.ok(settings.main_branch.required_checks.includes("Safety"));
  assert.match(audit, /--is-shallow-repository/);
  assert.match(audit, /requestedRange/);
  assert.match(audit, /historyScope/);
  assert.match(audit, /Public history PR audit passed/);
  assert.match(audit, /Buzz invitation token/);
  assert.match(audit, /pending-revocation/);
  assert.match(audit, /owner-accepted-risk/);
  assert.match(audit, /documented owner-accepted risk/);
  assert.match(audit, /No secret values are printed/);
  assert.doesNotMatch(audit, /console\.error\(`[^`]*\$\{text\}/);

  assert.equal(exceptions.exceptions.length, 1);
  const [revoked] = exceptions.exceptions;
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.accepted_by, "BryanHarrisScripts");
  assert.ok(Number.isFinite(Date.parse(revoked.revoked_at)));
  assert.equal(revoked.tracking_issue, 294);
  assert.match(revoked.reason, /revoked before public release/i);
  assert.ok(revoked.occurrences.length >= 1);
  for (const occurrence of revoked.occurrences) {
    assert.match(occurrence.commit, /^[0-9a-f]{12,40}$/);
    assert.ok(occurrence.path && !/[*?]/.test(occurrence.path));
  }
});
