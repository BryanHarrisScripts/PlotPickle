import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function semanticContract() {
  const raw = (await source("lib/story-proposals.ts")).replace(/\r\n?/g, "\n");
  const withoutImports = raw.replace(/import[\s\S]*?;\n/g, "");
  const compiled = stripTypeScriptTypes(`const cloneProject = structuredClone;\n${withoutImports}`, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

function project(overrides = {}) {
  return {
    schemaVersion: "1.7.0",
    id: "story-152",
    metadata: { title: "Story", subtitle: "", format: "Feature", targetMinutes: 100, genre: "Drama", tone: "Grounded", status: "Draft", createdAt: "2026-07-27T00:00:00.000Z", updatedAt: "2026-07-27T00:00:00.000Z" },
    story: { premise: "Base", logline: "Base logline", theme: "Trust", antiTheme: "Isolation", dramaticQuestion: "Will they connect?", hook: "", catalyst: "", stakes: "", ending: "", notes: "" },
    development: { notes: { general: "", research: "", openQuestions: "", continuity: "", revisions: "", sources: "" } },
    screenplay: { draftElements: [{ id: "line-1", type: "dialogue", text: "Hello" }] },
    characters: [{ id: "char-1", name: "Mara" }],
    structure: { acts: [] },
    blocks: [{ id: "block-1", number: 1, scenes: [{ id: "scene-1", title: "Arrival", miniBlocks: [] }], visuals: [] }],
    storyThreads: [{ id: "thread-1", name: "Trust" }],
    world: { period: "Now", history: "", rules: "", technology: "", locations: [] },
    production: { shots: [], cues: [], breakdowns: [], schedule: [], animatic: {}, distribution: {} },
    review: { threads: [], loglineCandidates: [], pitchPackage: {} },
    revisions: [],
    rights: { projectOwner: "Owner", collaborators: [], attributions: [], aiProvenance: [] },
    collaboration: { provider: "github", owner: "approved-owner", repo: "story", branch: "main", projectPath: "stories/story.ppf", syncEnabled: true, lastPulledCommit: "base-commit", lastPushedCommit: "", connectedAt: "", updatedAt: "" },
    ...overrides,
  };
}

test("issue #152 groups story changes semantically and applies only selected groups", async () => {
  const contract = await semanticContract();
  const approved = project();
  const proposed = project({
    story: { ...approved.story, logline: "A changed logline" },
    screenplay: { draftElements: [{ id: "line-1", type: "dialogue", text: "Goodbye" }] },
    characters: [{ id: "char-1", name: "Mara Changed" }],
    blocks: [{ id: "block-1", number: 1, scenes: [{ id: "scene-1", title: "Departure", miniBlocks: [] }], visuals: [] }],
    production: { ...approved.production, shots: [{ id: "shot-1" }] },
    collaboration: { ...approved.collaboration, owner: "proposal-owner", lastPulledCommit: "proposal-commit" },
  });
  const paths = [
    "project/story/story.json",
    "project/screenplay/main.fountain",
    "project/characters/mara.json",
    "project/24-blocks/block-01.json",
    "project/production/module.json",
  ];
  const groups = contract.compareStoryProposalProjects(approved, proposed, paths);
  assert.deepEqual(groups.map((group) => group.id), ["story", "dialogue", "characters", "scenes", "production"]);
  assert.equal(contract.storyProposalGroupForPath("project/screenplay/main.fountain"), "dialogue");
  assert.equal(contract.storyProposalGroupForPath("project/voiceprints/mara.json"), "characters");
  assert.equal(contract.storyProposalGroupForPath("project/96-blocks/block-01-01.json"), "scenes");
  assert.equal(contract.storyProposalGroupForPath("project/storyboard/index.json"), "production");
  assert.equal(contract.storyProposalGroupForPath("project/canon/timeline.json"), "world");

  const accepted = contract.applyStoryProposalGroups(approved, proposed, ["dialogue", "characters"]);
  assert.equal(accepted.story.logline, "Base logline");
  assert.equal(accepted.screenplay.draftElements[0].text, "Goodbye");
  assert.equal(accepted.characters[0].name, "Mara Changed");
  assert.equal(accepted.blocks[0].scenes[0].title, "Arrival");
  assert.equal(accepted.production.shots.length, 0);
  assert.equal(accepted.collaboration.owner, "approved-owner");
  assert.equal(accepted.collaboration.lastPulledCommit, "base-commit");
});

test("issue #152 records approved and declined proposal decisions without credentials", async () => {
  const contract = await semanticContract();
  const original = "## Story Proposal\n\n<!-- plotpickle-decision: open -->\n";
  const approved = contract.withStoryProposalDecision(original, "approved");
  assert.equal(contract.storyProposalDecision(approved), "approved");
  assert.equal((approved.match(/plotpickle-decision/g) ?? []).length, 1);
  const declined = contract.withStoryProposalDecision(approved, "declined");
  assert.equal(contract.storyProposalDecision(declined), "declined");
  assert.doesNotMatch(declined, /accessToken|refreshToken|clientSecret|privateKey/);
});

test("issue #152 creates canonical file proposals and guarded selective approval commits", async () => {
  const gateway = await source("build/github-review-gateway.ts");
  for (const contract of [
    "createProjectSyncInventory",
    "diffProjectSyncInventories",
    "plotpickle/proposal/",
    "/git/blobs",
    "/git/trees",
    "/git/commits",
    "base_tree",
    "parents: [base.commitSha]",
    "force: false",
    "expectedBaseCommit",
    "selectedGroups",
    "applyStoryProposalGroups",
    "safeManagedDeletionPath",
    "/proposal-review",
    "/approve-proposal",
    "/decline-proposal",
    "/refresh-approved",
    "The approved branch changed after Story Proposal review began",
    "No API key, access token, refresh token or private credential",
  ]) assert.ok(gateway.includes(contract), `Story Proposal gateway is missing: ${contract}`);
  assert.doesNotMatch(gateway, /createPortableProjectFile|serializePortableProjectFile/);
  assert.doesNotMatch(gateway, /token:\s*project|accessToken:\s*project|refreshToken:\s*project/);
});

test("issue #152 exposes filmmaker-facing proposal creation and semantic decisions", async () => {
  const [workspace, component, styles, docs] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("app/story-proposals.tsx"),
    source("app/story-proposals.module.css"),
    source("docs/issue-152-story-proposals.md"),
  ]);
  assert.match(workspace, /import StoryProposals from "\.\/story-proposals"/);
  assert.match(workspace, /<StoryProposals/);
  for (const phrase of [
    "Story Proposals",
    "Create Story Proposal",
    "Refresh approved story",
    "Approve selected groups",
    "Decline proposal",
    "dialogue, character, scene, production",
    "Unselected groups are excluded",
    "Open review in GitHub",
  ]) assert.ok(component.includes(phrase), `Story Proposal UI is missing: ${phrase}`);
  for (const className of ["storyProposalWorkspace", "proposalComposer", "proposalLayout", "proposalQueue", "proposalReview", "semanticGrid", "semanticCard", "semanticSelected"]) {
    assert.ok(styles.includes(`.${className}`), `Story Proposal styling is missing: ${className}`);
  }
  for (const phrase of ["Only changed canonical project files", "Semantic review", "non-forced approved-branch ref update", "Unselected groups remain out", "encrypted local secrets area", "`.ppf` remains a portable exchange"]) {
    assert.ok(docs.includes(phrase), `Story Proposal documentation is missing: ${phrase}`);
  }
});

test("issue #152 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-152-story-proposals\.test\.mjs/);
  assert.equal(packageJson.scripts["test:story-proposals"], "node --test tests/issue-152-story-proposals.test.mjs");
});
