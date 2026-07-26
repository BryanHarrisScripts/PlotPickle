import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #119 defines all eight persistent Production report sections", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const section of ["overview", "locations", "shot-types", "shoot-groups", "actor-schedule", "shooting-timeline", "requirements", "ai-systems"]) {
    assert.ok(reports.includes(`id: "${section}"`), `Missing Production report section: ${section}`);
  }
  assert.match(reports, /PRODUCTION_REPORT_SECTIONS/);
  assert.match(reports, /ProductionReportSection/);
});

test("issue #119 derives Production intelligence from canonical scene storyboard character and production records", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const contract of [
    "project.blocks.flatMap",
    "project.screenplay.draftElements.find",
    "project.production.breakdowns",
    "project.production.schedule",
    "project.production.shots",
    "project.production.cues",
    "block.visuals.filter",
    "project.characters.map",
    "project.world.locations.map",
  ]) assert.ok(reports.includes(contract), `Missing canonical reuse contract: ${contract}`);
  assert.doesNotMatch(reports, /localStorage|sessionStorage|productionReportDatabase/);
});

test("issue #119 location report includes story real and logistical fields", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const field of [
    "storyLocation",
    "realLocation",
    "interiorExterior",
    "dayNight",
    "characters",
    "props",
    "wardrobe",
    "sound",
    "lighting",
    "weather",
    "permits",
    "travel",
    "accessibility",
    "availability",
    "setupMinutes",
    "estimatedShootHours",
    "estimateBasis",
  ]) assert.ok(reports.includes(field), `Missing location field: ${field}`);
});

test("issue #119 covers the complete requested shot taxonomy", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const shotType of [
    "Establishing",
    "Wide",
    "Full",
    "Medium",
    "Close-up",
    "Extreme close-up",
    "Over the shoulder",
    "Two-shot",
    "Group",
    "POV",
    "Insert",
    "Cutaway",
    "Tracking",
    "Handheld",
    "Crane / jib",
    "Drone",
    "Static",
    "Vehicle",
    "Green-screen / virtual production",
    "VFX plate",
  ]) assert.ok(reports.includes(`label: "${shotType}"`), `Missing shot type: ${shotType}`);
});

test("issue #119 shoot groups explain reasoning and persist accept reject and adjustment decisions", async () => {
  const [reports, project, workspace] = await Promise.all([
    source("lib/production-reports.ts"),
    source("lib/project.ts"),
    source("app/production-reports-workspace.tsx"),
  ]);
  for (const reason of ["Shared location:", "Shared story time:", "Shared cast:", "Shared wardrobe:", "Shared props:", "Shared vehicles:", "Shared stunt needs:", "Shared effects:"]) {
    assert.ok(reports.includes(reason), `Missing group rationale: ${reason}`);
  }
  assert.match(reports, /updateProductionShootGroupDecision/);
  assert.match(project, /ProductionShootGroupDecisionStatus = "proposed" \| "accepted" \| "rejected" \| "adjusted"/);
  for (const action of ["Accept proposal", "Reject", "Reset", "Manual scene adjustment", "Producer adjustment note"]) {
    assert.ok(workspace.includes(action), `Missing manual shoot-group action: ${action}`);
  }
});

test("issue #119 actor schedule includes cast days locations sides availability and conflicts", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const contract of [
    "actorName",
    "availableDates",
    "unavailableDates",
    "wardrobe",
    "makeup",
    "rehearsalHours",
    "callTime",
    "wrapTime",
    "daysRequired",
    "groupedScenes",
    "sides",
    "conflicts",
    "unscheduledScenes",
    "byDay",
  ]) assert.ok(reports.includes(contract), `Missing actor schedule contract: ${contract}`);
});

test("issue #119 timeline exposes optimistic realistic and contingency schedules from production complexity", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const scenario of ['id: "optimistic"', 'id: "realistic"', 'id: "contingency"']) assert.ok(reports.includes(scenario));
  for (const input of [
    "pageEstimate",
    "characterIds.length",
    "shotIds.length",
    "stunts",
    "effects",
    "vehicles",
    "makeup",
    "pagesPerDay",
    "scenesPerDay",
    "nights",
    "moves",
    "prepDays",
    "pickupDays",
    "contingencyPercent",
  ]) assert.ok(reports.includes(input), `Missing timeline input: ${input}`);
});

test("issue #119 consolidates every requested production requirement category", async () => {
  const reports = await source("lib/production-reports.ts");
  for (const category of [
    "Cast",
    "Extras",
    "Locations",
    "Props",
    "Wardrobe",
    "Makeup",
    "Vehicles",
    "Animals",
    "Stunts",
    "Practical effects",
    "VFX",
    "Equipment",
    "Sound",
    "Playback",
    "Permits",
    "Safety",
    "Accessibility",
  ]) assert.ok(reports.includes(`"${category}"`), `Missing requirement category: ${category}`);
});

test("issue #119 AI system options are dated sourced maintainable and credential-free", async () => {
  const dataText = await source("data/production-ai-systems.json");
  const data = JSON.parse(dataText);
  assert.match(data.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(data.nextReviewDue, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(data.editorialNote, /not permanent rankings/i);
  for (const category of ["video", "image", "aggregator"]) {
    assert.equal(data.categories[category].length, 3, `${category} must have three reviewed options`);
    for (const option of data.categories[category]) {
      for (const field of ["displayOrder", "provider", "modelOrService", "costModel", "apiStatus", "pluginStatus", "deployment", "licensingPrivacy", "recommendedUse"]) {
        assert.ok(option[field] !== undefined && option[field] !== "", `${option.id} is missing ${field}`);
      }
      assert.ok(option.sources.length > 0);
      assert.ok(option.sources.every((url) => url.startsWith("https://")));
    }
  }
  assert.doesNotMatch(dataText, /api[_-]?key|access[_-]?token|secret|bearer\s+[a-z0-9]/i);
});

test("issue #119 mounts the nested Production workspace with visible guidance and canonical writes", async () => {
  const [reportsWorkspace, productionWorkspace, page, consolidated] = await Promise.all([
    source("app/reports-workspace.tsx"),
    source("app/production-reports-workspace.tsx"),
    source("app/page.tsx"),
    source("lib/consolidated-reports.ts"),
  ]);
  assert.match(reportsWorkspace, /<ProductionReportsWorkspace/);
  assert.match(productionWorkspace, /aria-label="Production report sections"/);
  assert.match(productionWorkspace, /Production planning guidance/);
  assert.match(productionWorkspace, /onProjectChange\(updateProductionShootGroupDecision/);
  assert.match(page, /productionReportSection/);
  assert.match(page, /onProjectChange=\{commit\}/);
  assert.match(consolidated, /createProductionReportsModel\(project\)/);
});

test("issue #119 production planning state is backward-compatible and normalized", async () => {
  const project = await source("lib/project.ts");
  assert.match(project, /reporting\?: ProductionReporting/);
  assert.match(project, /createBlankProductionReporting/);
  assert.match(project, /normalizeProductionReporting/);
  assert.match(project, /reporting: normalizeProductionReporting\(candidate\.reporting, now\)/);
  assert.match(project, /stringArray\(decision\.sceneIds\)/);
});

test("issue #119 repairs the Windows Drizzle tooling verification gap", async () => {
  const [packageText, lockText, runtime, setup] = await Promise.all([
    source("package.json"),
    source("package-lock.json"),
    source("scripts/windows-runtime.mjs"),
    source("scripts/windows-setup-report.mjs"),
  ]);
  const packageJson = JSON.parse(packageText);
  const lockJson = JSON.parse(lockText);
  assert.equal(packageJson.devDependencies["drizzle-kit"], "0.31.10");
  assert.equal(lockJson.packages[""].devDependencies["drizzle-kit"], "0.31.10");
  assert.match(runtime, /\["vite", "next", "react", "vinext", "rolldown", "drizzle-kit"\]/);
  assert.match(runtime, /update\(packageSource\)\.update\("\\0"\)\.update\(lockSource\)/);
  assert.match(setup, /update\(packageSource\)\.update\("\\0"\)\.update\(lockSource\)/);
  assert.match(setup, /\["Project data build tooling", "drizzle-kit"\]/);
});

test("issue #119 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-119-production-reports\.test\.mjs/);
  assert.equal(packageJson.scripts["test:production-reports"], "node --test tests/issue-119-production-reports.test.mjs");
});
