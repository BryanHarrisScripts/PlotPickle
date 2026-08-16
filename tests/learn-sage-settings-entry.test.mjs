import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("LEARN and PLAN use the supplied transparent PlotPickle dragon ouroboros identity without a backglow", async () => {
  const [anchorStyles, polish] = await Promise.all([
    read("app/ui-continuity-anchor.css"),
    read("app/learn-foundations-polish.css"),
  ]);
  for (const styles of [anchorStyles, polish]) {
    assert.match(styles, /plotpickle-ouroboros-v3-transparent\.png/);
    assert.doesNotMatch(styles, /plotpickle-ouroboros-v2\.png/);
    assert.doesNotMatch(styles, /plotpickle-icon-master-transparent\.png/);
    assert.match(styles, /background:\s*transparent/);
    assert.match(styles, /saturate\(1\.(?:3|34)/);
    assert.match(styles, /brightness\(1\.2/);
  }
  const shellBrand = anchorStyles.match(/\.application-shell-header \.shell-brand::before\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const shellBrandHover = anchorStyles.match(/\.application-shell-header \.shell-brand:hover::before\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const workflowBrand = anchorStyles.match(/nav\[aria-label="PlotPickle workflow"\]::before\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(shellBrand && shellBrandHover && workflowBrand);
  assert.doesNotMatch(`${shellBrand}\n${shellBrandHover}\n${workflowBrand}\n${polish}`, /drop-shadow/);
  assert.match(anchorStyles, /Shared shell brand: render the supplied transparent dragon ouroboros\/compass\/nib artwork/);
  assert.match(anchorStyles, /\.application-shell-header \.shell-brand::before/);
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

test("workspace=settings opens a beginner-first Quick Setup inside the shared root navigator", async () => {
  const [page, shell, settings, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/sage-settings-workspace.tsx"),
    read("app/sage-settings-workspace.module.css"),
  ]);
  assert.match(page, /type Workspace = RootWorkspace/);
  assert.match(shell, /RootWorkspace = "learn" \| "plan" \| "wyrmwood" \| "settings"/);
  assert.match(page, /requested === "settings"/);
  assert.match(page, /workspace === "settings"/);
  assert.match(page, /<PlotPickleWorkspaceShell activeWorkspace="settings"/);
  assert.match(page, /<SageSettingsWorkspace \/>/);
  assert.match(shell, /label: "SETTINGS", detail: "Config", selectable: true/);
  assert.match(settings, /Settings · Quick Setup/);
  assert.match(settings, /Set up Sage and PLAN\./);
  assert.match(settings, /Step 1:<\/strong> Choose how you want PlotPickle to talk to local AI/);
  assert.match(settings, /Step 2:<\/strong> Pick the model PlotPickle found/);
  assert.match(settings, /Step 3:<\/strong> Test Sage/);
  assert.match(settings, /Step 4:<\/strong> Test PLAN/);
  assert.match(settings, /href="\/\?workspace=learn">Return to LEARN/);
  assert.match(settings, /href="\/\?workspace=plan">Return to PLAN/);
  assert.match(settings, /<SageFastModelSetup \/>/);
  assert.match(settings, /<details className=\{styles\.advancedRuntime\}>[\s\S]*<LocalRuntimePanel \/>[\s\S]*<\/details>/);
  assert.doesNotMatch(settings, /<details className=\{styles\.advancedRuntime\}\s+open/);
  assert.match(styles, /\.advancedRuntime/);
});

test("Quick Setup surfaces detected runtimes and models while managed llama.cpp stays collapsed", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");
  assert.match(setup, /Use my running local AI/);
  assert.match(setup, /activeRuntime\.models/);
  assert.match(setup, /Running local AI/);
  assert.match(setup, /aria-label="Sage Fast model"/);
  assert.match(setup, /aria-label="PLAN Quality model"/);
  assert.match(setup, /Use this model for Sage and PLAN/);
  assert.match(setup, /Set up Sage and PLAN/);
  assert.match(setup, />Test Sage<\/button>/);
  assert.match(setup, />Test PLAN<\/button>/);
  assert.match(setup, />Runtime found<\/span>/);
  assert.match(setup, />Sage ready<\/span>/);
  assert.match(setup, />PLAN ready<\/span>/);
  assert.match(setup, /<details className=\{styles\.advancedSetup\}>/);
  assert.doesNotMatch(setup, /<details className=\{styles\.advancedSetup\}\s+open/);
  assert.match(setup, /Use PlotPickle-managed llama\.cpp/);
  assert.match(setup, /Sage Fast GGUF model path/);
  assert.match(setup, /PLAN Quality GGUF model path/);
  assert.match(setup, /Fast GPU layers/);
  assert.match(setup, /Quality GPU layers/);
  assert.match(setup, /managedPathsExist/);
  assert.match(setup, /body\.activeRuntime\.kind !== "llama\.cpp"/);
});

test("one detected model can be assigned to Sage and PLAN with one click and setup auto-uses it", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");
  assert.match(setup, /function useOnlyDetectedModelForBoth/);
  assert.match(setup, /setFastOverride\(model\)/);
  assert.match(setup, /setQualityOverride\(model\)/);
  assert.match(setup, /reportedModels\.length === 1/);
  assert.match(setup, /const onlyDetectedModel = !managed && reportedModels\.length === 1 \? reportedModels\[0\] : ""/);
  assert.match(setup, /const selectedFast = fastOverride\.trim\(\) \|\| onlyDetectedModel/);
  assert.match(setup, /const selectedQuality = qualityOverride\.trim\(\) \|\| onlyDetectedModel/);
});

test("role testing saves the selected runtime/model IDs before testing and does not force managed llama.cpp", async () => {
  const [setup, gateway] = await Promise.all([
    read("app/sage-fast-model-setup.tsx"),
    read("build/local-runtime-gateway.ts"),
  ]);
  assert.match(setup, /async function persistSetup/);
  assert.match(setup, /await persistSetup\(\);[\s\S]*\/api\/local-ai\/runtime\/model\/\$\{role\}\/load/);
  assert.match(setup, /preferredRuntime: managed \? "llama\.cpp" : preferredRuntime/);
  assert.match(gateway, /configuredManagedPath/);
  assert.match(gateway, /const shouldStartManaged = settings\.managedLlama\.enabled/);
  assert.match(gateway, /Boolean\(configuredManagedPath\)/);
  assert.match(gateway, /shouldStartManaged \? await startManagedLlama\(roleToLoad\) : false/);
  assert.match(gateway, /availableModels: snapshot\.activeRuntime\.models/);
  assert.match(gateway, /Choose one of the detected models in Settings/);
});

test("Quick Setup replaces technical failures with beginner-friendly guidance", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");
  assert.match(setup, /function friendlySetupError/);
  assert.match(setup, /PlotPickle could not find a ready local AI yet/);
  assert.match(setup, /PlotPickle found \$\{runtime\.label\}, but no matching story model is selected yet/);
  assert.match(setup, /Choose one detected model below and try again/);
});

test("runtime model matching tolerates Ollama-style punctuation and friendly catalog labels", async () => {
  const manager = await read("build/local-runtime-manager.ts");
  assert.match(manager, /function modelKey/);
  assert.match(manager, /replace\(\/\[\^a-z0-9\]\+\/g, ""\)/);
  assert.match(manager, /friendlyCatalogName/);
  assert.match(manager, /catalog\.expectedNameFragments\.some/);
  assert.match(manager, /modelKey\(model\)\.includes\(modelKey\(fragment\)\)/);
});

test("managed and detected-runtime setup preserve Fast and Quality without overwriting Deep settings", async () => {
  const setup = await read("app/sage-fast-model-setup.tsx");
  assert.match(setup, /\/api\/local-ai\/runtime\/settings/);
  assert.match(setup, /\.\.\.status\.settings\.modelOverrides/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama\.modelPaths/);
  assert.match(setup, /\.\.\.status\.settings\.managedLlama\.gpuLayers/);
  assert.match(setup, /modelOverrides:[\s\S]*fast:[\s\S]*quality:/);
  assert.match(setup, /modelPaths:[\s\S]*fast:[\s\S]*quality:/);
  assert.match(setup, /gpuLayers:[\s\S]*fast:[\s\S]*quality:/);
  assert.match(setup, /aria-label="Test Sage Fast"/);
  assert.match(setup, /aria-label="Test PLAN Quality"/);
});

test("local role preparation is used before Sage and PLAN preflights", async () => {
  const [gateway, guide, drafter] = await Promise.all([
    read("build/local-runtime-gateway.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);
  assert.match(gateway, /ROLE_LOAD_PREFIX/);
  assert.match(gateway, /roleStatus = snapshot\.roles\[roleToLoad\]/);
  assert.match(guide, /\/api\/local-ai\/runtime\/model\/fast\/load/);
  assert.ok(guide.indexOf("/api/local-ai/runtime/model/fast/load") < guide.indexOf("/api/writing-assistant/status"));
  assert.match(drafter, /\/api\/local-ai\/runtime\/model\/quality\/load/);
  assert.ok(drafter.indexOf("/api/local-ai/runtime/model/quality/load") < drafter.indexOf("/api/writing-assistant/status"));
});

test("Sage sanitizes prompt scaffolding before chat rendering and is instructed to converse like a mentor", async () => {
  const [guide, runtime] = await Promise.all([
    read("modules/creative-room/curriculum-guide.ts"),
    read("build/mastra-agent-runtime.ts"),
  ]);
  const normalizedGuide = guide.replace(/\r\n/g, "\n");
  assert.match(guide, /export function stripInternalScaffolding/);
  assert.match(guide, /&lt;/);
  assert.match(guide, /\\\\u003c/);
  assert.match(guide, /student_question\|conversation_memory\|project_memory\|curriculum_context/);
  assert.match(guide, /INTERNAL_SCAFFOLD_LINE/);
  assert.match(guide, /let text = cleanGuideAnswer\(result\.text\)/);
  assert.ok(normalizedGuide.indexOf("cleanGuideAnswer(result.text)") < normalizedGuide.indexOf("return {\n    text,"));
  assert.match(runtime, /Speak like a live mentor, not a prompt template or formatter/);
  assert.match(runtime, /answer it and then offer one useful choice for where to go next/);
  assert.match(runtime, /offer two or three likely help paths and ask which one fits/);
  assert.match(runtime, /Never output audits, unrelated lesson lists, raw retrieval, XML-like wrappers, escaped prompt tags/);
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
