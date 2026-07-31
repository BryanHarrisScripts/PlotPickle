import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  advanceDiagnosticLoop,
  buildDiagnosticPacket,
  createDiagnosticLoop,
  globToRegExp,
  matchesPattern,
  parseNodeTestOutput,
  planChangedTests,
  renderFailureSummary,
  validateAgentProposal,
  validateDiagnosticsRegistry,
} from "../scripts/developer-diagnostics/index.mjs";

const registry = JSON.parse(await readFile(new URL("../config/developer-diagnostics.json", import.meta.url), "utf8"));

test("issue #240 validates one global modular diagnostics registry", () => {
  const result = validateDiagnosticsRegistry(registry);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.ok(registry.areas.some((area) => area.id === "settings"));
  assert.ok(registry.areas.some((area) => area.id === "developer-diagnostics"));
  assert.equal(registry.agentPolicy.mode, "diagnosis-only");
});

test("glob matching supports repository-wide single and recursive patterns", () => {
  assert.equal(matchesPattern("app/settings-panel.tsx", "app/settings-*.tsx"), true);
  assert.equal(matchesPattern("app/settings/buzz/page.tsx", "app/settings/**"), true);
  assert.equal(matchesPattern("app/google-calendar-workspace.tsx", "app/google-*.tsx"), true);
  assert.equal(matchesPattern("lib/google-calendar.ts", "app/google-*.tsx"), false);
  assert.ok(globToRegExp(".github/workflows/*.yml").test(".github/workflows/quality.yml"));
});

test("changed-file planning is deterministic, explainable and never broadens to the full suite", () => {
  const plan = planChangedTests([
    "config/settings-system-taxonomy.json",
    "app/settings-panel.tsx",
  ], registry, { source: "test" });

  assert.equal(plan.source, "test");
  assert.ok(plan.areas.some((area) => area.id === "settings"));
  assert.ok(plan.suites.includes("tests/settings-menu.test.mjs"));
  assert.ok(plan.suites.includes("tests/issue-120-settings-connections.test.mjs"));
  assert.match(plan.commandText, /^node --test /);
  assert.equal(plan.safeFallback, null);
  assert.equal(plan.requiresHumanApprovalForFullSuite, true);
});

test("unmapped or unavailable changes stop instead of silently running everything", () => {
  const noFiles = planChangedTests([], registry, { source: "unavailable" });
  assert.match(noFiles.safeFallback, /full suite was not selected automatically/i);
  assert.deepEqual(noFiles.command, []);

  const unknown = planChangedTests(["notes/private-scratch.txt"], registry, { source: "test" });
  assert.match(unknown.safeFallback, /did not match a registered diagnostic area/i);
  assert.deepEqual(unknown.command, []);
});

test("Node test failures become structured contract-aware evidence", () => {
  const output = `
TAP version 13
not ok 1 - Settings exposes the complete Settings navigation
  ---
  duration_ms: 1.2
  location: 'file:///repo/tests/issue-120-settings-connections.test.mjs:92:1'
  failureType: 'testCodeFailure'
  error: 'missing control: Save key & connect'
  code: 'ERR_ASSERTION'
  ...
not ok 2 - Settings uses the expected connection controls
  ---
  location: 'file:///repo/tests/issue-120-settings-connections.test.mjs:110:1'
  error: 'missing control: Save key & connect'
  ...
1..2
# fail 2
`;
  const summary = parseNodeTestOutput(output, registry);
  assert.equal(summary.passed, false);
  assert.equal(summary.counts.failures, 2);
  assert.equal(summary.failures[0].testFile, "tests/issue-120-settings-connections.test.mjs");
  assert.ok(summary.failures[0].contracts.some((contract) => contract.id === "settings.controls"));
  assert.equal(summary.clusters.length, 1);
  assert.equal(summary.clusters[0].sharedCause, true);
  assert.equal(summary.focusedCommandText, "node --test tests/issue-120-settings-connections.test.mjs");
});

test("failure reports state evidence and confidence without pretending certainty", () => {
  const summary = parseNodeTestOutput(`
not ok 1 - Windows smoke
  ---
  location: 'file:///repo/tests/windows-release-smoke.test.mjs:20:1'
  error: 'Browser did not become ready within 8000 ms.'
  ...
`, registry);
  const markdown = renderFailureSummary(summary);
  assert.match(markdown, /Classification: environment/);
  assert.match(markdown, /confidence low/);
  assert.match(markdown, /Focused rerun/);
});

test("agent packets contain structured evidence and no raw repository content", () => {
  const plan = planChangedTests(["app/settings-panel.tsx"], registry, { source: "test" });
  const summary = parseNodeTestOutput(`
not ok 1 - Settings control
  ---
  location: 'file:///repo/tests/settings-menu.test.mjs:12:1'
  error: 'missing control'
  ...
`, registry);
  summary.secretToken = "must-not-leak";
  const packet = buildDiagnosticPacket(summary, plan, registry);
  const serialized = JSON.stringify(packet);
  assert.equal(packet.mode, "diagnosis-only");
  assert.ok(packet.scope.allowedPaths.length > 0);
  assert.doesNotMatch(serialized, /must-not-leak/);
  assert.doesNotMatch(serialized, /rawOutput/);
});

test("bounded agent policy rejects scope expansion, broad commands and repetition", () => {
  const plan = planChangedTests(["app/settings-panel.tsx"], registry, { source: "test" });
  const summary = parseNodeTestOutput(`
not ok 1 - Settings control
  ---
  location: 'file:///repo/tests/settings-menu.test.mjs:12:1'
  error: 'missing control'
  ...
`, registry);
  const packet = buildDiagnosticPacket(summary, plan, registry);

  const validProposal = {
    action: "focused-test",
    decision: "continue",
    diagnosis: "Inspect the registered Settings control contract.",
    evidence: ["failure-1"],
    paths: [],
    command: summary.focusedCommand,
  };
  const first = validateAgentProposal(validProposal, packet, registry, []);
  assert.equal(first.valid, true);

  const repeated = validateAgentProposal(validProposal, packet, registry, [{ fingerprint: first.fingerprint }]);
  assert.match(repeated.errors.join("\n"), /repetition is blocked/i);

  const expanded = validateAgentProposal({
    ...validProposal,
    paths: ["app/unrelated-feature.tsx"],
  }, packet, registry, []);
  assert.match(expanded.errors.join("\n"), /outside the diagnosed scope/i);

  const broad = validateAgentProposal({
    ...validProposal,
    command: ["npm", "test"],
  }, packet, registry, []);
  assert.match(broad.errors.join("\n"), /not one of the focused commands/i);
});

test("reinforcement loop follows observe classify propose verify stop and respects attempt limits", () => {
  const plan = planChangedTests(["app/settings-panel.tsx"], registry, { source: "test" });
  const summary = parseNodeTestOutput(`
not ok 1 - Settings control
  ---
  location: 'file:///repo/tests/settings-menu.test.mjs:12:1'
  error: 'missing control'
  ...
`, registry);
  const packet = buildDiagnosticPacket(summary, plan, registry);
  let loop = createDiagnosticLoop(packet);
  loop = advanceDiagnosticLoop(loop, { type: "evidence-ready" }, packet);
  loop = advanceDiagnosticLoop(loop, { type: "classification-ready" }, packet);
  loop = advanceDiagnosticLoop(loop, { type: "proposal-accepted" }, packet);
  loop = advanceDiagnosticLoop(loop, { type: "verification-failed" }, packet);
  assert.equal(loop.state, "classify");
  loop = advanceDiagnosticLoop(loop, { type: "classification-ready" }, packet);
  loop = advanceDiagnosticLoop(loop, { type: "proposal-accepted" }, packet);
  loop = advanceDiagnosticLoop(loop, { type: "verification-failed" }, packet);
  assert.equal(loop.state, "stop");
  assert.equal(loop.result, "attempt-limit");

  let ambiguous = createDiagnosticLoop(packet);
  ambiguous = advanceDiagnosticLoop(ambiguous, { type: "ambiguous" }, packet);
  assert.equal(ambiguous.result, "review-required");
});
