import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  parseQueueCommand,eligibleIssue,pickNextIssue,enableFactory,disableFactory,
  readFactoryStatus,runFactoryCycle,serveFactory,createQueueGitHubClient,planNewestFirst,authorizeFactoryRetry,
  admitFactoryIssues,factoryPiVersionGate,
} from "../scripts/engineering-team/windows/autonomous-queue.mjs";
import {parseCoderArgs,assessFactoryPaths,factoryFailureReceipt,factoryWorkerPrompt,factoryBoundedDocument,factoryRejectedPatchReceipt} from "../scripts/engineering-team/windows/autonomous-issue-coder.mjs";
import {
 factoryNpmCache,factoryNpmInstallArgs,factoryNpmFailureCode,
 factoryDependencyFingerprint,checkFactoryDependencyProof,runFactoryDependencyPreflight,
 publishFactoryDependencyPreflightResult,
} from "../scripts/engineering-team/queue/factory-dependency-preflight.mjs";
import {parseFactoryHunkArgs,factoryHunkTarget,factoryHunkReview} from "../scripts/engineering-team/review/factory-hunk.mjs";
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

test("latest-first backlog planner is read-only, finite and excludes blocked issues",()=>{
 assert.equal(parseQueueCommand(["--plan-latest"]).mode,"plan-latest");
 for(const argv of [["--plan-latest","--issues","3148"],["--plan-latest","--consent","PLOTPICKLE_AUTONOMOUS_ENGINEERING"],["--plan-latest","--serve"]]){
   assert.throws(()=>parseQueueCommand(argv));
 }
 const plan=planNewestFirst([
   second,
   {number:3148,title:"Newest authorized candidate",state:"OPEN",labels:[]},
   {...first,title:"[HOLD] blocked task"},
   {...second},
   {number:3146,title:"Ready for review",state:"OPEN",labels:[{name:"factory:blocked"}]},
   {number:3142,title:"Older eligible candidate",state:"OPEN",labels:[]},
   {number:3147,title:"Closed issue",state:"CLOSED",labels:[]},
 ]);
 assert.deepEqual(plan.proposedIssues.map(x=>x.number),[3148,3142,3123]);
 assert.equal(plan.state,"PLAN_ONLY");
 assert.equal(plan.order,"NEWEST_ISSUE_NUMBER_FIRST");
 assert.equal(plan.issuesCsv,"3148,3142,3123");
 assert.equal(plan.queueModified,false);
 assert.equal(plan.workerStarted,false);
 assert.equal(plan.userApprovalRequired,true);
 assert.ok(plan.excluded.some(x=>x.number===3123&&x.reason==="INVALID_OR_DUPLICATE"));
 assert.ok(plan.excluded.some(x=>x.number===3135));
 const limited=planNewestFirst([first,second],{maxIssues:1});
 assert.equal(limited.exceedsSingleApproval,true);
 assert.deepEqual(limited.proposedIssues.map(x=>x.number),[3135]);
 assert.throws(()=>planNewestFirst(undefined));
 assert.throws(()=>planNewestFirst([first],{maxIssues:81}));
 const unknownCapacity=planNewestFirst(Array.from({length:100},(_,i)=>({number:1000+i,title:"An issue",state:"OPEN",labels:[]})));
 assert.equal(unknownCapacity.truncatedAtGithubLimit,true);
 assert.equal(unknownCapacity.exceedsSingleApproval,true);
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

test("second #3141 attempt requires explicit consent and never overwrites first receipt",()=>sandbox(async root=>{
 const old="a".repeat(40),head="b".repeat(40),jobs=path.join(root,"jobs");
 await enableFactory({root,issues:[3141],now:()=>1000});
 await mkdir(jobs,{recursive:true});
 const firstJob={issueNumber:3141,sourceHead:old,attempt:1,replayAuthorized:false};
 const firstResult={issueNumber:3141,head:old,state:"BLOCKED",
   code:"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE",replayAuthorized:false,prUrl:null};
 await writeFile(path.join(jobs,"issue-3141.json"),JSON.stringify(firstJob));
 await writeFile(path.join(jobs,"result-3141.json"),JSON.stringify(firstResult));
 const github={exactHead:async()=>head,issues:async()=>[{
   number:3141,title:"Prove a docs pilot",state:"OPEN",labels:[]}]};
 const inspect=async()=>true;
 const args=["--authorize-retry","--issue","3141","--base",head,
   "--consent","PLOTPICKLE_AUTONOMOUS_ENGINEERING"];
 assert.equal(parseQueueCommand(args).retryBase,head);
 for(const bad of [["--authorize-retry"],[...args.slice(0,-1),"no"],
   ["--authorize-retry","--issue","3142","--base",head,"--consent",
     "PLOTPICKLE_AUTONOMOUS_ENGINEERING"]])assert.throws(()=>parseQueueCommand(bad));
 await assert.rejects(authorizeFactoryRetry({root,expectedHead:old,github,inspect}),/new independently/);
 const approved=await authorizeFactoryRetry({root,expectedHead:head,github,inspect,now:()=>2000});
 assert.equal(approved.state,"RETRY_AUTHORIZED");
 assert.equal(approved.workerStarted,false);
 assert.equal(approved.automaticMergeAuthorized,false);
 await assert.rejects(authorizeFactoryRetry({root,expectedHead:head,github,inspect}),/EEXIST/);
 let dispatched=0;
 const cycle=()=>runFactoryCycle({root,github,publish:async()=>{},now:()=>3000,
   preflight:async()=>({ready:true}),dispatch:async({attempt,issueNumber,head:pin})=>{
     dispatched++;assert.equal(attempt,2);assert.equal(issueNumber,3141);
     assert.equal(pin,head);
     return factoryFailureReceipt("RUN_LOCAL_PI");
   }});
 assert.equal((await cycle()).state,"BLOCKED");
 const secondJob=JSON.parse(await readFile(path.join(jobs,"issue-3141-attempt-2.json"),"utf8"));
 const secondResult=JSON.parse(await readFile(path.join(jobs,"result-3141-attempt-2.json"),"utf8"));
 assert.equal(secondJob.attempt,2);assert.equal(secondJob.sourceHead,head);
 assert.equal(secondResult.phase,"RUN_LOCAL_PI");
 assert.equal(secondResult.replayAuthorized,false);
 assert.deepEqual(JSON.parse(await readFile(path.join(jobs,"issue-3141.json"),"utf8")),firstJob);
 assert.deepEqual(JSON.parse(await readFile(path.join(jobs,"result-3141.json"),"utf8")),firstResult);
 assert.equal((await cycle()).state,"WAITING_FOR_ELIGIBLE_ISSUE");
 assert.equal(dispatched,1);
}));

test("retry denies uncertain original attempt and live factory service",()=>sandbox(async root=>{
 const old="a".repeat(40),head="b".repeat(40),jobs=path.join(root,"jobs");
 await enableFactory({root,issues:[3141]});await mkdir(jobs,{recursive:true});
 await writeFile(path.join(jobs,"issue-3141.json"),JSON.stringify({
   issueNumber:3141,sourceHead:old,attempt:1,replayAuthorized:false}));
 const receipt=path.join(jobs,"result-3141.json");
 await writeFile(receipt,JSON.stringify({issueNumber:3141,head:old,state:"BLOCKED",
   code:"EXECUTION_UNCERTAIN",replayAuthorized:false,prUrl:null}));
 const github={exactHead:async()=>head},inspect=async()=>true;
 await assert.rejects(authorizeFactoryRetry({root,expectedHead:head,github,inspect}),/unverified/);
 await writeFile(receipt,JSON.stringify({issueNumber:3141,head:old,state:"BLOCKED",
   code:"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE",replayAuthorized:false,prUrl:null}));
 await writeFile(path.join(root,"service.lock"),JSON.stringify({pid:process.pid,at:1}));
 await assert.rejects(authorizeFactoryRetry({root,expectedHead:head,github,inspect}),/still alive/);
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
 assert.deepEqual(parseCoderArgs(["--issue","3141","--head",HEAD,"--root",r,"--attempt","2"]),
   {issueNumber:3141,head:HEAD,root:r,attempt:2});
 assert.throws(()=>parseCoderArgs(["--issue","3135","--head",HEAD,"--root",r,"--attempt","2"]));
 assert.throws(()=>parseCoderArgs(["--issue","3141","--head",HEAD,"--root",r,"--attempt","3"]));
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

test("issue #3141 is restricted to its single approved documentation file",()=>{
 const approved="docs/developer-briefs/3141-autonomous-factory-native-acceptance.md";
 assert.equal(assessFactoryPaths([approved],3141).allowed,true);
 assert.equal(assessFactoryPaths([approved],3141).code,"BOUNDED_SOURCE_ONLY");
 assert.equal(assessFactoryPaths(["docs/developer-briefs/other.md"],3141).code,"ISSUE_SCOPE_VIOLATION");
 assert.equal(assessFactoryPaths([approved,"tests/issue-3110-autonomous-factory.test.mjs"],3141).allowed,false);
 assert.equal(assessFactoryPaths(["app/skin-v1/page.ts"],3141).allowed,false);
 assert.equal(assessFactoryPaths(["package.json"],3141).code,"DISALLOWED_SOURCE_PATH");
 assert.equal(assessFactoryPaths([approved],3135).allowed,true);
});

test("factory Hunk 0.23 bridge is opt-in, no extensions, fixed GitHub PR and advisory only",async()=>{
 assert.deepEqual(parseFactoryHunkArgs(["--status"]),{mode:"status"});
 assert.deepEqual(parseFactoryHunkArgs(["--pr","3145"]),{mode:"review",number:3145});
 for(const argv of [[],["--pr","0"],["--pr","-1"],["--pr","1;whoami"],["--pr","https://github.com/evil/x"],["--pr","1","--repo","evil"],["--serve"],["--pr","99999999999"]]){
   assert.throws(()=>parseFactoryHunkArgs(argv),"Rejected "+argv.join(" "));
 }
 assert.deepEqual(factoryHunkTarget(3145),{kind:"pull-request",number:3145});
 assert.throws(()=>factoryHunkTarget(-1));
 let invokes=0;
 const controller={
   capabilities:async()=>({state:"ready",message:"Reviewed Hunk 0.23.0"}),
   command:async()=>"C:\\tools\\hunk.exe",
 };
 const run=async(program,args,options)=>{
   invokes++;assert.equal(program,"powershell.exe");
   assert.equal(args.includes("-NoProfile"),true);
   assert.equal(args.includes("-File"),true);
   assert.equal(args.includes("-HunkCommand"),true);
   assert.equal(args.includes("C:\\tools\\hunk.exe"),true);
   assert.equal(args[args.indexOf("-PullRequest")+1],"3145");
   assert.equal(args.includes("--repo"),false);
   assert.equal(options.timeout,15000);
   return {stdout:JSON.stringify({pid:4567,startTicks:"123456789"})};
 };
 const status=await factoryHunkReview(["--status"],{platform:"win32",controller,run});
 assert.equal(status.state,"HUNK_REVIEW_READY");
 assert.equal(status.mergeAuthority,false);
 assert.equal(invokes,0);
 const launched=await factoryHunkReview(["--pr","3145"],{platform:"win32",controller,run,repositoryRoot:"C:\\repo",bridge:"C:\\bridge.ps1"});
 assert.equal(invokes,1);
 assert.equal(launched.state,"HUNK_ADVISORY_REVIEW_LAUNCHED");
 assert.equal(launched.pullRequest,3145);
 assert.equal(launched.sourceMutation,false);
 assert.equal(launched.independentCiProof,false);
 assert.equal(launched.windowsProductGateProof,false);
 assert.equal(launched.unattendedReview,false);
 await assert.rejects(factoryHunkReview(["--pr","3145"],{platform:"linux",controller,run}),/Windows/);
 await assert.rejects(factoryHunkReview(["--pr","3145"],{platform:"win32",controller,run:async()=>({stdout:"{}"})}),/ownership/);
});

test("coder stage failure receipts are bounded, truthful and do not replay an uncertain issue",()=>sandbox(async root=>{
 for(const phase of ["INSTALL_DEPENDENCIES","RUN_LOCAL_PI","INSPECT_CANDIDATE_PATCH",
   "CHECK_DIFF","RUN_CONTRACTS_UAT","RUN_PRODUCTION_BUILD","RECHECK_BASE_HEAD",
   "STAGE_CANDIDATE","RECHECK_STAGED_PATHS","COMMIT_CANDIDATE",
   "PUSH_CANDIDATE","CREATE_DRAFT_PR"]){
   const receipt=factoryFailureReceipt(phase);
   assert.deepEqual(receipt,{state:"BLOCKED",code:"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE",phase});
   assert.equal(Object.isFrozen(receipt),true);
 }
 const secret="SECRET API TOKEN and private model output";
 assert.equal(factoryFailureReceipt(secret).phase,"UNKNOWN_STAGE");
 assert.equal(JSON.stringify(factoryFailureReceipt(secret)).includes(secret),false);
 assert.deepEqual(factoryFailureReceipt("CREATE_DRAFT_PR",{pushed:true}),
   {state:"BLOCKED",code:"PUSHED_UNCERTAIN",phase:"CREATE_DRAFT_PR"});
 await enableFactory({root,issues:[3141],now:()=>1000});
 const fakeGitHub={exactHead:async()=>HEAD,issues:async()=>[{number:3141,title:"Local docs acceptance",state:"OPEN",labels:[]}]};
 let dispatched=0;
 const once=()=>runFactoryCycle({root,github:fakeGitHub,preflight:async()=>({ready:true}),
   publish:async()=>{},now:()=>2000,dispatch:async()=>{
     dispatched++;return factoryFailureReceipt("RUN_LOCAL_PI");
   }});
 const first=await once();
 assert.equal(first.state,"BLOCKED");
 const saved=JSON.parse(await readFile(path.join(root,"jobs","result-3141.json"),"utf8"));
 assert.equal(saved.code,"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE");
 assert.equal(saved.phase,"RUN_LOCAL_PI");
 assert.equal(saved.replayAuthorized,false);
 const next=await once();
 assert.equal(next.state,"WAITING_FOR_ELIGIBLE_ISSUE");
 assert.equal(dispatched,1);
}));

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
 let issued=false,headChecks=0,issueReads=0;
 const state=await runFactoryCycle({root,preflight:async()=>{throw Error("no provider use allowed");},
   publish:async()=>{},github:{pendingFactoryPRs:async()=>2,
   exactHead:async()=>{headChecks++;return HEAD;},
   issues:async()=>{issueReads++;return [first];}},
   dispatch:async()=>{issued=true;throw Error("no work allowed");}});
 assert.equal(state.state,"WAITING_FOR_PR_VERIFICATION");
 assert.equal(state.processed,0);
 assert.equal(headChecks,1);
 assert.equal(issueReads,0);
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
  baseRefOid:base,mergeStateStatus:"CLEAN",isDraft:false,files:[{path:"docs/3135.md"}],
  statusCheckRollup:Array.from({length:7},(_,i)=>({name:"Layer "+(i+1)+" OK",
     status:"COMPLETED",conclusion:"SUCCESS"}))};
 const calls=[];
 const send=async args=>{
   calls.push(args);
   if(args[0]==="pr"&&args[1]==="list")return JSON.stringify([{number:4141,headRefName:pr.headRefName}]);
   if(args[0]==="pr"&&args[1]==="view"&&args.some(x=>String(x).includes("mergedAt")))return JSON.stringify({
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

test("a green draft PR is made ready first, then independently rechecked before any merge",async()=>{
 const base="b".repeat(40),head=HEAD;
 const pr={number:4141,state:"OPEN",title:"factory: issue #3135 candidate",
   author:{login:"BryanHarrisScripts"},headRefName:"factory/issue-3135-"+head.slice(0,10),
   headRefOid:head,baseRefName:"main",baseRefOid:base,mergeStateStatus:"DRAFT",
   isDraft:true,files:[{path:"docs/3135.md"}],
   statusCheckRollup:Array.from({length:7},(_,i)=>({name:"Layer "+(i+1)+" Green",
     status:"COMPLETED",conclusion:"SUCCESS"}))};
 const calls=[];
 const send=async args=>{
   calls.push(args);
   if(args[1]==="list")return JSON.stringify([{number:4141,headRefName:pr.headRefName}]);
   if(args[1]==="view")return JSON.stringify(pr);
   if(args[1]==="checks")return JSON.stringify([{state:"SUCCESS",bucket:"pass"}]);
   return "";
 };
 const outcome=await reconcileApprovedDocsPRs({issueNumbers:[3135],exactBase:base,send});
 assert.equal(outcome.state,"WAITING_FOR_PR_VERIFICATION");
 assert.equal(calls.some(x=>x[1]==="ready"),true);
 assert.equal(calls.some(x=>x[1]==="merge"),false);
});

test("Pi version gate rejects old virtual-model API before issue reservation",()=>{
 assert.deepEqual(factoryPiVersionGate({ready:false,version:""}),{ready:false,code:"PI_NOT_INSTALLED"});
 for(const version of ["0.73.1","1.2.9","unknown","v1.3.0"]){
   assert.deepEqual(factoryPiVersionGate({ready:true,version}),
     {ready:false,code:"PI_VERSION_UNSUPPORTED"});
 }
 for(const version of ["1.3.0","1.3.1","2.0.0"]){
   assert.deepEqual(factoryPiVersionGate({ready:true,version}),
     {ready:true,code:"PI_VERSION_ACCEPTED"});
 }
});

test("explicit admission grammar is bounded and never grants docs merge",()=>{
 const consent="PLOTPICKLE_AUTONOMOUS_ENGINEERING";
 const parsed=parseQueueCommand(["--admit","--issues","3150,3142","--consent",consent]);
 assert.equal(parsed.mode,"admit");
 assert.deepEqual(parsed.issues,[3150,3142]);
 assert.equal(parsed.mergeDocsOnly,false);
 for(const flags of [
  ["--admit"],["--admit","--issues","3150"],
  ["--admit","--issues","3150,3150","--consent",consent],
  ["--admit","--issues","1,2,3,4,5,6","--consent",consent],
  ["--admit","--issues","3141","--merge-docs","--consent",consent],
  ["--admit","--issues","3","--base",HEAD,"--consent",consent],
  ["--admit","--issues","3","--issue","3","--consent",consent],
 ])assert.throws(()=>parseQueueCommand(flags),flags.join(" "));
});

test("owner can admit a new eligible issue without replaying blocked #3141",()=>sandbox(async root=>{
 const consent="PLOTPICKLE_AUTONOMOUS_ENGINEERING";
 const jobs=path.join(root,"jobs");
 await enableFactory({root,issues:[3141]});
 await mkdir(jobs,{recursive:true});
 const job=JSON.stringify({issueNumber:3141,attempt:1,state:"STARTED_UNCONFIRMED"});
 const result=JSON.stringify({issueNumber:3141,state:"BLOCKED",code:"SOURCE_OR_BUILD_OR_PROVIDER_FAILURE"});
 await writeFile(path.join(jobs,"issue-3141.json"),job);
 await writeFile(path.join(jobs,"result-3141.json"),result);
 const eligible=[{number:3150,title:"New diagnostic issue",state:"OPEN",labels:[]}];
 const github={issues:async()=>eligible,exactHead:async()=>HEAD};
 await assert.rejects(admitFactoryIssues({root,issues:[3150],consent:"yes",github}),/consent/);
 await assert.rejects(admitFactoryIssues({root,issues:[3141],consent,github}),/already admitted/);
 await assert.rejects(admitFactoryIssues({root,issues:[3153],consent,github}),/open, unblocked/);
 await writeFile(path.join(root,"service.lock"),JSON.stringify({pid:process.pid}));
 await assert.rejects(admitFactoryIssues({root,issues:[3150],consent,github}),/Stop the Windows Factory worker/);
 await unlink(path.join(root,"service.lock"));
 const admitted=await admitFactoryIssues({root,issues:[3150],consent,github,now:()=>2500});
 assert.equal(admitted.state,"ISSUES_ADMITTED");
 assert.equal(admitted.workerStarted,false);
 assert.equal(admitted.automaticMergeEnabled,false);
 assert.deepEqual(admitted.added,[3150]);
 const config=JSON.parse(await readFile(path.join(root,"config.json"),"utf8"));
 assert.deepEqual(config.issues,[3141,3150]);
 assert.equal(config.mergeDocsOnly,false);
 assert.equal(config.automaticMergeEnabled,false);
 assert.equal(config.admissions[0].mergingAuthorized,false);
 assert.deepEqual(JSON.parse(await readFile(path.join(jobs,"issue-3141.json"),"utf8")),JSON.parse(job));
 assert.deepEqual(JSON.parse(await readFile(path.join(jobs,"result-3141.json"),"utf8")),JSON.parse(result));
 await assert.rejects(admitFactoryIssues({root,issues:[3150],consent,github}),/already admitted/);
 let dispatched=0;
 const cycle=await runFactoryCycle({root,github,publish:async()=>{},preflight:async()=>({ready:true}),
   dispatch:async({issueNumber,attempt})=>{
     dispatched++;
     assert.equal(issueNumber,3150);
     assert.equal(attempt,1);
     return {state:"BLOCKED",code:"TEST_NO_REAL_AGENT"};
   }});
 assert.equal(cycle.issueNumber,3150);
 assert.equal(dispatched,1);
 assert.equal((await runFactoryCycle({root,github,publish:async()=>{},preflight:async()=>({ready:true}),
   dispatch:async()=>{throw Error("NEVER REPLAY");}})).processed,0);
}));


test("docs-only Windows pilot instructions require a physical write and prohibit conflicting test edits",()=>{
 const head=HEAD;
 const paths=[
  [3141,"docs/developer-briefs/3141-autonomous-factory-native-acceptance.md"],
  [3158,"docs/developer-briefs/factory-native-worker-pilot-acceptance.md"],
  [3160,"docs/developer-briefs/3160-factory-native-write-smoke.md"],
  [3164,"docs/developer-briefs/3164-factory-native-docs-smoke.md"],
 ];
 for(const [number,expected] of paths){
   assert.equal(factoryBoundedDocument(number),expected);
   const prompt=factoryWorkerPrompt({number,title:"Document worker smoke",body:"Create documentation only."},head);
   assert.match(prompt,/MUST make real filesystem changes using your available write\/edit tools/);
   assert.match(prompt,/chat response, proposed diff, or description of changes is NOT a patch/);
   assert.match(prompt,/For documentation-only issues, DO NOT add regression test files/);
   assert.ok(prompt.includes("EXACTLY ONE file: "+expected));
   assert.equal(assessFactoryPaths([expected],number).allowed,true);
   assert.equal(assessFactoryPaths(["tests/unrelated.test.mjs"],number).allowed,false);
   assert.equal(assessFactoryPaths([expected,"docs/another.md"],number).allowed,false);
 }
 assert.equal(factoryBoundedDocument(123),null);
 const ordinary=factoryWorkerPrompt({number:3123,title:"Fix source",body:"Please investigate."},head);
 assert.match(ordinary,/MUST make real filesystem changes/);
 assert.match(ordinary,/For code issues, implement a source-bound fix/);
 assert.doesNotMatch(ordinary,/Documentation-only permission: create or edit EXACTLY ONE file/);
});

test("empty or denied source patches are terminal at the inspection phase and never claim a draft PR",()=>{
 const outcomes=[
   assessFactoryPaths([]),
   assessFactoryPaths(["app/../secrets"]),
   assessFactoryPaths(["docs/not-authorized.md"],3160),
 ];
 for(const assessment of outcomes){
   assert.equal(assessment.allowed,false);
   assert.deepEqual(factoryRejectedPatchReceipt(assessment),{
     state:"BLOCKED",code:assessment.code,phase:"INSPECT_CANDIDATE_PATCH",
   });
   assert.equal("prUrl" in factoryRejectedPatchReceipt(assessment),false);
 }
 assert.equal(factoryRejectedPatchReceipt(assessFactoryPaths([])).code,"NO_BOUNDED_PATCH");
 assert.throws(()=>factoryRejectedPatchReceipt(assessFactoryPaths(["docs/valid.md"])),/Only a failed/);
});

test("factory dependency install uses private reusable npm cache and fail-closed typed diagnostics",()=>{
 const root=path.resolve(os.tmpdir(),"factory-owned-test-root");
 const cache=factoryNpmCache(root);
 assert.equal(cache,path.join(root,"npm-cache"));
 assert.deepEqual(factoryNpmInstallArgs(root),[
   "ci","--ignore-scripts","--no-audit","--no-fund","--prefer-offline","--cache",cache,
 ]);
 assert.equal(factoryNpmFailureCode({killed:true}),"NPM_INSTALL_TIMEOUT");
 assert.equal(factoryNpmFailureCode({stderr:"npm error code EUSAGE"}),"NPM_LOCKFILE_MISMATCH");
 assert.equal(factoryNpmFailureCode({stderr:"npm ERR! code EPERM"}),"NPM_WINDOWS_FILE_ACCESS");
 assert.equal(factoryNpmFailureCode({stderr:"npm error code ECONNRESET"}),"NPM_NETWORK_UNAVAILABLE");
 assert.equal(factoryNpmFailureCode({stderr:"npm ERR! code EINTEGRITY"}),"NPM_INTEGRITY_FAILURE");
 assert.equal(factoryNpmFailureCode({stderr:"ENOENT"}),"NPM_FILE_MISSING");
 assert.equal(factoryNpmFailureCode({stderr:"secret=must-not-leak"}),"NPM_INSTALL_UNCLASSIFIED");
 const base={packageText:'{"name":"x"}'+"\n",lockText:'{"lockfileVersion":3}',nodeVersion:"v24.0.0"};
 assert.equal(factoryDependencyFingerprint(base),factoryDependencyFingerprint({
   ...base,packageText:'{"name":"x"}'+"\r\n",
 }));
 assert.notEqual(factoryDependencyFingerprint(base),factoryDependencyFingerprint({...base,nodeVersion:"v24.0.1"}));
 assert.notEqual(factoryDependencyFingerprint(base),factoryDependencyFingerprint({...base,lockText:"changed"}));
});

test("isolated Windows npm preflight never reserves an issue, preserves failed probe and pins success to manifests",()=>sandbox(async root=>{
 const repoRoot=path.join(root,"repo");
 await mkdir(repoRoot,{recursive:true});
 await writeFile(path.join(repoRoot,"package.json"),'{"name":"unit-fixture"}\n');
 await writeFile(path.join(repoRoot,"package-lock.json"),'{"lockfileVersion":3}\n');
 const nodeVersion="v24.0.0";
 const invocations=[];
 const fakeGit=async args=>{
   invocations.push(args);
   if(args[0]==="rev-parse")return HEAD;
   if(args[0]==="branch")return "main";
   if(args[0]==="status")return "";
   if(args[0]==="worktree")return "";
   throw Error("Unexpected git operation");
 };
 const first=await runFactoryDependencyPreflight({root,repoRoot,platform:"win32",nodeVersion,
   git:fakeGit,now:()=>12345,
   install:async()=>{throw Object.assign(new Error("registry timed out"),{killed:true});}});
 assert.deepEqual(first,{
   state:"BLOCKED",code:"NPM_INSTALL_TIMEOUT",
   phase:"INSTALL_DEPENDENCIES",sourceHead:HEAD,probePreserved:true,
 });
 assert.equal(invocations.some(args=>args[0]==="worktree"),true);
 assert.equal((await checkFactoryDependencyProof({root,repoRoot,nodeVersion})).ready,false);
 await assert.rejects(readFile(path.join(root,"dependency-preflight.json"),"utf8"),/ENOENT/);
 await assert.rejects(readFile(path.join(root,"jobs","issue-3160.json"),"utf8"),/ENOENT/);
 const installCall=[];
 const second=await runFactoryDependencyPreflight({root,repoRoot,platform:"win32",nodeVersion,
   git:fakeGit,now:()=>12346,install:async args=>installCall.push(args)});
 assert.equal(second.state,"INSTALL_PREFLIGHT_READY");
 assert.equal(second.issueReserved,false);
 assert.equal(installCall[0].root,root);
 assert.equal((await checkFactoryDependencyProof({root,repoRoot,nodeVersion})).ready,true);
 const third=await runFactoryDependencyPreflight({root,repoRoot,platform:"win32",nodeVersion,
   git:fakeGit,now:()=>12347,install:async()=>{throw Error("must not reinstall verified digest");}});
 assert.equal(third.existing,true);
 await writeFile(path.join(repoRoot,"package-lock.json"),'{"lockfileVersion":3,"packages":{}}\n');
 assert.equal((await checkFactoryDependencyProof({root,repoRoot,nodeVersion})).ready,false);
 const lock=path.join(root,"service.lock");
 await writeFile(lock,JSON.stringify({pid:123}));
 const blocked=await runFactoryDependencyPreflight({root,repoRoot,platform:"win32",nodeVersion,git:fakeGit});
 assert.equal(blocked.code,"STOP_FACTORY_FIRST");
}));

test("failed npm dependency readiness does not consume one-shot local Factory admission",()=>sandbox(async root=>{
 await enableFactory({root,issues:[3160]});
 const github={exactHead:async()=>HEAD,
   pendingFactoryPRs:async()=>0,
   issues:async()=>[{number:3160,title:"Documentation pilot",state:"OPEN",labels:[]}]};
 let agentDispatched=false;
 const blocked=await runFactoryCycle({root,github,now:()=>2468,
   preflight:async()=>({ready:true}),publish:async()=>{},
   dependencyPreflight:async()=>({ready:false,code:"NPM_PREFLIGHT_REQUIRED"}),
   dispatch:async()=>{agentDispatched=true;throw Error("must never dispatch");}});
 assert.equal(agentDispatched,false);
 assert.equal(blocked.state,"WAITING_FOR_DEPENDENCIES");
 assert.equal(blocked.code,"NPM_PREFLIGHT_REQUIRED");
 assert.equal(blocked.processed,0);
 await assert.rejects(readFile(path.join(root,"jobs","issue-3160.json"),"utf8"),/ENOENT/);
 assert.equal((await readFactoryStatus({root,now:()=>3000})).enabled,true);
 const success=await runFactoryCycle({root,github,now:()=>4000,
   preflight:async()=>({ready:true}),publish:async()=>{},
   dependencyPreflight:async()=>({ready:true,code:"NPM_PREFLIGHT_VERIFIED"}),
   dispatch:async()=>{agentDispatched=true;return {state:"BLOCKED",code:"UNIT_FIXTURE"};}});
 assert.equal(success.processed,1);
 assert.equal(success.issueNumber,3160);
 assert.equal(agentDispatched,true);
 const saved=JSON.parse(await readFile(path.join(root,"jobs","issue-3160.json"),"utf8"));
 assert.equal(saved.replayAuthorized,false);
}));

test("new #3164 acceptance is a uniquely bounded docs-only job; #3160 receipts cannot authorize it",()=>{
 const file="docs/developer-briefs/3164-factory-native-docs-smoke.md";
 assert.equal(factoryBoundedDocument(3164),file);
 assert.equal(assessFactoryPaths([file],3164).allowed,true);
 assert.equal(assessFactoryPaths([file,"tests/fake.test.mjs"],3164).allowed,false);
 assert.equal(assessFactoryPaths(["docs/developer-briefs/3160-factory-native-write-smoke.md"],3164).allowed,false);
 const prompt=factoryWorkerPrompt({number:3164,title:"Local Pi docs smoke",body:"One file only."},HEAD);
 assert.match(prompt,/write\/edit tools/);
 assert.match(prompt,/DO NOT add regression test files/);
 assert.ok(prompt.includes("EXACTLY ONE file: "+file));
});

test("preflight public status receipt is allowlisted and never contains sensitive failure detail",()=>sandbox(async root=>{
 const result=await publishFactoryDependencyPreflightResult({root,now:()=>77,
   result:{state:"BLOCKED",code:"NPM_WINDOWS_FILE_ACCESS",sourceHead:HEAD,
     stderr:"secret: my-token",cache:"C:/Users/private/path",logs:"private"}});
 assert.equal(result.state,"BLOCKED");
 assert.equal(result.code,"NPM_WINDOWS_FILE_ACCESS");
 assert.equal(result.issueReserved,false);
 const raw=await readFile(path.join(root,"dependency-preflight-result.json"),"utf8");
 assert.equal(raw.includes("secret"),false);
 assert.equal(raw.includes("C:/Users"),false);
 assert.equal(JSON.parse(raw).observedAt,77);
 const unknown=await publishFactoryDependencyPreflightResult({root,now:()=>78,
   result:{state:"RUNNING",code:"SECRET=abc",sourceHead:"C:/private"}});
 assert.equal(unknown.state,"BLOCKED");
 assert.equal(unknown.code,"NPM_PREFLIGHT_UNAVAILABLE");
 assert.equal(unknown.sourceHead,null);
 assert.equal(JSON.parse(await readFile(path.join(root,"dependency-preflight-result.json"),"utf8")).issueReserved,false);
}));
