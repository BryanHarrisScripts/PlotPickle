import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("LEARN and PLAN use the current V2 PlotPickle identity with transparent presentation and glow", async () => {
  const [anchorStyles, polish] = await Promise.all([
    read("app/ui-continuity-anchor.css"),
    read("app/learn-foundations-polish.css"),
  ]);
  for (const styles of [anchorStyles, polish]) {
    assert.match(styles, /plotpickle-ouroboros-v2\.png/);
    assert.doesNotMatch(styles, /plotpickle-icon-master-transparent\.png/);
    assert.match(styles, /background:\s*transparent/);
    assert.match(styles, /drop-shadow/);
  }
});

test("the standalone header exposes a dedicated lore-style Settings SVG and uses a hard navigation boundary", async () => {
  const [anchor, styles, relic] = await Promise.all([
    read("app/ui-continuity-anchor.tsx"),
    read("app/ui-continuity-anchor.css"),
    read("public/assets/workflow-relics/settings.svg"),
  ]);
  assert.match(anchor, /function SettingsRelic/);
  assert.match(anchor, /\/assets\/workflow-relics\/settings\.svg/);
  assert.match(anchor, /<a[\s\S]*href="\/\?workspace=settings"/);
  assert.doesNotMatch(anchor, /next\/link|<Link/);
  assert.match(anchor, /sageSetupNeeded \? "Setup AI" : "Settings"/);
  assert.match(anchor, /alertText\.includes\("quality local model"\)/);
  assert.match(styles, /\.standalone-settings-relic/);
  assert.match(styles, /right:\s*12px/);
  assert.match(styles, /left:\s*auto/);
  assert.match(relic, /<svg/);
  assert.match(relic, /radialGradient id="gem"/);
  assert.match(relic, /linearGradient id="gold"/);
  assert.doesNotMatch(relic, /<rect[^>]+(?:fill="#000|fill="black)/i);
});

test("workspace=settings is a real local AI destination with explicit LEARN and PLAN returns", async () => {
  const [page, settings] = await Promise.all([
    read("app/page.tsx"),
    read("app/sage-settings-workspace.tsx"),
  ]);
  assert.match(page, /type Workspace = "learn" \| "plan" \| "settings"/);
  assert.match(page, /requested === "settings"/);
  assert.match(page, /workspace === "settings"/);
  assert.match(page, /<SageSettingsWorkspace \/>/);
  assert.match(settings, /Make Sage and PLAN ready\./);
  assert.match(settings, /Sage uses PlotPickle&apos;s Fast local role/);
  assert.match(settings, /PLAN draft proposals use the Quality local role/);
  assert.match(settings, /href="\/\?workspace=learn">Return to LEARN/);
  assert.match(settings, /href="\/\?workspace=plan">Return to PLAN/);
  assert.match(settings, /<SageFastModelSetup \/>/);
  assert.match(settings, /<LocalRuntimePanel \/>/);
});

test("Settings configures both Sage Fast and PLAN Quality roles without overwriting Deep settings", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");
  assert.match(setup, /\/api\/local-ai\/runtime\/settings/);
  assert.match(setup, /Sage Fast model name override/);
  assert.match(setup, /PLAN Quality model name override/);
  assert.match(setup, /Let PlotPickle manage llama\.cpp role switching/);
  assert.match(setup, /Sage Fast GGUF model path/);
  assert.match(setup, /PLAN Quality GGUF model path/);
  assert.match(setup, /Fast GPU layers/);
  assert.match(setup, /Quality GPU layers/);
  assert.match(setup, /\.\.\.status\.settings\.modelOverrides/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama\.modelPaths/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama\.gpuLayers/);
  assert.match(setup, /modelOverrides:[\s\S]*fast:[\s\S]*quality:/);
  assert.match(setup, /modelPaths:[\s\S]*fast:[\s\S]*quality:/);
  assert.match(setup, /gpuLayers:[\s\S]*fast:[\s\S]*quality:/);
  assert.match(setup, /Load\/test Sage Fast/);
  assert.match(setup, /Load\/test PLAN Quality/);
});

test("managed local role preparation is exposed and used before Sage and PLAN preflights", async () => {
  const [gateway, guide, drafter] = await Promise.all([
    read("build/local-runtime-gateway.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);
  assert.match(gateway, /ROLE_LOAD_PREFIX/);
  assert.match(gateway, /startManagedLlama\(roleToLoad\)/);
  assert.match(gateway, /roleStatus: snapshot\.roles\[roleToLoad\]/);
  assert.match(guide, /\/api\/local-ai\/runtime\/model\/fast\/load/);
  assert.ok(guide.indexOf("/api/local-ai/runtime/model/fast/load") < guide.indexOf("/api/writing-assistant/status"));
  assert.match(drafter, /\/api\/local-ai\/runtime\/model\/quality\/load/);
  assert.ok(drafter.indexOf("/api/local-ai/runtime/model/quality/load") < drafter.indexOf("/api/writing-assistant/status"));
});

test("the recovery path preserves local-only role routing with no cloud fallback", async () => {
  const [guide, drafter] = await Promise.all([
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);
  assert.match(guide, /provider: "local"/);
  assert.match(guide, /modelRole: "fast"/);
  assert.match(drafter, /provider: "local"/);
  assert.match(drafter, /modelRole: "quality"/);
  assert.doesNotMatch(`${guide}\n${drafter}`, /provider: "openai"|provider: "minimax"/);
});
