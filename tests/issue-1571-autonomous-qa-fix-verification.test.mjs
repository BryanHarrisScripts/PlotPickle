import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1571 targeted reruns require a reproduced defect and a different exact fix head", async () => {
  const source = await read("build/autonomous-guest/qa/fix-verification.ts");
  assert.ok(source.includes('campaignType: "targeted-rerun"'));
  assert.ok(source.includes("!input.defect.reproducible"));
  assert.ok(source.includes('input.defect.severity === "flaky"'));
  assert.ok(source.includes("requires an exact fix commit SHA"));
  assert.ok(source.includes("must run on a different exact commit"));
});

test("#1571 targeted reruns preserve the original reproduction plus affected registered routes", async () => {
  const source = await read("build/autonomous-guest/qa/fix-verification.ts");
  assert.ok(source.includes("autonomousQaTesterJourney"));
  assert.ok(source.includes("reproductionRefs"));
  assert.ok(source.includes("regressionRouteIds"));
  assert.ok(source.includes("regressionRouteIds.add(input.defect.routeId)"));
});

test("#1571 a repair is fixed only when reproduction, affected routes and deterministic gates pass", async () => {
  const source = await read("build/autonomous-guest/qa/fix-verification.ts");
  assert.ok(source.includes("evidence.reproductionPassed === true"));
  assert.ok(source.includes("evidence.deterministicGateRefs.length > 0"));
  assert.ok(source.includes("missingRoutes.length === 0"));
  assert.ok(source.includes('"verified-fixed"'));
  assert.ok(source.includes('"not-fixed"'));
  assert.ok(source.includes("aiSelfCertified: false"));
});

test("#1571 fix verification is evidence-only and cannot edit source/canon or self-approve", async () => {
  const source = await read("build/autonomous-guest/qa/fix-verification.ts");
  assert.doesNotMatch(source, /writeFile|fetch\(|github|applyStoryCommand|saveActiveLibraryProject|browser_navigate|model|prompt|completion/i);
});
