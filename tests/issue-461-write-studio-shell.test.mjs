import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#461 Write and Edit wireframe satisfies the Studio continuity contract before implementation", async () => {
  const wireframe = await source("docs/wireframes/issue-461-write-edit-studio.md");

  for (const contract of [
    "Write and Edit are two creative lenses over one canonical screenplay",
    "4 Acts",
    "24 Blocks",
    "96 mini-blocks",
    "Write → Edit → Write continuity",
    "same canonical screenplay elements",
    "No copy or shadow draft is created",
    "Scene",
    "Dialogue",
    "Action",
    "Pacing",
    "Continuity",
    "Accept change",
    "Rewrite myself",
    "Ignore",
    "Compare",
  ]) assert.ok(wireframe.includes(contract), `Missing Write/Edit wireframe contract: ${contract}`);

  assert.match(wireframe, /Review against #444/);
  assert.match(wireframe, /Implementation gate/);
});

test("#461 activates the Write Studio boundary only for the Write workspace", async () => {
  const host = await source("app/write-studio-host.tsx");

  assert.match(host, /params\.get\("workspace"\) !== "write"/);
  assert.match(host, /querySelector<HTMLElement>\("\.workspace"\)/);
  assert.match(host, /workspace\.dataset\.writeStudio = "true"/);
  assert.match(host, /delete activeWorkspace\.dataset\.writeStudio/);
  assert.match(host, /MutationObserver/);
  assert.doesNotMatch(host, /setProject|onChange|localStorage|sessionStorage|fetch\(|provider|apiKey/i);
});

test("#461 gives the existing Writer a matte-black warm-gold Studio shell", async () => {
  const styles = await source("app/write-studio-phase-c.css");

  assert.match(styles, /\.workspace\[data-write-studio="true"\]/);
  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Georgia/);
  assert.match(styles, /nav button/);
  assert.match(styles, /activeMini/);
  assert.match(styles, /scriptPaper/);
  assert.match(styles, /assistantPanel/);
  assert.match(styles, /section\[aria-label\$="capabilities"\]/);
  assert.match(styles, /feedback records/);
});

test("#461 Treatment and craft diagnostics stay inside the same dark Writer system", async () => {
  const styles = await source("app/write-studio-treatment.css");

  assert.match(styles, /workspaceShell/);
  assert.match(styles, /> \[class\*="page"\]/);
  assert.match(styles, /editorCard/);
  assert.match(styles, /previewContent/);
  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Diagnostic craft summary/);
  assert.match(styles, /summaryCounts/);
  assert.match(styles, /finding/);
  assert.doesNotMatch(styles, /treatment-editor/);
});

test("#461 preserves the canonical Writer capabilities beneath the new shell", async () => {
  const writer = await source("app/script-workspace.tsx");

  assert.match(writer, /TreatmentEditor/);
  assert.match(writer, /24 Blocks · 96 mini-blocks/);
  assert.match(writer, /nav aria-label="Screenplay blocks"/);
  assert.match(writer, /Export Fountain/);
  assert.match(writer, /Export Final Draft/);
  assert.match(writer, /Print \/ PDF/);
  assert.match(writer, /ProductionDraftPanel/);
  assert.match(writer, /CraftDiagnosticSummary/);
  assert.match(writer, /assignDraftElementToScene/);
});

test("#461 keeps provider mechanics outside the normal Writer shell", async () => {
  const styles = await source("app/write-studio-phase-c.css");
  const treatment = await source("app/write-studio-treatment.css");
  const host = await source("app/write-studio-host.tsx");

  assert.doesNotMatch(styles, /Ollama|ComfyUI|MiniMax|endpoint|checkpoint|apiKey/i);
  assert.doesNotMatch(treatment, /Ollama|ComfyUI|MiniMax|endpoint|checkpoint|apiKey/i);
  assert.doesNotMatch(host, /Ollama|ComfyUI|MiniMax|endpoint|checkpoint|apiKey/i);
});

test("#461 mounts the Write Studio host and styles globally without replacing ScriptWorkspace", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /import WriteStudioHost/);
  assert.match(layout, /<WriteStudioHost \/>/);
  assert.match(layout, /write-studio-phase-c\.css/);
  assert.match(layout, /write-studio-treatment\.css/);
  assert.match(layout, /StoryboardWriteHandoff/);
});
