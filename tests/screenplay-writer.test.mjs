import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Screenplay is a write and read workspace tied to all 24 Blocks and 96 mini-blocks", async () => {
  const page = await source("app/page.tsx");
  const workspace = await source("app/script-workspace.tsx");
  assert.match(page, /label: "Screenplay", description: "Outline & write"/);
  assert.match(page, /<ScriptWorkspace/);
  for (const phrase of ["24 Blocks · 96 mini-blocks", "allMiniBlocks", "blockNumber", "miniBlockNumber", "Open Block"] ) {
    assert.ok(workspace.includes(phrase), `Screenplay workspace is missing ${phrase}`);
  }
  assert.ok(!workspace.includes("Read & learn"), "Learning belongs in the primary navigation, not the Screenplay workspace");
});

test("writer supports standard screenplay grammar and Final Draft/Fountain handoff", async () => {
  const workspace = await source("app/script-workspace.tsx");
  const draft = await source("lib/screenplay-draft.ts");
  for (const type of ["scene-heading", "action", "character", "parenthetical", "dialogue", "transition"]) {
    assert.ok(workspace.includes(type), `Writer is missing ${type}`);
  }
  assert.match(draft, /screenplayToFountain/);
  assert.match(draft, /screenplayToFinalDraft/);
  assert.match(draft, /<FinalDraft DocumentType="Script"/);
  assert.match(workspace, /Print \/ PDF/);
});

test("Afterglow loads its v10 screenplay as one continuous editable draft", async () => {
  const workspace = await source("app/script-workspace.tsx");
  const afterglow = await source("data/afterglow.ts");
  const screenplay = await source("data/afterglow-screenplay.ts");
  assert.match(afterglow, /screenplay: createAfterglowScreenplay\(importedAt\)/);
  assert.equal((screenplay.match(/"type":/g) ?? []).length, 368);
  assert.match(screenplay, /"blockNumber": 1/);
  assert.match(screenplay, /"blockNumber": 8/);
  assert.match(screenplay, /"type": "dialogue"/);
  assert.match(screenplay, /"type": "action"/);
  assert.match(workspace, /full scrollable draft/);
  assert.match(workspace, /jumpToPosition/);
  assert.match(workspace, /scrollIntoView/);
});

test("AI writing and character images use the private local gateway and require approval", async () => {
  const workspace = await source("app/script-workspace.tsx");
  const character = await source("app/character-image-generator.tsx");
  const gateway = await source("build/local-ai-gateway.ts");
  assert.match(workspace, /\/api\/local-ai\/generate\/text/);
  assert.match(workspace, /Nothing is inserted until you approve it/);
  assert.match(character, /\/api\/local-ai\/generate\/image/);
  assert.match(character, /Generate character image/);
  assert.match(gateway, /TEXT_PATH/);
  assert.match(gateway, /IMAGE_PATH/);
  assert.match(gateway, /assetsDirectory/);
  assert.match(gateway, /isLocalRequest/);
});
