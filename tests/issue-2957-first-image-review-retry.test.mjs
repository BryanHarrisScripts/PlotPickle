import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  canRejectFirstImage,
  firstImageHistory,
  visualSequenceForAddress,
} from "../modules/visual/model/block-visual-candidates.mjs";

const workflow = "block-visual-journey-v1";
const anchor = "storyboard-anchor:block:block-01:mini-1";
const source = "block-visual-passage:scene-1";
const candidate = (id, reviewState = "draft", overrides = {}) => ({
  id,
  workflow,
  createdAt: "2026-10-13T14:00:00.000Z",
  frameNumber: 1,
  reviewState,
  prompt: "first grounded prompt",
  sourceDecisionKeys: [anchor, source],
  ...overrides,
});
const history = (artifacts) => firstImageHistory(artifacts, anchor, source, workflow);
const active = (artifacts, accepted = []) =>
  visualSequenceForAddress(artifacts, anchor, source, workflow, new Set(accepted));

test("PP-IMG-RETRY-001 isolates history by project-owned address, passage, workflow and frame", () => {
  const same = candidate("a");
  const otherAddress = candidate("b", "draft", { sourceDecisionKeys: ["different-anchor", source] });
  const otherPassage = candidate("c", "draft", { sourceDecisionKeys: [anchor, "other-passage"] });
  const otherWorkflow = candidate("d", "draft", { workflow: "other" });
  const secondFrame = candidate("e", "draft", { frameNumber: 2 });
  const artifacts = [otherAddress, otherPassage, otherWorkflow, secondFrame, same];
  assert.deepEqual(history(artifacts).map((item) => item.id), ["a"]);
  assert.deepEqual(active(artifacts).map((item) => item.id), ["a", "e"]);
  assert.equal(artifacts.length, 5, "selection never mutates the ledger");
});

test("rejecting a draft removes it only from active playback; the rejected provenance remains in history", () => {
  const rejected = candidate("rejected", "rejected", { prompt: "bad multi-panel result" });
  const other = candidate("retry", "draft", {
    createdAt: "2026-10-13T14:01:00.000Z",
    parentArtifactId: rejected.id,
    prompt: "revised two-brother single frame",
  });
  const artifacts = [rejected, other];
  assert.deepEqual(history(artifacts).map((item) => item.id), ["retry", "rejected"]);
  assert.deepEqual(active(artifacts).map((item) => item.id), ["retry"]);
  assert.equal(history(artifacts)[1].prompt, "bad multi-panel result");
  assert.equal(other.parentArtifactId, rejected.id);
  assert.equal(canRejectFirstImage(rejected, new Set()), false);
  assert.equal(canRejectFirstImage(other, new Set()), true);
});

test("an accepted first image outranks newer drafts and can never be rejected", () => {
  const approved = candidate("accepted-old", "accepted");
  const newer = candidate("draft-new", "draft", { createdAt: "2026-10-13T14:02:00.000Z" });
  assert.deepEqual(active([newer, approved], ["accepted-old"]).map((item) => item.id), ["accepted-old"]);
  assert.equal(canRejectFirstImage(approved, new Set(["accepted-old"])), false);
  assert.equal(canRejectFirstImage(newer, new Set(["draft-new"])), false);
  assert.equal(canRejectFirstImage(candidate("accepted-inconsistent", "accepted"), new Set()), false);
  assert.equal(canRejectFirstImage(undefined, new Set()), false);
});

test("repeated regeneration always selects newest eligible draft deterministically and never auto-accepts", () => {
  const attempts = [];
  for (let i = 0; i < 30; i += 1) {
    attempts.push(candidate("attempt-" + String(i).padStart(3, "0"), i % 3 === 0 ? "rejected" : "draft", {
      createdAt: new Date(Date.UTC(2026, 9, 13, 14, 0, i)).toISOString(),
      parentArtifactId: i ? "attempt-" + String(i - 1).padStart(3, "0") : null,
    }));
  }
  const original = JSON.stringify(attempts);
  assert.equal(history(attempts).length, 30);
  assert.equal(active(attempts)[0].id, "attempt-029");
  assert.equal(active(attempts)[0].reviewState, "draft");
  assert.equal(JSON.stringify(attempts), original);
  // Timestamp ties break by stable ID, not input or save order.
  const tie = [candidate("a"), candidate("z")];
  assert.equal(active(tie)[0].id, "z");
  assert.equal(active(tie.reverse())[0].id, "z");
});

test("the actual application wires reject, editable retry, approval guards and failed-route semantics", async () => {
  const visual = await readFile(new URL("../app/skin-v1/block-visual-journey-workspace.tsx", import.meta.url), "utf8");
  const commands = await readFile(new URL("../core/project/apply-command.ts", import.meta.url), "utf8");
  assert.match(visual, /function rejectFirstImage\(\)/u);
  assert.match(visual, /canRejectFirstImage\(firstImage, acceptedIds\)/u);
  assert.match(visual, /type: "foundations\.visual\.discard"/u);
  assert.match(visual, /type: "foundations\.visual\.accept"/u);
  assert.match(visual, /disabled=\{generating \|\| firstImageAccepted\}/u);
  assert.match(visual, /REJECT IMAGE/u);
  assert.match(visual, /REGENERATE IMAGE/u);
  assert.match(visual, /firstCandidates\.map\(\(candidate\) =>/u);
  assert.match(visual, /await generateOne\(submittedPrompt, 1, firstCandidates\[0\]\?\.id \?\? null\)/u);
  assert.match(visual, /prompt: submittedPrompt/u);
  assert.match(visual, /source-revision:\$\{project\.revision\}/u);
  assert.match(visual, /billingAcknowledged: cloudRoute \? billingAcknowledged : false/u);
  assert.match(visual, /if \(cloudRoute && !billingAcknowledged\)/u);
  assert.match(visual, /if \(!routeReady\)/u);
  assert.match(visual, /activeSelection\.passageId !== requestPassageId/u);
  assert.match(visual, /An accepted first image is already recorded/u);
  assert.match(visual, /storedPassage\.text !== selectedPassage\.text/u);
  assert.match(visual, /function promptIdentity\(project: PPFProject/u);
  assert.doesNotMatch(visual, /type: "foundations\.visual\.unaccept"/u);
  const store = commands.split('case "foundations.visual.store":')[1]?.split('case "foundations.visual.discard":')[0];
  assert.ok(store, "the actual shared visual store must exist");
  assert.doesNotMatch(store, /slice\(0, 75\)/u, "no previously generated image may be silently pruned");
  const discard = commands.split('case "foundations.visual.discard":')[1]?.split('case "foundations.visual.delete":')[0];
  assert.ok(discard, "the real shared command reducer must be present");
  assert.match(discard, /\.\.\.project\.build\.foundations/u, "reject must preserve unrelated story fields");
  assert.match(discard, /reviewState: "rejected"/u);
  assert.doesNotMatch(discard, /visualArtifacts:\s*\[\]/u);
});
