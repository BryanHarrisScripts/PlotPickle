import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("screenplay import populates every current canonical project area", async () => {
  const importer = await source("lib/screenplay-import.ts");
  for (const field of [
    "metadata", "story", "world", "development", "screenplay", "structure", "characters", "blocks",
    "storyThreads", "rights", "revisions", "review", "production", "collaboration",
  ]) assert.ok(importer.includes(`${field}:`), `Importer is missing ${field}`);
  for (const section of [
    "voiceprints", "arc-matrices", "mini-blocks", "pitch-package", "production-breakdowns", "shoot-schedule", "distribution",
  ]) assert.ok(importer.includes(`"${section}"`), `Suggested-field audit is missing ${section}`);
  for (const field of [
    "originEnvironment", "socialContext", "educationExpertise", "worldviewBoundaries", "rhythmSentenceShape",
    "vocabularyMetaphors", "verbalFingerprints", "emotionalAccess", "statusShift", "persuasionStrategy",
    "arcMatrix", "charactersEntering", "charactersLeaving", "entryCondition", "exitCondition", "threadIds",
    "sourceAttributionIds", "review", "breakdowns", "schedule", "distribution", "projectPath",
  ]) assert.ok(importer.includes(field), `Imported screenplay hydration is missing ${field}`);
  assert.match(importer, /Imported screenplay baseline/);
  assert.match(importer, /Confirm imported screenplay analysis/);
  assert.match(importer, /sourceAttributionIds: \["imported-screenplay-source"\]/);
});

test("reports recalculate and audit all recently added sections", async () => {
  const [reports, panel] = await Promise.all([source("lib/screenplay-reports.ts"), source("app/settings-project-tools.tsx")]);
  for (const phrase of ["createScreenplayPopulationReport", "characters, arcs and voiceprints", "96 Mini-Blocks", "Story Threads", "Rights and provenance", "Review and pitch package", "Production planning", "Collaboration metadata"]) {
    assert.ok(reports.toLowerCase().includes(phrase.toLowerCase()), `Reports are missing ${phrase}`);
  }
  assert.match(panel, /Every number is recalculated/);
  assert.match(panel, /Report is current/);
  assert.match(panel, /Import and metadata audit/);
});

test("terminology uses readable categories, views, examples, and workspace links", async () => {
  const [terms, panel, styles] = await Promise.all([source("lib/screenplay-terms.ts"), source("app/settings-project-tools.tsx"), source("app/settings-project-tools.module.css")]);
  for (const category of ["Writing", "Formatting", "Structure", "Character", "Production", "Revision", "PlotPickle", "Collaboration"]) assert.ok(terms.includes(category));
  for (const term of ["Call sheet", "Canon", "Collaboration proposal", "Pull request", "Revision colour", "Story Bible"]) assert.ok(terms.includes(term));
  assert.match(panel, /Concise/);
  assert.match(panel, /Expanded/);
  assert.match(panel, /workspace\.href/);
  assert.match(styles, /termGrid/);
  assert.match(styles, /categoryBar/);
});

test("many local servers submit Story Proposals instead of writing directly to the approved version", async () => {
  const [gateway, workspace, proposals] = await Promise.all([
    source("build/github-review-gateway.ts"),
    source("app/github-collaboration.tsx"),
    source("app/story-proposals.tsx"),
  ]);
  for (const phrase of [
    "server-identity.json",
    "randomUUID",
    "plotpickle/proposal/",
    "/git/blobs",
    "/git/trees",
    "/git/commits",
    "pulls",
    "expectedBaseRevision",
    "expectedBaseCommit",
    "selectedGroups",
    "maintainer_can_modify",
  ]) assert.ok(gateway.includes(phrase), `Collaboration gateway is missing ${phrase}`);
  assert.match(workspace, /Many local PlotPickle servers\. One owner-controlled GitHub story/);
  assert.match(proposals, /Create Story Proposal/);
  assert.match(proposals, /Approve selected groups/);
  assert.match(proposals, /The approved \$\{branch\} version is unchanged/);
  assert.doesNotMatch(`${workspace}\n${proposals}`, /Push named backup/);
});
