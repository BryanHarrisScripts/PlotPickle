import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNodeTestFailureInventory,
  parseNodeTestTapFailures,
} from "../lib/verification/uat-autopilot.mjs";

const TWO_FAILURES = `TAP version 13
# Subtest: stale skill shape
not ok 1 - stale skill shape
  ---
  duration_ms: 4.2
  location: '/workspace/PlotPickle/tests/skill-shape.test.mjs:12:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected keys to match the historical skill shape
  code: 'ERR_ASSERTION'
  stack: |-
    TestContext.<anonymous> (file:///workspace/PlotPickle/tests/skill-shape.test.mjs:12:1)
  ...
# Subtest: old navigation contract
not ok 2 - old navigation contract
  ---
  location: '/workspace/PlotPickle/tests/navigation.test.mjs:33:1'
  failureType: 'testCodeFailure'
  error: 'Expected legacy root navigation'
  code: 'ERR_ASSERTION'
  ...
1..2
# tests 2
# pass 0
# fail 2
`;

test("#2714 focused UAT evidence preserves every failing test with source and diagnostics", () => {
  const failures = parseNodeTestTapFailures(TWO_FAILURES, { repoRoot: "/workspace/PlotPickle" });
  assert.equal(failures.length, 2);
  assert.equal(failures[0].name, "stale skill shape");
  assert.equal(failures[0].source, "tests/skill-shape.test.mjs:12:1");
  assert.equal(failures[0].code, "ERR_ASSERTION");
  assert.match(failures[0].message, /historical skill shape/u);
  assert.equal(failures[1].source, "tests/navigation.test.mjs:33:1");
  assert.notEqual(failures[0].fingerprint, failures[1].fingerprint);
});

test("#2714 repeated manifestations are grouped without discarding raw failures", () => {
  const duplicated = TWO_FAILURES.replace(
    "1..2",
    `# Subtest: stale skill shape repeated
not ok 3 - stale skill shape
  ---
  location: '/workspace/PlotPickle/tests/skill-shape.test.mjs:12:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected keys to match the historical skill shape
  code: 'ERR_ASSERTION'
  ...
1..3`,
  );
  const inventory = buildNodeTestFailureInventory(duplicated, { repoRoot: "/workspace/PlotPickle" });
  assert.equal(inventory.failures.length, 3);
  const repeated = inventory.groups.find((group) => group.name === "stale skill shape");
  assert.equal(repeated?.occurrences, 2);
});

test("#2714 passing TAP produces an empty failure inventory", () => {
  const inventory = buildNodeTestFailureInventory(`TAP version 13\nok 1 - current contract\n1..1\n# pass 1\n# fail 0\n`);
  assert.deepEqual(inventory.failures, []);
  assert.deepEqual(inventory.groups, []);
});
