import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("LEARN replaces the square logo presentation with the approved transparent mark and pixel-following glow", async () => {
  const styles = await read("app/ui-continuity-anchor.css");
  assert.match(styles, /nav\[aria-label="PlotPickle workflow"\] > img\[alt="PlotPickle"\]/);
  assert.match(styles, /opacity:\s*0/);
  assert.match(styles, /plotpickle-icon-master-transparent\.png/);
  assert.match(styles, /nav\[aria-label="PlotPickle workflow"\]::before/);
  assert.match(styles, /drop-shadow/);
  assert.doesNotMatch(styles, /plotpickle-icon-master-transparent\.png[\s\S]{0,260}background:\s*#[0-9a-f]{3,8}/i);
});

test("the standalone header exposes a lore-style Settings rune in the top-right and highlights Sage setup failures", async () => {
  const [anchor, styles] = await Promise.all([
    read("app/ui-continuity-anchor.tsx"),
    read("app/ui-continuity-anchor.css"),
  ]);
  assert.match(anchor, /function SettingsRuneGlyph/);
  assert.match(anchor, /standalone-settings-ring/);
  assert.match(anchor, /standalone-settings-spokes/);
  assert.match(anchor, /standalone-settings-core/);
  assert.match(anchor, /href="\/\?workspace=settings"/);
  assert.match(anchor, /sageSetupNeeded \? "Setup Sage" : "Settings"/);
  assert.match(anchor, /alertText\.includes\("fast model"\)/);
  assert.doesNotMatch(anchor, /data-hide-agent-settings-anchor/);
  assert.match(styles, /\.standalone-agent-settings-anchor\s*\{[\s\S]*right:\s*12px/);
  assert.match(styles, /left:\s*auto/);
  assert.match(styles, /#c89446|#d9ad5b/i);
  assert.match(styles, /#35c9b8/i);
});

test("workspace=settings is a real Sage settings destination with an explicit return to LEARN", async () => {
  const [page, settings] = await Promise.all([
    read("app/page.tsx"),
    read("app/sage-settings-workspace.tsx"),
  ]);
  assert.match(page, /type Workspace = "learn" \| "plan" \| "settings"/);
  assert.match(page, /requested === "settings"/);
  assert.match(page, /workspace === "settings"/);
  assert.match(page, /<SageSettingsWorkspace \/>/);
  assert.match(settings, /Make Sage ready to answer\./);
  assert.match(settings, /Sage uses PlotPickle&apos;s Fast local model/);
  assert.match(settings, /href="\/\?workspace=learn">Return to LEARN/);
  assert.match(settings, /<SageFastModelSetup \/>/);
  assert.match(settings, /<LocalRuntimePanel \/>/);
});

test("Sage Settings can configure the Fast role without overwriting Quality or Deep managed settings", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");
  assert.match(setup, /\/api\/local-ai\/runtime\/settings/);
  assert.match(setup, /Fast model name override/);
  assert.match(setup, /Manage llama\.cpp for Sage/);
  assert.match(setup, /Fast GGUF model path/);
  assert.match(setup, /Fast GPU layers/);
  assert.match(setup, /\.\.\.status\.settings\.modelOverrides/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama\.modelPaths/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama\.gpuLayers/);
  assert.match(setup, /preferredRuntime: managed \? "llama\.cpp"/);
  assert.match(setup, /Sage is ready\. Return to LEARN and ask your question again\./);
});

test("the Sage recovery UI preserves the local Fast-role architecture and no cloud fallback", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");
  assert.match(guide, /provider: "local"/);
  assert.match(guide, /modelRole: "fast"/);
  assert.match(guide, /No production-ready local model is available/);
  assert.doesNotMatch(guide, /provider: "openai"|provider: "minimax"/);
});
