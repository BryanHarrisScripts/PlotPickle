import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1230 current Foundations LEARN contract is four lessons while PLAN remains eleven lessons / thirty-three answers", () => {
  const foundations = JSON.parse(source("learn/foundations.json"));
  assert.equal(foundations.lessonCount, 4);
  assert.equal(foundations.lessons.length, 4);

  const journey = source("scripts/writer-journey-completion.mjs");
  assert.match(journey, /topic: "Foundations",[\s\S]*?expectedCount: 4,/);
  assert.match(journey, /for \(let lessonNumber = 1; lessonNumber <= 11; lessonNumber \+= 1\)/);

  const finalState = source("scripts/writer-journey-final-state.mjs");
  assert.match(finalState, /completedLessonIds\.length >= 4/);
  assert.match(finalState, /completedLessonIds\.length >= 9/);
  assert.match(finalState, /foundationAnswers >= 33/);
  assert.match(finalState, /Number\(plan\.completeLessonCount \|\| 0\) >= 11/);
});

test("#1230 optional BUZZ verifies the local backbone and never substitutes a fake remote identity", () => {
  const buzz = source("scripts/verify-buzz-live-activity.mjs");
  assert.match(buzz, /request\("\/live-health"\)/);
  assert.match(buzz, /request\("\/status"\)/);
  assert.match(buzz, /if \(!connection\.configured \|\| !connection\.identityConfigured\)/);
  assert.match(buzz, /NOT CONFIGURED/);
  assert.match(buzz, /process\.exit\(0\)/);
  assert.match(buzz, /if \(!connection\.identityVerified\)/);
  assert.match(buzz, /signed identity verification/);
  for (const room of ["lore-library", "wayfarer-journal", "wyrmwood-ring", "lantern-watch", "gatehouse", "forge", "github-herald"]) {
    assert.match(buzz, new RegExp(room));
  }
});

test("#1230 exhaustive UAT emits real interaction progress without weakening its 60 second stall watchdog", () => {
  const audit = source("scripts/exhaustive-ui-control-audit.mjs");
  assert.match(audit, /"WORKING"/);
  assert.match(audit, /\$\{interactions\}\/\$\{interactionLimit\}/);

  const runner = source("scripts/full-verification-progress-runner.mjs");
  assert.match(runner, /export const EXHAUSTIVE_UAT_STALL_TIMEOUT_MS = 60_000;/);
  assert.match(runner, /"exhaustive-uat": EXHAUSTIVE_UAT_STALL_TIMEOUT_MS/);
});

test("#1230 Pi cold-start proof remains bounded and preserves useful process evidence", () => {
  const pi = source("scripts/verify-pi-repair-worker.mjs");
  assert.match(pi, /const PI_SMOKE_TIMEOUT_MS = 4 \* 60_000;/);
  assert.match(pi, /runPiSmoke\(\{ command: pi\.command, runtime, purpose: "repair", timeout: PI_SMOKE_TIMEOUT_MS \}\)/);
  assert.match(pi, /safePiFailure/);
  assert.match(pi, /stderr=/);
  assert.match(pi, /stdout=/);

  const runner = source("scripts/full-verification-progress-runner.mjs");
  assert.match(runner, /export const PI_PREFLIGHT_TIMEOUT_MS = 20 \* 60_000;/);
  assert.match(runner, /"pi-preflight": PI_PREFLIGHT_TIMEOUT_MS/);
});
