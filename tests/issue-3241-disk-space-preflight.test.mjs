import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FACTORY_DISK_MIN_FREE_BYTES, readFactoryDiskSpace } from "../scripts/engineering-team/queue/factory-disk-space.mjs";
import { runFactoryDependencyPreflight, factoryNpmFailureCode } from "../scripts/engineering-team/queue/factory-dependency-preflight.mjs";
import { stageFactoryCandidatePr } from "../scripts/engineering-team/mcp/factory-named-tests.mjs";

const HEAD="a".repeat(40), CANDIDATE="b".repeat(40), ID="c".repeat(32);
async function sandbox(fn){
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-disk-3241-"));
  try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
const ready=()=>({state:"READY",code:"DISK_SPACE_SUFFICIENT"});
const low=()=>({state:"BLOCKED",code:"DISK_SPACE_INSUFFICIENT"});

test("#3241 disk probe checks target folders and returns path-free free-space evidence",()=>
  sandbox(async root=>{
    const visited=[];
    const r=await readFactoryDiskSpace({
      locations:[path.join(root,"stage"),path.join(root,"cache")],
      requiredBytes:4*1024*1024,
      getStats:async(p,opts)=>{
        assert.equal(opts.bigint,true);visited.push(p);
        return {bavail:10000n,bsize:1024n};
      },
    });
    assert.equal(r.state,"READY");
    assert.equal(r.freeBytes,10240000);
    assert.equal(r.checkedDestinations,2);
    assert.equal(r.isReservation,false);
    assert.equal(r.cleanupAuthorized,false);
    assert.deepEqual(visited,[root,root]);
    assert.equal(JSON.stringify(r).includes(root),false);
  }));

test("#3241 low/unknown/reparse capacity fails closed and preserves private files",()=>
  sandbox(async root=>{
    const file=path.join(root,"precious-story.txt");
    await writeFile(file,"KEEP");
    const args={locations:[path.join(root,"worktree")],requiredBytes:4096};
    assert.equal((await readFactoryDiskSpace({...args,
      getStats:async()=>({bavail:2n,bsize:1024n})})).code,"DISK_SPACE_INSUFFICIENT");
    const unknown=await readFactoryDiskSpace({...args,
      getStats:async()=>{throw Error("PRIVATE_PATH_TOKEN");}});
    assert.equal(unknown.code,"DISK_SPACE_UNVERIFIED");
    assert.equal(JSON.stringify(unknown).includes("PRIVATE_PATH_TOKEN"),false);
    assert.equal((await readFactoryDiskSpace({locations:["../relative"],requiredBytes:4096})).code,"DISK_SPACE_UNVERIFIED");
    assert.equal((await readFactoryDiskSpace({locations:[file],requiredBytes:4096})).code,"DISK_SPACE_UNVERIFIED");
    const link=path.join(root,"symlink");
    try {
      await symlink(root,link,"junction");
      assert.equal((await readFactoryDiskSpace({
        locations:[link],requiredBytes:4096})).code,"DISK_SPACE_UNVERIFIED");
    }catch(e){
      if(process.platform!=="win32"||!["EPERM","EACCES","ENOTSUP"].includes(e?.code))throw e;
    }
    assert.equal(await readFile(file,"utf8"),"KEEP");
  }));

test("#3241 npm dependency preflight blocks before worktree/install and rechecks after stage",()=>
  sandbox(async root=>{
    const repoRoot=path.join(root,"repo"),privateRoot=path.join(root,"private");
    await mkdir(repoRoot);await mkdir(privateRoot);
    await writeFile(path.join(repoRoot,"package.json"),'{"name":"test"}');
    await writeFile(path.join(repoRoot,"package-lock.json"),'{"lockfileVersion":3}');
    let calls=0,worktrees=0,installs=0;
    const opts={
      root:privateRoot,repoRoot,platform:"win32",nodeVersion:"v24.0.0",
      git:async argv=>{
        if(argv[0]==="rev-parse")return HEAD;
        if(argv[0]==="branch")return "main";
        if(argv[0]==="status")return "";
        if(argv[0]==="worktree"){worktrees++;return "";}
        throw Error("Unexpected git");
      },
      install:async()=>{installs++;},now:()=>10001,
    };
    const blocked=await runFactoryDependencyPreflight({...opts,
      diskPreflight:async input=>{
        assert.equal(input.requiredBytes,FACTORY_DISK_MIN_FREE_BYTES.dependencyInstall);
        assert.equal(input.locations.length,3);return low();
      }});
    assert.equal(blocked.state,"BLOCKED");
    assert.equal(blocked.code,"DISK_SPACE_INSUFFICIENT");
    assert.equal(blocked.phase,"CHECK_DISK");
    assert.equal(blocked.issueReserved,false);
    assert.equal(installs,0);assert.equal(worktrees,0);
    const late=await runFactoryDependencyPreflight({...opts,now:()=>10002,
      diskPreflight:async()=>++calls===1?ready():low()});
    assert.equal(late.code,"DISK_SPACE_INSUFFICIENT");
    assert.equal(late.phase,"CHECK_DISK");
    assert.equal(late.probePreserved,true);
    assert.equal(installs,0);assert.equal(worktrees,1);
    assert.equal((await readFile(path.join(privateRoot,"dependency-preflight.json"),"utf8").catch(e=>e.code)),"ENOENT");
    assert.equal(factoryNpmFailureCode({stderr:"npm error code ENOSPC"}),"DISK_SPACE_INSUFFICIENT");
  }));

test("#3241 candidate staging rejects low/unverified disk without fetching candidate source",()=>
  sandbox(async root=>{
    let git=0;
    const args={
      prNumber:3269,expectedHead:HEAD,candidateHead:CANDIDATE,
      requestId:ID,root,repoRoot:root,platform:"win32",
      verifyHead:async()=>HEAD,
      inspectPr:async()=>({state:"TEST_PASSED",code:"CANDIDATE_HEAD_VERIFIED"}),
      run:async()=>{git++;throw Error("Forbidden Git when no headroom");},
    };
    const r=await stageFactoryCandidatePr({...args,diskPreflight:async input=>{
      assert.equal(input.requiredBytes,FACTORY_DISK_MIN_FREE_BYTES.candidateStage+1024**3);
      return low();
    }});
    assert.equal(r.code,"BLOCK_RESOURCE_PRESSURE");
    assert.equal(r.state,"BLOCKED");
    assert.equal(r.issueReserved,false);
    assert.equal(git,0);
    const unknown=await stageFactoryCandidatePr({...args,
      requestId:"d".repeat(32),diskPreflight:async()=>{throw Error("PRIVATE_KEY");}});
    assert.equal(unknown.code,"STAGE_ADMISSION_UNVERIFIED");
    assert.equal(git,0);
    assert.equal(JSON.stringify([r,unknown]).includes("PRIVATE_KEY"),false);
  }));
