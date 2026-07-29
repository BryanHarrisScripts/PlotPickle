import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #172 preserves the ten-workspace sequence and adds owner-aware entry points", async () => {
  const [navigation, page, shelf] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/page.tsx"),
    source("app/workspace-capability-shelf.tsx"),
  ]);
  const orderedLabels = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"];
  let cursor = -1;
  for (const label of orderedLabels) {
    const next = navigation.indexOf(`label: "${label}"`, cursor + 1);
    assert.ok(next > cursor, `Navigation is missing or misorders ${label}`);
    cursor = next;
  }
  for (const workspace of ["learn", "plan", "storyboard", "write", "pitch", "build", "feedback", "refine", "reports"]) {
    assert.ok(page.includes(`${workspace}:`), `Missing query route for ${workspace}`);
  }
  assert.match(page, /<WorkspaceCapabilityShelf workspace=\{capabilityOwner\}/);
  for (const owner of ["Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Reports"]) {
    assert.ok(shelf.includes(`${owner} owns`) || shelf.includes(`${owner} · read only`), `Missing owner shelf for ${owner}`);
  }
});

test("Pitch owns package work while Feedback owns review and approval", async () => {
  const [workspace, route, shelf] = await Promise.all([
    source("app/pitch-review-workspace.tsx"),
    source("app/pitch-review/page.tsx"),
    source("app/workspace-capability-shelf.tsx"),
  ]);
  assert.match(workspace, /type PitchReviewScope = "pitch" \| "plan"/);
  assert.match(workspace, /\["logline", "Logline Lab", "pitch"\]/);
  assert.doesNotMatch(workspace, /scope: "feedback"/);
  assert.match(route, /window\.location\.replace\("\/\?workspace=feedback"\)/);
  assert.match(shelf, /Logline, package & exports/);
  assert.match(shelf, /Anchored reviews & revision compare/);
  assert.match(shelf, /Saved-pass approval/);
});

test("Storyboard and Build divide production tools and Reports remains read-only", async () => {
  const [production, route, reports, page] = await Promise.all([
    source("app/preproduction-workspace.tsx"),
    source("app/production/page.tsx"),
    source("app/production-reports-workspace.tsx"),
    source("app/page.tsx"),
  ]);
  for (const storyboardView of ['id: "shots"', 'id: "animatic"']) {
    assert.match(production, new RegExp(`${storyboardView.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*owner: "storyboard"`));
  }
  for (const buildView of ['id: "sonic"', 'id: "breakdowns"', 'id: "shoot-groups"', 'id: "schedule"', 'id: "distribution"']) {
    assert.match(production, new RegExp(`${buildView.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*owner: "build"`));
  }
  assert.match(route, /parameters\.get\("scope"\) === "storyboard"/);
  assert.match(production, /updateProductionShootGroupDecision/);
  assert.doesNotMatch(reports, /onProjectChange|updateProductionShootGroupDecision/);
  assert.match(reports, /Reports is read-only/);
  assert.doesNotMatch(page, /<ReportsWorkspace[^>]*onProjectChange/);
});

test("specialist labs use owner scopes and require a Feedback approval handoff", async () => {
  const [labs, route] = await Promise.all([
    source("app/specialist-labs.tsx"),
    source("app/labs/page.tsx"),
  ]);
  for (const contract of [
    '{ id: "dialogue", label: "Dialogue Lab"',
    'owner: "refine"',
    '{ id: "research", label: "Research & Canon"',
    'owner: "plan"',
    '{ id: "visual", label: "Visual Bible"',
    'owner: "storyboard"',
    '{ id: "passes", label: "Saved-Pass Approval History"',
    'owner: "feedback"',
  ]) assert.ok(labs.includes(contract), `Missing lab ownership contract: ${contract}`);
  assert.match(route, /requestedScope === "plan"/);
  assert.match(route, /requestedScope === "storyboard"/);
  assert.match(route, /requestedScope === "feedback"/);
  assert.match(labs, /PENDING_SPECIALIST_SUGGESTION_KEY/);
  assert.match(labs, /Send to Feedback for approval/);
  assert.match(labs, /scope === "feedback" \? "Apply approved suggestion"/);
});

test("Learn Plan and Refine divide Story Craft Essentials without duplicate editors", async () => {
  const [craft, voice, resonance, pageflow, draftlens] = await Promise.all([
    source("app/story-craft-essentials/page.tsx"),
    source("app/voiceprint/page.tsx"),
    source("app/resonance/page.tsx"),
    source("app/pageflow/page.tsx"),
    source("app/draftlens/page.tsx"),
  ]);
  assert.match(craft, /type StoryCraftScope = "learn" \| "plan" \| "refine"/);
  assert.match(craft, /id="experience" hidden=\{scope !== "plan"\}/);
  assert.match(craft, /id="theme" hidden=\{scope !== "plan"\}/);
  assert.match(craft, /id="motif" hidden=\{scope !== "plan"\}/);
  assert.match(craft, /id="audit" hidden=\{scope !== "refine"\}/);
  assert.match(craft, /hidden=\{scope !== "learn"\}/);
  assert.match(voice, /Plan · Character voice definitions/);
  assert.match(voice, /Back to Plan/);
  assert.match(resonance, /readOnly aria-readonly="true"/);
  assert.match(pageflow, /This text is read-only here\./);
  assert.match(draftlens, /DraftLens saves diagnostic notes only/);
  assert.match(draftlens, /it does not rewrite canonical story/);
});

test("Refine has exactly seven diagnostic passes and no moved editor card", async () => {
  const hub = await source("app/engine-hub.tsx");
  const titles = [
    "Overview & Diagnostic Queue",
    "Structure & Pacing Diagnostics",
    "Story & Theme through Resonance",
    "Character & Dialogue Diagnostics",
    "Page & Scene Diagnostics through PageFlow",
    "Full-Draft Diagnosis through DraftLens",
    "Revision Passes & Essential Craft Audit",
  ];
  for (const title of titles) assert.ok(hub.includes(title), `Missing Refine pass: ${title}`);
  assert.equal((hub.match(/code: "/g) ?? []).length, 7);
  for (const moved of ["Pitch & Review Studio", "Production Studio", "Specialist Labs", "Voiceprint Engine", "CraftLoop Engine"]) {
    assert.ok(!hub.includes(`title: "${moved}"`), `Refine still owns moved editor: ${moved}`);
  }
  assert.match(hub, /Refine diagnoses and proposes\./);
  assert.match(hub, /Reports owns read-only summaries/);
});

test("Reports adds provenance without a second database or mutation path", async () => {
  const [model, workspace] = await Promise.all([
    source("lib/consolidated-reports.ts"),
    source("app/reports-workspace.tsx"),
  ]);
  assert.match(model, /\| "provenance"/);
  assert.match(model, /id: "provenance"/);
  assert.match(workspace, /function renderProvenance/);
  assert.match(workspace, /project\.rights\.aiProvenance/);
  assert.doesNotMatch(workspace, /localStorage|sessionStorage|provenanceDatabase/);
});

test("issue #172 documentation and focused test are registered", async () => {
  const [documentation, packageText] = await Promise.all([
    source("docs/issue-172-refine-ownership.md"),
    source("package.json"),
  ]);
  for (const phrase of [
    "Refine diagnoses and proposes.",
    "Feedback owns discussion and approval.",
    "Reports owns read-only summaries.",
    "Dashboard, Learn, Plan, Storyboard, Write, Pitch, Build, Feedback, Refine, Reports.",
  ]) assert.ok(documentation.includes(phrase), `Missing #172 documentation contract: ${phrase}`);
  const packageJson = JSON.parse(packageText);
  assert.match(packageJson.scripts.test, /issue-172-refine-ownership\.test\.mjs/);
  assert.equal(packageJson.scripts["test:refine-ownership"], "node --test tests/issue-172-refine-ownership.test.mjs");
});
