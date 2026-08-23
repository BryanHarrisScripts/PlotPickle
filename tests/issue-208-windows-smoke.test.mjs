import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Issue 208 packaged Windows smoke covers the new UX and safety contracts", async () => {
  const [smoke, workflow] = await Promise.all([
    read("scripts/windows-issue-208-smoke.mjs"),
    read(".github/workflows/release-candidate.yml"),
  ]);

  assert.match(smoke, /Dashboard identifies a new local project without Afterglow fragments/);
  assert.match(smoke, /Learn tabs switch without a nested tab scrollbar/);
  assert.match(smoke, /Collab Approvals explains GitHub and routes setup to Settings/);
  assert.match(smoke, /Graphic Novel entire-cast regeneration cancels before paid calls/);
  assert.match(smoke, /Fetch\.enable/);
  assert.match(smoke, /api\/local-connections/);
  assert.match(smoke, /api\/local-ai\/generate\/image/);
  assert.match(smoke, /window\.confirm = \(\) => false/);
  assert.match(smoke, /paidImageCalls !== 0/);
  assert.match(smoke, /View GitHub connection settings/);
  assert.match(smoke, /Regenerate Entire Cast/);
  assert.match(smoke, /Entire-cast regeneration was cancelled\. No provider calls were made\./);

  assert.match(workflow, /Run Issue 208 packaged Windows smoke/);
  assert.match(workflow, /windows-issue-208-smoke\.mjs/);
  assert.match(workflow, /reports\/windows-issue-208-smoke/);
  assert.match(workflow, /PLOTPICKLE_ISSUE_208_SMOKE_TIMEOUT_MS/);
});
