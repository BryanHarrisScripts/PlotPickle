import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { profileFactoryStorage } from "../scripts/engineering-team/mcp/storage/factory-storage-profile.mjs";
import { inspectFactoryStorage, validStorageReportArgs } from "../scripts/engineering-team/mcp/storage/factory-storage-inventory.mjs";

const HEAD = "f".repeat(40);
async function fixture(fn) {
  const base = await mkdtemp(path.join(os.tmpdir(), "plotpickle-storage-growth-"));
  try {
    const root = path.join(base, "engineering-team");
    const queue = path.join(root, "autonomous-queue");
    await mkdir(queue,{recursive:true});
    for(const [name,count] of [["chat-candidate-stages",64],["worktrees",32],["jobs",16]]){
      await mkdir(path.join(queue,name),{recursive:true});
      await writeFile(path.join(queue,name,"fixture.txt"),"x".repeat(count));
    }
    return await fn({base,root,queue});
  } finally {await rm(base,{recursive:true,force:true});}
}

test("#3241 profile accepts only the fixed inventory root and a bounded mode",()=>{
  assert.equal(validStorageReportArgs({expectedHead:HEAD,rootId:"engineering-team",scanMode:"profile"}),true);
  assert.equal(validStorageReportArgs({expectedHead:HEAD,rootId:"../../private",scanMode:"profile"}),false);
  assert.equal(validStorageReportArgs({expectedHead:HEAD,rootId:"engineering-team",scanMode:"profile",directory:"C:/private"}),false);
  assert.equal(validStorageReportArgs({expectedHead:HEAD,rootId:"engineering-team",scanMode:"unlimited"}),false);
});

test("#3241 growth profile observes multiple siblings and never returns absolute paths",()=>fixture(async ({base,root})=>{
  const output=await profileFactoryStorage({
    selected:{id:"engineering-team",kind:"factory",directory:root},rootId:"engineering-team",
  });
  assert.equal(output.state,"COMPLETE");
  assert.equal(output.apparentBytes,"112");
  assert.equal(output.scope,"autonomous-queue");
  assert.equal(output.children.length,3);
  assert.deepEqual(output.children.map(x=>x.name),["chat-candidate-stages","worktrees","jobs"]);
  assert.ok(output.children.every(x=>x.state==="COMPLETE"));
  assert.equal(JSON.stringify(output).includes(base),false);
  assert.equal(output.cleanupAuthorized,false);
  assert.equal(output.bytesAreReclaimable,false);
  assert.equal(output.retentionReferenceState,"UNVERIFIED");
}));

test("#3241 profile bounds and source checks reject unverified privileged observations",()=>fixture(async ({base,root})=>{
  const environment={PLOTPICKLE_HOME:base};
  const options={expectedHead:HEAD,rootId:"engineering-team",scanMode:"profile",
    environment,repoRoot:base,verifyHead:async()=>HEAD,
    capacityCheck:async()=>({state:"READY",code:"DISK_SPACE_SUFFICIENT",freeBytes:6000000000,requiredBytes:4294967296})};
  const actual=await inspectFactoryStorage(options);
  assert.equal(actual.state,"COMPLETE");
  assert.equal(actual.children.length,3);
  assert.equal(actual.apparentBytes,"112");
  assert.equal(actual.metadataOnly,true);
  assert.equal(actual.cleanupAuthorized,false);
  assert.equal(actual.deletionImplemented,false);
  assert.equal(actual.independentVerification,false);
  assert.ok(actual.children.every(c=>!JSON.stringify(c).includes(base)));
  let called=0;
  assert.equal((await inspectFactoryStorage({...options,
    verifyHead:async()=>null,profileScan:async()=>{called++;return{};}})).code,"EXACT_HEAD_MISMATCH");
  assert.equal(called,0);
  let checks=0;
  assert.equal((await inspectFactoryStorage({...options,
    verifyHead:async()=>++checks===1?HEAD:null})).code,"EXACT_HEAD_MISMATCH");
  const forged=await inspectFactoryStorage({...options,profileScan:async()=>({
    state:"COMPLETE",code:"INVENTORY_COMPLETE",scanMode:"profile",rootId:"engineering-team",
    children:[{name:"x",state:"COMPLETE",apparentBytes:"3"}],
    apparentBytes:"3",metadataOnly:true,cleanupAuthorized:true,bytesAreReclaimable:false,
  })});
  assert.equal(forged.code,"STORAGE_PROFILE_UNVERIFIED");
}));

test("#3241 profile preserves scan uncertainty rather than inventing reclaimable space",()=>fixture(async({root})=>{
  let processed=0;
  const result=await profileFactoryStorage({
    selected:{id:"engineering-team",kind:"factory",directory:root},rootId:"engineering-team",
    scan:async({roots})=>{
      processed++;
      return {metadataOnly:true,cleanupAuthorized:false,bytesAreReclaimable:false,
        visitedEntries:50,roots:[{id:roots[0].id,state:"PARTIAL",code:"TIME_LIMIT_REACHED",
          apparentBytes:"300",files:20,directories:10,skippedLinks:0}]};
    },
  });
  assert.equal(processed,3);
  assert.equal(result.state,"PARTIAL");
  assert.equal(result.totalsAreLowerBounds,true);
  assert.equal(result.apparentBytes,"900");
  assert.ok(result.children.every(x=>x.code==="TIME_LIMIT_REACHED"));
}));

test("#3241 profile skips reparse links rather than traversing them",()=>fixture(async({base,root,queue})=>{
  const outside=path.join(base,"outside");
  await mkdir(outside);
  try {await symlink(outside,path.join(queue,"redirection"),"dir");}
  catch(error) {
    if(process.platform==="win32" && ["EPERM","EACCES"].includes(error?.code)) return;
    throw error;
  }
  const r=await profileFactoryStorage({
    selected:{id:"engineering-team",kind:"factory",directory:root},rootId:"engineering-team",
  });
  const suspect=r.children.find(c=>c.name==="redirection");
  assert.equal(suspect.code,"PROFILE_LINK_SKIPPED");
  assert.equal(suspect.apparentBytes,"0");
  assert.equal(r.state,"PARTIAL");
  assert.equal(r.cleanupAuthorized,false);
}));
