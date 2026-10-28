#!/usr/bin/env node
/**
 * #3302 — read-only immutable Git edition inventory for EXTERNAL F00 intake.
 * Not a reviewer, verifier, credential issuer, W8/W9 ADMIT, or catalogue writer.
 * Requires an independently trusted git executable and repository checkout.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const NORMATIVE = 'docs/white-papers/AI_Programming_Evolution_White_Paper.md';
const LANE_A_TESTS = Object.freeze([
  'tests/issue-3302-lane-a-admission-receipt.test.mjs',
  'tests/issue-3302-lane-a-automated-reviewer-cli.test.mjs',
  'tests/issue-3302-lane-a-automated-reviewer.test.mjs',
  'tests/issue-3302-lane-a-external-trust-bootstrap.test.mjs',
  'tests/issue-3302-lane-a-native-service-host.test.mjs',
  'tests/issue-3302-lane-a-reviewer-enrollment.test.mjs',
  'tests/issue-3302-lane-a-service-identity-policy.test.mjs',
  'tests/issue-3302-lane-a-signed-registrar-policy.test.mjs',
]);
const MAX_FILES = 512;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT = 24 * 1024 * 1024;

const deny = (code) => Object.freeze({
  schemaVersion: 'PP-F00-SOURCE-INTAKE-V1', state: 'BLOCKED', code,
  independentReview: false, signedAdmission: false, catalogueWriteAuthorized: false,
  windowsProductGate: false, modelInvoked: false, automaticMergeEnabled: false,
});

function parseArgs(args) {
  if (args.length !== 6 && args.length !== 8) return null;
  const result = Object.create(null);
  for (let i = 0; i < args.length; i += 2) {
    if (!['--head', '--base', '--scope', '--repo'].includes(args[i]) ||
        Object.hasOwn(result, args[i])) return null;
    result[args[i]] = args[i + 1];
  }
  if (!SHA.test(result['--head'] || '') || !SHA.test(result['--base'] || '') ||
      !['lane-a', 'coding'].includes(result['--scope']) ||
      (args.length === 8) !== Object.hasOwn(result, '--repo') ||
      result['--head'] === result['--base']) return null;
  if (result['--repo'] !== undefined &&
      (!path.isAbsolute(result['--repo']) || result['--repo'].length > 512)) return null;
  return result;
}

function isSafeRelativePath(p) {
  return typeof p === 'string' && p.length > 0 && p.length <= 512 &&
    !p.includes('\\') && !p.includes('\0') && !p.includes('\n') &&
    !p.startsWith('/') && !p.split('/').some(s => s === '.' || s === '..' || !s);
}

/** Git's immutable blob bytes, not a working tree view or a JSON assertion. */
export function buildSourceIntake({ root, head, base, scope, gitCommand = 'git' }) {
  if (!path.isAbsolute(root || '') || !SHA.test(head || '') ||
      !SHA.test(base || '') || head === base ||
      !['lane-a', 'coding'].includes(scope)) return deny('INVALID_EXACT_SOURCE_COORDINATES');
  const git = (...args) => execFileSync(gitCommand, ['-C', root, ...args], {
    timeout: 12_000, maxBuffer: MAX_OUTPUT, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    if (git('cat-file', '-t', head).toString('utf8').trim() !== 'commit' ||
        git('cat-file', '-t', base).toString('utf8').trim() !== 'commit')
      return deny('GIT_COORDINATES_NOT_COMMITS');
    git('merge-base', '--is-ancestor', base, head);

    // Git diff is NUL-delimited to avoid path-escape ambiguities. Changes
    // outside the reviewer's announced scope remain visible for inspection.
    const raw = git('diff', '--name-only', '-z', '--no-renames', base, head, '--');
    const names = raw.toString('utf8').split('\0').filter(Boolean);
    if (names.length < 1 || names.length > MAX_FILES ||
        new Set(names).size !== names.length ||
        !names.every(isSafeRelativePath)) return deny('CHANGED_PATH_SET_UNVERIFIABLE');

    function edition(p, { optional = false } = {}) {
      if (!isSafeRelativePath(p)) throw new Error('INVALID_GIT_PATH');
      let tree;
      try { tree = git('ls-tree', '-z', head, '--', p); }
      catch { if (optional) return { path: p, state: 'UNREADABLE_OR_DELETED' }; throw new Error('TREE_UNREADABLE'); }
      const str = tree.toString('utf8');
      const match = str.match(/^100(?:644|755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
      if (!match || match[2] !== p) {
        if (optional) return { path: p, state: 'DELETED_OR_NOT_REGULAR' };
        throw new Error('REQUIRED_FILE_MISSING_OR_UNSAFE');
      }
      const size = Number(git('cat-file', '-s', match[1]).toString('utf8').trim());
      if (!Number.isSafeInteger(size) || size > MAX_BYTES || size < 0)
        throw new Error('BLOB_SIZE_OUT_OF_BOUNDS');
      const bytes = git('cat-file', 'blob', match[1]);
      if (bytes.length !== size) throw new Error('GIT_BLOB_LENGTH_MISMATCH');
      return { path: p, state: 'PRESENT', gitBlob: match[1], sha256: sha256(bytes), bytes: size };
    }

    const sourceNormative = edition(NORMATIVE);
    // Compare actual normative blob objects, not a name or claimed version.
    const baseNormative = git('ls-tree', '-z', base, '--', NORMATIVE).toString('utf8');
    const norm = baseNormative.match(/^100(?:644|755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
    if (!norm || norm[2] !== NORMATIVE) return deny('BASE_NORMATIVE_NOT_PINNED');
    const normativeUnchanged = sourceNormative.gitBlob === norm[1];

    const mandatory = scope === 'lane-a' ? LANE_A_TESTS : [];
    const requiredTests = mandatory.map(p => edition(p));
    const changed = names.map(p => edition(p, { optional: true }));
    const changedTestPaths = names.filter(p => p.startsWith('tests/'));
    const unlistedLaneATests = scope === 'lane-a' ?
      changedTestPaths.filter(p => !LANE_A_TESTS.includes(p)) : [];
    const catalogueChanged = names.includes('config/verification/test-catalog.json');
    const requiredTestsPresent = requiredTests.length === mandatory.length &&
      requiredTests.every(x => x.state === 'PRESENT');
    const intakeComplete = normativeUnchanged && requiredTestsPresent &&
      unlistedLaneATests.length === 0 && changed.every(x => x.state === 'PRESENT');

    return Object.freeze({
      schemaVersion: 'PP-F00-SOURCE-INTAKE-V1',
      state: intakeComplete ? 'IMMUTABLE_INTAKE_READY' : 'BLOCKED_INTAKE_INCOMPLETE',
      scope, head, base, normative: sourceNormative,
      normativeBaseGitBlob: norm[1], normativeUnchanged,
      requiredTruthRefs: ['WHITE-PAPER-V3/W8', 'WHITE-PAPER-V3/W9'],
      requiredTestEditions: requiredTests, changedFileEditions: changed,
      unlistedTestChanges: unlistedLaneATests, protectedCatalogueChanged: catalogueChanged,
      changedFileCount: changed.length,
      independentReview: false, signedAdmission: false,
      catalogueWriteAuthorized: false, windowsProductGate: false,
      modelInvoked: false, automaticMergeEnabled: false,
      warning: 'READ_ONLY_AUTHOR_OR_EXTERNAL_INTAKE; independently rehash and review obligations; never treat this output as an ADMIT',
    });
  } catch {
    return deny('GIT_EDITION_READ_OR_ANCESTRY_UNVERIFIABLE');
  }
}

function main(args = process.argv.slice(2)) {
  const parsed = parseArgs(args);
  const response = parsed ? buildSourceIntake({
    root: path.resolve(parsed['--repo'] || process.cwd()),
    head: parsed['--head'], base: parsed['--base'], scope: parsed['--scope'],
  }) : deny('EXACT_ARGUMENTS_REQUIRED');
  process.stdout.write(JSON.stringify(response) + '\n');
  if (response.state !== 'IMMUTABLE_INTAKE_READY') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
