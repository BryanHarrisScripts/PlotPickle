import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { storyboardNarrationRequest, storyboardNarrationPrompt, parseStoryboardNarration, narrationRequest } from '../core/media/previs-narration.mjs';

const storyContext = { title: 'Afterglow', act: 1, block: 1, miniBlock: 1, blockTitle: 'Opening', dramaticResponsibility: 'Establish the dilemma.' };
const passages = [{ type: 'character', text: 'REN' }, { type: 'parenthetical', text: '(quietly)' }, { type: 'dialogue', text: 'We should go. Before they return.' }, { type: 'character', text: 'AVA' }, { type: 'dialogue', text: 'Wait for me.' }];
const shot = { story: 'Ren hesitates at the door.', sceneBeat: 'Scene 1: hesitation', camera: 'Close-up', performance: 'Still', lighting: 'Low', timing: '3s authored', informationBoundary: 'withhold: destination', continuity: 'Exit to corridor' };
const evidence = { mode: 'storyboard-shot', storyContext, passages, panels: [{ position: 19, intention: 'Ren pauses at the door.' }], shot };
const input = storyboardNarrationRequest(evidence);
const output = (narration = 'Ren hesitates before taking the next step.', bubbles = []) => JSON.stringify({ panels: [{ position: 19, narration, bubbles }] });

test('#2839 text-only Shot evidence includes every authored fact without image input', () => {
  assert.equal('image' in input, false);
  assert.equal('contactSheet' in input, false);
  const prompt = storyboardNarrationPrompt(input);
  for (const fact of Object.values(shot)) assert.ok(prompt.includes(fact));
  assert.ok(prompt.includes(passages[2].text));
  assert.throws(() => storyboardNarrationRequest({ ...evidence, contactSheet: 'data:image/jpeg;base64,AAAA' }), /text-only/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, image: [] }), /text-only/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, panels: [...evidence.panels, { position: 20, intention: '' }] }), /one locked Shot/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, shot: { ...shot, camera: null } }), /Shot evidence/);
  assert.throws(() => narrationRequest({ ...evidence, mode: undefined }), /contact sheet/);
});

test('#2839 short output, silence, exact dialogue and actual speaker are enforced', () => {
  assert.equal(parseStoryboardNarration(output(), input)[0].position, 19);
  assert.equal(parseStoryboardNarration(output('', []), input)[0].narration, '');
  assert.equal(parseStoryboardNarration(output('', [{ speaker: 'REN', text: 'Before they return.' }]), input)[0].bubbles[0].text, 'Before they return.');
  for (const invalid of [
    output('one two three four five six seven eight nine ten eleven twelve thirteen'),
    output('x'.repeat(101)),
    output('', [{ speaker: 'REN', text: 'We must go.' }]),
    output('', [{ speaker: 'AVA', text: 'We should go.' }]),
    output('', [{ speaker: 'REN', text: 'we should go!' }]),
    output('', [{ speaker: 'INVENTED', text: 'We should go.' }]),
    JSON.stringify({ panels: [{ position: 1, narration: '', bubbles: [] }] }),
  ]) assert.throws(() => parseStoryboardNarration(invalid, input));
});

test('#2839 actual Storyboard generation handler never reads image pixels and submits shot text', async () => {
  const source = await readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8');
  const start = source.indexOf('  async function generateNarration(');
  const end = source.indexOf('\n  return (', start);
  const executable = stripTypeScriptTypes(source.slice(start, end));
  const project = { id: 'afterglow' };
  let drafts = {}, notices = {}, submitted;
  const context = vm.createContext({
    busyPosition: null, evidence: { passages }, project, latestProject: { current: project },
    storyContext, activeRequest: { current: null }, AbortController,
    setBusyPosition() {}, setNotices(fn) { notices = fn(notices); }, setDrafts(fn) { drafts = fn(drafts); },
    graphicNovelTextSourceKey: () => 'source-current',
    fetch: async (url, options) => {
      if (url === '/api/auth/profile') return Response.json({ authenticated: true, csrfToken: 'test-csrf' });
      assert.equal(url, '/api/previs/narration', 'no image URL may be fetched');
      assert.equal(options.headers['X-PlotPickle-CSRF'], 'test-csrf');
      submitted = JSON.parse(options.body);
      const validated = storyboardNarrationRequest(submitted);
      return Response.json({ ok: true, panels: parseStoryboardNarration(output(), validated) });
    },
  });
  vm.runInContext(executable, context);
  await context.generateNarration({ position: 19, narration: evidence.panels[0].intention }, shot);
  assert.equal(submitted.mode, 'storyboard-shot');
  assert.deepEqual(submitted.shot, shot);
  assert.equal('contactSheet' in submitted, false);
  assert.equal(drafts[19].narration, 'Ren hesitates before taking the next step.');
  assert.match(notices[19], /Human review/);
});

test('#2839 actual narration endpoint sends text to the agent and distinguishes compute from invalid output', async (t) => {
  const original = await readFile('app/api/previs/narration/route.ts', 'utf8');
  for (const [name, ending] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    await t.test(name, async () => {
      const source = original.replace(/\r?\n/gu, ending);
      const executable = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gmu, '')).replace(/\bexport /gu, '');
      const contract = await import('../core/media/previs-narration.mjs');
      let sent, failCompute = false, reply = output();
      const context = vm.createContext({
        ...contract, Error, Response, URL,
        withAuthenticatedProfileRequest: async (_request, fn) => fn(),
        getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
        requestBoundary: request => request,
        resolveConfiguredAgentExecutionProfile: async () => ({ profile: { model: 'text-only-fixture' } }),
        askPlotPickleAgent: async args => { sent = args; if (failCompute) throw new Error('offline'); return reply; },
      });
      vm.runInContext(executable, context);
      const request = value => new Request('http://localhost/api/previs/narration', { method: 'POST', body: JSON.stringify(value) });
      const response = await context.POST(request(evidence));
      assert.equal(response.status, 200);
      assert.equal('image' in sent, false, 'text route must not require vision support');
      assert.match(sent.message, /TEXT ONLY/);
      failCompute = true;
      assert.equal((await (await context.POST(request(evidence))).json()).code, 'TEXT_COMPUTE_UNAVAILABLE');
      failCompute = false; reply = output('', [{ speaker: 'REN', text: 'An invented line.' }]);
      assert.equal((await (await context.POST(request(evidence))).json()).code, 'INVALID_NARRATION_OUTPUT');
      const legacy = { ...evidence, mode: undefined, contactSheet: 'data:image/jpeg;base64,/9j/2Q==' };
      reply = output();
      assert.equal((await context.POST(request(legacy))).status, 200);
      assert.ok(sent.image instanceof Uint8Array, 'existing Previs image route remains visual');
    });
  }
});

test('#2839 changed narration product owners select the Windows rendered approval proof', async () => {
  const source = await readFile('.github/workflows/architecture-shadow.yml', 'utf8');
  const scope = source.slice(source.indexOf('  windows-product-scope:'), source.indexOf('  windows-product-proof:'));
  const selectors = [...scope.matchAll(/grep -Eq '([^']+)'; then (\w+)=true;/gu)].map(match => ({ lane: match[2], pattern: new RegExp(match[1]) }));
  for (const path of ['app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'app/api/previs/narration/route.ts', 'core/media/previs-narration.mjs']) {
    assert.deepEqual(selectors.filter(({ pattern }) => pattern.test(path)).map(({ lane }) => lane), ['build']);
  }
});

test('PP-NARR-001 B2: Storyboard uses the ready LOCAL writer without requiring a Hybrid selection', async () => {
  // Executed endpoint-boundary negative proof. The first version is expected RED:
  // existing code resolves a Hybrid route even when a verified local writer exists.
  // This verifies dispatch authority, NOT real model capability or pixel understanding.
  const route = await readFile('app/api/previs/narration/route.ts', 'utf8');
  const compiled = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, '')).replace(/\bexport /gu, '');
  const calls = [];
  const context = vm.createContext({
    Error, Response, URL, ...await import('../core/media/previs-narration.mjs'),
    withAuthenticatedProfileRequest: async (_req, next) => next(),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: req => req,
    resolveConfiguredAgentExecutionProfile: async () => {
      calls.push('hybrid');
      throw new Error('Hybrid writing route is OFF despite ready LOCAL writer');
    },
    resolveConfiguredLocalNarrationProfile: async () => {
      calls.push('local');
      return { profile: { provider: 'local', textModel: 'ready-local-fixture' } };
    },
    askPlotPickleAgent: async (params) => {
      calls.push('model');
      assert.equal(params.profile.provider, 'local');
      assert.equal('image' in params, false, 'text-only Local works without unproven vision');
      return output();
    },
  });
  vm.runInContext(compiled, context);
  const response = await context.POST(new Request('http://127.0.0.1:3000/api/previs/narration', {
    method: 'POST', body: JSON.stringify(evidence),
  }));
  assert.equal(response.status, 200, 'local narration should not be blocked by an unrelated Hybrid OFF state');
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.deepEqual(calls, ['local', 'model'], 'Storyboard must use exactly the local route and not switch to Hybrid or Cloud');
  assert.equal(json.panels[0].narration, 'Ren hesitates before taking the next step.');
});
