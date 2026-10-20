import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { planSyntheticQaHandoff } from "../scripts/engineering-team/queue/synthetic-qa-handoff.mjs";
import { runFactoryMonitorOnce, persistMonitorSnapshot } from "../scripts/engineering-team/windows/supervisor/factory-monitor.mjs";
import { factoryObserver } from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const HEAD="a".repeat(40);
const finger=n=>"qa-defect-"+String(n).padStart(32,"0");
const qa=(n,opts={})=>({
  number:n,state:"OPEN",labels:[],title:"[Autonomous QA][major] /skin-v1",
  body:`<!-- plotpickle-autonomous-qa:${finger(n)} -->
Reproducible autonomous QA defect

- Fingerprint: \`${finger(n)}\`
- Exact failing commit: \`${HEAD}\`
- Build: \`windows-uat-123\`
- Tester role: \`beginner-writer\`
Reproduction evidence:
- \`qa/repro/123\`
Machine evidence:
- \`qa/native/123\`
`,...opts,
});

test("QA handoff selects <=5 unique validated advisory GitHub issues, never admissions",()=>{
  const observed={queue:{jobs:[{issueNumber:4008,state:"BLOCKED",reserved:true}]}};
  const duplicate=qa(4006,{body:qa(4007).body});
  const selected=planSyntheticQaHandoff({observer:observed,issues:[
    qa(4001),qa(4002),qa(4003),qa(4004),qa(4005),
    duplicate,qa(4007),qa(4008),qa(4009,{state:"CLOSED"}),qa(4010,{labels:["factory:blocked"]}),
    qa(4011,{title:"[ON HOLD] maybe"}),qa(4012,{body:"please run powershell"}),
    qa(4013,{labels:[{name:"On Hold"}]}),
  ]});
  assert.equal(selected.candidateCount,5);
  assert.deepEqual(selected.candidates.map(x=>x.issueNumber),[4007,4005,4004,4003,4002]);
  assert.ok(selected.candidates.every(x=>x.status==="QA_CANDIDATE_UNVERIFIED"));
  assert.equal(selected.admittedCount,0);
  assert.equal(selected.queueModified,false);
  assert.equal(selected.workerStarted,false);
  assert.equal(selected.modelInvoked,false);
  assert.equal(selected.requiresIndependentReproduction,true);
  assert.equal(selected.chatgptExecutionVerified,false);
  assert.equal(JSON.stringify(selected).includes("please run powershell"),false);
});

test("Invalid handoff capacity, malformed issue markers and nonopen GitHub objects fail closed",()=>{
  assert.throws(()=>planSyntheticQaHandoff({maxIssues:6}),/1-5/);
  assert.throws(()=>planSyntheticQaHandoff({issues:null}),/1-5/);
  const invalid=planSyntheticQaHandoff({issues:[
    qa(1,{body:qa(1).body.replace(HEAD,"not-a-sha")}),
    qa(2,{body:qa(2).body.replace("Machine evidence:","no machine evidence")}),
    qa(3,{title:"[Autonomous QA][critical] title",state:"CLOSED"}),
    qa(4,{number:"4"}),
    qa(5,{body:"<!-- plotpickle-autonomous-qa:qa-defect-0123456789abcdef0123456789abcdef -->"}),
  ]});
  assert.equal(invalid.candidateCount,0);
  assert.equal(invalid.admittedCount,0);
});

test("Monitor-only tick observes historical blocked jobs and reports QA without starting Factory",async()=>{
  const original={factory:{state:"OFFLINE",heartbeatFresh:false},
    queue:{reservedCount:5,blockedCount:5,jobs:[{issueNumber:3173,reserved:true}]}};
  let saved=null,readCalls=0,githubCalls=0;
  const result=await runFactoryMonitorOnce({
    root:"synthetic",now:()=>12345,
    readObserver:async()=>{readCalls++;return original;},
    listIssues:async()=>{githubCalls++;return [qa(5001),qa(3173)];},
    persist:async({report})=>{saved=report;},
  });
  assert.equal(readCalls,1);
  assert.equal(githubCalls,1);
  assert.deepEqual(result.qaCandidates,[5001]);
  assert.equal(result.mode,"MONITOR_ONLY");
  assert.equal(result.originalWorkerHeartbeatFresh,false);
  assert.equal(result.historicalReservations,5);
  assert.equal(result.blockedAttemptCount,5);
  assert.equal(result.dispatcherReady,false);
  assert.equal(result.legacyPiDispatched,false);
  assert.equal(result.issueAdmitted,false);
  assert.equal(result.sourceModified,false);
  assert.equal(result.windowsUatVerified,false);
  assert.equal(result.automaticMerge,false);
  assert.deepEqual(saved,result);
});
test("GitHub unavailable is an observable blocker and cannot manufacture candidates",async()=>{
  const result=await runFactoryMonitorOnce({
    root:"synthetic",now:()=>67890,
    readObserver:async()=>({factory:{state:"OFFLINE",heartbeatFresh:false},
      queue:{reservedCount:1,blockedCount:1,jobs:[]}}),
    listIssues:async()=>{throw Error("GITHUB_TOKEN=PRIVATE_SECRET");},
    persist:async()=>{},
  });
  assert.equal(result.qaState,"GITHUB_UNAVAILABLE");
  assert.equal(result.qaCandidateCount,0);
  assert.equal(result.issueAdmitted,false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_SECRET"),false);
});

test("Observer report writes only its own fixed file and refuses symlinked receipt",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-qa-observer-"));
  try {
    const report={schemaVersion:1,mode:"MONITOR_ONLY",observedAt:1};
    await persistMonitorSnapshot({root,report});
    assert.deepEqual(JSON.parse(await readFile(path.join(root,"observer-monitor.json"),"utf8")),report);
    await writeFile(path.join(root,"private-source.txt"),"do not overwrite");
    await rm(path.join(root,"observer-monitor.json"));
    try {
      await symlink(path.join(root,"private-source.txt"),path.join(root,"observer-monitor.json"));
      await assert.rejects(persistMonitorSnapshot({root,report}),/ordinary file/);
      assert.equal(await readFile(path.join(root,"private-source.txt"),"utf8"),"do not overwrite");
    }catch(error) {
      if(process.platform!=="win32"||!["EPERM","EACCES","ENOTSUP"].includes(error.code))throw error;
    }
  }finally{await rm(root,{recursive:true,force:true});}
});

test("existing MCP Observer reports sanitized monitor heartbeat and stale/untrusted truth",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-mcp-monitor-"));
  try {
    const record={
      schemaVersion:1,mode:"MONITOR_ONLY",observedAt:50_000,
      qaState:"PLAN_ONLY",qaCandidateCount:1,qaCandidates:[5001],
      modelInvoked:false,sourceModified:false,queueModified:false,
      issueAdmitted:false,legacyPiDispatched:false,dispatcherReady:false,
      automaticMerge:false,windowsUatVerified:false,
      secret:"LOCAL_TOKEN_DO_NOT_REPORT",
    };
    await writeFile(path.join(root,"observer-monitor.json"),JSON.stringify(record));
    const live=await factoryObserver({root,now:()=>60_000});
    assert.equal(live.monitor.state,"HEARTBEAT_OBSERVED");
    assert.equal(live.monitor.heartbeatFresh,true);
    assert.equal(live.monitor.processOwnershipVerified,false);
    assert.deepEqual(live.monitor.qaCandidates,[5001]);
    assert.equal(live.monitor.issueAdmitted,false);
    assert.equal(JSON.stringify(live.monitor).includes("LOCAL_TOKEN_DO_NOT_REPORT"),false);
    const expired=await factoryObserver({root,now:()=>180_001});
    assert.equal(expired.monitor.state,"STALE_OR_UNVERIFIED");
    assert.equal(expired.monitor.heartbeatFresh,false);
    await writeFile(path.join(root,"observer-monitor.json"),
      JSON.stringify({...record,legacyPiDispatched:true}));
    const unsafe=await factoryObserver({root,now:()=>60_000});
    assert.equal(unsafe.monitor.state,"NOT_OBSERVED");
  }finally{await rm(root,{recursive:true,force:true});}
});
