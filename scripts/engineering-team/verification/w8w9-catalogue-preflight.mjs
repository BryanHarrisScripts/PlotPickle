/** #3302: read-only W8/W9 catalogue admission preflight. NOT an independent verifier. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

export const EDITION = Object.freeze({
  head: '0eb774a5a53ec86db883ee66d689e90ef9b8e186',
  targets: Object.freeze({
    'tests/issue-3142-authorized-coding-once.test.mjs':'ea63b55721289876da51926730410b8883d08b2059f1bbf67554bf199fcc1593',
    'tests/issue-3142-authorized-publish-once.test.mjs':'d454f937e9a1738a4095a66bdf1ea1f41490b6e63eb888ad45c248adf73f60b3',
    'tests/issue-3142-authorized-pr-publish-once.test.mjs':'f88668e025451d98edb97b8981c0a8fc14a12ee6d66967c436f0be97d8239eb3',
  }),
  inputs: Object.freeze({
    'scripts/engineering-team/gateway/authorized-coding-once.mjs':'c26fe53bc9758bf82b8a9be82c49518204a69324dd33c8521f6d0b7da2cfeda3',
    'scripts/engineering-team/gateway/publication/authorized-pr-publish-once.mjs':'020792fc88479ef0a156336a219d551a4657c1cbd4304ccab0d60befd8a2d47e',
    'scripts/engineering-team/gateway/receipts/atomic-coding-ownership.mjs':'2013cfd1015c4b53c600859075f0ec435a36521176085effe5ea129f4b05e9c4',
    'scripts/engineering-team/gateway/gateway-host.mjs':'17755df74f92130264bfe8f81f0496262accd57bf2218753f98031aeb652d7f8',
    'scripts/engineering-team/gateway/receipts/write-once-json.mjs':'e93a45ace974f9b53544b9544bd4e97eef6c475ec4f01ff77ef947c8d4316131',
  }),
});
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = (root, relative) => {
  if (!/^(tests|scripts)\/[a-z0-9./-]+\.mjs$/.test(relative) || relative.includes('..')) throw new Error('UNSAFE_PATH');
  const path = resolve(root, relative);
  if (!path.startsWith(resolve(root) + sep)) throw new Error('UNSAFE_PATH');
  return path;
};
export async function inspectEdition({root, head}) {
  if (head !== EDITION.head) return {status:'BLOCKED',code:'HEAD_MISMATCH',expectedHead:EDITION.head,observedHead:head};
  const mismatches=[];
  for (const [path, expected] of Object.entries({...EDITION.targets,...EDITION.inputs})) {
    try {
      const actual=digest(await readFile(safePath(root,path)));
      if (actual !== expected) mismatches.push({path,code:'DIGEST_MISMATCH',expected,actual});
    } catch (e) { mismatches.push({path,code:'READ_FAILED',errorCode:e.code||'UNKNOWN'}); }
  }
  let catalogue;
  try { catalogue=JSON.parse(await readFile(resolve(root,'config/verification/test-catalog.json'),'utf8')); }
  catch(e) { mismatches.push({path:'config/verification/test-catalog.json',code:'CATALOGUE_READ_FAILED',errorCode:e.code||'UNKNOWN'}); }
  const bindings=catalogue?.truthGovernance?.bindings;
  for (const [path, expected] of Object.entries(EDITION.targets)) {
    const binding=Array.isArray(bindings) ? bindings.filter(x=>x.target===path) : [];
    if (binding.length!==1) { mismatches.push({path,code:'BINDING_CARDINALITY',count:binding.length}); continue; }
    const b=binding[0];
    if (b.targetDigest!==expected) mismatches.push({path,code:'CATALOGUE_TARGET_STALE'});
    if (!Array.isArray(b.truthRefs) || !['W8','W9'].every(obligationId=>b.truthRefs.some(ref=>ref?.truthId==='WHITE-PAPER-V3' && ref?.obligationId===obligationId))) mismatches.push({path,code:'TRUTH_REFS_MISSING'});
    if (!Array.isArray(b.catalogueIds) || !b.catalogueIds.includes('agent.autonomous-factory-queue-3110')) mismatches.push({path,code:'CATALOGUE_ID_MISSING'});
    if (!Array.isArray(b.scopes) || !b.scopes.includes('unit-fixture')) mismatches.push({path,code:'SCOPE_MISSING'});
    const declared = new Map(Array.isArray(b.inputs) ? b.inputs.map(input=>[input.path,input.digest]) : []);
    const required = path.includes('authorized-coding-once')
      ? ['scripts/engineering-team/gateway/authorized-coding-once.mjs','scripts/engineering-team/gateway/receipts/atomic-coding-ownership.mjs']
      : path.includes('authorized-pr-publish-once')
        ? ['scripts/engineering-team/gateway/authorized-coding-once.mjs','scripts/engineering-team/gateway/publication/authorized-pr-publish-once.mjs','scripts/engineering-team/gateway/receipts/atomic-coding-ownership.mjs']
        : ['scripts/engineering-team/gateway/publication/authorized-pr-publish-once.mjs'];
    for (const input of [...required,'scripts/engineering-team/gateway/gateway-host.mjs','scripts/engineering-team/gateway/receipts/write-once-json.mjs']) {
      if (declared.get(input)!==EDITION.inputs[input]) mismatches.push({path,code:'INPUT_DIGEST_STALE',input});
    }
  }
  return {status:'BLOCKED',code:mismatches.length?'EDITION_OR_CATALOGUE_NOT_ADMITTED':'AWAITING_INDEPENDENT_ASSERTION_REVIEW',head,mismatches,independentReview:false,windowsProductGate:false,governedExecutionAuthorized:false};
}
