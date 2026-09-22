import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const json = async (file) => JSON.parse(await read(file));

test("#2357 renders one ordered three-step DSDD process and removes Clear Draft", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  const interpret = panel.indexOf("<small>01</small>");
  const piDraft = panel.indexOf("<small>02</small>");
  const publish = panel.indexOf("<small>03</small>");
  assert.ok(interpret >= 0 && piDraft > interpret && publish > piDraft, "expected 01 Interpret -> 02 Pi Draft -> 03 Publish Brief source order");
  assert.match(panel, /DSDD three-step development handoff/u);
  assert.match(panel, /1 Interpret your intent\. 2 Pi prepares the technical developer draft\. 3 Publish the approved brief\./u);
  assert.doesNotMatch(panel, /Clear draft|function clearDraft/u);
});

test("#2357 step gating exposes active complete locked states and stops after a no-action interpretation", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  assert.match(panel, /const interpretStep = working \? "active" : hasInterpretation \? "complete"/u);
  assert.match(panel, /const piDraftStep = piDrafting \? "active" : piDraftReady \? "complete"/u);
  assert.match(panel, /const publishStep = publishing \? "active" : briefPublished \? "complete"/u);
  assert.match(panel, /data-step-state=\{interpretStep\}/u);
  assert.match(panel, /data-step-state=\{piDraftStep\}/u);
  assert.match(panel, /data-step-state=\{publishStep\}/u);
  assert.match(panel, /disabled=\{busy \|\| noActionRequired \|\| piDraftReady \|\| !hasInterpretation\}/u);
  assert.match(panel, /disabled=\{busy \|\| noActionRequired \|\| !piDraftReady \|\| briefPublished\}/u);
  assert.match(panel, /Steps 02 and 03 are not needed for this UAT observation/u);
});

test("#2357 asks for a concise canonical no-action interpretation", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  assert.match(panel, /under 1200 characters/u);
  assert.match(panel, /at most five short bullets/u);
  assert.match(panel, /Understood\. This is not a problem and no development action is required\. I’ll retain it as a UAT observation\./u);
  assert.match(panel, /Do not invite Pi Draft when no development action is required/u);
  assert.match(panel, /MAX_INTERPRETATION_CHARS = 6000/u);
});

test("#2357 DSDD intent generation is bounded to 384 output tokens and compacts repeated text", async () => {
  const [gateway, provider] = await Promise.all([
    read("build/writing-assistant-gateway.ts"),
    read("build/writing-assistant-provider.ts"),
  ]);
  assert.match(gateway, /DSDD_INTENT_MAX_OUTPUT_TOKENS = 384/u);
  assert.match(gateway, /DSDD_INTENT_MAX_CHARS = 3500/u);
  assert.match(gateway, /x-plotpickle-dsdd-scope/u);
  assert.match(gateway, /compactDsddIntentText\(generated\)/u);
  assert.match(gateway, /seen\.has\(key\)/u);
  assert.match(gateway, /repeated >= 2/u);
  assert.match(provider, /maxOutputTokens\?: number/u);
  assert.match(provider, /max_tokens: maxOutputTokens/u);
  assert.match(provider, /max_output_tokens: maxOutputTokens/u);
});

test("#2357 health-check bootstrap model cannot satisfy Fast Quality or Deep production text roles", async () => {
  const [manager, catalog] = await Promise.all([
    read("build/local-runtime-manager.ts"),
    read("lib/runtime/ai/local-runtime.ts"),
  ]);
  assert.match(catalog, /role: "health-check"/u);
  assert.match(catalog, /production: false/u);
  assert.match(manager, /function healthCheckModel/u);
  assert.match(manager, /productionTextRole \? models\.filter\(\(model\) => !healthCheckModel\(model\)\)/u);
  assert.match(manager, /productionTextRole \? descriptors\.filter\(\(model\) => !healthCheckModel\(model\.id\)\)/u);
  assert.match(manager, /exactModel\(eligibleModels, override\)/u);
  assert.match(manager, /catalogFallback\(role, eligibleModels\)/u);
  assert.match(manager, /available: Boolean\(selected && eligibleModels\.includes\(selected\)\)/u);
});

test("#2357 preserves Pi Draft read-only and Publish Brief Issue-only authority boundaries", async () => {
  const [panel, piDraft, publisher, gateway] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("scripts/dsdd-pi-draft.mjs"),
    read("scripts/dsdd-publish-brief.mjs"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(piDraft, /runPiReadOnly/u);
  assert.match(piDraft, /read, grep, find and ls/u);
  assert.match(publisher, /"issue", "create"/u);
  assert.doesNotMatch(publisher, /"pr", "create"|git commit|git push|git worktree/u);
  assert.doesNotMatch(gateway, /action === "build"|run-uat-repair-agent\.mjs/u);
  assert.match(panel, /PUBLISH BRIEF/u);
});

test("#2357 is impact-catalogued in Layer 2 Experience Contract and Layer 6 Provider Runtime", async () => {
  const catalog = await json("config/verification/test-catalog.json");
  const experience = catalog.entries.find((entry) => entry.id === "experience.dsdd-guided-flow-2357");
  const provider = catalog.entries.find((entry) => entry.id === "provider.dsdd-production-interpretation-2357");
  assert.equal(experience?.ownerLayer, "experience-contract");
  assert.equal(provider?.ownerLayer, "provider-runtime");
  assert.ok(experience?.runner.targets.includes("tests/issue-2357-dsdd-guided-flow-fast-interpret.test.mjs"));
  assert.ok(provider?.runner.targets.includes("tests/issue-2357-dsdd-guided-flow-fast-interpret.test.mjs"));
});
