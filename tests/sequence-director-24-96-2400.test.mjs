import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const contractPath = "core/contracts/sequence-director/index.ts";
const compilerPath = "lib/sequence-director.ts";
const skillPath = ".agents/skills/sequence-director/SKILL.md";
const architecturePath = "docs/architecture/sequence-director-24-96-2400.md";
const registryPath = "config/ai-source-registry.json";

test("Sequence Director reuses the canonical 24/96/2400 render grid instead of inventing a second production model", async () => {
  const [contract, compiler, architecture] = await Promise.all([
    read(contractPath),
    read(compilerPath),
    read(architecturePath),
  ]);

  assert.match(contract, /RENDER_CLIP_SECONDS/);
  assert.match(contract, /RENDER_CLIPS_PER_MINI_BLOCK/);
  assert.match(contract, /RENDER_MINI_BLOCK_SECONDS/);
  assert.match(contract, /renderClipSlotsForAnchor/);
  assert.match(contract, /storyboard-anchor:block:block-/);
  assert.match(compiler, /sequenceDirectorRenderSlots/);
  assert.match(compiler, /25 fixed 3-second render clips/);
  assert.match(architecture, /25 clips per Mini-Block/);
  assert.match(architecture, /2,400 clips per feature/);
  assert.match(architecture, /creative Storyboard\/Previs shot is not a technical render clip/i);
  assert.doesNotMatch(`${contract}\n${compiler}`, /Array\.from\(\{ length: 2400|renderClips:\s*\[/);
});

test("Sequence Director is one provider-neutral procedure shared by PLAN STORYBOARD and PREVIS", async () => {
  const [contract, compiler, skill, architecture] = await Promise.all([
    read(contractPath),
    read(compilerPath),
    read(skillPath),
    read(architecturePath),
  ]);

  assert.match(contract, /"plan" \| "storyboard" \| "previs"/);
  assert.match(compiler, /compileSequenceDirectorBrief/);
  assert.match(compiler, /surface === "plan"/);
  assert.match(compiler, /surface === "storyboard"/);
  assert.match(compiler, /surface === "previs"/);
  assert.match(skill, /## PLAN procedure/);
  assert.match(skill, /## STORYBOARD procedure/);
  assert.match(skill, /## PREVIS procedure/);
  assert.match(architecture, /PLAN → STORYBOARD → PREVIS → RENDER PLAN → GENERATE/);

  assert.doesNotMatch(`${contract}\n${compiler}`, /GPT-Image|gpt-image|MiniMax H3|LTX-Video|Wan 2\.1/i);
  assert.doesNotMatch(`${contract}\n${compiler}`, /api\.openai\.com|api\.minimax|huggingface\.co/i);
  assert.doesNotMatch(`${contract}\n${compiler}`, /16 numbered shots|16 shots|4x4|GIF/i);
});

test("Render prompts adapt reference-first continuity into deterministic 3-second local changes", async () => {
  const compiler = await read(compilerPath);

  for (const section of [
    "=== REFERENCE MAP ===",
    "=== WHAT STAYS ===",
    "=== START STATE ===",
    "=== WHAT CHANGES IN THIS CLIP ===",
    "=== END STATE ===",
    "=== MOTION FLOW ===",
    "=== HARD RULES ===",
  ]) assert.ok(compiler.includes(section), `${section} must remain in the render prompt grammar`);

  assert.match(compiler, /Continue exactly from the approved previous boundary keyframe/);
  assert.match(compiler, /End on a stable boundary that can seed the next 3-second clip/);
  assert.match(compiler, /Do not add unrequested characters, props, text, logos, cuts, camera moves or continuity changes/);
});

test("The current Pascal local VIDEO default remains LTX through the plug-in registry, not through Sequence Director", async () => {
  const registry = JSON.parse(await read(registryPath));
  const ltx = registry.plugins.find((plugin) => plugin.id === "video.ltx-video-2b-0.9.8-distilled");
  const h3 = registry.plugins.find((plugin) => plugin.id === "video.minimax-h3");

  assert.ok(ltx, "LTX local video plug-in must stay registered");
  assert.equal(ltx.label, "LTX-Video 2B 0.9.8 Distilled");
  assert.equal(ltx.adapterId, "comfyui-ltx-local");
  assert.equal(ltx.hardwarePriority["nvidia-pascal-8gb-32gb"], 10);
  assert.ok(ltx.modes.includes("text-to-video"));
  assert.ok(h3, "H3 advanced plug-in must remain registered separately");
  assert.equal(h3.hardwarePriority["nvidia-pascal-8gb-32gb"], undefined);
});

test("Sequence Director documentation contains no embedded project-specific sample content", async () => {
  const [skill, architecture] = await Promise.all([read(skillPath), read(architecturePath)]);
  assert.doesNotMatch(`${skill}\n${architecture}`, /The Last Dish|CHEF|GUEST|takeaway box|cooking sequence/i);
  assert.match(skill, /does not require any one image or video model/i);
  assert.match(architecture, /process grammar, not any particular example, provider, model or finished sequence/i);
});
