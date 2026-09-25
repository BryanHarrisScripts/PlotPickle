import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2440 Story Architect uses native Mastra structured output with an assessment-sized budget", async () => {
  const runtime = await read("build/mastra-agent-runtime.ts");

  assert.match(runtime, /function storyArchitectAssessmentSchema\(\)/u);
  assert.match(runtime, /state: \{ type: "string", enum: \["covered", "condensed-shared", "gap-underdeveloped", "unresolved"\] \}/u);
  assert.match(runtime, /minItems: 4,[\s\S]*maxItems: 4,[\s\S]*ordinal: \{ type: "integer", enum: \[1, 2, 3, 4\] \}/u);
  assert.match(runtime, /const storyArchitectModelSettings = \{[\s\S]*temperature: 0\.1,[\s\S]*maxOutputTokens: 1800/u);

  const structuredStart = runtime.indexOf('if (!directConversationMode && input.agentId === "story-architect")');
  const genericStart = runtime.indexOf("const result = await agent.generate(prompt, executionOptions);");
  assert.ok(structuredStart >= 0, "Story Architect structured branch must exist.");
  assert.ok(genericStart > structuredStart, "Story Architect structured branch must run before generic free-form generation.");

  const structuredBranch = runtime.slice(structuredStart, runtime.indexOf('if (!directConversationMode && input.agentId === "discovery-mapper")', structuredStart));
  assert.match(structuredBranch, /structuredOutput: \{[\s\S]*schema: storyArchitectAssessmentSchema\(\)[\s\S]*jsonPromptInjection: false/u);
  assert.match(structuredBranch, /if \(!result\.object\) throw new Error\("Story Architect did not return a structured assessment\."\)/u);
  assert.match(structuredBranch, /return JSON\.stringify\(result\.object\)/u);
  assert.doesNotMatch(structuredBranch, /result\.text/u);
});

test("#2440 Story Architect failure diagnostics expose the safe execution route and do not expose provider secrets", async () => {
  const gateway = await read("build/writing-assistant-gateway.ts");

  const helperStart = gateway.indexOf("function storyArchitectExecutionRoute(");
  const helperEnd = gateway.indexOf("async function handleChat", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = gateway.slice(helperStart, helperEnd);

  for (const field of ["profile.provider", "profile.runtime", "profile.textModel", "role", "computeSource"]) {
    assert.match(helper, new RegExp(field.replaceAll(".", "\\."), "u"));
  }
  assert.doesNotMatch(helper, /apiKey|Authorization|baseUrl|headers/u);

  assert.match(gateway, /agentId === "story-architect"[\s\S]*Story Architect execution failed \(\$\{storyArchitectExecutionRoute\(profile, role, assigned\.source\)\}\)/u);
  assert.match(gateway, /no structured assessment was returned/u);
});

test("#2440 Outline keeps evidence validation authoritative and stores safe execution-route metadata", async () => {
  const assessment = await read("modules/plan/outline-agent-assessment.ts");

  assert.match(assessment, /function storyArchitectExecutionLabel/u);
  assert.match(assessment, /provider=\$\{result\.provider\}/u);
  assert.match(assessment, /runtime=\$\{result\.runtimeProvider\}/u);
  assert.match(assessment, /model=\$\{result\.model\}/u);
  assert.match(assessment, /role=\$\{result\.modelRole\}/u);
  assert.match(assessment, /compute=\$\{result\.computeSource\}/u);
  assert.match(assessment, /storyArchitectExecutionLabel\(result\)/u);

  assert.match(assessment, /citations\(structural\.passageIds, allowed, "Structure"\)/u);
  assert.match(assessment, /cited a passage outside this Block/u);
  assert.match(assessment, /characters\.length !== cells\.length/u);
  assert.match(assessment, /new Set\(miniBlocks\.map\(\(item\) => item\.ordinal\)\)\.size !== 4/u);
  assert.match(assessment, /inputFingerprint: outlineAssessmentFingerprint\(project, blockNumber\)/u);
});
