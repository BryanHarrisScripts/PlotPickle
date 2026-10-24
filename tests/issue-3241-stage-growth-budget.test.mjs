import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assessCandidateStageCount, withCandidateStageBudget, FACTORY_STAGING_POLICY } from "../scripts/engineering-team/mcp/storage/factory-stage-budget.mjs";
import { FACTORY_DISK_MIN_FREE_BYTES } from "../scripts/engineering-team/queue/factory-disk-space.mjs";
import { stageFactoryCandidatePr } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";

const HEAD="a".repeat(40),CANDIDATE="b".repeat(40);
async function sandbox(fn) {
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-stage-growth-"));
  const base=path.join(root,"chat-candidate-stages");
  await mkdir(base);
  try {return await fn({root,base});} finally {await rm(root,{recursive:true,force:true});}
}
const id=(x)=>x.toString(16).padStart(32,"0");

test("#3241 staging count is three, headroom eight GiB and no automatic delete API",()=>{
  assert.equal(FACTORY_STAGING_POLICY.maxRetainedStages,3);
  assert.equal(FACTORY_STAGING_POLICY.minFreeBytes,8*1024**3);
  assert.equal(FACTORY_DISK_MIN_FREE_BYTES.candidateStage,8*1024**3);
});

test("#3241 full stage budget rejects new work before callback and preserves all existing directories",()=>sandbox(async({root,base})=>{
  for(let x=1;x<=65;x++)await mkdir(path.join(base,id(x)));
  let called=0;
  const r=await withCandidateStageBudget({root,base,onStage:async()=>{called++;return {state:"TEST_PASSED"};}});
  assert.equal(r.code,"STAGE_BUDGET_EXCEEDED");
  assert.equal(r.maximumStages,3);
  assert.equal(r.state,"BLOCKED");
  assert.equal(r.cleanupAuthorized,false);
  assert.equal(called,0);
  assert.equal((await readdir(base)).length,65);
  assert.equal((await readdir(root)).includes(".candidate-stage-budget.lock"),false);
  assert.equal(JSON.stringify(r).includes(root),false);
}));

test("#3241 allowance serializes check and checkout and releases only owned lock",()=>sandbox(async({root,base})=>{
  await mkdir(path.join(base,id(1)));
  const first=await assessCandidateStageCount({base});
  assert.equal(first.state,"READY");
  assert.equal(first.observedStages,1);
  let unblock;
  const started=new Promise(resolve=>unblock=resolve);
  let entered;
  const didEnter=new Promise(resolve=>entered=resolve);
  const a=withCandidateStageBudget({root,base,onStage:async()=>{
    entered();
    await started;
    await mkdir(path.join(base,id(2)));
    return {state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED"};
  }});
  await didEnter;
  let secondCalled=0;
  const b=await withCandidateStageBudget({root,base,onStage:async()=>{
    secondCalled++;return {state:"TEST_PASSED"};
  }});
  assert.equal(b.code,"STAGE_BUDGET_BUSY");
  assert.equal(secondCalled,0);
  unblock();
  const done=await a;
  assert.equal(done.code,"CANDIDATE_STATIC_STAGED");
  assert.equal((await readdir(base)).length,2);
  assert.equal((await readdir(root)).includes(".candidate-stage-budget.lock"),false);
}));

test("#3241 staged directory ambiguity, links and invalid identifiers fail closed",()=>sandbox(async({root,base})=>{
  await mkdir(path.join(base,"unexpected-preserved-evidence"));
  let result=await withCandidateStageBudget({root,base,onStage:async()=>{throw Error("must not run");}});
  assert.equal(result.code,"STAGE_BUDGET_UNVERIFIED");
  assert.equal((await readdir(base)).length,1);
  await rm(path.join(base,"unexpected-preserved-evidence"),{recursive:true});
  try {await symlink(root,path.join(base,id(4)),"junction");}
  catch(error) {
    if(process.platform==="win32" && ["EPERM","EACCES"].includes(error?.code))return;
    throw error;
  }
  result=await withCandidateStageBudget({root,base,onStage:async()=>({state:"TEST_PASSED"})});
  assert.equal(result.code,"STAGE_BUDGET_UNVERIFIED");
}));

test("#3241 invalid roots and stale locks block; no action and no silent recovery",()=>sandbox(async({root,base})=>{
  let used=0;
  assert.equal((await withCandidateStageBudget({
    root,base:path.join(root,"other"),onStage:async()=>{used++;},
  })).code,"STAGE_BUDGET_UNVERIFIED");
  await mkdir(path.join(root,".candidate-stage-budget.lock"));
  const r=await withCandidateStageBudget({
    root,base,onStage:async()=>{used++;},
  });
  assert.equal(r.code,"STAGE_BUDGET_BUSY");
  assert.equal(used,0);
  assert.equal((await readdir(root)).includes(".candidate-stage-budget.lock"),true);
}));

test("#3241 candidate staging integration blocks Git fetch after budget failure",()=>sandbox(async({root})=>{
  let git=0,assess=0;
  const r=await stageFactoryCandidatePr({
    prNumber:3278,requestId:id(42),expectedHead:HEAD,
    candidateHead:CANDIDATE,root,repoRoot:root,platform:"win32",
    verifyHead:async()=>HEAD,
    inspectPr:async()=>({state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED"}),
    diskPreflight:async({requiredBytes})=>{
      assert.equal(requiredBytes,8*1024**3);
      return {state:"READY",code:"DISK_SPACE_SUFFICIENT"};
    },
    stageBudget:async({onStage})=>{
      assess++; assert.equal(typeof onStage,"function");
      return {state:"BLOCKED",code:"STAGE_BUDGET_EXCEEDED"};
    },
    run:async()=>{git++;throw Error("GIT_SHOULD_NOT_RUN");},
  });
  assert.equal(r.code,"STAGE_BUDGET_EXCEEDED");
  assert.equal(git,0);
  assert.equal(assess,1);
}));
