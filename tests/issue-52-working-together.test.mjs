import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("legacy Collaborators guide maps into the Working Together handbook", async () => {
  const learning = await source("app/learning-working-together.ts");
  for (const phrase of [
    "Your Role and Key Questions",
    "Process Post-Submission",
    "Feedback and Communication",
    "Unlimited Contributions",
    "Evolving Together",
    "Act review questions",
    "Afterglow collaborator guide",
  ]) assert.ok(learning.includes(phrase), `Missing source alias: ${phrase}`);
  assert.match(learning, /legacyCollaboratorSourceMap/);
  assert.match(learning, /collection: "Working Together in PlotPickle"/);
  assert.equal((learning.match(/lesson\(\{/g) ?? []).length, 9);
});

test("handbook supports eight collaboration models without requiring GitHub or an open licence", async () => {
  const learning = await source("app/learning-working-together.ts");
  for (const model of [
    "Solo project with occasional feedback",
    "Private reviewer access",
    "Invited contributor",
    "Co-writing partnership",
    "Commissioned rewrite or specialist service",
    "Production-team collaboration",
    "Public feedback project",
    "Openly licensed community project",
  ]) assert.ok(learning.includes(model), `Missing collaboration model: ${model}`);
  assert.match(learning, /GitHub, AI, public publishing and an open licence remain optional tools and separate decisions/);
  assert.match(learning, /public repository may be readable without granting reuse rights/i);
});

test("roles and creative authority remain separate from technical permissions", async () => {
  const learning = await source("app/learning-working-together.ts");
  for (const role of [
    "Project Owner",
    "Co-owner / Maintainer",
    "Writer / Co-writer",
    "Contributor",
    "Reviewer",
    "Story Editor",
    "Research / Continuity Contributor",
    "Visual, Music or Production Contributor",
  ]) assert.ok(learning.includes(role), `Missing role: ${role}`);
  for (const action of ["View", "Comment", "Create review threads", "Propose changes", "Merge into canon", "Change licences"]) {
    assert.ok(learning.includes(`"${action}"`), `Missing authority action: ${action}`);
  }
  assert.match(learning, /Technical permission/);
  assert.match(learning, /creative authority/i);
});

test("workspace creates welcome cards, briefs, proposal packets, anchored feedback and decisions", async () => {
  const page = await source("app/working-together/page.tsx");
  for (const feature of [
    "Download welcome card",
    "Create contribution brief",
    "Proposal review packet",
    "Create anchored review thread",
    "Record canon decision",
    "Add to Rights & Provenance",
    "revision history",
    "PLOTPICKLE_COLLABORATION_RECORD",
  ]) assert.ok(page.includes(feature), `Missing workspace feature: ${feature}`);
  for (const field of [
    "Problem to solve",
    "Story purpose and audience effect",
    "Canon facts and continuity locks",
    "Elements that must not change",
    "Expected credit",
    "Compensation reference",
    "Ownership expectation",
    "Agreement reference",
    "Licence reference",
    "Acceptance criteria",
  ]) assert.ok(page.includes(field), `Missing brief field: ${field}`);
});

test("review categories, outcomes and contextual structure questions are complete", async () => {
  const learning = await source("app/learning-working-together.ts");
  for (const category of ["required", "continuity", "rights", "craft", "question", "preference", "praise"]) {
    assert.ok(learning.includes(`"${category}"`), `Missing feedback category: ${category}`);
  }
  for (const outcome of ["accepted", "changes-requested", "deferred", "declined", "superseded", "withdrawn", "resolved-without-change"]) {
    assert.ok(learning.includes(`"${outcome}"`), `Missing outcome: ${outcome}`);
  }
  assert.match(learning, /collaborationReviewQuestions/);
  assert.match(learning, /Block \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(learning, /do not impose one fixed legacy Act model/i);
});

test("rights, privacy and local-only boundaries are explicit", async () => {
  const combined = `${await source("app/learning-working-together.ts")}\n${await source("app/working-together/page.tsx")}`.toLowerCase();
  for (const phrase of [
    "feedback does not automatically create ownership",
    "a contribution does not automatically transfer copyright",
    "a public repository is not an open licence",
    "software and documentation licences do not automatically apply",
    "local-only and file-based collaboration remain fully supported",
    "local drafts, autosaves, ai prompts",
    "credentials remain outside",
    "only intentionally submitted proposal material is shared",
  ]) assert.ok(combined.includes(phrase), `Missing rights/privacy boundary: ${phrase}`);
});

test("Read and Learn and collaboration settings route into the handbook", async () => {
  const studio = await source("app/learning-studio.tsx");
  const collaboration = await source("app/github-collaboration.tsx");
  const pitch = await source("app/pitch-review/page.tsx");
  for (const integration of [
    "workingTogetherLessons",
    "workingTogetherSearchText",
    "Working Together in PlotPickle",
    "working-together",
    "workingTogetherLessons.map",
  ]) assert.ok(studio.includes(integration), `Missing learning integration: ${integration}`);
  assert.match(collaboration, /Open contributor onboarding/);
  assert.match(collaboration, /working-together/);
  assert.match(pitch, /Working Together/);
});

test("proposal flow remains owner-controlled and stale-base safe", async () => {
  const collaboration = await source("app/github-collaboration.tsx");
  const gateway = await source("build/github-review-gateway.ts");
  for (const phrase of ["Pull approved story", "Edit locally", "Submit proposal", "Owner decides", "requires a new pull before submission"]) {
    assert.ok(collaboration.includes(phrase), `Missing collaboration boundary: ${phrase}`);
  }
  assert.match(gateway, /stale/i);
  assert.match(collaboration, /canonical .* branch is unchanged until the repository owner merges it/i);
});
