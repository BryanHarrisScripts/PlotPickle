import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  parseQueueCommand,eligibleIssue,pickNextIssue,enableFactory,disableFactory,
  readFactoryStatus,runFactoryCycle,serveFactory,createQueueGitHubClient,
} from "../scripts/engineering-team/windows/autonomous-queue.mjs";
import {parseCoderArgs,assessFactoryPaths} from "../scripts/engineering-team/windows/autonomous-issue-coder.mjs";
import {renderFactoryHeartbeat,publishFactoryHeartbeat} from "../scripts/engineering-team/windows/autonomous-telemetry.mjs";
import {reviewDocsOnlyCandidate,reconcileApprovedDocsPRs} from "../scripts/engineering-team/windows/autonomous-pr-review.mjs";

const HEAD="a".repeat(40);
const first={number:3135,title:"Prove Windows live STOP",state:"OPEN",labels:[]};
const second={number:3123,title:"Repair story continuity",state:"OPEN",labels:[]};
async function sandbox(fn){
 const root=await mkdtemp(path.join(os.tmpdir(),"plotpickle-auto-factory-"));
 try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
test("queue is fully OFF by default; --status does not pair, poll GitHub, or launch a provider",()=>sandbox(async root=>{
 assert.deepEqual(await readFactoryStatus({root}),{state:"OFF",enabled:false,reason:"NOT_ENABLED"});
 for(const flags of [["--once","--serve"],["--enable"],["--enable","--issues","3123"],["--serve","--issues","12"],
   ["--enable","--issues","1,1","--consent","PLOTPICKLE_AUTONOMOUS_ENGINEERING"],
   ["--enable","--issues","2,0","--consent","PLOTPICKLE_AUTONOMOUS_ENGINEERING"]]){
  assert.throws(()=>parseQueueCommand(flags));
 }
 assert.deepEqual(parseQueueCommand(["--enable","--issues","3123,3135","--consent",
   "PLOTPICKLE_AUTONOMOUS_ENGINEERING"]).issues,[3123,3135]);
 const state=await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},dispatch:async()=>{throw Error("must not dispatch");}});
 assert.equal(state.state,"OFF");
 assert.equal(state.processed,0);
}));

test("only explicitly allowlisted open eligible issues run; HOLD and blocked never run",()=>{
 assert.equal(eligibleIssue(first,[3135]),true);
 assert.equal(eligibleIssue(first,[3123]),false);
 assert.equal(eligibleIssue({...first,title:"[ON HOLD] owner task"},[3135]),false);
 assert.equal(eligibleIssue({...first,labels:[{name:"factory:blocked"}]},[3135]),false);
 assert.equal(eligibleIssue({...first,state:"CLOSED"},[3135]),false);
 assert.deepEqual(pickNextIssue([second,first],[3135,3123],[3135]),{number:3123,title:second.title});
 assert.equal(pickNextIssue([first],[3135],[3135]),null);
});

test("enabling needs reviewed finite issues; one attempt is irreversibly reserved before agent dispatch",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3135,3123],now:()=>1000});
 let runs=0;
 const fakeGitHub={exactHead:async()=>HEAD,issues:async()=>[second,first]};
 const before=await readFactoryStatus({root,now:()=>2000});
 assert.equal(before.enabled,true);
 assert.equal(before.state,"OFFLINE");
 const one=await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github:fakeGitHub,now:()=>2000,
   dispatch:async({issueNumber,head})=>{
     runs++;assert.equal(issueNumber,3135);assert.equal(head,HEAD);
     const reservation=JSON.parse(await readFile(path.join(root,"jobs","issue-3135.json"),"utf8"));
     assert.equal(reservation.state,"STARTED_UNCONFIRMED");
     assert.equal(reservation.modelRoute,"local-only");
     assert.equal(reservation.automaticMergeAuthorized,false);
     return {state:"WAITING_FOR_PRODUCT_UAT",code:"DRAFT_PR_CREATED",
       prUrl:"https://github.com/BryanHarrisScripts/PlotPickle/pull/9999"};
   }});
 assert.equal(one.processed,1);assert.equal(runs,1);assert.equal(one.issueNumber,3135);
 assert.equal(one.state,"WAITING_FOR_PRODUCT_UAT");
 const two=await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github:fakeGitHub,now:()=>3000,
    dispatch:async({issueNumber})=>{assert.equal(issueNumber,3123);runs++;return {state:"BLOCKED",code:"NO_RUNTIME"};}});
 assert.equal(two.issueNumber,3123);assert.equal(runs,2);
 const three=await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github:fakeGitHub,now:()=>4000,
   dispatch:async()=>{throw Error("NEVER REPLAY");}});
 assert.equal(three.state,"WAITING_FOR_ELIGIBLE_ISSUE");
 assert.equal(three.processed,0);
 assert.equal(runs,2);
 const status=await readFactoryStatus({root,now:()=>4001});
 assert.equal(status.state,"BLOCKED");
 assert.equal(status.localAgentProven,false);
 assert.equal(status.automaticMergeEnabled,false);
}));

test("uncertain agent crashes are fail-closed and cannot automatically replay",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3123],now:()=>1000});
 const github={exactHead:async()=>HEAD,issues:async()=>[second]};
 const result=await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github,now:()=>1500,dispatch:async()=>{
   throw new Error("possibly dispatched model, output and credentials must remain private");
 }});
 assert.equal(result.state,"BLOCKED");
 const ledger=JSON.parse(await readFile(path.join(root,"jobs","result-3123.json"),"utf8"));
 assert.equal(ledger.code,"EXECUTION_UNCERTAIN");
 assert.equal(ledger.replayAuthorized,false);
 assert.equal(JSON.stringify(ledger).includes("credentials"),false);
 assert.equal((await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github,dispatch:async()=>{throw Error("replay");}})).processed,0);
}));

test("stale/main mismatch prevents attempts and locally disabled factory rejects new commands",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3135]});
 const github={exactHead:async()=>null,issues:async()=>{throw Error("must not list");}};
 const notStarted=await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github,dispatch:async()=>{throw Error("must not dispatch");}});
 assert.equal(notStarted.state,"WAITING_FOR_EXACT_CLEAN_MAIN");
 assert.equal((await disableFactory({root})).state,"OFF");
 assert.equal((await runFactoryCycle({root,preflight:async()=>({ready:true}),publish:async()=>{},github,dispatch:async()=>{throw Error("must not dispatch");}})).processed,0);
 await assert.rejects(enableFactory({root,issues:[3135]}),/locally disabled/);
}));

test("service shutdown and queue state remain truthful; no silent startup",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3135]});
 let cycles=0;
 const result=await serveFactory({root,publish:async()=>{},now:()=>12345,cycle:async()=>{
   cycles++;
   await disableFactory({root,now:()=>12346});
 },sleep:async()=>{}});
 assert.equal(result.state,"OFF");
 assert.equal(cycles,1);
 await assert.rejects(readFile(path.join(root,"service.lock"),"utf8"),/ENOENT/);
}));

test("GitHub client uses fixed argv and never shell-evaluates issue text",async()=>{
 const calls=[];
 const client=createQueueGitHubClient({exec:async(command,args,options)=>{
   calls.push({command,args,options});
   const joined=args.join(" ");
   if(joined==="rev-parse HEAD"||joined==="rev-parse origin/main")return {stdout:HEAD};
   if(joined==="branch --show-current")return {stdout:"main"};
   if(joined.startsWith("status "))return {stdout:""};
   return {stdout:JSON.stringify([first])};
 }});
 assert.equal(await client.exactHead(),HEAD);
 assert.deepEqual(await client.issues(),[first]);
 assert.equal(calls.some(x=>x.options.shell===true),false);
 assert.equal(calls.at(-1).command,"gh");
 assert.equal(calls.at(-1).args.includes("--json"),true);
});

test("bounded coding adapter rejects arbitrary issue commands and protected file edits",()=>{
 const r=path.resolve(os.tmpdir(),"plotpickle-test");
 assert.deepEqual(parseCoderArgs(["--issue","3135","--head",HEAD,"--root",r]),
   {issueNumber:3135,head:HEAD,root:r});
 for(const args of [
   ["--issue","oops","--head",HEAD,"--root",r],
   ["--issue","3135","--head","main","--root",r],
   ["--issue","3135","--head",HEAD,"--root","../unsafe"],
   ["--issue","3135","--head",HEAD,"--root",r,"--shell","cmd"],
 ])assert.throws(()=>parseCoderArgs(args));
 assert.equal(assessFactoryPaths(["app/skin-v1/page.ts","tests/issue-3135.test.mjs"]).allowed,true);
 for(const file of [".github/workflows/ci.yml","../secret","package.json","app/../.env",
   "scripts/engineering-team/windows/paired-github-control.mjs","scripts/engineering-team/repair/policy.json","app/private/.env.local",
   "C:/Users/secrets.txt"]){
   assert.equal(assessFactoryPaths([file]).allowed,false,file);
 }
 assert.equal(assessFactoryPaths([]).allowed,false);
});

test("GitHub telemetry edits one sanitized comment, rate-limited without private issue/model prose",()=>sandbox(async root=>{
 const calls=[];
 const runner=async(program,args,options)=>{
   calls.push({program,args,options});
   return {stdout:JSON.stringify({id:6270000000})};
 };
 const state={state:"RUNNING",issueNumber:3135,head:HEAD,privateStory:"never-publish",
   modelPrompt:"secret"};
 const first=await publishFactoryHeartbeat({root,status:state,now:()=>1000000,run:runner});
 assert.equal(first.state,"PUBLISHED");
 assert.equal(first.commentId,6270000000);
 const again=await publishFactoryHeartbeat({root,status:state,now:()=>1000200,run:runner});
 assert.equal(again.state,"UNCHANGED");
 assert.equal(calls.length,1);
 const changed=await publishFactoryHeartbeat({root,status:{...state,state:"BLOCKED"},
   now:()=>1000210,run:runner});
 assert.equal(changed.state,"PUBLISHED");
 assert.equal(calls.length,2);
 assert.equal(calls[0].program,"gh");
 assert.equal(calls[0].args.includes("--method"),true);
 assert.equal(calls[1].args.includes("PATCH"),true);
 const bodies=calls.map(x=>x.args.find(a=>a.startsWith("body=")));
 assert.equal(bodies.some(b=>b.includes("never-publish")||b.includes("secret")),false);
 assert.match(bodies[0],/Browser Product Gate: UNPROVEN/);
 assert.match(renderFactoryHeartbeat({state:"not-really-running",issueNumber:3135}),/OFFLINE/);
}));

test("no local model does not consume an attempt; admitted queue can resume when provider appears",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3135]});
 const github={exactHead:async()=>HEAD,issues:async()=>[first]};
 const blocked=await runFactoryCycle({root,github,preflight:async()=>({ready:false,code:"PI_NOT_INSTALLED"}),
   publish:async()=>{},dispatch:async()=>{throw Error("must not dispatch");}});
 assert.equal(blocked.state,"WAITING_FOR_PROVIDER");
 assert.equal(blocked.processed,0);
 await assert.rejects(readFile(path.join(root,"jobs","issue-3135.json"),"utf8"),/ENOENT/);
 const ready=await runFactoryCycle({root,github,preflight:async()=>({ready:true}),
   publish:async()=>{},dispatch:async()=>({state:"BLOCKED",code:"CANDIDATE_REJECTED"})});
 assert.equal(ready.processed,1);
 assert.equal(ready.issueNumber,3135);
}));

test("more than two pending autonomous draft PRs blocks new issue work before provider use",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3135]});
 let issued=false;
 const state=await runFactoryCycle({root,preflight:async()=>{throw Error("no probe allowed");},
   publish:async()=>{},github:{pendingFactoryPRs:async()=>2,
   exactHead:async()=>{throw Error("no git work allowed");},issues:async()=>[first]},
   dispatch:async()=>{issued=true;throw Error("no work allowed");}});
 assert.equal(state.state,"WAITING_FOR_PR_VERIFICATION");
 assert.equal(state.processed,0);
 assert.equal(issued,false);
}));

test("only exact green seven-layer documentation PR can enter auto-merge path",()=>{
 const pr={
  number:4141,state:"OPEN",title:"factory: issue #3135 candidate",author:{login:"BryanHarrisScripts"},
  headRefName:"factory/issue-3135-"+HEAD.slice(0,10),headRefOid:HEAD,
  baseRefName:"main",baseRefOid:"b".repeat(40),mergeStateStatus:"CLEAN",
  isDraft:true,files:[{path:"docs/developer-briefs/3135-report.md"}],
  statusCheckRollup:Array.from({length:7},(_,i)=>({
    name:"Layer "+(i+1)+" Verification",status:"COMPLETED",conclusion:"SUCCESS"}))
 };
 const required=[{name:"Architecture Verification",bucket:"pass",state:"SUCCESS"}];
 const base="b".repeat(40);
 assert.equal(reviewDocsOnlyCandidate(pr,required,[3135],base).eligible,true);
 assert.equal(reviewDocsOnlyCandidate({...pr,files:[{path:"app/index.ts"}]},required,[3135],base).code,"PRODUCT_GATE_REQUIRED");
 assert.equal(reviewDocsOnlyCandidate({...pr,baseRefOid:HEAD},required,[3135],base).code,"STALE_BASE_OR_HEAD");
 assert.equal(reviewDocsOnlyCandidate({...pr,statusCheckRollup:pr.statusCheckRollup.slice(1)},required,[3135],base).code,
   "SEVEN_LAYER_ARCHITECTURE_NOT_GREEN");
 assert.equal(reviewDocsOnlyCandidate(pr,[{name:"Architecture",bucket:"pending",state:"IN_PROGRESS"}],[3135],base).eligible,false);
 assert.equal(reviewDocsOnlyCandidate({...pr,author:{login:"Mallory"}},required,[3135],base).eligible,false);
 assert.equal(reviewDocsOnlyCandidate({...pr,files:[{path:"docs/../private.md"}]},required,[3135],base).eligible,false);
});

test("optional docs-only merge reconciler requires exact head, gated CI and confirmed GitHub merge",async()=>{
 const head=HEAD,base="b".repeat(40),number=3135;
 const pr={number:4141,state:"OPEN",title:"factory: issue #3135 candidate",author:{login:"BryanHarrisScripts"},
  headRefName:"factory/issue-3135-"+head.slice(0,10),headRefOid:head,baseRefName:"main",
  baseRefOid:base,mergeStateStatus:"CLEAN",isDraft:true,files:[{path:"docs/3135.md"}],
  statusCheckRollup:Array.from({length:7},(_,i)=>({name:"Layer "+(i+1)+" OK",
     status:"COMPLETED",conclusion:"SUCCESS"}))};
 const calls=[];
 const send=async args=>{
   calls.push(args);
   if(args[0]==="pr"&&args[1]==="list")return JSON.stringify([{number:4141,headRefName:pr.headRefName}]);
   if(args[0]==="pr"&&args[1]==="view"&&args.includes("mergedAt"))return JSON.stringify({
     state:"MERGED",mergedAt:"2026-10-19T22:00:00Z",mergeCommit:{oid:"c".repeat(40)}});
   if(args[0]==="pr"&&args[1]==="view")return JSON.stringify(pr);
   if(args[0]==="pr"&&args[1]==="checks")return JSON.stringify([{name:"required",state:"SUCCESS",bucket:"pass"}]);
   return "";
 };
 const accepted=await reconcileApprovedDocsPRs({issueNumbers:[number],exactBase:base,send});
 assert.equal(accepted.state,"MERGED");
 assert.equal(accepted.mergeSha,"c".repeat(40));
 assert.equal(calls.some(args=>args[0]==="pr"&&args[1]==="merge"&&args.includes("--match-head-commit")&&args.includes(head)),true);
});

test("explicit docs merge consent is separate; service cannot quietly elevate it",()=>sandbox(async root=>{
 const args=parseQueueCommand(["--enable","--issues","3135","--merge-docs","--consent",
   "PLOTPICKLE_AUTONOMOUS_ENGINEERING"]);
 assert.equal(args.mergeDocsOnly,true);
 const state=await enableFactory({root,issues:args.issues,mergeDocsOnly:args.mergeDocsOnly});
 assert.equal(state.documentationAutoMergeEnabled,true);
 const github={exactHead:async()=>HEAD,issues:async()=>[first],pendingFactoryPRs:async()=>0};
 let dispatches=0;
 const response=await runFactoryCycle({root,github,
   preflight:async()=>{throw Error("no provider expected");},publish:async()=>{},
   reconcile:async()=>({state:"MERGED",issueNumber:3135,mergeSha:"c".repeat(40),prNumber:4141}),
   dispatch:async()=>{dispatches++;}});
 assert.equal(response.state,"MERGED");
 assert.equal(dispatches,0);
}));
