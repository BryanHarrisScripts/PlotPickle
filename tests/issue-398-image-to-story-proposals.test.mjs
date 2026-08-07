import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #398 supports character world scene action and dialogue proposals", async () => {
  const model = await source("lib/image-to-story-proposals.ts");
  assert.match(model, /StoryProposalKind = "character" \| "world" \| "scene" \| "action" \| "dialogue"/);
  assert.match(model, /sourceAssetId/);
  assert.match(model, /sourceCandidateId/);
  assert.match(model, /currentText/);
  assert.match(model, /proposedText/);
  assert.match(model, /rationale/);
});

test("issue #398 never edits story fields merely by adding a visual proposal", async () => {
  const model = await source("lib/image-to-story-proposals.ts");
  assert.match(model, /addImageToStoryProposal/);
  assert.match(model, /proposals: \[\.\.\.store\.proposals, proposal\]/);
  const addSection = model.slice(model.indexOf("export function addImageToStoryProposal"), model.indexOf("export function decideImageToStoryProposal"));
  assert.doesNotMatch(addSection, /applyFieldPath|story:\s*\{|world:\s*\{/);
});

test("issue #398 requires explicit accept edit reject or defer decisions", async () => {
  const [model, view] = await Promise.all([
    source("lib/image-to-story-proposals.ts"),
    source("app/image-to-story-proposals.tsx"),
  ]);
  assert.match(model, /"accepted" \| "edited" \| "rejected" \| "deferred"/);
  for (const label of [">Accept<", ">Edit then accept<", ">Defer<", ">Reject<"]) assert.ok(view.includes(label), `Missing decision: ${label}`);
});

test("issue #398 accepted changes preserve asset provenance and human decision in revision history", async () => {
  const model = await source("lib/image-to-story-proposals.ts");
  assert.match(model, /AcceptedStoryRevision/);
  assert.match(model, /sourceAssetId: proposal\.sourceAssetId/);
  assert.match(model, /sourceCandidateId: proposal\.sourceCandidateId/);
  assert.match(model, /before: proposal\.currentText/);
  assert.match(model, /after,/);
  assert.match(model, /humanDecision/);
  assert.match(model, /decidedBy/);
  assert.match(model, /REVISION_EXTENSION_KEY = "acceptedStoryRevisions"/);
});

test("issue #398 shows current and proposed text side by side with rationale", async () => {
  const view = await source("app/image-to-story-proposals.tsx");
  for (const phrase of ["Current text", "Proposed change", "Why the visual suggests this", "Human decision", "originating asset"]) {
    assert.ok(view.includes(phrase), `Missing proposal review behavior: ${phrase}`);
  }
});

test("issue #398 remains downstream of exploration candidates and visual canon", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 398/);
  assert.match(registry, /"id": "image-to-story-proposals"/);
  assert.match(registry, /"dependsOn": \["exploration-candidates", "visual-canon-binder"\]/);
});
