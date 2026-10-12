import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
// PP-NARR-001 B6 runs in the existing Windows narration gate, not only as an unselected new test file.
import './issue-2855-bubble-source-identity.test.mjs';
import './issue-2930-single-shot-narration.test.mjs';
import './issue-2907-narration-overall-story.test.mjs';
import './issue-2909-narration-storytelling-skill.test.mjs';
import './issue-2841-local-writing-truth.test.mjs';
import { storyboardNarrationRequest, storyboardNarrationPrompt, storyboardShotBriefRequest, storyboardShotBriefPrompt, parseStoryboardShotBrief, parseStoryboardNarration, narrationRequest, storyboardNarrationOutputFailure } from '../core/media/previs-narration.mjs';
import { prepareStoryboardNarrationSequence, screenplayFormattingDirective, storyboardNarrationAuthoredIntention } from '../core/media/storyboard-sequence-evidence.mjs';

const storyContext = { title: 'Afterglow', act: 1, block: 1, miniBlock: 1, blockTitle: 'Opening', dramaticResponsibility: 'Establish the dilemma.' };
const passages = [{ type: 'character', text: 'REN' }, { type: 'parenthetical', text: '(quietly)' }, { type: 'dialogue', text: 'We should go. Before they return.' }, { type: 'character', text: 'AVA' }, { type: 'dialogue', text: 'Wait for me.' }];
const shot = { story: 'Ren hesitates at the door.', sceneBeat: 'Scene 1: hesitation', camera: 'Close-up', performance: 'Still', lighting: 'Low', timing: '3s authored', informationBoundary: 'withhold: destination', continuity: 'Exit to corridor', imagePrompt: 'Black-and-white frame, close on Ren at the doorway.' };
const sequenceShots = Array.from({ length: 25 }, (_, i) => ({ position: i + 1, intention: 'Authored moment for image ' + (i + 1) }));
const evidence = { mode: 'storyboard-shot', storyContext, passages, sequence: { selectedPosition: 19, shots: sequenceShots }, panels: [{ position: 19, intention: 'Ren pauses at the door.' }], shot };
const input = storyboardNarrationRequest(evidence);
const output = (narration = 'Ren hesitates before taking the next step.', bubbles = []) => JSON.stringify({ panels: [{ position: 19, narration, bubbles }] });

test('#2839 text-only Shot evidence includes every authored fact without image input', () => {
  assert.equal('image' in input, false);
  assert.equal('contactSheet' in input, false);
  assert.equal(input.shot.imagePrompt, shot.imagePrompt);
  const prompt = storyboardNarrationPrompt(input);
  for (const fact of Object.values(shot)) assert.ok(prompt.includes(fact));
  assert.ok(prompt.includes(passages[2].text));
  assert.throws(() => storyboardNarrationRequest({ ...evidence, contactSheet: 'data:image/jpeg;base64,AAAA' }), /text-only/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, image: [] }), /text-only/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, panels: [...evidence.panels, { position: 20, intention: '' }] }), /one locked Shot/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, shot: { ...shot, camera: null } }), /Shot evidence/);
  assert.throws(() => storyboardNarrationRequest({ ...evidence, shot: { ...shot, imagePrompt: 'x'.repeat(8_001) } }), /Shot evidence: imagePrompt/);
  assert.throws(() => narrationRequest({ ...evidence, mode: undefined }), /contact sheet/);
});

test('#2839 the Shot brief analyzes one selected Shot and returns only bounded missing-field proposals', () => {
  const briefInput = storyboardShotBriefRequest({
    ...evidence,
    mode: 'storyboard-shot-brief',
    shot: { ...shot, story: '', camera: '' },
  });
  const prompt = storyboardShotBriefPrompt(briefInput);
  assert.match(prompt, /review material, not saved Shot canon/u);
  assert.match(prompt, /never claim to have viewed or describe the locked image/u);
  assert.match(prompt, /Only these currently missing fields/u);
  assert.ok(prompt.includes(shot.imagePrompt));
  const proposals = Object.fromEntries(['story', 'sceneBeat', 'camera', 'performance', 'lighting', 'timing', 'informationBoundary', 'continuity', 'imagePrompt'].map((field) => [field, '']));
  proposals.story = 'Ren weighs the risk of leaving.';
  proposals.camera = 'Close framing from the doorway.';
  proposals.lighting = 'Must not overwrite authored lighting.';
  proposals.imagePrompt = 'A proposed text prompt.';
  const parsed = parseStoryboardShotBrief(JSON.stringify({ analysis: 'Ren faces a choice before the exit.', proposals }), briefInput);
  assert.equal(parsed.analysis, 'Ren faces a choice before the exit.');
  assert.equal(parsed.proposals.story, proposals.story);
  assert.equal(parsed.proposals.camera, proposals.camera);
  assert.equal(parsed.proposals.lighting, '', 'authored facts cannot be replaced by a proposal');
  assert.equal(parsed.proposals.imagePrompt, '', 'an existing saved prompt cannot be overwritten by a proposal');
  const missingPromptInput = storyboardShotBriefRequest({ ...evidence, mode: 'storyboard-shot-brief', shot: { ...shot, imagePrompt: '' } });
  const missingPromptBrief = parseStoryboardShotBrief(JSON.stringify({ analysis: 'The prompt is missing.', proposals }), missingPromptInput);
  assert.equal(missingPromptBrief.proposals.imagePrompt, proposals.imagePrompt, 'a missing prompt may be proposed for review');
  assert.throws(() => parseStoryboardShotBrief(JSON.stringify({ analysis: 'x', proposals: { ...proposals, extra: 'not allowed' } }), briefInput), /proposals are invalid/u);
  assert.throws(() => storyboardShotBriefRequest({ ...evidence, mode: 'storyboard-shot-brief', image: [] }), /text-only/u);
});

test('#2855 Human Shot 13 and 20 have shot-specific output examples and no invented speech placeholders', () => {
  for (const position of [1, 13, 20, 25]) {
    const request = storyboardNarrationRequest({
      ...evidence,
      sequence: { ...evidence.sequence, selectedPosition: position },
      panels: [{ position, intention: '' }],
      shot: { ...shot, story: '', sceneBeat: '' },
    });
    const prompt = storyboardNarrationPrompt(request);
    assert.match(prompt, new RegExp('"position":' + position + ',"narration":"","bubbles":\\[\\]'),
      'the JSON shape must always use the REAL selected Shot, never a hard-coded 1');
    const instruction = prompt.slice(0, prompt.indexOf('Evidence: '));
    if (position !== 1) assert.doesNotMatch(instruction, /"position":1[},]/u,
      'a later Shot must not be biased toward Shot 1 by a worked example (the evidence still lists all 25 positions)');
    assert.doesNotMatch(prompt, /"speaker":"NAME"|"text":"ACTUAL DIALOGUE"/u,
      'the schema must not invite invented dummy dialogue and made-up speakers');
    assert.match(prompt, /actual speaker and an exact contiguous screenplay quotation/u);
    assert.match(prompt, /without an authored source-to-Shot association/u);
    assert.throws(() => parseStoryboardNarration(
      JSON.stringify({ panels: [{ position: position === 1 ? 20 : 1, narration: 'Wrong Shot.', bubbles: [] }] }),
      request), /invalid narration pacing or positions/i,
      'wrong Shot must still fail closed: do not silently relabel a model output');
    assert.throws(() => parseStoryboardNarration(
      JSON.stringify({ panels: [{ position, narration: '', bubbles: [{ speaker: 'NAME', text: 'ACTUAL DIALOGUE' }] }] }),
      request), /unsupported speaker/i,
      'plausible-looking dummy speech must still be rejected');
  }
});

test('#2839 short output, silence, exact dialogue and actual speaker are enforced', () => {
  assert.equal(parseStoryboardNarration(output(), input)[0].position, 19);
  assert.throws(() => parseStoryboardNarration(output('', []), input), /empty narration output/i,
    'a structurally valid but empty model result must enter the bounded correction path');
  assert.equal(parseStoryboardNarration(output('', [{ speaker: 'REN', text: 'Before they return.' }]), input)[0].bubbles[0].text, 'Before they return.');
  for (const invalid of [
    output('one two three four five six seven eight nine ten eleven twelve thirteen'),
    output('x'.repeat(101)),
    output('Ren hesitates at the doorway.', [{ speaker: 'REN', text: 'We should go.' }]),
    output('', [{ speaker: 'REN', text: 'We should go. Before they return. We should go. Before they return. We should go.' }]),
    output('', [{ speaker: 'REN', text: 'We must go.' }]),
    output('', [{ speaker: 'AVA', text: 'We should go.' }]),
    output('', [{ speaker: 'REN', text: 'we should go!' }]),
    output('', [{ speaker: 'INVENTED', text: 'We should go.' }]),
    JSON.stringify({ panels: [{ position: 1, narration: '', bubbles: [] }] }),
  ]) assert.throws(() => parseStoryboardNarration(invalid, input));
});

test('#2922 empty structured narration receives one bounded correction on the same locked Shot and local model', async () => {
  const route = await readFile('app/api/previs/narration/route.ts', 'utf8');
  const source = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, '')).replace(/\bexport /gu, '');
  let calls = 0;
  const lockedWriter = { provider: 'local', textModel: 'verified-local-fixture' };
  const context = vm.createContext({
    Error, Response, URL, ...await import('../core/media/previs-narration.mjs'),
    withAuthenticatedProfileRequest: async (_request, callback) => callback(),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: request => request,
    resolveConfiguredLocalNarrationProfile: async () => ({ profile: lockedWriter }),
    resolveConfiguredAgentExecutionProfile: async () => { throw new Error('wrong provider'); },
    askPlotPickleAgent: async args => {
      calls++;
      assert.equal(args.outputFormat.kind, 'storyboard-narration');
      assert.equal(args.outputFormat.position, 19);
      assert.equal(args.profile, lockedWriter, 'correction must keep the selected local writer');
      assert.match(args.message, /Ren hesitates at the door/u, 'correction must reuse the same authored Shot evidence');
      if (calls === 1) return output('', []);
      assert.match(args.message, /FORMAT CORRECTION:.*EMPTY_NARRATION_OUTPUT/su);
      return output('Ren pauses before stepping into the corridor.');
    },
  });
  vm.runInContext(source, context);
  const result = await context.POST(new Request('http://localhost/api/previs/narration', { method: 'POST', body: JSON.stringify(evidence) }));
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.repaired, true);
  assert.equal(body.panels[0].narration, 'Ren pauses before stepping into the corridor.');
  assert.equal(calls, 2, 'empty output gets one correction, never an unbounded retry');
});

test('#2922 invalid dialogue correction requests one short caption on the same Shot', async () => {
  const route = await readFile('app/api/previs/narration/route.ts', 'utf8');
  const source = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, '')).replace(/\bexport /gu, '');
  let calls = 0;
  const context = vm.createContext({
    Error, Response, URL, ...await import('../core/media/previs-narration.mjs'),
    withAuthenticatedProfileRequest: async (_request, callback) => callback(),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: request => request,
    resolveConfiguredLocalNarrationProfile: async () => ({ profile: { provider: 'local', textModel: 'verified-local-fixture' } }),
    resolveConfiguredAgentExecutionProfile: async () => { throw new Error('wrong provider'); },
    askPlotPickleAgent: async args => {
      calls++;
      assert.equal(args.outputFormat.kind, 'storyboard-narration');
      assert.equal(args.outputFormat.position, 19);
      if (calls === 1) return output('', [{ speaker: 'REN', text: 'This line is not in the supplied screenplay.' }]);
      assert.match(args.message, /Do not use dialogue bubbles/u);
      assert.match(args.message, /complete scene caption/u);
      assert.match(args.message, /twelve words and one hundred characters/u);
      return output('Ren pauses before the open door.');
    },
  });
  vm.runInContext(source, context);
  const result = await context.POST(new Request('http://localhost/api/previs/narration', { method: 'POST', body: JSON.stringify(evidence) }));
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.repaired, true);
  assert.equal(body.panels[0].narration, 'Ren pauses before the open door.');
  assert.equal(calls, 2);
});

test('#2839 actual Storyboard first step creates a review-only brief for the selected Shot', async () => {
  const source = await readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8');
  const start = source.indexOf('  async function prepareShotBrief(');
  const end = source.indexOf('  async function generateNarration(', start);
  assert.ok(start > -1 && end > start);
  const executable = stripTypeScriptTypes(source.slice(start, end));
  let briefs = {}, submitted;
  const context = vm.createContext({
    busyPosition: null, authoredSequencePassages: passages, sequenceShots,
    prepareStoryboardNarrationSequence, storyboardNarrationAuthoredIntention, storyContext,
    activeRequest: { current: null }, AbortController,
    setBusyPosition() {}, setNotices() {}, setDrafts() {}, setShotBriefs(fn) { briefs = fn(briefs); },
    storyboardShotBriefRequest, parseStoryboardShotBrief,
    fetch: async (url, options) => {
      if (url === '/api/auth/profile') return Response.json({ authenticated: true, csrfToken: 'test-csrf' });
      submitted = JSON.parse(options.body);
      assert.equal(options.headers['X-PlotPickle-CSRF'], 'test-csrf');
      assert.equal('contactSheet' in submitted, false);
      const validated = storyboardShotBriefRequest(submitted);
      const proposals = Object.fromEntries(['story','sceneBeat','camera','performance','lighting','timing','informationBoundary','continuity','imagePrompt'].map((field) => [field, '']));
      proposals.story = 'A reviewable choice proposal.';
      return Response.json({ ok: true, shotBrief: parseStoryboardShotBrief(JSON.stringify({ analysis: 'The character weighs a choice.', proposals }), validated) });
    },
  });
  vm.runInContext(executable, context);
  const missingFacts = { ...shot, story: '' };
  await context.prepareShotBrief({ position: 19, narration: 'Ren pauses at the door.' }, missingFacts);
  assert.equal(submitted.mode, 'storyboard-shot-brief');
  assert.equal(submitted.panels[0].position, 19);
  assert.equal(briefs[19].analysis, 'The character weighs a choice.');
  assert.equal(briefs[19].facts.story, proposalsStory());
  assert.match(briefs[19].facts.imagePrompt, /Black-and-white/u, 'the saved prompt stays available as text evidence');
  function proposalsStory() { return 'A reviewable choice proposal.'; }
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
    authoredSequencePassages: passages,
    sequenceShots,
    prepareStoryboardNarrationSequence, storyboardNarrationAuthoredIntention,
    storyContext, activeRequest: { current: null }, AbortController,
    setBusyPosition() {}, setNotices(fn) { notices = fn(notices); }, setDrafts(fn) { drafts = fn(drafts); },
    currentApproval: () => ({sourceKey: 'source-current'}),
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
  const reviewedBrief = { analysis: 'The selected moment is a choice.', facts: shot };
  await context.generateNarration({ position: 19, narration: evidence.panels[0].intention }, shot, reviewedBrief);
  assert.equal(submitted.mode, 'storyboard-shot');
  assert.equal(submitted.shotAnalysis, reviewedBrief.analysis);
  assert.deepEqual(submitted.shot, shot);
  assert.equal(submitted.passages.length, passages.length, 'writer sees the full ordered dramatic sequence');
  assert.equal(submitted.passages[0].text, 'REN');
  assert.equal(submitted.passages.at(-1).text, 'Wait for me.');
  assert.equal(submitted.sequence.shots.length, 25, 'every authored Shot is available for sequencing');
  assert.equal(submitted.sequence.selectedPosition, 19);
  assert.equal('contactSheet' in submitted, false);
  assert.equal(drafts[19].narration, 'Ren hesitates before taking the next step.');
  assert.match(notices[19], /review/);
});

test('#2855 sequence evidence excludes FADE IN and preserves sparse-story order across 25 images', async () => {
  const sparse = [
    { type: 'action', text: 'FADE IN:\nAmy watches the visitors approach.' },
    { type: 'scene-heading', text: 'INT. BBT TECHNOLOGIES - DAY' },
    { type: 'character', text: 'AMY' },
    { type: 'dialogue', text: 'I have a question.' },
    { type: 'transition', text: 'CUT TO:' },
    { type: 'action', text: 'The monitoring light flickers.' },
  ];
  const shots = Array.from({ length: 25 }, (_, i) => ({
    position: i + 1,
    intention: i === 24 ? 'Amy chooses silence as the screen fades.' : 'Image ' + (i + 1) + ': human tension increases.',
  }));
  for (let i = 1; i <= 25; i++) {
    const prepared = prepareStoryboardNarrationSequence({ passages: sparse, shots, position: i });
    assert.equal(prepared.passages.length, 4, 'all authored story information, not arithmetic position windows');
    assert.deepEqual(prepared.passages.map(p => p.text),
      ['Amy watches the visitors approach.', 'AMY', 'I have a question.', 'The monitoring light flickers.']);
    assert.equal(prepared.sequence.selectedPosition, i);
    assert.equal(prepared.sequence.shots.length, 25);
    assert.match(prepared.sequence.shots[i - 1].intention, i === 25 ? /chooses silence/ : /Image/);
    assert.equal(prepared.sequence.shots[24].intention, shots[24].intention,
      'Shots 11–25 cannot automatically inherit the final screenplay line as their own moment');
  }
  const noDrama = [{ type: 'action', text: 'FADE IN:' }, { type: 'transition', text: 'CUT TO:' }];
  assert.throws(() => prepareStoryboardNarrationSequence({
    passages: noDrama,
    shots: shots.map(item => ({ ...item, intention: '' })),
    position: 11,
  }), /no authored dramatic context/i);
  assert.equal(screenplayFormattingDirective('FADE IN:'), true);
  assert.equal(screenplayFormattingDirective('CUT TO:'), true);
  assert.equal(screenplayFormattingDirective('Amy watches the visitors approach.'), false);
  const file = await readFile('app/_components/storyboard/storyboard-editorial-model.ts', 'utf8');
  const start = file.indexOf('export function storyboardNarrationSourcePassagesInStoryOrder');
  const end = file.indexOf('export function storyboardSourceEvidenceForAnchor', start);
  assert.ok(start > -1 && end > start);
  assert.doesNotMatch(file.slice(start, end), /\.sort\(/,
    'screenplay may not be reordered by opaque passage identifier for narration');
});

test('#2855 formatting-only output is a rejected draft, not comic dialogue or caption', () => {
  for (const caption of ['FADE IN', 'FADE IN:', 'CUT TO:', 'EXT. CITY - NIGHT', 'SCENE 23', 'FADE OUT.']) {
    assert.throws(() => parseStoryboardNarration(output(caption), input), /formatting/i, caption);
  }
  assert.equal(parseStoryboardNarration(output('Amy has a question, but waits.'), input)[0].narration,
    'Amy has a question, but waits.');
  assert.throws(() => storyboardNarrationRequest({ ...evidence, sequence: { selectedPosition: 12, shots: sequenceShots } }),
    /exact 25-Shot sequence/i, 'selected Shot is not interchangeable with another Shot');
  assert.throws(() => storyboardNarrationRequest({ ...evidence, sequence: { selectedPosition: 19, shots: sequenceShots.slice(0, 24) } }),
    /25-Shot sequence/i, 'partial sequence cannot masquerade as complete arc');
});

test('#2855 recovery provenance is never a Shot-story source and approved decisions are not rewritten', async () => {
  for (const position of [1, 3, 13, 15, 20, 25]) {
    assert.equal(storyboardNarrationAuthoredIntention('Recovered local Storyboard frame · position ' + String(position).padStart(2, '0')), '');
  }
  assert.equal(storyboardNarrationAuthoredIntention('Original Storyboard Image prompt unavailable for this image.'), '');
  assert.equal(storyboardNarrationAuthoredIntention('Amy hesitates before opening the door'), 'Amy hesitates before opening the door');
  const empty = Array.from({ length: 25 }, (_, i) => ({ position: i + 1, intention: 'Recovered local Storyboard frame · position ' + String(i + 1).padStart(2, '0') }));
  assert.throws(() => prepareStoryboardNarrationSequence({ passages: [], shots: empty, position: 20 }), /no authored dramatic context/i);
  const stage = prepareStoryboardNarrationSequence({ passages, shots: empty, position: 20 });
  assert.equal(stage.sequence.shots[19].intention, '', 'recovered description is not original per-shot story truth');
  assert.equal(stage.passages[0].text, 'REN', 'authored screenplay is still available when recovered images have no shot intent');
  const handoff = await readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8');
  assert.match(handoff, /storyboardNarrationAuthoredIntention\(artifact\.narrativeIntention\)/u);
  assert.match(handoff, /Scene context for this Mini-Block/u);
  assert.match(handoff, /Authored Mini-Block Beat context \(not assigned to this Shot\)/u);
  assert.match(handoff, /imagePrompt: artifact\.prompt\?\.trim\(\)/u);
  assert.doesNotMatch(handoff, /sceneBeat: compact\(\[shot\?\.narrativePurpose\]\)/u);
  assert.doesNotMatch(handoff, /sceneBeat: compact\(\[shot\?\.narrativePurpose, evidence\.responsibility\]/u);
  assert.match(handoff, /graphicNovelTextSourceKey\(panel, evidence\.passages, storyContext,/u,
    'existing approved source identities and storage must not be modified by prompt correction');
});

test('#2855 observed validation outcomes distinguish JSON, format, incomplete prose, quote and structure', () => {
  const examples = [
    [new SyntaxError('model output leaked private text'), 'OUTPUT_NOT_JSON'],
    [new Error('Screenplay formatting cannot be printed as a Graphic Novel caption.'), 'SCREENPLAY_FORMATTING'],
    [new Error('An unfinished caption fragment cannot be printed as a Graphic Novel caption.'), 'UNFINISHED_CAPTION'],
    [new Error('A speech bubble must quote actual dialogue by its screenplay speaker.'), 'DIALOGUE_NOT_IN_SCREENPLAY'],
    [new Error('Storyboard narration exceeds the 12-word / 100-character bubble limit.'), 'TEXT_TOO_LONG'],
    [new Error('One Shot may have either a scene caption or a dialogue bubble, not both.'), 'CAPTION_AND_DIALOGUE'],
    [new Error('The agent returned invalid narration pacing or positions.'), 'INVALID_SHOT_RESPONSE'],
    [new Error('Private unrecognized runtime content'), 'INVALID_MODEL_RESPONSE'],
  ];
  for (const [error, expected] of examples) {
    const failure = storyboardNarrationOutputFailure(error);
    assert.equal(failure.reason, expected);
    assert.equal(/model output leaked private text|Private unrecognized runtime content/iu.test(failure.message), false,
      'no raw model response or exception details may escape into the UI');
  }
  assert.throws(() => parseStoryboardNarration(output('In her quiet attic,'), input), /unfinished caption fragment/i,
    'an incomplete literary phrase cannot silently become a new approved panel');
  assert.equal(parseStoryboardNarration(output('Ren considers the decision.'), input)[0].narration, 'Ren considers the decision.',
    'complete short proposals remain available to Human review');
});

test('#2855 empty model text is reported as no proposal rather than silently suggesting approval', async () => {
  const source = await readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8');
  const start = source.indexOf('  async function generateNarration(');
  const end = source.indexOf('\n  return (', start);
  let notices = {}, drafts = {};
  const project = { id: 'afterglow' };
  const context = vm.createContext({
    busyPosition: null, evidence: { passages }, project, latestProject: { current: project },
    storyContext, activeRequest: { current: null }, AbortController,
    authoredSequencePassages: passages, sequenceShots, prepareStoryboardNarrationSequence, storyboardNarrationAuthoredIntention,
    setBusyPosition() {}, setNotices(fn) { notices = fn(notices); },
    setDrafts(fn) { drafts = fn(drafts); },
    currentApproval: () => ({ sourceKey: 'fixed-source' }),
    fetch: async (url) => url === '/api/auth/profile'
      ? Response.json({ authenticated: true, csrfToken: 'test' })
      : Response.json({ ok: true, panels: [{ position: 19, narration: '', bubbles: [] }] }),
  });
  vm.runInContext(stripTypeScriptTypes(source.slice(start, end)), context);
  await context.generateNarration({ position: 19, narration: 'Ren at the door' }, shot, { analysis: 'The selected moment is a choice.', facts: shot });
  assert.equal(Object.keys(drafts).length, 0, 'empty AI response is not a reviewable approved draft');
  assert.match(notices[19], /no printed text/i);
  assert.match(notices[19], /Regenerate/);
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
        resolveConfiguredLocalNarrationProfile: async () => ({ profile: { model: 'text-only-fixture', provider: 'local' } }),
        askPlotPickleAgent: async args => { sent = args; if (failCompute) throw new Error('offline'); return reply; },
      });
      vm.runInContext(executable, context);
      const request = value => new Request('http://localhost/api/previs/narration', { method: 'POST', body: JSON.stringify(value) });
      const response = await context.POST(request(evidence));
      assert.equal(response.status, 200);
      assert.equal('image' in sent, false, 'text route must not require vision support');
      assert.match(sent.message, /TEXT ONLY/);
      failCompute = true;
      assert.equal((await (await context.POST(request(evidence))).json()).code, 'LOCAL_WRITER_FAILED');
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

test('PP-NARR-001 duplicate Save & Lock clicks cannot race an encrypted write and No Bubble is not offered', async () => {
  const source = await readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8');
  const start = source.indexOf('  async function saveApproval(');
  const end = source.indexOf('  async function generateNarration(', start);
  assert.ok(start >= 0 && end > start, 'test the actual Storyboard Save & Lock handler');
  const executable = stripTypeScriptTypes(source.slice(start, end));
  let active = {
    id: 'afterglow', revision: 1,
    build: { foundations: { visualArtifacts: [{ id: 'locked-webp' }] } },
    production: { graphicNovelTextApprovals: [] },
  };
  const saving = [];
  const saveInFlight = { current: false };
  let notices = {}, drafts = { 1: { sourceKey: 'shot-source' } };
  let writes = 0;
  let release;
  const context = vm.createContext({
    saveInFlight, busyPosition: null,
    setSavingPosition(position) { saving.push(position); },
    setNotices(update) { notices = update(notices); },
    setDrafts(update) { drafts = update(drafts); },
    project: active, latestProject: { current: active }, anchorRef: 'block-1.1',
    lockedArtifacts: [{ position: 1, artifact: { id: 'locked-webp' } }],
    storyContext, evidence: { passages },
    graphicNovelTextSourceSnapshot: () => ({}),
    graphicNovelTextSourceKey: () => 'shot-source',
    loadFoundationProject: () => active,
    saveFoundationProjectDurably: async (next, expectedRevision) => {
      assert.equal(expectedRevision, active.revision);
      writes += 1;
      await new Promise(resolve => { release = resolve; });
      active = next;
      return next;
    },
    onProjectChange: () => {},
  });
  vm.runInContext(executable, context);
  const shot = { position: 1 };
  const first = context.saveApproval(shot, 'shot-source', 'One printed caption.', [], false);
  assert.equal(saveInFlight.current, true);
  assert.equal(writes, 1);
  assert.match(notices[1], /Saving the Bubble decision/u);
  const raced = context.saveApproval(shot, 'shot-source', 'One printed caption.', [], false);
  await raced;
  assert.equal(writes, 1, 'a duplicate Save & Lock cannot race the outstanding approval write');
  assert.equal(saving.filter(value => value === 1).length, 1);
  release();
  await first;
  assert.equal(saveInFlight.current, false);
  assert.equal(active.production.graphicNovelTextApprovals[0].noText, false);
  assert.match(notices[1], /saved and locked/u);
  assert.equal(saving.at(-1), null);
  const second = context.saveApproval(shot, 'shot-source', 'A reviewed replacement caption.', [], false);
  assert.equal(writes, 2, 'a new reviewed narration decision is allowed after the first readback');
  release();
  await second;
  assert.equal(active.production.graphicNovelTextApprovals[0].noText, false);
  assert.match(notices[1], /saved and locked/u);
  assert.equal(saveInFlight.current, false);
  assert.doesNotMatch(source, />\{savingPosition === position \? "Saving…" : "No Bubble"\}</u,
    'new No Bubble decisions are no longer offered in Storyboard');
  assert.match(source, /approvalState\.current\?\.noText[\s\S]*?No Bubble · Saved & Locked/u,
    'previously saved no-text decisions remain visible');
});

test('#2920 Storyboard local narration follows explicit Ollama but never silently uses a Cloud/Off route', async () => {
  const source = await readFile('build/writing-assistant-gateway.ts', 'utf8');
  const start = source.indexOf('export async function resolveConfiguredLocalNarrationProfile()');
  const end = source.indexOf('\n}', start);
  assert.ok(start > 0 && end > start, 'Local narration resolver is available');
  const fn = source.slice(start, end + 2).replace('export ', '');
  const selected = { text: 'ollama' };
  const local = { provider: 'local', textModel: 'quality-local' };
  const ollama = { provider: 'ollama', textModel: 'ollama-local', baseUrl: 'http://127.0.0.1:11434' };
  let attempted = [];
  const resolver = vm.runInNewContext('(' + fn + ')', {
    readCapabilityChoice: async () => selected,
    readSynchronizedAssistantStore: async () => ({ store: { profiles: { local, ollama } } }),
    profileForProvider: async (_store, provider) => { attempted.push(provider); return ollama; },
    probeOllama: async () => ({ reachable: true, models: ['ollama-local'] }),
    localTextExecutionProfile: async () => ({ textModel: 'quality-local' }),
    sameLocalWritingExecution: () => true,
    writingReadiness: () => ({ ready: true }),
    Error, Promise,
  });
  assert.equal((await resolver()).profile.provider, 'ollama');
  assert.deepEqual(attempted, ['ollama']);
  selected.text = 'off';
  assert.equal((await resolver()).profile.provider, 'local', 'approved local narration must work when Hybrid is Off');
  selected.text = 'openai';
  assert.equal((await resolver()).profile.provider, 'local', 'a cloud route may not receive the Storyboard prompt without new Human truth');
  assert.deepEqual(attempted, ['ollama'], 'no Cloud provider resolution or paid fallback');
});

test('#2920 narration and motion failures display actionable red provider diagnostic states', async () => {
  const [route, storyboard, storyboardCss, timeline, timelineCss] = await Promise.all([
    readFile('app/api/previs/narration/route.ts', 'utf8'),
    readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8'),
    readFile('app/_components/storyboard/storyboard-readiness-workspace.module.css', 'utf8'),
    readFile('app/_components/timeline/timeline-assembly-workspace.tsx', 'utf8'),
    readFile('app/_components/timeline/timeline-assembly-workspace.module.css', 'utf8'),
  ]);
  for (const stage of ['SESSION_AUTH', 'STORY_EVIDENCE', 'WRITING_PREFLIGHT', 'PROVIDER_EXECUTION', 'OUTPUT_VALIDATION']) {
    assert.ok(route.includes(stage), 'narration preserves precise failure stage: ' + stage);
  }
  assert.match(route, /route:profile\?\.provider/u);
  assert.match(storyboard, /data-narration-failure/u);
  assert.match(storyboard, /role=\{notices\[position\]\?\.startsWith/u);
  assert.match(storyboardCss, /\[data-narration-failure="true"\]/u);
  assert.match(storyboardCss, /var\(--pp-skin-danger\)/u);
  assert.match(timeline, /CAPABILITY_VERIFICATION/u);
  assert.match(timeline, /route=\$\{selected\}/u);
  assert.match(timeline, /OBSERVATION BLOCKED/u);
  assert.match(timeline, /JOB_RECEIPT_PERSISTENCE/u);
  assert.match(timeline, /data-motion-failure/u);
  assert.match(timelineCss, /\.failureDiagnostic/u);
  assert.match(timelineCss, /var\(--pp-skin-danger\)/u);
  assert.doesNotMatch(route, /return Response\.json\(\{.*apiKey/u);
});

test('#2920 Timeline recovers exact saved Storyboard Bubble fingerprints rather than marking them stale', async () => {
  const [storyboard, timeline] = await Promise.all([
    readFile('app/_components/preproduction/storyboard-locked-shot-handoff.tsx', 'utf8'),
    readFile('app/_components/timeline/timeline-assembly-workspace.tsx', 'utf8'),
  ]);
  assert.match(storyboard, /graphicNovelTextSourceKey\(panel, evidence\.passages, storyContext, graphicNovelTextSourceSnapshot\(project, anchorRef, panel\.position, artifact(?:, [^)]+)?\)\)/u);
  assert.match(timeline, /graphicNovelTextSourceKey,\s*graphicNovelTextSourceSnapshot/u);
  assert.match(timeline, /overallStory: narrationOverallStory\(project\)/u);
  assert.match(timeline, /graphicNovelTextSourceKey\(panel, evidence\.passages, storyContext, graphicNovelTextSourceSnapshot\(project, placement\.anchorRef, shotNumber, artifact, approval\.reviewedShotBrief\)\)/u);
  assert.doesNotMatch(timeline, /function graphicNovelTextSourceKey\(/u, 'Timeline must not implement a second incompatible Bubble fingerprint');
  assert.match(timeline, /timelinePresentationFor\(project, selectedPlacement, position\)/u, 'Timeline export uses the shared source identity');
});

test('#2922 invalid local narration JSON gets one bounded repair on the same locked Shot and local model', async () => {
  const route = await readFile('app/api/previs/narration/route.ts', 'utf8');
  const source = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, '')).replace(/\bexport /gu, '');
  let calls = 0;
  const lockedWriter = { provider: 'local', textModel: 'verified-local-fixture' };
  const context = vm.createContext({
    Error, Response, URL, ...await import('../core/media/previs-narration.mjs'),
    withAuthenticatedProfileRequest: async (_request, callback) => callback(),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: request => request,
    resolveConfiguredLocalNarrationProfile: async () => ({ profile: lockedWriter }),
    resolveConfiguredAgentExecutionProfile: async () => { throw new Error('wrong provider'); },
    askPlotPickleAgent: async args => {
      calls++;
      assert.equal(args.outputFormat.kind, 'storyboard-narration', 'local inference must use the structured narration contract');
      assert.equal(args.outputFormat.position, 19, 'the schema must target the exact selected Shot');
      assert.equal(args.profile, lockedWriter, 'retry must not switch to a cloud provider');
      assert.equal(args.agentId, 'graphic-novel');
      assert.match(args.message, /Ren hesitates at the door/u, 'same authored Storyboard evidence');
      if (calls === 1) return 'Sorry, here is my explanation, not JSON';
      assert.match(args.message, /FORMAT CORRECTION/u);
      assert.match(args.message, /"position":19/u);
      assert.doesNotMatch(args.message, /Sorry, here is my explanation/u, 'never echo previous model output');
      return output('Ren hesitates before taking the next step.');
    },
  });
  vm.runInContext(source, context);
  const req = () => new Request('http://localhost/api/previs/narration', { method: 'POST', body: JSON.stringify(evidence) });
  const result = await context.POST(req());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).repaired, true);
  assert.equal(calls, 2, 'one original inference and one bounded local correction');
});

test('#2922 repeated invalid local narration remains failed after one correction, with approved text unchanged', async () => {
  const route = await readFile('app/api/previs/narration/route.ts', 'utf8');
  const source = stripTypeScriptTypes(route.replace(/^import .*;\r?\n/gmu, '')).replace(/\bexport /gu, '');
  let calls = 0;
  const context = vm.createContext({
    Error, Response, URL, ...await import('../core/media/previs-narration.mjs'),
    withAuthenticatedProfileRequest: async (_request, callback) => callback(),
    getProfileExperienceRuntime: async () => ({ boundaryFor: () => ({ authorizeRequest: async () => {} }) }),
    requestBoundary: request => request,
    resolveConfiguredLocalNarrationProfile: async () => ({ profile: { provider: 'local' } }),
    askPlotPickleAgent: async args => {
      calls++;
      assert.equal(args.outputFormat.kind, 'storyboard-narration', 'initial and correction calls must use the structured narration contract');
      assert.equal(args.outputFormat.position, 19, 'the schema must target the exact selected Shot');
      return 'This is not JSON';
    },
  });
  vm.runInContext(source, context);
  const result = await context.POST(new Request('http://localhost/api/previs/narration', { method: 'POST', body: JSON.stringify(evidence) }));
  assert.equal(result.status, 502);
  const failure = await result.json();
  assert.equal(failure.code, 'INVALID_NARRATION_OUTPUT');
  assert.equal(failure.reason, 'OUTPUT_NOT_JSON');
  assert.equal(failure.priorReason, 'OUTPUT_NOT_JSON');
  assert.equal(failure.attempts, 2);
  assert.equal(calls, 2);
  assert.equal('panels' in failure, false, 'never manufacture accepted text');
});
