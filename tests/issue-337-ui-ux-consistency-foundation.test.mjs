import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function importSource(path) {
  const compiled = stripTypeScriptTypes(await source(path), { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

async function registry() {
  return JSON.parse(await source("config/ui-ux-screen-registry.json"));
}

test("the UI/UX programme registry covers canonical product navigation", async () => {
  const [audit, direction] = await Promise.all([
    registry(),
    importSource("lib/product-direction.ts"),
  ]);
  const screens = new Map(audit.screens.map((screen) => [screen.id, screen]));

  for (const item of direction.PRIMARY_WORKFLOW_NAVIGATION) {
    assert.equal(screens.get(item.id)?.label, item.label, `Missing canonical workflow screen: ${item.label}`);
    assert.equal(screens.get(item.id)?.area, "workflow");
  }
  for (const item of direction.COLLABORATION_NAVIGATION) {
    assert.equal(screens.get(item.id)?.label, item.label, `Missing canonical collaboration screen: ${item.label}`);
    assert.equal(screens.get(item.id)?.area, "collaboration");
  }
  assert.ok(audit.screens.some((screen) => screen.area === "settings"), "Settings audit screens are missing");
  assert.ok(audit.screens.some((screen) => screen.area === "shell"), "Application shell audit screens are missing");
  assert.ok(audit.screens.some((screen) => screen.area === "public"), "Public surface audit screens are missing");
});

test("every openable Settings target is assigned to a focused audit unit", async () => {
  const [audit, taxonomyText] = await Promise.all([
    registry(),
    source("config/settings-system-taxonomy.json"),
  ]);
  const taxonomy = JSON.parse(taxonomyText);
  const configuredItems = [
    ...taxonomy.workspace,
    ...taxonomy.systems.flatMap((system) => system.items),
  ];
  const configuredTargets = new Set(configuredItems.map((item) => item.target).filter(Boolean));
  const auditedTargets = new Set(
    audit.screens
      .filter((screen) => screen.area === "settings")
      .flatMap((screen) => screen.targets || []),
  );

  for (const target of configuredTargets) {
    assert.ok(auditedTargets.has(target), `Settings target is missing from the UI/UX audit registry: ${target}`);
  }
});

test("screen registry entries are stable, unique and reviewable", async () => {
  const audit = await registry();
  const ids = audit.screens.map((screen) => screen.id);
  const allowedAreas = new Set(["public", "shell", "workflow", "collaboration", "settings"]);
  const allowedStatuses = new Set(audit.lifecycle);
  const allowedRequirements = new Set(audit.requiredReviewDimensions);

  assert.equal(audit.schemaVersion, 1);
  assert.equal(audit.programmeIssue, 336);
  assert.equal(audit.foundationIssue, 337);
  assert.equal(new Set(ids).size, ids.length, "UI/UX screen ids must be unique");
  assert.ok(ids.length >= 30, "The complete screen audit registry is unexpectedly small");

  for (const screen of audit.screens) {
    assert.match(screen.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(screen.label.trim());
    assert.ok(screen.scope.trim());
    assert.ok(allowedAreas.has(screen.area), `Unknown screen area: ${screen.area}`);
    assert.ok(allowedStatuses.has(screen.status), `Unknown audit status: ${screen.status}`);
    assert.ok(Array.isArray(screen.requirements) && screen.requirements.length > 0, `Missing requirements for ${screen.id}`);
    for (const requirement of screen.requirements) {
      assert.ok(allowedRequirements.has(requirement), `Unknown requirement ${requirement} on ${screen.id}`);
    }
    if (screen.status === "audited") {
      assert.ok(Number.isInteger(screen.issue) && screen.issue > 0, `Audited screen ${screen.id} needs an issue`);
      assert.ok(Number.isInteger(screen.pullRequest) && screen.pullRequest > 0, `Audited screen ${screen.id} needs a merged PR`);
    }
  }
});

test("the shared contract preserves status meaning and the Dashboard-to-Settings boundary", async () => {
  const [audit, contract] = await Promise.all([
    registry(),
    source("docs/UI-UX-CONSISTENCY-PROGRAM.md"),
  ]);

  assert.deepEqual(audit.statusSemantics, {
    green: "Ready or connected",
    yellow: "Attention or setup required",
    red: "Unavailable or error",
  });
  assert.match(audit.dashboardBoundary, /read-only visual status surface/i);
  assert.match(audit.dashboardBoundary, /Settings screen/);
  assert.match(contract, /Dashboard must not contain component configuration forms/);
  assert.match(contract, /Colour never carries meaning alone/);
  assert.match(contract, /loading, empty, success, warning and error/);
  assert.match(contract, /wide desktop, narrow desktop\/tablet and mobile/);
  assert.match(contract, /logical tab order and visible focus/);
  assert.match(contract, /navigation does not silently discard edits/);
});

test("the foundation regression is enforced by a focused pull-request workflow", async () => {
  const workflow = await source(".github/workflows/ui-ux-consistency-foundation.yml");
  assert.match(workflow, /name: UI\/UX consistency foundation/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /tests\/issue-337-ui-ux-consistency-foundation\.test\.mjs/);
  assert.match(workflow, /Screen registry contract/);
});
