import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEmptyPrevisProductionState,
  normalizePrevisProductionState,
} from "../core/contracts/previs/index.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2531 persists bounded Graphic Novel text approvals as presentation-only Previs production state", () => {
  const empty = createEmptyPrevisProductionState();
  assert.deepEqual(empty.graphicNovelTextApprovals, []);

  const normalized = normalizePrevisProductionState({
    shots: [],
    graphicNovelTextApprovals: [{
      anchorRef: "storyboard-anchor:block:block-01:mini-1",
      position: 4,
      sourceKey: '{"assetUrl":"/api/local-ai/assets/frame-4.webp","narration":"source"}',
      narration: "Ren looks toward the water.",
      bubbles: [
        { speaker: "REN", text: "Did you hear that?" },
        { speaker: "SUMMER", text: "Hear what?" },
        { speaker: "EXTRA", text: "This third bubble must be bounded away." },
      ],
      noText: false,
      approvedAt: "2026-09-28T05:20:00.000Z",
    }],
  });

  assert.equal(normalized.graphicNovelTextApprovals?.length, 1);
  assert.equal(normalized.graphicNovelTextApprovals?.[0]?.position, 4);
  assert.equal(normalized.graphicNovelTextApprovals?.[0]?.bubbles.length, 2);
  assert.equal(normalized.graphicNovelTextApprovals?.[0]?.narration, "Ren looks toward the water.");
});

test("#2531 explicit No text approval normalizes to a deliberately empty overlay snapshot", () => {
  const normalized = normalizePrevisProductionState({
    shots: [],
    graphicNovelTextApprovals: [{
      anchorRef: "storyboard-anchor:block:block-01:mini-1",
      position: 7,
      sourceKey: "locked-frame-7-source",
      narration: "This must be cleared.",
      bubbles: [{ speaker: "REN", text: "Also cleared." }],
      noText: true,
      approvedAt: "2026-09-28T05:21:00.000Z",
    }],
  });
  const approval = normalized.graphicNovelTextApprovals?.[0];
  assert.ok(approval);
  assert.equal(approval.noText, true);
  assert.equal(approval.narration, "");
  assert.deepEqual(approval.bubbles, []);
});

test("#2763 replaces manual review with automatic saved presentation snapshots", async () => {
 const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");
 assert.doesNotMatch(workspace, />Review Text<|>Create WebP<|Approve All/u);
 assert.match(workspace, /saveFoundationProject\(next\)/u);
 assert.match(workspace, /latestSource.current !== source/u);
 assert.match(workspace, /graphicNovelTextApprovals/u);
 assert.match(workspace, /passages,/u);
});
