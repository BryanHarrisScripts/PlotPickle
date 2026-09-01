import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1571 gives each of the six core testers one bounded journey owner", async () => {
  const source = await read("build/autonomous-guest/qa/tester-journeys.ts");
  for (const role of [
    "fresh-install",
    "beginner-writer",
    "full-story-journey",
    "visual-production",
    "persistence-recovery",
    "adversarial-boundary",
  ]) assert.equal(source.match(new RegExp(`role: \\\"${role}\\\"`, "g"))?.length, 1, `${role} should have exactly one journey owner`);
  assert.ok(source.includes("autonomousQaTesterJourneys"));
  assert.ok(source.includes("has more than one journey owner"));
});

test("#1571 reuses existing installer, focused UAT, autonomous story and boundary authorities", async () => {
  const [journeys, installer, reference, routes, focused] = await Promise.all([
    read("build/autonomous-guest/qa/tester-journeys.ts"),
    read(".github/workflows/windows-installer.yml"),
    read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs"),
    read("scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs"),
    read("scripts/run-uat-autopilot.mjs"),
  ]);
  for (const adapter of ["windows-installer", "focused-uat", "autonomous-story-reference", "deterministic-boundary"]) {
    assert.ok(journeys.includes(`\"${adapter}\"`), `Missing existing execution adapter ${adapter}`);
  }
  assert.ok(installer.includes("Run install and uninstall smoke"));
  assert.ok(reference.includes("createManagedPlotPickleLifecycle"));
  assert.ok(reference.includes("runRoutePass"));
  assert.ok(routes.includes("autonomousStoryRoutes"));
  assert.ok(routes.includes("browser_navigate"));
  assert.ok(focused.includes("inspectRegisteredAreas"));
  assert.doesNotMatch(journeys, /new McpClient|browser_navigate|spawn\(|writeFile\(|applyStoryCommand|saveActiveLibraryProject/);
});

test("#1571 role plans name only canonical registered routes and deterministic evidence", async () => {
  const [journeys, registry] = await Promise.all([
    read("build/autonomous-guest/qa/tester-journeys.ts"),
    read("config/uat-autopilot-registry.json"),
  ]);
  const registered = new Set(JSON.parse(registry).autonomousStoryRoutes.map((route) => route.id));
  for (const routeId of [
    "library", "learn", "plan", "build", "story-decisions", "story-workbench", "visual-readiness",
    "storyboard", "production-shots", "previs-animatic", "write", "edit", "refine", "reports",
  ]) assert.ok(registered.has(routeId));
  assert.ok(journeys.includes("autonomousGuestRegisteredRouteIds"));
  assert.ok(journeys.includes("unregistered product route"));
  assert.ok(journeys.includes("has no deterministic execution evidence"));
});

test("#1571 tester roles preserve special execution boundaries instead of pretending every role is the same browser pass", async () => {
  const source = await read("build/autonomous-guest/qa/tester-journeys.ts");
  assert.match(source, /role: "fresh-install"[\s\S]*?requiresWindows: true/);
  assert.match(source, /role: "full-story-journey"[\s\S]*?referenceWorkingCopy: true/);
  assert.match(source, /role: "visual-production"[\s\S]*?visual-readiness[\s\S]*?storyboard[\s\S]*?production-shots[\s\S]*?previs-animatic/);
  assert.match(source, /role: "persistence-recovery"[\s\S]*?application-lifecycle\.mjs/);
  assert.match(source, /role: "adversarial-boundary"[\s\S]*?deterministic-boundary/);
});
