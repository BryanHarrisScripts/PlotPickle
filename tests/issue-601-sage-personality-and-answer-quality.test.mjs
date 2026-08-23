import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("Sage uses the repository skill as active runtime instructions", async () => {
  const [skill, runtime] = await Promise.all([
    read(".agents/skills/sage-brinewick/SKILL.md"),
    read("build/mastra-agent-runtime.ts"),
  ]);

  assert.match(skill, /resident curriculum mentor/i);
  assert.match(skill, /Answer the actual question in the first one or two sentences/i);
  assert.match(skill, /Never answer by repeating or lightly rephrasing the writer's question/i);
  assert.match(skill, /What is theme\?/i);
  assert.match(skill, /not a response bank/i);
  assert.match(skill, /Story and curriculum questions/i);
  assert.match(skill, /Normal conversation and odd questions/i);
  assert.match(skill, /little sarcasm, dry wit, or playful pushback/i);

  assert.match(runtime, /\.agents\/skills\/sage-brinewick\/SKILL\.md/);
  assert.match(runtime, /stripSkillFrontmatter\(readFileSync\(SAGE_BRINEWICK_SKILL_PATH, "utf8"\)\)/);
  assert.match(runtime, /SAGE_BRINEWICK_PLAYBOOK = loadSageBrinewickPlaybook\(\)/);
  assert.match(runtime, /id === "curriculum-guide" \? `Sage Brinewick skill:/);
  assert.match(runtime, /curriculum_context supplied by PlotPickle is the only source of truth/i);
  assert.match(runtime, /temperature: input\.agentId === "curriculum-guide" \? 0\.3 : input\.agentId === "wyrmwood-rival-director" \? 0\.55 : 0\.2/);
  assert.match(runtime, /maxOutputTokens: input\.agentId === "foundations-planner" \? 720 : input\.agentId === "wyrmwood-rival-director" \? 1100 : 480/);
});

test("Sage rejects weak local output and can route conversational or broad questions through Quality", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /export function guideAnswerNeedsRepair/);
  assert.match(guide, /normalizedAnswer === normalizedQuestionText/);
  assert.match(guide, /shortSemanticEcho/);
  assert.match(guide, /mode === "craft" && broadCraftQuestion\(question\) && answerWords\.length < 18/);
  assert.match(guide, /RESPONSE QUALITY RETRY/);
  assert.match(guide, /CONVERSATION MODE: ordinary conversation/);
  assert.match(guide, /requestGuideModel\(message, 45_000, "fast"\)/);
  assert.match(guide, /preferQuality = mode !== "craft" \|\| broadCraftQuestion\(question\)/);
  assert.match(guide, /requestGuideModel\(message, 45_000, "quality"\)/);
  assert.match(guide, /SAGE_QUALITY_ESCALATION_INSTRUCTION/);
  assert.match(guide, /prepareGuideQualityModel\(\)/);
  assert.match(guide, /\/api\/local-ai\/runtime\/model\/quality\/load/);
  assert.match(guide, /fallbackRole: GuideModelRole = role === "quality" \? "fast" : "quality"/);
  assert.match(guide, /stronger Fast or Quality model in Settings/);
  assert.doesNotMatch(guide, /answerBank|fixedResponses|cannedResponses/);
});
