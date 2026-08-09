import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Write is the screenplay workspace tied to all 24 Blocks and 96 mini-blocks", async () => {
  const [page, navigation, workspace] = await Promise.all([
    source("app/page.tsx"),
    source("lib/product-direction.ts"),
    source("app/script-workspace.tsx"),
  ]);
  assert.match(navigation, /id: "script", label: "Write", description: "Outline and write"/);
  assert.match(page, /activeTab === "script"/);
  assert.match(page, /<ScriptWorkspace/);
  for (const phrase of ["24 Blocks · 96 mini-blocks", "allMiniBlocks", "blockNumber", "miniBlockNumber", "Open Block"]) {
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

test("Afterglow loads the complete v9 screenplay as one continuous editable draft", async () => {
  const workspace = await source("app/script-workspace.tsx");
  const completeProject = await source("data/afterglow-complete.ts");
  const screenplay = await source("data/afterglow-screenplay.ts");
  const parts = await Promise.all(Array.from({ length: 8 }, (_, index) => source(`data/afterglow-screenplay/part-${String(index + 1).padStart(2, "0")}.ts`)));
  const fullSource = parts.join("\n");

  assert.match(completeProject, /Afterglow: Reflections of Sentience/);
  assert.match(completeProject, /Complete 24 Blocks demonstration project/);
  assert.match(screenplay, /Afterglow v9 Twitter Rewrite \(2023\) — complete screenplay/);
  assert.match(screenplay, /blocks: 24/);
  assert.match(screenplay, /screenplayPages: 80/);
  assert.match(fullSource, /# PUPPETS AND PUPPETEERS/);
  assert.match(fullSource, /# CODED BONDS/);
  assert.match(fullSource, /> THE END/);
  assert.match(fullSource, /@REN/);
  assert.match(fullSource, /!Ren/);
  assert.match(workspace, /full scrollable draft/);
  assert.match(workspace, /jumpToPosition/);
  assert.match(workspace, /scrollIntoView/);
});

test("AI writing and character images use the private local gateway and require approval", async () => {
  const workspace = await source("app/script-workspace.tsx");
  const character = await source("app/character-image-generator.tsx");
  const gateway = await source("build/local-ai-gateway.ts");
  assert.match(workspace, /\/api\/local-ai\/generate\/text/);
  assert.match(workspace, /Nothing is added to the screenplay until you choose to insert it/);
  assert.match(character, /\/api\/local-ai\/generate\/image/);
  assert.match(character, /Generate \$\{angle\.replace\("-", " "\)\} reference/);
  assert.match(character, /Approve and lock identity/);
  assert.match(gateway, /TEXT_PATH/);
  assert.match(gateway, /IMAGE_PATH/);
  assert.match(gateway, /assetsDirectory/);
  assert.match(gateway, /isLocalRequest/);
});
