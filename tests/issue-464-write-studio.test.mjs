import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#464 Write wireframe follows the #444 same-story drafting contract", async () => {
  const wireframe = await source("docs/wireframes/issue-464-write-studio.md");

  for (const contract of [
    "Write is the screenplay-creation workspace",
    "4 Acts",
    "24 Blocks",
    "96 mini-blocks",
    "same canonical story moment",
    "screenplay editor is the primary",
    "Plan / Storyboard → Write contract",
    "Write → Edit boundary",
    "provider/model/endpoint language",
  ]) assert.ok(wireframe.toLowerCase().includes(contract.toLowerCase()), `Missing Write wireframe contract: ${contract}`);

  assert.match(wireframe, /Review against #444/);
  assert.match(wireframe, /Implementation gate/);
});

test("#464 gives Write a full-width matte-black Studio boundary without changing screenplay state", async () => {
  const [layout, styles, polish] = await Promise.all([
    source("app/layout.tsx"),
    source("app/write-studio-phase-e.css"),
    source("app/write-studio-polish.css"),
  ]);

  assert.match(layout, /write-studio-phase-e\.css/);
  assert.match(layout, /write-studio-polish\.css/);
  assert.match(styles, /\.workspace:has\(nav\[aria-label="Screenplay blocks"\]\)/);
  assert.match(polish, /data-write-studio="true"/);
  assert.match(polish, /section\[aria-label\$="capabilities"\]/);
  assert.match(polish, /feedback records/);
  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /scriptPaper/);
  assert.match(styles, /writerLayout/);
  assert.match(styles, /blockRail/);
});

test("#464 preserves the canonical Write Block mini-block and scene machinery", async () => {
  const writer = await source("app/script-workspace.tsx");

  assert.match(writer, /initialBlockNumber/);
  assert.match(writer, /initialSceneId/);
  assert.match(writer, /buildGlobalSceneIndex\(project\.blocks\)/);
  assert.match(writer, /blockNumber/);
  assert.match(writer, /miniBlockNumber/);
  assert.match(writer, /currentSceneEntry/);
  assert.match(writer, /assignDraftElementToScene/);
  assert.match(writer, /onChange\(reconcileProductionDraft/);
});

test("#464 normal Write entry defaults to Screenplay once without preventing deliberate Treatment selection", async () => {
  const [layout, host] = await Promise.all([
    source("app/layout.tsx"),
    source("app/write-studio-host.tsx"),
  ]);

  assert.match(layout, /import WriteStudioHost/);
  assert.match(layout, /<WriteStudioHost \/>/);
  assert.match(host, /let defaultApplied = false/);
  assert.match(host, /defaultApplied = true/);
  assert.match(host, /normalized\(button\.textContent\) === "screenplay"/);
  assert.match(host, /screenplay\.click\(\)/);
  assert.match(host, /useEffect\(\(\) => \{[\s\S]*\}, \[\]\)/);
  assert.doesNotMatch(host, /setProject|onProjectChange|localStorage|sessionStorage|approvedImageVersionId/i);
});

test("#464 keeps screenplay creation capability while moving export and production controls behind More", async () => {
  const [writer, host, polish] = await Promise.all([
    source("app/script-workspace.tsx"),
    source("app/write-studio-host.tsx"),
    source("app/write-studio-polish.css"),
  ]);

  for (const capability of [
    "Treatment",
    "Screenplay",
    "Export Fountain",
    "Export Final Draft",
    "Print / PDF",
    "ProductionDraftPanel",
    "Add screenplay element",
    "Editable screenplay",
  ]) assert.ok(writer.includes(capability), `Missing preserved Write capability: ${capability}`);

  assert.match(host, /More writing tools/);
  assert.match(host, /Exports and production-draft controls remain available here/);
  assert.match(polish, /exportActions/);
  assert.match(polish, /productionDraftPanel/);
  assert.match(polish, /data-write-more="open"/);
  assert.match(polish, /display:\s*none\s*!important/);
});

test("#464 normal Write presentation stays provider-neutral", async () => {
  const [styles, host] = await Promise.all([
    source("app/write-studio-phase-e.css"),
    source("app/write-studio-host.tsx"),
  ]);
  assert.doesNotMatch(styles, /Ollama|ComfyUI|MiniMax|OpenAI|checkpoint|endpoint|apiKey/i);
  assert.doesNotMatch(host, /Ollama|ComfyUI|MiniMax|OpenAI|checkpoint|endpoint|apiKey/i);
});
