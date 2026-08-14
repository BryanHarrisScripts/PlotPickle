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
  assert.match(playbook, /Story and curriculum questions/i);
  assert.match(playbook, /Normal conversation and odd questions/i);
  assert.match(playbook, /little sarcasm, dry wit, or playful pushback/i);

  assert.match(runtime, /agents\/sage-brinewick\.md/);
  assert.match(runtime, /readFileSync\(SAGE_BRINEWICK_PLAYBOOK_PATH, "utf8"\)/);
  assert.match(runtime, /SAGE_BRINEWICK_PLAYBOOK = loadSageBrinewickPlaybook\(\)/);
  assert.match(runtime, /id === "curriculum-guide" \? `Sage Brinewick playbook:/);
  assert.match(runtime, /casual, personal, humorous, meta, or clearly non-craft questions/i);
  assert.match(runtime, /temperature: input\.agentId === "curriculum-guide" \? 0\.45 : 0\.2/);
  assert.match(runtime, /maxOutputTokens: input\.agentId === "foundations-planner" \? 720 : 480/);
});

test("Sage rejects bad Fast output, then can escalate to a stronger local Quality model", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /export function guideAnswerNeedsRepair/);
  assert.match(guide, /normalizedAnswer === normalizedQuestion/);
  assert.match(guide, /broadCraftQuestion && answerWords\.length < 12/);
  assert.match(guide, /RESPONSE QUALITY RETRY/);
  assert.match(guide, /casual, personal, humorous, meta, or clearly non-craft conversation/i);
  assert.match(guide, /requestGuideModel\(message, 45_000, "fast"\)/);
  assert.match(guide, /SAGE_QUALITY_ESCALATION_INSTRUCTION/);
  assert.match(guide, /prepareGuideModel\("quality"\)/);
  assert.match(guide, /requestGuideModel\(`\$\{SAGE_QUALITY_ESCALATION_INSTRUCTION\}\\n\\n\$\{message\}`, 45_000, "quality"\)/);
  assert.match(guide, /stronger Fast or Quality model in Settings/);
  assert.doesNotMatch(guide, /answerBank|fixedResponses|cannedResponses/);
});
