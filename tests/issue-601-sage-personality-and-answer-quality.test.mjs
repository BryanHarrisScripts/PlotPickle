import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("Sage uses a repository playbook as active runtime instructions", async () => {
  const [playbook, runtime] = await Promise.all([
    read("agents/sage-brinewick.md"),
    read("build/mastra-agent-runtime.ts"),
  ]);

  assert.match(playbook, /resident curriculum mentor/i);
  assert.match(playbook, /Answer the actual question in the first one or two sentences/i);
  assert.match(playbook, /Never answer by repeating or lightly rephrasing the writer’s question/i);
  assert.match(playbook, /What is theme\?/i);
  assert.match(playbook, /not a response bank/i);
  assert.match(playbook, /only source of truth/i);

  assert.match(runtime, /agents\/sage-brinewick\.md/);
  assert.match(runtime, /readFileSync\(SAGE_BRINEWICK_PLAYBOOK_PATH, "utf8"\)/);
  assert.match(runtime, /SAGE_BRINEWICK_PLAYBOOK = loadSageBrinewickPlaybook\(\)/);
  assert.match(runtime, /id === "curriculum-guide" \? `Sage Brinewick playbook:/);
  assert.match(runtime, /temperature: input\.agentId === "curriculum-guide" \? 0\.3 : 0\.2/);
  assert.match(runtime, /maxOutputTokens: input\.agentId === "foundations-planner" \? 720 : 420/);
});

test("Sage rejects question echoes and retries once with a direct-answer contract", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /export function guideAnswerNeedsRepair/);
  assert.match(guide, /normalizedAnswer === normalizedQuestion/);
  assert.match(guide, /broadQuestion && answerWords\.length < 12/);
  assert.match(guide, /RESPONSE QUALITY RETRY/);
  assert.match(guide, /define the concept, explain why it matters to a story, and give one short concrete example/i);
  assert.match(guide, /requestGuideModel\(message, 45_000\)/);
  assert.match(guide, /requestGuideModel\(`\$\{SAGE_REPAIR_INSTRUCTION\}\\n\\n\$\{message\}`, 30_000\)/);
  assert.match(guide, /repeated, looped, or failed to answer the question twice/);
  assert.doesNotMatch(guide, /answerBank|fixedResponses|cannedResponses/);
});
