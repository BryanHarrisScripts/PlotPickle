import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assessCandidateStageCount, withCandidateStageBudget, FACTORY_STAGING_POLICY,
} from "../scripts/engineering-team/mcp/storage/factory-stage-budget.mjs";
import { FACTORY_DISK_MIN_FREE_BYTES } from "../scripts/engineering-team/queue/factory-disk-space.mjs";
import { stageFactoryCandidatePr } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";

const HEAD="a".repeat(40), CANDIDATE="b".repeat(40);
const GiB=1024**3, id=x=>x.toString(16).padStart(32,"0");
const ampleSpace=()=>Promise.resolve({state:"READY",code:"DISK_SPACE_SUFFICIENT",
  freeBytes:12*GiB,checkedDestinations:2});
async function sandbox(fn) {
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-stage-growth-"));
  const base=path.join(root,"chat-candidate-stages");
  await mkdir(base);
  try {return await fn({root,base});}
  finally {await rm(root,{recursive:true,force:true});}
}

test("#3241 policy separates one concurrent stage from unlimited retained evidence within bounded inventory",()=>{
  assert.equal(FACTORY_STAGING_POLICY.maxConcurrentStaging,1);
  assert.equal(FACTORY_STAGING_POLICY.maxInventoryEntries,4096);
  assert.equal(FACTORY_STAGING_POLICY.minFreeBytes,8*GiB);
  assert.equal(FACTORY_STAGING_POLICY.admissionReserveBytes,1*GiB);
  assert.equal(FACTORY_DISK_MIN_FREE_BYTES.candidateStage,8*GiB);
  assert.equal(Object.hasOwn(FACTORY_STAGING_POLICY,"maxRetainedStages"),false);
});

test("#3241 seventy retained stages do not block new work solely by directory count",()=>sandbox(async({root,base})=>{
  for(let x=1;x<=70;x++)await mkdir(path.join(base,id(x)));
  const prior=await readdir(base);
  const inventory=await assessCandidateStageCount({base});
  assert.equal(inventory.state,"READY");
  assert.equal(inventory.code,"RETAINED_STAGES_PRESERVED");
  assert.equal(inventory.observedRetainedStages,70);
  assert.equal(inventory.retentionReferenceState,"UNVERIFIED");
  let admitted=0,preflight=0;
  const r=await withCandidateStageBudget({root,base,
    checkCapacity:async()=>{preflight++;return ampleSpace();},
    onStage:async()=>{admitted++;await mkdir(path.join(base,id(71)));
      return {state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED"};},
  });
  assert.equal(r.code,"CANDIDATE_STATIC_STAGED");
  assert.equal(admitted,1);
  assert.equal(preflight,1);
  const after=await readdir(base);
  assert.equal(after.length,71);
  assert.ok(prior.every(x=>after.includes(x)),"all 70 original stages survive");
  assert.equal((await readdir(root)).includes(".candidate-stage-budget.lock"),false);
  assert.equal(JSON.stringify(r).includes(root),false);
}));

test("#3241 admission lock serializes space check and stage creation",()=>sandbox(async({root,base})=>{
  await mkdir(path.join(base,id(1)));
  let release,notify;
  const wait=new Promise(resolve=>release=resolve);
  const entered=new Promise(resolve=>notify=resolve);
  let firstChecked=0,secondChecked=0;
  const first=withCandidateStageBudget({root,base,
    checkCapacity:async()=>{firstChecked++;notify();await wait;return ampleSpace();},
    onStage:async()=>({state:"TEST_PASSED",code:"CANDIDATE_STATIC_STAGED"}),
  });
  await entered;
  const second=await withCandidateStageBudget({root,base,
    checkCapacity:async()=>{secondChecked++;return ampleSpace();},
    onStage:async()=>{throw Error("concurrent work cannot start");},
  });
  assert.equal(second.code,"STAGE_ADMISSION_BUSY");
  assert.equal(secondChecked,0);
  release();
  assert.equal((await first).code,"CANDIDATE_STATIC_STAGED");
  assert.equal(firstChecked,1);
  assert.equal((await readdir(root)).includes(".candidate-stage-budget.lock"),false);
}));

test("#3241 low or unverifiable actual disk capacity blocks before staging, even with zero retained stages",()=>sandbox(async({root,base})=>{
  let work=0;
  for(const [capacity,expected] of [
    [{state:"BLOCKED",code:"DISK_SPACE_INSUFFICIENT",freeBytes:7*GiB},"BLOCK_RESOURCE_PRESSURE"],
    [{state:"READY",code:"DISK_SPACE_SUFFICIENT",freeBytes:8*GiB},"BLOCK_RESOURCE_PRESSURE"],
    [null,"STAGE_ADMISSION_UNVERIFIED"],
    [{state:"READY",code:"DISK_SPACE_SUFFICIENT",freeBytes:null},"STAGE_ADMISSION_UNVERIFIED"],
  ]) {
    const r=await withCandidateStageBudget({root,base,
      checkCapacity:async()=>capacity,
      onStage:async()=>{work++;return {state:"TEST_PASSED"};},
    });
    assert.equal(r.code,expected);
    assert.equal(r.cleanupAuthorized,false);
    assert.equal(work,0);
  }
  assert.deepEqual(await readdir(base),[]);
}));

test("#3241 unexpected evidence, links and invalid stage names are preserved and block admission",()=>sandbox(async({root,base})=>{
  await mkdir(path.join(base,"unclassified-recovery-evidence"));
  let capacityCalls=0;
  let r=await withCandidateStageBudget({root,base,
    checkCapacity:async()=>{capacityCalls++;return ampleSpace();},
    onStage:async()=>{throw Error("should never run");},
  });
  assert.equal(r.code,"STAGE_INVENTORY_UNVERIFIED");
  assert.equal(capacityCalls,0);
  assert.equal((await readdir(base))[0],"unclassified-recovery-evidence");
  await rm(path.join(base,"unclassified-recovery-evidence"),{recursive:true});
  let linked=false;
  try {
    await symlink(root,path.join(base,id(4)),"junction");
    linked=true;
  } catch(error) {
    if(process.platform!=="win32"||!["EPERM","EACCES"].includes(error?.code)) throw error;
  }
  if(linked) {
    r=await withCandidateStageBudget({root,base,
      checkCapacity:ampleSpace,onStage:async()=>{throw Error("symlink not allowed");},
    });
    assert.equal(r.code,"STAGE_INVENTORY_UNVERIFIED");
  }
}));

test("#3241 bounded inventory refuses unknown workload with no deletion",()=>sandbox(async({base})=>{
  const fakeEntry={isDirectory:()=>true,isSymbolicLink:()=>false,name:id(4)};
  const fakeList=async()=>({
    async *[Symbol.asyncIterator]() {
      for(let i=0;i<=FACTORY_STAGING_POLICY.maxInventoryEntries;i++)yield fakeEntry;
    },
    close:async()=>{},
  });
  const r=await assessCandidateStageCount({base,list:fakeList});
  assert.equal(r.code,"STAGE_INVENTORY_BUDGET_EXCEEDED");
  assert.equal(r.cleanupAuthorized,false);
  assert.equal(r.observedStagesAtLeast,4097);
}));

test("#3241 invalid roots, missing capacity check and stale locks stop without replay",()=>sandbox(async({root,base})=>{
  let action=0;
  assert.equal((await withCandidateStageBudget({
    root,base:path.join(root,"wrong"),checkCapacity:ampleSpace,onStage:async()=>action++,
  })).code,"STAGE_ADMISSION_UNVERIFIED");
  assert.equal((await withCandidateStageBudget({
    root,base,onStage:async()=>action++,
  })).code,"STAGE_ADMISSION_UNVERIFIED");
  await mkdir(path.join(root,".candidate-stage-budget.lock"));
  assert.equal((await withCandidateStageBudget({
    root,base,checkCapacity:ampleSpace,onStage:async()=>action++,
  })).code,"STAGE_ADMISSION_BUSY");
  assert.equal(action,0);
  assert.equal((await readdir(root)).includes(".candidate-stage-budget.lock"),true);
}));

test("#3241 candidate staging checks disk INSIDE admission gate before any Git fetch",()=>sandbox(async({root})=>{
  let git=0,admission=0,requestedBytes=0;
  const r=await stageFactoryCandidatePr({
    prNumber:3298,requestId:id(42),expectedHead:HEAD,
    candidateHead:CANDIDATE,root,repoRoot:root,platform:"win32",
    verifyHead:async()=>HEAD,
    inspectPr:async()=>({state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED"}),
    diskPreflight:async({requiredBytes})=>{
      requestedBytes=requiredBytes;
      return {state:"BLOCKED",code:"DISK_SPACE_INSUFFICIENT",freeBytes:8*GiB};
    },
    stageBudget:async({checkCapacity,onStage})=>{
      admission++;
      assert.equal(typeof onStage,"function");
      const result=await checkCapacity();
      assert.equal(result.code,"DISK_SPACE_INSUFFICIENT");
      return {state:"BLOCKED",code:"BLOCK_RESOURCE_PRESSURE"};
    },
    run:async()=>{git++;throw Error("GIT_SHOULD_NOT_RUN");},
  });
  assert.equal(r.code,"BLOCK_RESOURCE_PRESSURE");
  assert.equal(requestedBytes,9*GiB);
  assert.equal(admission,1);
  assert.equal(git,0);
}));
