import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Windows full-check launcher describes the current verification surface', async () => {
  const launcher = await read('Run-PlotPickle-Full-Check.bat');

  assert.match(launcher, /architecture, curriculum, the production build, local AI\/Pi/i);
  assert.match(launcher, /BUZZ, visual UI\/UX UAT, and the Writer-in-Residence journey/i);
  assert.match(launcher, /run-plotpickle-full-check\.ps1/i);
});

test('full verification runner keeps all nine stages in the intended order', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');
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

  let previous = -1;
  for (const stage of stages) {
    const index = runner.indexOf(stage);
    assert.ok(index > previous, `${stage} should appear after the previous full-check stage`);
    previous = index;
  }
});

test('full verification executes architecture, curriculum, build, Pi, BUZZ, visual UAT and writer checks', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');

  assert.match(runner, /\.\\scripts\\agent-skills\.mjs", "--self-test/);
  assert.match(runner, /\.\\tests\\sage-brinewick-agent-skill\.test\.mjs/);
  assert.match(runner, /\.\\tests\\issue-913-agent-skills-migration\.test\.mjs/);
  assert.match(runner, /"run", "validate:learn"/);
  assert.match(runner, /"run", "build"/);
  assert.match(runner, /ensure-local-repair-model\.mjs", "--worker", "pi"/);
  assert.match(runner, /run-uat-repair-agent\.mjs", "--worker", "pi", "--preflight", "--require-ready"/);
  assert.match(runner, /verify-buzz-live-activity\.mjs/);
  assert.match(runner, /run-exhaustive-ui-uat\.mjs", "--github-report"/);
  assert.match(runner, /run-writer-in-residence\.mjs", "--github-report"/);
});

test('browser-dependent checks become explicitly blocked when PlotPickle cannot start', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');

  assert.match(runner, /7 of 9 - Verify BUZZ live activity/);
  assert.match(runner, /8 of 9 - Exhaustive code-aware UI and UX UAT/);
  assert.match(runner, /9 of 9 - Writer-in-Residence/);
  assert.match(runner, /Add-Result \$BlockedStep\.Name \$BlockedStep\.Category "BLOCKED"/);
  assert.match(runner, /complete child-process output above is part of this same log/i);
});

test('final summary uses plain-language verification categories', async () => {
  const runner = await read('scripts/run-plotpickle-full-check.ps1');

  for (const category of [
    'Architecture',
    'Curriculum',
    'Production Build',
    'Local AI / Pi',
    'BUZZ',
    'Visual UAT',
    'Writer Journey',
  ]) {
    assert.match(runner, new RegExp(`"${category.replace('/', '\\/')}"`));
  }

  assert.match(runner, /Write-Section "FINAL SUMMARY"/);
  assert.match(runner, /\$GroupStatus = "PASS"/);
  assert.match(runner, /\$GroupStatus = "BLOCKED"/);
  assert.match(runner, /\$GroupStatus = "FAIL"/);
});
