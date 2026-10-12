import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import {
  storyboardNarrationRequest, parseStoryboardNarration,
  storyboardNarrationCorrectionPrompt,
} from "../core/media/previs-narration.mjs";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const position = 19;
const evidence = {
  mode: "storyboard-shot",
  storyContext: { title: "Test", act: 1, block: 1, miniBlock: 1, blockTitle: "Opening", dramaticResponsibility: "A difficult decision." },
  passages: [{ type: "character", text: "REN" }, { type: "dialogue", text: "Wait for me." }],
  sequence: { selectedPosition: position, shots: Array.from({ length: 25 }, (_, i) => ({ position: i + 1, intention: "Authored Shot " + (i + 1) })) },
  panels: [{ position, intention: "Ren considers the choice." }],
  shot: { story: "Ren considers the choice.", sceneBeat: "Mini-Block opening", camera: "", performance: "", lighting: "", timing: "~3s Storyboard planning target", informationBoundary: "", continuity: "", imagePrompt: "" },
  shotAnalysis: "Ren must make a decision.",
};
const request = storyboardNarrationRequest(evidence);

test("#2930 retains grounded exact-shot narration when local model changes JSON envelope", () => {
  const caption = "Ren hesitates before the open door.";
  assert.equal(parseStoryboardNarration(JSON.stringify({ position: "19", caption }), request)[0].narration, caption);
  assert.equal(parseStoryboardNarration(JSON.stringify({ panels: [{ position: "19", narration: caption }] }), request)[0].position, 19);
  assert.throws(() => parseStoryboardNarration(JSON.stringify({ position: "20", caption }), request), /invalid narration pacing or positions/u, "wrong Shot must never be silently renamed");
  assert.throws(() => parseStoryboardNarration(JSON.stringify({ position: "19", narration: "", bubbles: [{ speaker: "REN", text: "Not in the screenplay." }] }), request), /quote actual dialogue/u, "invented dialogue is rejected");
  assert.throws(() => parseStoryboardNarration(JSON.stringify({ position: "19", caption: "one two three four five six seven eight nine ten eleven twelve thirteen" }), request), /12-word/u, "hard caption limit remains");
  assert.throws(() => parseStoryboardNarration(JSON.stringify({ position: "19", narration: "" }), request), /empty narration output/u, "empty draft remains invalid");
});

test("#2930 correction is bounded to the same Shot and same supplied story packet", () => {
  const prompt = storyboardNarrationCorrectionPrompt(request, "INVALID_DIALOGUE_SHAPE");
  assert.match(prompt, /FORMAT CORRECTION: INVALID_DIALOGUE_SHAPE/u);
  assert.match(prompt, /"position":19/u);
  assert.match(prompt, /Do not use dialogue bubbles/u);
  assert.match(prompt, /Ren considers the choice/u);
  assert.doesNotMatch(prompt, /"position":20,"narration"/u);
});

test("#2930 one-shot image flow stores an immutable prompt and retains paid confirmation boundary", async () => {
  const [workspace, production, handoff] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("core/contracts/previs/index.ts"),
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
  ]);
  assert.match(workspace, /Create Storyboard Image Prompt/u);
  assert.match(workspace, /Create Storyboard Image/u);
  assert.match(workspace, /storyboardImagePrompts/u);
  assert.match(workspace, /saveFoundationProjectDurably\(next, current\.revision\)/u); // exact-revision durable acknowledgment
  assert.match(workspace, /const originalPrompt = existingPrompt\?\.prompt \|\| selectedImage\?\.prompt \|\| ""/u);
  assert.match(workspace, /anchorRef, position, prompt: generatedPrompt/u);
  assert.match(workspace, /requestCount: 1, billingAcknowledged: true/u);
  assert.match(workspace, /if \(option\.locality !== "local"\)/u);
  assert.match(workspace, /await requestPlotPickleConfirmation/u);
  assert.doesNotMatch(workspace, /storyboard-generation-scope|Current group of 5 Shots|All 25 Shots|setGenerationScope|frameConsent/u);
  assert.match(production, /readonly storyboardImagePrompts\?: readonly StoryboardImagePromptRecord\[\]/u);
  assert.match(production, /position! < 1/u);
  assert.match(handoff, /Prepare Narration Brief/u);
  assert.match(handoff, /Create Narration/u);
});

test("#2930 first INVALID_DIALOGUE_SHAPE then direct caption response succeeds with one correction", async () => {
  const route = await read("app/api/previs/narration/route.ts");
  const source = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, "")).replace(/\bexport /gu, "");
  let calls = 0;
  const profile = { provider: "local", textModel: "verified-local-fixture" };
  const context = vm.createContext({
    Error, Response, URL, ...await import("../core/media/previs-narration.mjs"),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: request => request,
    resolveConfiguredLocalNarrationProfile: async () => ({ profile }),
    resolveConfiguredAgentExecutionProfile: async () => { throw new Error("No remote provider permitted"); },
    askPlotPickleAgent: async args => {
      calls++;
      assert.equal(args.profile, profile);
      assert.equal(args.outputFormat.position, position);
      if (calls === 1) return JSON.stringify({ panels: [{ position, narration: "", bubbles: [{ speaker: "UNKNOWN", text: "Wrong speaker" }] }] });
      assert.match(args.message, /FORMAT CORRECTION: INVALID_DIALOGUE_SHAPE/u);
      assert.match(args.message, /"position":19/u);
      return JSON.stringify({ position: "19", caption: "Ren hesitates before the open door." });
    },
  });
  vm.runInContext(source, context);
  const response = await context.POST(new Request("http://localhost/api/previs/narration", { method: "POST", body: JSON.stringify(evidence) }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.repaired, true);
  assert.equal(body.panels[0].position, position);
  assert.equal(body.panels[0].narration, "Ren hesitates before the open door.");
  assert.equal(calls, 2);
});

test("#2930 invalid dialogue followed by wrong Shot still returns safe HTTP 502", async () => {
  const route = await read("app/api/previs/narration/route.ts");
  const source = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, "")).replace(/\bexport /gu, "");
  let calls = 0;
  const context = vm.createContext({
    Error, Response, URL, ...await import("../core/media/previs-narration.mjs"),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: request => request,
    resolveConfiguredLocalNarrationProfile: async () => ({ profile: { provider: "local" } }),
    askPlotPickleAgent: async () => {
      calls++;
      return calls === 1
        ? JSON.stringify({ panels: [{ position, narration: "", bubbles: [{ speaker: "INVALID", text: "invented" }] }] })
        : JSON.stringify({ position: 20, caption: "Wrong Shot." });
    },
  });
  vm.runInContext(source, context);
  const response = await context.POST(new Request("http://localhost/api/previs/narration", { method: "POST", body: JSON.stringify(evidence) }));
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.reason, "INVALID_SHOT_RESPONSE");
  assert.equal(body.priorReason, "INVALID_DIALOGUE_SHAPE");
  assert.equal(body.attempts, 2);
  assert.equal("panels" in body, false);
  assert.equal(calls, 2);
});
