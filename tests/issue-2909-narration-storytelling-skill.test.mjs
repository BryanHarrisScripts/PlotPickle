import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { Agent } from '@mastra/core/agent';
import { loadAgentSkill, materializeAgentSkillRunManifest, stripSkillFrontmatter } from '../scripts/agent-skills.mjs';

const temp = await mkdtemp(path.resolve('node_modules/.narration-skill-test-'));
await build({ stdin: { contents: 'export { askPlotPickleAgent, createPlotPickleMastra, loadNarrationStorytellingSkill } from "./build/mastra-agent-runtime.ts";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: path.join(temp, 'runtime.mjs'), logLevel: 'silent' });
const { askPlotPickleAgent, createPlotPickleMastra, loadNarrationStorytellingSkill } = await import(pathToFileURL(path.join(temp, 'runtime.mjs')).href);
test.after(() => rm(temp, { recursive: true, force: true }));

test('#2909 registered skill materializes for Graphic Novel only, with bounded trust metadata', async () => {
  const skill = await loadAgentSkill('narration-storytelling');
  assert.equal(skill.primaryWorker, 'mastra');
  assert.deepEqual(skill.consumers, ['graphic-novel']);
  const manifest = await materializeAgentSkillRunManifest('graphic-novel', ['narration-storytelling']);
  assert.ok(manifest.skills.some(item => item.uri === skill.uri));
  await assert.rejects(materializeAgentSkillRunManifest('story-architect', ['narration-storytelling']), /not enabled/);
  const trust = JSON.parse(await readFile('config/agent-skill-trust.json', 'utf8')).records.find(item => item.uri === skill.uri);
  assert.deepEqual(trust.requestedCapabilityClasses, ['bounded-project-context', 'proposal-draft']);
  assert.equal(trust.evalStatus, 'partial');
});

test('#2909 actual Mastra instructions load the registered body without frontmatter or leaking it into other roles', async () => {
  const skill = await loadAgentSkill('narration-storytelling');
  const procedure = stripSkillFrontmatter(skill.content);
  assert.equal(loadNarrationStorytellingSkill(), procedure);
  const mastra = createPlotPickleMastra({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', textModel: 'synthetic-no-request' });
  const instructions = await mastra.getAgent('graphic-novel').getInstructions();
  assert.ok(instructions.includes(procedure));
  assert.ok(instructions.includes('Specialist responsibility: Work as a storyteller'));
  assert.ok(!instructions.includes('name: narration-storytelling'));
  for (const role of ['story-architect', 'curriculum-guide']) {
    assert.ok(!(await mastra.getAgent(role).getInstructions()).includes(procedure));
  }
});

test('#2922 Graphic Novel narration asks Mastra for schema-constrained output', async () => {
  const originalGenerate = Agent.prototype.generate;
  let generateOptions;
  Agent.prototype.generate = async function (_prompt, options) {
    generateOptions = options;
    return { object: { panels: [{ position: 19, narration: 'Ren waits before crossing.', bubbles: [] }] } };
  };
  try {
    const response = await askPlotPickleAgent({
      profile: { provider: 'local', baseUrl: 'http://127.0.0.1:1234/v1', textModel: 'synthetic-local' },
      agentId: 'graphic-novel', tone: 'direct', outputFormat: { kind: 'storyboard-narration', position: 19 },
      message: 'Return one narration panel.',
    });
    assert.deepEqual(JSON.parse(response), {
      panels: [{ position: 19, narration: 'Ren waits before crossing.', bubbles: [] }],
    });
    assert.equal(generateOptions.structuredOutput.jsonPromptInjection, false);
    assert.equal(generateOptions.structuredOutput.schema.jsonSchema.properties.panels.maxItems, 1);
    assert.deepEqual(generateOptions.structuredOutput.schema.jsonSchema.properties.panels.items.properties.position.enum, [19]);
    const shotSchema = generateOptions.structuredOutput.schema.jsonSchema.properties.panels.items.properties;
    assert.match(shotSchema.narration.pattern, /\{0,11\}/u, 'caption schema must cap output at twelve whitespace-delimited words');
    assert.match(shotSchema.bubbles.items.properties.text.pattern, /\{0,11\}/u, 'dialogue schema must cap output at twelve whitespace-delimited words');
    const narrationWordLimit = new RegExp(shotSchema.narration.pattern);
    assert.equal(narrationWordLimit.test(Array(12).fill('word').join(' ')), true);
    assert.equal(narrationWordLimit.test(Array(13).fill('word').join(' ')), false);
  } finally {
    Agent.prototype.generate = originalGenerate;
  }
});

test('#2926 only the structured Storyboard shot brief gets the extended local response window', async () => {
  const originalGenerate = Agent.prototype.generate;
  const originalTimeout = AbortSignal.timeout;
  const observedTimeouts = [];
  Agent.prototype.generate = async function (_prompt, options) {
    return options?.structuredOutput
      ? { object: { analysis: 'A supported shot action.', proposals: { story: '', sceneBeat: '', camera: '', performance: '', lighting: '', timing: '', informationBoundary: '', continuity: '', imagePrompt: '' } } }
      : { text: 'A short grounded caption.' };
  };
  AbortSignal.timeout = (milliseconds) => {
    observedTimeouts.push(milliseconds);
    return new AbortController().signal;
  };
  try {
    await askPlotPickleAgent({
      profile: { provider: 'local', baseUrl: 'http://127.0.0.1:1234/v1', textModel: 'synthetic-local' },
      agentId: 'graphic-novel', tone: 'direct', outputFormat: { kind: 'storyboard-shot-brief' },
      message: 'Analyze one selected shot.',
    });
    await askPlotPickleAgent({
      profile: { provider: 'local', baseUrl: 'http://127.0.0.1:1234/v1', textModel: 'synthetic-local' },
      agentId: 'graphic-novel', tone: 'direct',
      message: 'Write one short narration draft.',
    });
    assert.deepEqual(observedTimeouts, [90_000, 25_000]);
  } finally {
    Agent.prototype.generate = originalGenerate;
    AbortSignal.timeout = originalTimeout;
  }
});