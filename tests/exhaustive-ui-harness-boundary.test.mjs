import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { McpToolArgumentError, toolArguments } from "../scripts/creative-uat/mcp-runtime.mjs";
import { clickArgs, pageStateSignature, refFor, selectArgs, snapshotControlRefs, typeArgs } from "../scripts/exhaustive-ui-control-audit.mjs";
import { isReportableExhaustiveFinding, partitionExhaustiveFindings } from "../scripts/exhaustive-ui-finding-policy.mjs";

const root = new URL("..", import.meta.url);

test("Playwright target schema receives legacy accessibility ref as required target", () => {
  const tool = {
    name: "browser_type",
    inputSchema: {
      properties: { element: { type: "string" }, target: { type: "string" }, text: { type: "string" }, submit: { type: "boolean" }, slowly: { type: "boolean" } },
      required: ["target", "text"],
    },
  };
  assert.deepEqual(
    typeArgs(tool, "e42", "Search every lesson", "test"),
    { element: "Search every lesson", text: "test", slowly: false, submit: false, target: "e42" },
  );
});

test("legacy ref schema remains supported", () => {
  const tool = {
    name: "browser_click",
    inputSchema: { properties: { element: { type: "string" }, ref: { type: "string" } }, required: ["element", "ref"] },
  };
  assert.deepEqual(
    clickArgs(tool, "e7", "Refresh"),
    { element: "Refresh", ref: "e7" },
  );
});

test("target-based click and select builders satisfy current Playwright MCP schema", () => {
  const clickTool = {
    name: "browser_click",
    inputSchema: { properties: { element: { type: "string" }, target: { type: "string" } }, required: ["target"] },
  };
  const selectTool = {
    name: "browser_select_option",
    inputSchema: { properties: { element: { type: "string" }, target: { type: "string" }, values: { type: "array" } }, required: ["target", "values"] },
  };
  assert.deepEqual(clickArgs(clickTool, "e11", "Great Hall"), { element: "Great Hall", target: "e11" });
  assert.deepEqual(selectArgs(selectTool, "e12", "Model", "local"), { element: "Model", values: ["local"], target: "e12" });
});

test("required MCP targeting arguments are rejected before the browser call", () => {
  const tool = {
    name: "browser_click",
    inputSchema: { properties: { element: { type: "string" }, target: { type: "string" } }, required: ["target"] },
  };
  assert.throws(
    () => toolArguments(tool, { element: "Refresh", ref: undefined }),
    (error) => error instanceof McpToolArgumentError && error.missing.includes("target"),
  );
});

test("snapshot refs preserve duplicate-control occurrence matching", () => {
  const snapshot = [
    '- button "Refresh" [ref=e7]',
    '- button "Refresh" [ref=e8]',
    '- tab "Great Hall" [ref=e9]',
  ].join("\n");
  assert.deepEqual(snapshotControlRefs(snapshot), [
    { role: "button", label: "Refresh", ref: "e7", occurrence: 0 },
    { role: "button", label: "Refresh", ref: "e8", occurrence: 1 },
    { role: "tab", label: "Great Hall", ref: "e9", occurrence: 0 },
  ]);
  assert.equal(refFor({ role: "button", label: "Refresh", occurrence: 1 }, snapshot)?.ref, "e8");
});

test("accessibility ref matching reconciles ampersands and harmless punctuation without changing roles", () => {
  const snapshot = [
    '- button "Agents and Stewards" [ref=e21]',
    '- link "Agents and Stewards" [ref=e22]',
    '- button "Open Story Room - Ready" [ref=e23]',
  ].join("\n");

  assert.equal(refFor({ role: "button", label: "Agents & Stewards", occurrence: 0 }, snapshot)?.ref, "e21");
  assert.equal(refFor({ role: "button", label: "Open Story Room: Ready", occurrence: 0 }, snapshot)?.ref, "e23");
});

test("accessibility ref matching allows one unique same-role token-superset name", () => {
  const snapshot = [
    '- button "View all Great Hall conversations 5 recent" [ref=e31]',
    '- link "View all Great Hall conversations" [ref=e32]',
  ].join("\n");

  assert.equal(refFor({ role: "button", label: "View all Great Hall conversations", occurrence: 0 }, snapshot)?.ref, "e31");
});

test("accessibility ref fallback refuses one-token and ambiguous fuzzy matches", () => {
  const oneToken = '- button "Refresh Community" [ref=e41]';
  assert.equal(refFor({ role: "button", label: "Refresh", occurrence: 0 }, oneToken), null);

  const ambiguous = [
    '- button "Open Story Room Ready" [ref=e42]',
    '- button "Open Story Room Offline" [ref=e43]',
  ].join("\n");
  assert.equal(refFor({ role: "button", label: "Open Story Room", occurrence: 0 }, ambiguous), null);
});

test("observable state signature includes semantic tab state, headings and status text", () => {
  const base = {
    url: "http://127.0.0.1:4173/?workspace=community",
    headings: ["Community"],
    statusText: [],
    controls: [{ role: "tab", label: "Great Hall", ariaSelected: "false", ariaExpanded: "", ariaPressed: "", ariaCurrent: "", dataState: "", value: "", checked: null, disabled: false, detailsOpen: null, options: [] }],
  };
  const changed = structuredClone(base);
  changed.controls[0].ariaSelected = "true";
  changed.headings = ["Great Hall"];
  assert.notEqual(pageStateSignature(base), pageStateSignature(changed));
});

test("issue #939 bundled same-lesson source links produce an observable status and target the exact source", async () => {
  const material = await readFile(new URL("modules/learn/ui/curriculum-material.tsx", root), "utf8");
  for (const contract of [
    "onOpenReference",
    "target.sourceId",
    "data-source-navigation-status",
    'role="status"',
    "Opened bundled source:",
    "scrollIntoView",
    "focus({ preventScroll: true })",
    "tabIndex={-1}",
  ]) {
    assert.ok(material.includes(contract), `Missing issue #939 source-navigation contract: ${contract}`);
  }
  assert.doesNotMatch(material, /onClick=\{\(\) => onOpenLesson\(target\.lessonId\)\}/);
});

test("harness findings stay local while a successfully exercised dead control remains reportable", () => {
  const harness = {
    kind: "harness",
    severity: "high",
    actionable: true,
    summary: "PLAN: button ‘Build’ could not be completed by the synthetic browser harness.",
    impact: "MCP argument validation: browser_click is missing required argument(s): target.",
  };
  const accessibility = {
    kind: "accessibility",
    severity: "high",
    actionable: true,
    summary: "PLAN: button ‘Build’ has no current accessibility target.",
    impact: "Visible rendered control had no matching accessibility ref in the current snapshot.",
  };
  const dead = {
    kind: "bug",
    severity: "high",
    actionable: true,
    summary: "PLAN: button ‘Build’ can be activated but produces no observable result.",
    impact: "The Playwright interaction completed successfully, but PlotPickle produced no observable route, control, semantic, heading or status change.",
  };

  assert.equal(isReportableExhaustiveFinding(harness), false);
  assert.equal(isReportableExhaustiveFinding(accessibility), false);
  assert.equal(isReportableExhaustiveFinding(dead), true);
  assert.deepEqual(partitionExhaustiveFindings([harness, accessibility, dead]), {
    reportable: [dead],
    harnessOnly: [harness, accessibility],
  });
});
