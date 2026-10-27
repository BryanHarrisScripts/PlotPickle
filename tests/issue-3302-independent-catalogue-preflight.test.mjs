import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {EDITION,inspectEdition} from '../scripts/engineering-team/verification/w8w9-catalogue-preflight.mjs';

test('rejects incorrect head before file reads',async()=>{
 const result=await inspectEdition({root:'/not-a-real-directory',head:'wrong'});
 assert.equal(result.code,'HEAD_MISMATCH');
});
test('missing inputs never become PASS',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pp-qa-'));
 try {
   const r=await inspectEdition({root,head:EDITION.head});
   assert.equal(r.status,'BLOCKED'); assert.equal(r.independentReview,false);
   assert.ok(r.mismatches.some(x=>x.code==='READ_FAILED'));
 } finally {await rm(root,{recursive:true,force:true});}
});
test('even exact source editions cannot self-admit protected catalogue',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pp-qa-'));
 try {
  for(const path of Object.keys({...EDITION.targets,...EDITION.inputs})){
    await mkdir(dirname(join(root,path)),{recursive:true});
    await writeFile(join(root,path),'fixture');
  }
  await mkdir(join(root,'config/verification'),{recursive:true});
  await writeFile(join(root,'config/verification/test-catalog.json'),JSON.stringify({truthGovernance:{bindings:[]}}));
  const r=await inspectEdition({root,head:EDITION.head});
  assert.equal(r.status,'BLOCKED'); assert.equal(r.governedExecutionAuthorized,false);
  assert.ok(r.mismatches.some(x=>x.code==='BINDING_CARDINALITY'));
 } finally {await rm(root,{recursive:true,force:true});}
});
