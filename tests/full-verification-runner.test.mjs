import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Windows full-check launcher describes the current verification surface', async () => {
  const launcher = await read('Run-PlotPickle-Full-Check.bat');

  assert.match(launcher, /architecture, curriculum, the production build, local AI\/Pi/i);
  assert.match(launcher, /BUZZ, visual UI\/UX UAT, and the Writer-in-Residence journey/i);
  assert.match(launcher, /run-plotpickle-full-check\.ps1/i);
  assert.match(launcher, /Deterministic checks own PASS\/FAIL/i);
  assert.match(launcher, /--github-report/);
  assert.match(launcher, /--repair/);
  assert.match(launcher, /--retest-of/);
});

test('full verification preserves the same nine authoritative stages in canonical order', async () => {
  const [runner, graph] = await Promise.all([
    read('scripts/run-plotpickle-full-check.ps1'),
    read('scripts/full-verification-graph.mjs'),
  ]);
  const stages = [
    '1 of 9 - Agent Skills registry',
    '2 of 9 - Agent Skills architecture boundaries',
    '3 of 9 - LEARN curriculum validation',
    '4 of 9 - Production build',
    '5 of 9 - Ensure Pi local repair model',
    '6 of 9 - Pi repair preflight',
    '7 of 9 - Verify BUZZ live activity',
    '8 of 9 - Exhaustive code-aware UI and UX UAT',
    '9 of 9 - Writer-in-Residence',
  ];

  for (const source of [runner, graph]) {
    let previous = -1;
    for (const stage of stages) {
      const index = source.indexOf(stage);
      assert.ok(index > previous, `${stage} should appear after the previous full-check stage`);
      previous = index;
    }
  }
});

test('full verification graph executes architecture, curriculum, build, Pi, BUZZ, UI/UX UAT and writer checks', async () => {
  const graph = await read('scripts/full-verification-graph.mjs');

  assert.match(graph, /scripts\/agent-skills\.mjs", "--self-test/);
  assert.match(graph, /tests\/sage-brinewick-agent-skill\.test\.mjs/);
  assert.match(graph, /tests\/issue-913-agent-skills-migration\.test\.mjs/);
  assert.match(graph, /args: \["run", "validate:learn"\]/);
  assert.match(graph, /args: \["run", "build"\]/);
  assert.match(graph, /scripts\/ensure-local-repair-model\.mjs", "--worker", "pi"/);
  assert.match(graph, /scripts\/run-uat-repair-agent\.mjs", "--worker", "pi", "--preflight", "--require-ready"/);
  assert.match(graph, /scripts\/verify-buzz-live-activity\.mjs/);
  assert.match(graph, /scripts\/run-exhaustive-ui-uat\.mjs/);
  assert.match(graph, /scripts\/run-writer-in-residence\.mjs/);
  assert.doesNotMatch(graph, /run-exhaustive-ui-uat\.mjs", "--github-report"/);
  assert.doesNotMatch(graph, /run-writer-in-residence\.mjs", "--github-report"/);
});

test('PowerShell delegates deterministic execution to one host-owned graph and materializes its stage array', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');

  assert.match(runner, /full-verification-graph\.mjs/);
  assert.match(runner, /\$StageRecords\s*=\s*@\(\$Graph\.stages\)/);
  assert.match(runner, /Add-Result \(\[string\]\$Stage\.Step\)/);
  assert.doesNotMatch(runner, /Invoke-NodeStep|Invoke-NpmStep/);
});

test('structured Verification Inbox payload materializes generic stage results as a plain object array', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');

  assert.match(runner, /\$StageRecords\s*=\s*\[object\[\]\]\(\$Results\s*\|\s*ForEach-Object\s*\{\s*\$_\s*\}\)/);
  assert.match(runner, /stages\s*=\s*\$StageRecords/);
  assert.doesNotMatch(runner, /stages\s*=\s*@\(\$Results\)/);
});

test('deterministic result is saved before advisory orchestration and BUZZ lifecycle reporting', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');
  const record = runner.indexOf('$RunId = Write-StructuredVerificationRecord');
  const orchestration = runner.indexOf('Invoke-VerificationOrchestrator $RunId');
  assert.ok(record >= 0 && orchestration > record);
  assert.match(runner, /verification-orchestrator\.mjs/);
  assert.match(runner, /verification-buzz-lifecycle\.mjs/);
  assert.match(runner, /BUZZ lifecycle delivery was unavailable; the deterministic verification result is unchanged/);
});

test('browser-dependent checks use app readiness as a real success dependency and preserve explicit BLOCKED results', async () => {
  const [runner, graph] = await Promise.all([
    read('scripts/run-plotpickle-full-check.ps1'),
    read('scripts/full-verification-graph.mjs'),
  ]);

  for (const id of ['buzz-live', 'exhaustive-uat', 'writer-in-residence']) {
    const start = graph.indexOf(`id: "${id}"`);
    const section = graph.slice(start, start + 900);
    assert.match(section, /dependencies: \[\{ id: "app-ready", require: "success" \}\]/);
  }
  assert.match(graph, /status: "BLOCKED"/);
  assert.match(runner, /Verification graph omitted this authoritative stage/);
  assert.match(runner, /complete child-process output above is part of this same log/i);
});

test('final summary uses plain-language verification categories without conflating control UAT with visual review', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');

  for (const category of [
    'Architecture',
    'Curriculum',
    'Production Build',
    'Local AI / Pi',
    'BUZZ',
    'UI / UX UAT',
    'Writer Journey',
  ]) {
    assert.match(runner, new RegExp(`"${category.replace('/', '\\/')}"`));
  }

  assert.doesNotMatch(runner, /"Visual UAT"/);
  assert.match(runner, /Write-Section "FINAL SUMMARY"/);
  assert.match(runner, /\$GroupStatus = "PASS"/);
  assert.match(runner, /\$GroupStatus = "BLOCKED"/);
  assert.match(runner, /\$GroupStatus = "FAIL"/);
});
