import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { reviewBlockHandoff } from "../modules/write/model/block-handoff-review.mjs";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const plan = accepted => ({
  state: accepted ? "accepted" : "incomplete",
  content: "Human reviewed plan",
  acceptedAt: accepted ? "2026-10-14T12:00:00Z" : null,
});
function story() {
  return {
    id: "owned-current-story", title: "Brotherly Love", revision: 4,
    structure: { blocks: Array.from({ length: 24 }, (_, n) => ({
      id: "block-" + (n + 1), number: n + 1,
      miniBlocks: Array.from({ length: 4 }, (_, i) => ({
        ordinal: i + 1, stages: { plan: plan(i < 2), storyboard: { state: "locked" } },
      })),
    })) },
    sourceEvidence: { screenplay: { passagesTruncated: true,
      passages: [{ id: "passage-1", blockNumber: 1, miniBlockNumber: 1, text: "Immutable original screenplay" },
        { id: "passage-2", blockNumber: 2, miniBlockNumber: 1, text: "Other Block" }] },
      outlineAssessments: [{ blockNumber: 1, assessedAt: "2026-10-13" }] },
    writing: { entries: [{ blockNumber: 1, miniBlockNumber: 1, text: "Saved Human writing" }] },
  };
}
test("#2977 read-only Block census respects exact selected project and all four Mini-Blocks", () => {
  const project = story();
  const untouched = JSON.stringify(project);
  const x = reviewBlockHandoff(project, 1, { currentAssessment: true });
  assert.equal(x.projectId, "owned-current-story");
  assert.equal(x.revision, 4);
  assert.deepEqual(x.miniBlocks.map(m => m.address), ["1.1","1.2","1.3","1.4"]);
  assert.equal(x.acceptedCount, 2);
  assert.equal(x.allPlansAccepted, false);
  assert.equal(x.status, "requires-human-outline-review");
  assert.equal(x.mappedSourcePassages, 1);
  assert.equal(x.savedWritingCount, 1);
  assert.equal(x.sourceIsPartial, true);
  assert.equal(x.currentAssessment, true);
  assert.equal(JSON.stringify(project), untouched, "preflight cannot rewrite source, plan, assessment or writing");
  assert.equal(Object.isFrozen(x), true);
  assert.equal(Object.isFrozen(x.miniBlocks), true);
});
test("#2977 advisory Story Architect proposal never equals a Human-accepted Plan", () => {
  const p = story();
  p.sourceEvidence.outlineAssessments = [{ blockNumber: 1, assessedAt: "later", state: "approved" }];
  const x = reviewBlockHandoff(p, 1, { currentAssessment: true });
  assert.equal(x.acceptedCount, 2);
  assert.equal(x.allPlansAccepted, false);
  for (const m of p.structure.blocks[0].miniBlocks) m.stages.plan = plan(true);
  assert.equal(reviewBlockHandoff(p, 1).allPlansAccepted, true);
  p.structure.blocks[0].miniBlocks[0].stages.plan.acceptedAt = null;
  assert.equal(reviewBlockHandoff(p, 1).allPlansAccepted, false);
});
test("#2977 missing or punctuation-only imported title is exposed without inventing identity", () => {
  const p = story(); p.title = ".";
  assert.equal(reviewBlockHandoff(p, 1).titleNeedsReview, true);
  assert.equal(reviewBlockHandoff(p, 1).title, ".");
  assert.throws(() => reviewBlockHandoff(null, 1), /owning Library PPF/);
  assert.throws(() => reviewBlockHandoff(p, 25), RangeError);
  p.structure.blocks[0].miniBlocks = p.structure.blocks[0].miniBlocks.slice(0, 3);
  assert.throws(() => reviewBlockHandoff(p, 1), /four valid Mini-Block/);
});
test("#2977 every Block address stays bounded to one PPF; no automatic source repair", () => {
  const p = story(); const before = JSON.stringify(p);
  for (let n = 1; n <= 24; n++) {
    const x = reviewBlockHandoff(p, n);
    assert.equal(x.blockNumber, n);
    assert.deepEqual(x.miniBlocks.map(m => m.address), [1,2,3,4].map(i => n + "." + i));
    assert.equal(x.mappedSourcePassages, n === 1 || n === 2 ? 1 : 0);
  }
  assert.equal(JSON.stringify(p), before);
});
function handler(source) {
  const tree = ts.createSourceFile("write.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "visualizeBlock") functions.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(functions.length, 1, "execute the real Write handler, not a mock replacement");
  return stripTypeScriptTypes(functions[0].getText(tree)) + "\nvisualizeBlock";
}
test("#2977 actual Visualize handler refuses unaccepted Outline plans before any Run mutation", async () => {
  const write = await read("modules/write/ui/block-native-write-workspace.tsx");
  const p = story(), handoff = reviewBlockHandoff(p, 1);
  let status = "", calls = 0;
  const run = vm.runInNewContext(handler(write), {
    handoff, project: p, address: { blockNumber: 1 },
    dirty: false, saveInFlightRef: { current: false },
    setStatus(v) { status = v; }, setVisualizing() {},
    createAgenticStoryToScreenProjectionRequest() { calls++; throw new Error("must never be reached"); },
    responsibilityRunRequest() { calls++; throw new Error("must never be reached"); },
    responsibilityRunCreatePayload() { calls++; throw new Error("must never be reached"); },
    Date, String, Error,
  });
  await run();
  assert.equal(calls, 0);
  assert.match(status, /2\/4 accepted Outline Mini-Block plans/);
  assert.match(status, /no run was created/);
});
test("#2977 accepted Outline permits only proposal record preparation, not inference or canon changes", async () => {
  const write = await read("modules/write/ui/block-native-write-workspace.tsx");
  const p = story();
  for (const mini of p.structure.blocks[0].miniBlocks) mini.stages.plan = plan(true);
  const original = JSON.stringify(p), handoff = reviewBlockHandoff(p, 1);
  let status = "", calls = [];
  const run = vm.runInNewContext(handler(write), {
    handoff, project: p, address: { blockNumber: 1 },
    dirty: false, saveInFlightRef: { current: false },
    setStatus(v) { status = v; }, setVisualizing() {},
    createAgenticStoryToScreenProjectionRequest({ project, scope }) {
      assert.equal(project.id, "owned-current-story");
      assert.equal(scope.blockNumber, 1);
      return { canonicalRevision: 4, parentRun: { runId: "parent" },
        stages: [1,2,3,4,5].map(i => ({ run: { runId: "stage-" + i } })) };
    },
    responsibilityRunCreatePayload(run) { return { action: "create", runId: run.runId }; },
    async responsibilityRunRequest(payload) { calls.push(payload); },
    Date, String, Error,
  });
  await run();
  assert.equal(calls.length, 11, "one parent, five child records and five edges only");
  assert.equal(calls.filter(c => c.action === "create").length, 6);
  assert.equal(calls.filter(c => c.action === "attach-child").length, 5);
  assert.ok(calls.every(c => ["create", "attach-child"].includes(c.action)));
  assert.match(status, /not executed agent stages/);
  assert.match(status, /No Outline agent result, Storyboard image, provider call, cloud spend/);
  assert.equal(JSON.stringify(p), original, "preparing proposals cannot change any story or accepted evidence");
});
test("#2977 selected PPF Write surface shows real reviewed states, not a fake completed movie", async () => {
  const write = await read("modules/write/ui/block-native-write-workspace.tsx");
  assert.match(write, /reviewBlockHandoff\(project, address\.blockNumber/);
  assert.match(write, /currentOutlineAssessment\(project, address\.blockNumber\)/);
  assert.match(write, /data-block-handoff-project-id=\{handoff\.projectId\}/);
  assert.match(write, /accepted Outline plans: \{handoff\.acceptedCount\}\/4/i);
  assert.match(write, /disabled=\{visualizing \|\| !handoff\.allPlansAccepted\}/);
  assert.match(write, /onClick=\{openOutlineFromWrite\}/);
  assert.match(write, /it does not execute agents, generate images, certify Storyboard readiness/i);
});
