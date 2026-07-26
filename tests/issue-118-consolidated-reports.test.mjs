import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #118 defines the persistent eight-section Reports workspace", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const section of ["project", "story", "characters", "scenes", "dialogue", "production", "feedback", "connections"]) {
    assert.ok(reports.includes(`\"${section}\"`), `Missing consolidated report section: ${section}`);
  }
  assert.match(reports, /CONSOLIDATED_REPORT_SECTIONS/);
  assert.match(reports, /createConsolidatedReportsModel/);
});

test("issue #118 reuses existing canonical report and diagnostic builders", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "createCharacterDialogueReport",
    "createDirectorReport",
    "createProducerReport",
    "createScreenplayPopulationReport",
    "createMiniBlockWallModel",
    "createStoredFeedbackModel",
    "countSpokenWords",
  ]) assert.ok(reports.includes(contract), `Missing reused report builder: ${contract}`);
  assert.doesNotMatch(reports, /reportDatabase|cachedReports|localStorage|sessionStorage/);
});

test("issue #118 Project report covers draft format scale completion storyboard feedback and canon", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const metric of [
    'id: "draft"',
    'id: "format"',
    'id: "runtime"',
    'id: "pages"',
    'id: "scenes"',
    'id: "characters"',
    'id: "locations"',
    'id: "blocks"',
    'id: "mini-blocks"',
    'id: "storyboard"',
    'id: "feedback"',
    'id: "canonical"',
  ]) assert.ok(reports.includes(metric), `Missing Project report metric: ${metric}`);
  assert.match(reports, /project\.metadata\.updatedAt/);
  assert.match(reports, /project\.schemaVersion/);
});

test("issue #118 Story report covers balance completion diagnostics setup payoff arcs storylines and pacing", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "acts",
    "sequences",
    "completedBlocks",
    "diagnostics: wall.warnings",
    "setupPayoff",
    "unresolvedSetups",
    "unresolvedPayoffs",
    "characterArcs",
    "storylines",
    "pacingProfile",
    "averageShotSeconds",
  ]) assert.ok(reports.includes(contract), `Missing Story report contract: ${contract}`);
});

test("issue #118 Character report covers scenes dialogue appearances sharing arcs visuals requirements and days", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "dialogueLines",
    "dialogueEntries",
    "firstAppearance",
    "lastAppearance",
    "sharedScenes",
    "arcProgress",
    "visualContinuity",
    "actorRequirements",
    "shootingDays",
  ]) assert.ok(reports.includes(contract), `Missing Character report contract: ${contract}`);
});

test("issue #118 Scene report covers headings timing links storyboard feedback readiness and requirements", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "headingParts",
    "interiorExterior",
    "dayNight",
    "pageEstimate",
    "estimatedSeconds",
    "storyboardFrames",
    "feedback: feedbackCount",
    "readiness",
    "requirements",
    'target("write", row.id',
  ]) assert.ok(reports.includes(contract), `Missing Scene report contract: ${contract}`);
});

test("issue #118 Dialogue report covers counts speeches balance repetition voice sides and duration", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "longestSpeeches",
    "dialogueHeavyScenes",
    "silentScenes",
    "repeatedPhrases",
    "voiceConsistency",
    "estimatedSpeakingSeconds",
    "sceneHeadings",
  ]) assert.ok(reports.includes(contract), `Missing Dialogue report contract: ${contract}`);
});

test("issue #118 Production report exposes existing producer director and canonical planning records", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "summary: createProducerReport(project)",
    "scenes: createDirectorReport(project)",
    "project.production.shots",
    "project.production.cues",
    "project.production.breakdowns",
    "project.production.schedule",
    "project.production.distribution",
  ]) assert.ok(reports.includes(contract), `Missing Production report contract: ${contract}`);
});

test("issue #118 Feedback report covers status source reviewer target category priority and review rooms", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const contract of [
    "statuses",
    "sources",
    "reviewers",
    "categories",
    "priorities",
    "distribution",
    "writersRoom",
    "tableRead",
    "model.records",
  ]) assert.ok(reports.includes(contract), `Missing Feedback report contract: ${contract}`);
});

test("issue #118 Connections report remains useful when every optional integration is disconnected", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const connection of ["github", "ai", "plugins", "google", "storage", "backups"]) {
    assert.ok(reports.includes(`\"${connection}\"`), `Missing Connections row: ${connection}`);
  }
  assert.match(reports, /ReportsRuntimeConnections = \{\}/);
  assert.match(reports, /Not connected\. Core reporting remains available\./);
  assert.match(reports, /project\.collaboration\.repositoryUrl/);
  assert.match(reports, /project\.collaboration\.lastPulledCommit/);
  assert.match(reports, /project\.collaboration\.lastPushedCommit/);
});

test("issue #118 report actions retain stable workspace and target context", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  for (const workspace of ["dashboard", "plan", "build", "write", "storyboard", "feedback", "reports", "settings"]) {
    assert.ok(reports.includes(`\"${workspace}\"`), `Missing report target workspace: ${workspace}`);
  }
  for (const id of ["targetId", "blockId", "miniBlockId", "sceneId", "characterId"]) {
    assert.ok(reports.includes(id), `Missing stable report target field: ${id}`);
  }
  assert.doesNotMatch(reports, /window\.location|router\.push|redirect\(/);
});

test("issue #118 derives reports without mutating canonical project data", async () => {
  const reports = await source("lib/consolidated-reports.ts");
  assert.doesNotMatch(reports, /project\.(?:blocks|characters|screenplay|production|review|collaboration)\s*=/);
  assert.doesNotMatch(reports, /\.push\(|\.splice\(/);
});

test("issue #118 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-118-consolidated-reports\.test\.mjs/);
  assert.equal(packageJson.scripts["test:consolidated-reports"], "node --test tests/issue-118-consolidated-reports.test.mjs");
});
