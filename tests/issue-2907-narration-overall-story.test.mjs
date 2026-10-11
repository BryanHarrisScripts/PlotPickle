import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { narrationOverallStory, validateNarrationOverallStory } from '../core/media/storyboard-sequence-evidence.mjs';
import { storyboardNarrationRequest, storyboardNarrationPrompt } from '../core/media/previs-narration.mjs';

const project = {
  storyDevelopment: { fields: {
    theme: { value: 'Connection outlasts control.', acceptedSource: 'human', proposal: 'UNAPPROVED SECRET' },
    ending: { value: 'Ava chooses freedom.', acceptedSource: 'agent-proposal' },
    pending: { value: 'Unaccepted', acceptedSource: null },
  } },
  foundations: { brief: { content: 'A machine seeks belonging.' } },
  sourceEvidence: { storyMatrix: { blocks: [
    { blockNumber: 24, title: 'Freedom', responsibility: 'Resolve the choice.' },
    { blockNumber: 1, title: 'Awakening', responsibility: 'Establish dependence.' },
  ] } },
  credentials: 'NEVER SEND',
};

test('#2907 overall evidence uses saved decisions and ordered full story, excluding proposals and operational data', () => {
  const overall = narrationOverallStory(project);
  assert.deepEqual(overall.blocks.map(b => b.block), [1, 24]);
  assert.match(overall.decisions, /Ava chooses freedom/);
  assert.match(overall.foundations, /seeks belonging/);
  assert.doesNotMatch(JSON.stringify(overall), /UNAPPROVED|Unaccepted|NEVER SEND/);
  assert.deepEqual(validateNarrationOverallStory(overall), overall);
  assert.deepEqual(narrationOverallStory({}), { decisions: '', foundations: '', blocks: [] });
  assert.throws(() => validateNarrationOverallStory({ ...overall, blocks: [...overall.blocks].reverse() }), /block map/);
  assert.throws(() => validateNarrationOverallStory({ ...overall, decisions: 'x'.repeat(2401) }), /overall story/);
});

test('#2907 actual request preserves overall story and prompt places local narrative without future reveals', () => {
  const overallStory = narrationOverallStory(project);
  const input = storyboardNarrationRequest({
    mode: 'storyboard-shot',
    storyContext: { title: 'Story', act: 1, block: 1, miniBlock: 1, blockTitle: 'Awakening', dramaticResponsibility: 'Dependence', overallStory },
    passages: [{ type: 'action', text: 'Ava awakens alone.' }],
    panels: [{ position: 1, intention: 'Awakening' }],
    sequence: { selectedPosition: 1, shots: Array.from({ length: 25 }, (_, i) => ({ position: i + 1, intention: '' })) },
    shot: Object.fromEntries(['story', 'sceneBeat', 'camera', 'performance', 'lighting', 'timing', 'informationBoundary', 'continuity'].map(k => [k, ''])),
  });
  assert.deepEqual(input.storyContext.overallStory, overallStory);
  const prompt = storyboardNarrationPrompt(input);
  assert.match(prompt, /Ava chooses freedom/);
  assert.match(prompt, /Later Blocks and ending decisions are continuity context only/);
  assert.match(prompt, /opening state, supported change, ending state and handoff/);
  assert.match(prompt, /Missing overall evidence is unknown/);
  assert.match(prompt, /12 words and 100 characters HARD MAXIMUM/);
});

test('#2907 Storyboard and Previs fingerprint the same shared overall context', async () => {
  for (const file of ['app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'app/_components/previs/previs-readiness-workspace.tsx']) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(source, /overallStory: narrationOverallStory\(project\)/);
    assert.match(source, /graphicNovelTextSourceKey\(panel,[\s\S]*?storyContext/);
  }
  assert.notDeepEqual(narrationOverallStory(project), narrationOverallStory({ ...project, foundations: { brief: { content: 'Changed premise.' } } }));
});

 test('#2907 runtime Graphic Novel agent receives the native storyteller procedure', async () => {
  const source = await readFile(new URL('../build/mastra-agent-runtime.ts', import.meta.url), 'utf8');
  assert.match(source, /"graphic-novel": NARRATION_STORYTELLER_PROCEDURE/);
  assert.match(source, /Specialist responsibility: \$\{role\}/);
 });

 test('#2907 Windows runtime fixture selects its verified synthetic route explicitly', async () => {
  const source = await readFile(new URL('../scripts/pi/durable/outline-product-proof.mjs', import.meta.url), 'utf8');
  const configure = source.indexOf('await api(session, "/api/writing-assistant/ollama"');
  const select = source.indexOf('await api(session, "/api/ai-routing/select", { capability: "text", route: "ollama" })');
  const start = source.indexOf('action: "start"', configure);
  assert.ok(configure >= 0 && select > configure && select < start);
  assert.match(source, /assert.equal\(\(await api\(session, "\/api\/ai-routing\/status"\)\).text.selected, "ollama"\)/);
 });
