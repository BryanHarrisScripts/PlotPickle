import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Sage separates ordinary conversation from curriculum retrieval and prefers Quality for harder replies", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /type GuideConversationMode = "craft" \| "identity" \| "help" \| "conversation"/);
  assert.match(guide, /who are you\|what are you/);
  assert.match(guide, /can you help\|could you help/);
  assert.match(guide, /const retrieval = mode === "craft"/);
  assert.match(guide, /: EMPTY_RETRIEVAL/);
  assert.match(guide, /mode === "craft" \? retrieval\.lessonIds : \[\]/);
  assert.match(guide, /mode === "craft" \? retrieval\.sourceIds : \[\]/);
  assert.match(guide, /preferQuality = mode !== "craft" \|\| broadCraftQuestion\(question\)/);
  assert.match(guide, /requestGuideModel\(message, 45_000, "quality"\)/);
});

test("Sage rejects the exact weak patterns visible in the screenshot", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /shortSemanticEcho/);
  assert.match(guide, /student of/);
  assert.match(guide, /answer\.trim\(\)\.endsWith\("\?"\)/);
  assert.match(guide, /\bplotpickle\b/);
  assert.match(guide, /\b(?:guide|mentor|curriculum)\b/);
  assert.match(guide, /For simple help requests, answer yes and say how you can help/);
});

test("PLAN may create review-only provisional candidates and recovers failed batch output one field at a time", async () => {
  const [drafter, runtime] = await Promise.all([
    read("modules/plan/foundations-plan-drafter.ts"),
    read("build/mastra-agent-runtime.ts"),
  ]);

  assert.match(drafter, /plausible working candidate/);
  assert.match(drafter, /Provisional —/);
  assert.match(drafter, /recoverFieldsIndividually/);
  assert.match(drafter, /RECOVER ONE PLAN FIELD/);
  assert.match(drafter, /safeProvisionalFallback/);
  assert.match(drafter, /looksLikePromptEcho/);
  assert.match(runtime, /unaccepted review proposal/);
  assert.match(runtime, /Never invent a story fact and present it as accepted canon/);
});

test("PLAN and LEARN workflow labels keep the same stacked spacing", async () => {
  const [layout, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/pr-613-workflow-nav-alignment.css"),
  ]);

  assert.match(layout, /pr-613-workflow-nav-alignment\.css/);
  assert.match(css, /nav\[aria-label="PlotPickle workflow"\] button > span/);
  assert.match(css, /display: grid/);
  assert.match(css, /gap: 2px/);
  assert.match(css, /button > span > strong/);
  assert.match(css, /button > span > small/);
});
