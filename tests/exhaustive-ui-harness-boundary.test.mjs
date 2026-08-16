import test from "node:test";
import assert from "node:assert/strict";
import { toolArguments } from "../scripts/creative-uat/mcp-runtime.mjs";
import { isReportableExhaustiveFinding, partitionExhaustiveFindings } from "../scripts/exhaustive-ui-finding-policy.mjs";

test("Playwright target schema receives legacy accessibility ref as target", () => {
  const tool = { inputSchema: { properties: { element: {}, target: {}, text: {} } } };
  assert.deepEqual(
    toolArguments(tool, { element: "Search every lesson", ref: "e42", text: "test" }),
    { element: "Search every lesson", text: "test", target: "e42" },
  );
});

test("legacy ref schema remains supported", () => {
  const tool = { inputSchema: { properties: { element: {}, ref: {} } } };
  assert.deepEqual(
    toolArguments(tool, { element: "Refresh", ref: "e7" }),
    { element: "Refresh", ref: "e7" },
  );
});

test("harness-only findings stay local while reproduced dead controls remain reportable", () => {
  const harness = {
    kind: "bug",
    severity: "high",
    actionable: true,
    summary: "PLAN: button ‘Build’ threw or stalled during synthetic UAT.",
    impact: "Invalid arguments for tool browser_click: expected string, received undefined at target",
  };
  const dead = {
    kind: "bug",
    severity: "high",
    actionable: true,
    summary: "PLAN: button ‘Build’ can be activated but produces no observable result.",
    impact: "A user can get trapped clicking controls without knowing whether anything happened.",
  };

  assert.equal(isReportableExhaustiveFinding(harness), false);
  assert.equal(isReportableExhaustiveFinding(dead), true);
  assert.deepEqual(partitionExhaustiveFindings([harness, dead]), {
    reportable: [dead],
    harnessOnly: [harness],
  });
});
