import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { loadAgentSkill, materializeAgentSkillRunManifest, stripSkillFrontmatter } from '../scripts/agent-skills.mjs';

const temp = await mkdtemp(path.resolve('node_modules/.narration-skill-test-'));
await build({ stdin: { contents: 'export { createPlotPickleMastra, loadNarrationStorytellingSkill } from "./build/mastra-agent-runtime.ts";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: path.join(temp, 'runtime.mjs'), logLevel: 'silent' });
const { createPlotPickleMastra, loadNarrationStorytellingSkill } = await import(pathToFileURL(path.join(temp, 'runtime.mjs')).href);
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
