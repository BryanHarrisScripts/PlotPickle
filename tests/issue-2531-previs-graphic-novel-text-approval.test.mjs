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

test("#2531 Review Text makes missing speech bubbles visible and supports edit/add/remove/No text/approval", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);

  for (const phrase of [
    "Review Text",
    "Approve Text",
    "Approve All",
    "No speech bubble proposed.",
    "Add Speech Bubble",
    "Remove Bubble",
    "No text — intentionally export this locked panel without narration or bubbles",
    "Stale approval",
  ]) assert.ok(workspace.includes(phrase), `Missing Graphic Novel text review control: ${phrase}`);

  assert.match(workspace, /graphicNovelTextDrafts/u);
  assert.match(workspace, /graphicNovelTextApprovals/u);
  assert.match(workspace, /saveFoundationProject\(next\)/u);
  assert.match(css, /\.graphicNovelTextReview/u);
  assert.match(css, /\.graphicNovelTextGrid/u);
  assert.match(css, /\.graphicNovelBubbleEditor/u);
});

test("#2531 Create WebP is gated until every locked panel has a current source-key approval", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(workspace, /function graphicNovelTextSourceKey/u);
  assert.match(workspace, /approval\.sourceKey === graphicNovelTextSourceKey\(panel\)/u);
  assert.match(workspace, /pendingTextApprovalCount/u);
  assert.match(workspace, /graphicNovelTextReady = lockedGraphicNovelPanels\.length > 0 && pendingTextApprovalCount === 0/u);
  assert.match(workspace, /disabled=\{!graphicNovelTextReady \|\| graphicNovelExporting\}/u);
  assert.match(workspace, />Create WebP<\/button>/u);
  assert.match(workspace, /Review and approve Graphic Novel text before creating the WebP\./u);
});

test("#2531 WebP creation consumes approved snapshots rather than freshly derived dialogue", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");
  const exportStart = workspace.indexOf("async function exportGraphicNovel");
  const exportEnd = workspace.indexOf("\n  function commit(", exportStart);
  assert.ok(exportStart >= 0 && exportEnd > exportStart);
  const exporter = workspace.slice(exportStart, exportEnd);

  assert.match(exporter, /currentTextApprovalFor\(panel\)/u);
  assert.match(exporter, /approvedGraphicNovelPanel\(panel, approval\)/u);
  assert.match(exporter, /exportPanels\.length !== sourcePanels\.length/u);
  assert.match(exporter, /buildBrowserGraphicNovelWebp/u);
  assert.doesNotMatch(exporter, /graphicNovelSpeechBubbles|\/api\/writing-assistant|OpenAI|Ollama/u);
  assert.match(workspace, /exact approved Graphic Novel text snapshot/u);
  assert.match(workspace, /story canon and Storyboard approval were unchanged/u);
});

test("#2531 live Graphic Novel preview distinguishes proposed text from current approved text", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(workspace, /selectedGraphicNovelApproval/u);
  assert.match(workspace, /selectedGraphicNovelDisplayPanel/u);
  assert.match(workspace, /Approved Graphic Novel text · presentation only/u);
  assert.match(workspace, /Proposed Graphic Novel text · review before Create WebP/u);
  assert.match(workspace, /if \(!panel\.caption && !panel\.narration && !panel\.shotLabel && !panel\.shotContext && !panel\.bubbles\.length\) return/u);
});
