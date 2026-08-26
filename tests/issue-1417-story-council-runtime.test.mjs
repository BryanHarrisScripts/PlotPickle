import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STORY_COUNCIL_RUNTIME_MARKER,
  isStoryCouncilRuntimeMessage,
  parseStoryCouncilRuntimeText,
  storyCouncilRuntimeMessage,
} from "../core/story-workflow/story-council-runtime-protocol.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const validOutput = JSON.stringify({
  kind: "proposal",
  severity: "medium",
  confidence: 0.78,
  changesCanon: true,
  explanation: "The supplied evidence supports a clearer causal link.",
  proposal: "Strengthen the existing setup/payoff without adding a new story fact.",
  alternatives: ["Keep the ambiguity and ask the writer whether it is intentional."],
});

test("#1417 Story Council runtime marker is explicit and structured output is strictly bounded", () => {
  const marked = storyCouncilRuntimeMessage("Inspect this bounded Story Work Item.");
  assert.equal(marked.startsWith(`${STORY_COUNCIL_RUNTIME_MARKER}\n`), true);
  assert.equal(isStoryCouncilRuntimeMessage(marked), true);
  assert.equal(isStoryCouncilRuntimeMessage("ordinary writer chat"), false);

  const output = parseStoryCouncilRuntimeText(validOutput);
  assert.deepEqual(output, {
    kind: "proposal",
    severity: "medium",
    confidence: 0.78,
    changesCanon: true,
    explanation: "The supplied evidence supports a clearer causal link.",
    proposal: "Strengthen the existing setup/payoff without adding a new story fact.",
    alternatives: ["Keep the ambiguity and ask the writer whether it is intentional."],
  });
});

test("#1417 runtime output cannot claim host-owned identity, revision, target, evidence or provenance fields", () => {
  for (const key of ["workItemId", "runId", "agentId", "baseRevision", "targetRefs", "evidenceRefs", "curriculumRefs", "provenance"]) {
    const value = JSON.parse(validOutput);
    value[key] = key.endsWith("Refs") ? ["forged:ref"] : "forged";
    assert.throws(() => parseStoryCouncilRuntimeText(JSON.stringify(value)), /host-owned or unsupported fields/i, key);
  }
  assert.throws(() => parseStoryCouncilRuntimeText(`\`\`\`json\n${validOutput}\n\`\`\``), /structured JSON object/i);
  assert.throws(() => parseStoryCouncilRuntimeText(JSON.stringify({ ...JSON.parse(validOutput), confidence: 2 })), /between 0 and 1/i);
  assert.throws(() => parseStoryCouncilRuntimeText(JSON.stringify({ ...JSON.parse(validOutput), kind: "proposal", proposal: "" })), /requires a proposal/i);
});

test("#1417 Mastra keeps the existing approved role but switches marked Council work to a strict schema before role-specific output", async () => {
  const mastra = await read("build/mastra-agent-runtime.ts");
  for (const contract of [
    "isStoryCouncilRuntimeMessage",
    "storyCouncilContributionSchema",
    "storyCouncilMode",
    "The Story Council specialist did not return a structured contribution.",
    "additionalProperties: false",
    "changesCanon",
    "confidence",
    "alternatives",
  ]) assert.ok(mastra.includes(contract), `Mastra Story Council mode missing: ${contract}`);

  assert.ok(mastra.indexOf("if (storyCouncilMode)") < mastra.indexOf('if (input.agentId === "foundations-planner")'),
    "Story Council schema must override Tamsin's ordinary Foundations field schema only for marked Council work");
  assert.doesNotMatch(mastra, /StoryCouncil.*(?:OpenAI|MiniMax|Anthropic)|provider:\s*["'](?:openai|minimax|anthropic)["']/i,
    "Story Council must not introduce a paid-cloud execution path");
});

test("#1417 host adapter binds model content back to canonical work item/profile context", async () => {
  const runtime = await read("modules/story-workflow/story-council-runtime.ts");
  for (const contract of [
    "profile.runtimeRoleId",
    "profile.requestedModelRole",
    'provider: "local"',
    "parseStoryCouncilRuntimeText",
    "workItemId: input.workItem.workItemId",
    "baseRevision: input.workItem.baseRevision",
    "targetRefs: input.workItem.targetRefs",
    "evidenceRefs: input.workItem.evidenceRefs",
    "curriculumRequirementId: input.workItem.curriculumRequirementId",
    "affectedDownstreamRefs: input.workItem.dependencyRefs",
    'transport: "local-runtime"',
  ]) assert.ok(runtime.includes(contract), `Story Council runtime host binding missing: ${contract}`);

  assert.doesNotMatch(runtime, /saveActiveLibraryProject|saveFoundationProject|writeProject|applyCanon|acceptProposal/i,
    "Runtime output may become proposal evidence but cannot directly mutate project canon");
  assert.doesNotMatch(runtime, /messages\s+send|channels\s+add-member|fetch\([^)]*buzz/i,
    "Local Story Council execution must not depend on BUZZ transport");
});
