import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const asWindowsText = (text) => text.replace(/\r?\n/g, "\r\n");

test("Sage Brinewick is a registered product-agent skill", async () => {
  const [registry, skill] = await Promise.all([
    readJson("config/agent-skills.json"),
    read(".agents/skills/sage-brinewick/SKILL.md"),
  ]);
  const sage = registry.skills.find((entry) => entry.id === "sage-brinewick");
  assert.deepEqual(sage, {
    id: "sage-brinewick",
    name: "Sage Brinewick",
    description: "Guide LEARN conversations with Sage's visible mentor personality and procedure while PlotPickle curriculum retrieval remains the teaching source of truth.",
    entry: ".agents/skills/sage-brinewick/SKILL.md",
    uri: "skill://plotpickle/sage-brinewick",
    roles: ["curriculum-guide"],
    primaryWorker: "mastra",
    consumers: ["curriculum-guide"],
    mcpReady: true,
    localOnly: true,
  });
  const windowsSkill = asWindowsText(skill);
  assert.match(skill, /^---\r?\nname: sage-brinewick\r?\n/);
  assert.match(windowsSkill, /^---\r?\nname: sage-brinewick\r?\n/);
  assert.match(skill, /This skill owns Sage's visible personality and conversational procedure/i);
});

test("Sage skill owns personality and procedure while curriculum remains retrieved truth", async () => {
  const [skill, unified] = await Promise.all([
    read(".agents/skills/sage-brinewick/SKILL.md"),
    read("modules/creative-room/sage-unified-guide.ts"),
  ]);

  assert.match(skill, /warm, perceptive, lightly witty, and conversational/i);
  assert.match(skill, /Most replies should be 2 to 4 sentences/i);
  assert.match(skill, /This skill is procedure, not curriculum/i);
  assert.match(skill, /retrieved\/injected curriculum is the source of truth/i);
  assert.match(skill, /If the supplied curriculum context does not support a PlotPickle teaching claim, do not invent one/i);
  assert.doesNotMatch(skill, /lesson\.definitions|lesson\.overview|lesson\.apply|FOUNDATIONS_CURRICULUM|retrieveCurriculumContext/);

  assert.match(unified, /retrieveCurriculumContext/);
  assert.match(unified, /sourceLessonIds: craft \? retrieval\.lessonIds : \[\]/);
  assert.match(unified, /sourceReferenceIds: craft \? retrieval\.sourceIds : \[\]/);
});

test("Mastra loads the Sage skill body and leaves routing and recovery in the host", async () => {
  const runtime = await read("build/mastra-agent-runtime.ts");

  assert.match(runtime, /SAGE_BRINEWICK_SKILL_PATH = resolve\(process\.cwd\(\), "\.agents\/skills\/sage-brinewick\/SKILL\.md"\)/);
  assert.match(runtime, /stripSkillFrontmatter/);
  assert.match(runtime, /Sage Brinewick skill:/);
  assert.match(runtime, /Use the Sage Brinewick skill for visible personality and conversational procedure/);
  assert.match(runtime, /Retrieval, model routing, bounded local recovery, and application state remain host responsibilities outside Sage's skill/);
  assert.doesNotMatch(runtime, /agents\/sage-brinewick\.md/);

  const legacy = new URL("../agents/sage-brinewick.md", import.meta.url);
  await assert.rejects(access(legacy), /ENOENT/);
});

test("Sage skill stays provider-independent and cannot mutate writer state", async () => {
  const skill = await read(".agents/skills/sage-brinewick/SKILL.md");
  assert.match(skill, /Do not name or select Fast, Quality, Ollama, LM Studio, llama\.cpp, a cloud provider, or a specific model/i);
  assert.match(skill, /Do not change project canon, lesson completion, PLAN answers, provider settings, files, or GitHub state/i);
  assert.doesNotMatch(skill, /api\.openai\.com|anthropic\.com|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
});

test("focused Foundations and LEARN UAT owns the Sage skill regression", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const learn = registry.areas.find((area) => area.id === "foundations-learn");
  assert.ok(learn);
  assert.ok(learn.tests.includes("tests/sage-brinewick-agent-skill.test.mjs"));
});
