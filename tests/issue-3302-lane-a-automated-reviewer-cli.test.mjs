import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../scripts/engineering-team/verification/lane-a-automated-reviewer-cli.mjs',import.meta.url));
const norm='docs/white-papers/AI_Programming_Evolution_White_Paper.md';
const target='tests/demonstration.test.mjs';
const impl='scripts/engineering-team/verification/demonstration.mjs';
const source={
 [norm]:Buffer.from('Protected W8 and W9 normative obligations'),
 [target]:Buffer.from('throw Error("THIS_MUST_NEVER_BE_EXECUTED")'),
 [impl]:Buffer.from('export const demo = true;')
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const makeRequest=()=>({
 workOrder:{
  schemaVersion:'PP-LANE-A-REVIEW-WORK-V1',authorPrincipal:'coding-worker',
  candidateHead:'a'.repeat(40),
  testDigests:{[target]:sha(source[target])},
  inputDigests:{[impl]:sha(source[impl]),[norm]:sha(source[norm])},
  truthRefs:['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9']
 },
 independentlyPinnedPolicy:{
  schemaVersion:1,source:'external-protected-authority',
  normativeDigest:sha(source[norm]),sourceHead:'a'.repeat(40),
  allowAutomatedPreflight:true,requiredTruthRefs:['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9']
 },
 stopMarkerState:'ABSENT',
 sourceBlobsBase64:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.toString('base64')]))
});
function run(payload,{raw=false,args=['--inspect']}={}){
 return spawnSync(process.execPath,[cli,...args],{
  input:raw?payload:JSON.stringify(payload),encoding:'utf8',
  timeout:5000,maxBuffer:160000
 });
}

test('standalone automated reviewer reads exact sources but has no ADMIT or signing privilege',()=>{
 const p=run(makeRequest());
 assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(p.stdout);
 assert.equal(r.status,'REVIEW_PROPOSAL_ONLY');
 assert.equal(r.disposition,'UNPROVEN');
 assert.equal(r.independentlyVerified,false);
 for(const k of ['mayAdmit','maySign','mayEditCatalogue','mayCode','mayMerge'])assert.equal(r[k],false,k);
 assert.equal(r.observedDigests[target],sha(source[target]));
});

test('tampered executable test stays inert and only generates FIX proposal',()=>{
 const req=makeRequest();
 req.sourceBlobsBase64[target]=Buffer.from('process.exit(42)').toString('base64');
 const p=run(req);
 assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(p.stdout);
 assert.equal(r.disposition,'FIX');
 assert.equal(r.maySign,false);
});

test('malformed inputs and missing trust sources fail closed',()=>{
 const json=run('{malformed',{raw:true});
 assert.equal(json.status,2);
 assert.equal(JSON.parse(json.stdout).code,'REQUEST_JSON_INVALID');
 const noTrust=makeRequest();delete noTrust.independentlyPinnedPolicy;
 const p=run(noTrust);
 assert.equal(p.status,2);
 assert.equal(JSON.parse(p.stdout).code,'INDEPENDENT_TRUTH_POLICY_MISSING');
});

test('STOP always blocks regardless of matched hashes',()=>{
 const req=makeRequest();req.stopMarkerState='PRESENT';
 const p=run(req);
 assert.equal(p.status,2);
 const r=JSON.parse(p.stdout);
 assert.equal(r.code,'INTENTIONAL_STOP');
 assert.equal(r.mayAdmit,false);
});

test('invalid byte encoding and surprising request fields are rejected',()=>{
 const extra=makeRequest();extra.trustMe=true;
 assert.equal(JSON.parse(run(extra).stdout).code,'REQUEST_SCHEMA_INVALID');
 const invalid=makeRequest();invalid.sourceBlobsBase64[target]='ABC=DEAD';
 const p=run(invalid);assert.equal(p.status,2);
 assert.equal(JSON.parse(p.stdout).code,'SOURCE_BLOB_ENCODING_INVALID');
});

test('only fixed --inspect entrypoint is accepted, no arbitrary CLI subcommands',()=>{
 const p=run('',{raw:true,args:['--sign']});
 assert.equal(p.status,2);
 assert.match(p.stderr,/READ_ONLY_INSPECT_ONLY/);
 assert.equal(p.stdout,'');
});
