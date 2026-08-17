import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  loadAgentSkillRegistry,
  readAgentSkillProcedure,
  skillIndexResource,
} from '../scripts/agent-skills.mjs';
import {
  listProcedureConsumers,
  readBuzzGuildhallReportingProcedure,
  readPlanFoundationsProcedure,
  readProcedureForConsumer,
  readVisualQaProcedure,
  readWriterInResidenceProcedure,
} from '../scripts/agent-skill-procedures.mjs';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const migrated = [
  {
    id: 'plan-foundations',
    uri: 'skill://plotpickle/plan-foundations',
    entry: '.agents/skills/plan-foundations/SKILL.md',
    consumer: 'foundations-planner',
  },
  {
    id: 'writer-in-residence',
    uri: 'skill://plotpickle/writer-in-residence',
    entry: '.agents/skills/writer-in-residence/SKILL.md',
    consumer: 'writer-in-residence',
  },
  {
    id: 'visual-qa',
    uri: 'skill://plotpickle/visual-qa',
    entry: '.agents/skills/visual-qa/SKILL.md',
    consumer: 'visual-qa',
  },
  {
    id: 'buzz-guildhall-reporting',
    uri: 'skill://plotpickle/buzz-guildhall-reporting',
    entry: '.agents/skills/buzz-guildhall-reporting/SKILL.md',
    consumer: 'buzz-guildhall',
  },
];

test('issue 913 registers four stable progressively discoverable Agent Skills', async () => {
  const registry = await loadAgentSkillRegistry();
  assert.equal(registry.discovery, 'progressive');
  assert.equal(registry.transport, 'filesystem-first-mcp-resource-ready');

  for (const expected of migrated) {
    const entry = registry.skills.find((skill) => skill.id === expected.id);
    assert.ok(entry, `missing registry entry for ${expected.id}`);
    assert.equal(entry.uri, expected.uri);
    assert.equal(entry.entry, expected.entry);
    assert.deepEqual(entry.consumers, [expected.consumer]);
    assert.equal(entry.mcpReady, true);
    assert.equal(entry.localOnly, true);

    const source = await read(expected.entry);
    assert.match(source, new RegExp(`^---\\r?\\nname: ${expected.id}\\r?\\n`));
    assert.ok(source.includes(`uri: ${expected.uri}`));
    assert.match(source, /progressiveDisclosure: true/);
  }
});

test('host procedure loader exposes only the requested migrated procedure', async () => {
  assert.deepEqual(listProcedureConsumers().sort(), migrated.map(({ consumer }) => consumer).sort());

  const direct = [
    await readPlanFoundationsProcedure(),
    await readWriterInResidenceProcedure(),
    await readVisualQaProcedure(),
    await readBuzzGuildhallReportingProcedure(),
  ];

  for (const procedure of direct) {
    assert.ok(procedure.length > 200);
    assert.doesNotMatch(procedure, /^---/);
    assert.match(procedure, /Host responsibilities/i);
  }

  for (const expected of migrated) {
    assert.equal(await readProcedureForConsumer(expected.consumer), await readAgentSkillProcedure(expected.id));
  }

  assert.throws(() => readProcedureForConsumer('unknown-consumer'), /No PlotPickle Agent Skill is registered/);
});

test('PLAN skill drafts Foundations decisions but cannot own truth, mutation, routing, or progression', async () => {
  const procedure = await readPlanFoundationsProcedure();
  assert.match(procedure, /Preserve existing writer decisions/i);
  assert.match(procedure, /retrieved Foundations references/i);
  assert.match(procedure, /This skill proposes; it does not persist or approve/i);
  assert.match(procedure, /cannot save project state/i);
  assert.match(procedure, /cannot choose models or providers/i);
  assert.match(procedure, /must not create or operate later curriculum workspaces, Storyboard, or Previs/i);
});

test('Writer-in-Residence and Visual QA retain separate observation authority', async () => {
  const [writer, visual] = await Promise.all([
    readWriterInResidenceProcedure(),
    readVisualQaProcedure(),
  ]);

  assert.match(writer, /Avery never receives `browser_evaluate`/);
  assert.match(writer, /no repository, git, GitHub, project-state, provider-selection, or hidden browser authority/i);
  assert.match(writer, /Rendered-layout inspection belongs to the separate Visual QA observer/i);

  assert.match(visual, /use it only to confirm rendered layout facts/i);
  assert.match(visual, /cannot write product copy, mutate story or project state/i);
  assert.match(visual, /host owns browser and screenshot capture/i);
});

test('BUZZ skill reports minimum-necessary activity without becoming runtime or transport', async () => {
  const procedure = await readBuzzGuildhallReportingProcedure();
  assert.match(procedure, /BUZZ carries and displays reports; it is not the agent runtime/i);
  assert.match(procedure, /Remove credentials, secrets, private prompts, hidden reasoning, raw private content/i);
  assert.match(procedure, /Never claim that BUZZ received or delivered it until the host confirms transport success/i);
  assert.match(procedure, /host owns signed transport, identity, room permissions/i);
});

test('skills remain procedural packages rather than executable authority', async () => {
  const adapter = await read('scripts/agent-skill-procedures.mjs');
  assert.doesNotMatch(adapter, /fetch\(|writeFile|child_process|openai|anthropic|ollama|lm studio|github/i);

  for (const { entry } of migrated) {
    const source = await read(entry);
    assert.doesNotMatch(source, /OPENAI_API_KEY|ANTHROPIC_API_KEY|api\.openai\.com|api\.anthropic\.com|child_process|writeFile\(|fetch\(/i);
  }
});

test('progressive skill index and CLI self-test include the migration', async () => {
  const index = JSON.parse((await skillIndexResource()).text);
  for (const expected of migrated) {
    assert.ok(index.skills.some((skill) => skill.id === expected.id && skill.uri === expected.uri));
  }

  const result = spawnSync(process.execPath, ['scripts/agent-skills.mjs', '--self-test'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PlotPickle agent skills self-test PASS: 6 skill\(s\)/);
});
