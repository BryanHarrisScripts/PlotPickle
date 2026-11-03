import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  sanitizeOwnerWindowsDiagnostics,inspectOwnerWindowsHost,
  SUPERVISOR_DIAGNOSTIC_SCRIPT_SHA256,
} from "../scripts/engineering-team/mcp/engineering/factory-host-diagnostics.mjs";

const HEAD="a".repeat(40),OTHER="b".repeat(40);
const stamp="2026-11-02T20:02:11.0000000Z";
const sample=()=>({
  schemaVersion:1,taskState:"Ready",lastTaskResult:1,
  lastRunUtc:stamp,nextRunUtc:null,taskEventsState:"OBSERVED",
  taskEvents:[{id:201,timeUtc:stamp,resultCode:"1"}],
  lockState:"ABSENT",lockPid:null,processState:"UNVERIFIABLE",
  stopMarker:"ABSENT",pauseMarker:"ABSENT",
  processOwnershipVerified:false,remediationAuthorized:false,
  Message:"Sensitive Task Scheduler account C:\\Users\\Private",
  CommandLine:"node --token secret"
});
test("#3142 fixed event diagnostics remove raw messages and preserve typed evidence",()=>{
  const observed=sanitizeOwnerWindowsDiagnostics(sample(),HEAD);
  assert.equal(observed.state,"OBSERVED_NOT_RELEASE_PROOF");
  assert.equal(observed.lastTaskResult,1);
  assert.equal(observed.lastRunUtc,stamp);
  assert.equal(observed.nextRunUtc,null);
  assert.equal(observed.taskEventsState,"OBSERVED");
  assert.deepEqual(observed.taskEvents,[{id:201,timeUtc:stamp,resultCode:"1"}]);
  assert.equal(observed.processOwnershipVerified,false);
  assert.equal(observed.remediationAuthorized,false);
  assert.equal(observed.replayAuthorized,false);
  assert.equal(JSON.stringify(observed).includes("Sensitive"),false);
  assert.equal(JSON.stringify(observed).includes("secret"),false);
  const missing=sanitizeOwnerWindowsDiagnostics({
    ...sample(),taskEvents:[],taskEventsState:"NOT_FOUND_IN_BOUNDED_SCAN"
  },HEAD);
  assert.equal(missing.taskEventsState,"NOT_FOUND_IN_BOUNDED_SCAN");
  assert.equal(missing.taskEvents.length,0);
  assert.equal(sanitizeOwnerWindowsDiagnostics({
    ...sample(),taskEvents:[],taskEventsState:"UNAVAILABLE"
  },HEAD).taskEventsState,"UNAVAILABLE");
});
test("#3142 event evidence rejects forged IDs, times, amounts and claimed authority",()=>{
  const bad=[
    {taskEvents:[{id:999,timeUtc:stamp,resultCode:"0"}]},
    {taskEvents:[{id:201,timeUtc:stamp,resultCode:"TOKEN_PRIVATE"}]},
    {taskEvents:[{id:201,timeUtc:"tomorrow",resultCode:"1"}]},
    {taskEvents:[{id:201,timeUtc:stamp,resultCode:"1",message:"private"}]},
    {taskEvents:Array.from({length:9},()=>({id:201,timeUtc:stamp,resultCode:null}))},
    {taskEventsState:"OBSERVED",taskEvents:[]},
    {taskEventsState:"UNAVAILABLE"},
    {nextRunUtc:"not a timestamp"},
    {processOwnershipVerified:true},
    {remediationAuthorized:true},
  ];
  for(const change of bad){
    const input={...sample(),...change};
    assert.equal(sanitizeOwnerWindowsDiagnostics(input,HEAD).state,"BLOCKED",JSON.stringify(change));
  }
});
test("#3142 fixed host adapter runs no caller command and pins checked-in script",async()=>{
  const script=new URL("../scripts/engineering-team/windows/supervisor/Read-PlotPickleSupervisorDiagnostics.ps1",import.meta.url);
  const body=await readFile(script,"utf8");
  assert.match(body,/Get-WinEvent/);
  assert.match(body,/-MaxEvents 256/);
  assert.match(body,/AddHours\(-12\)/);
  assert.match(body,/Microsoft-Windows-TaskScheduler\/Operational/);
  assert.match(body,/PlotPickleIndependentSupervisor/);
  assert.doesNotMatch(body,/\b(?:Start-ScheduledTask|Stop-ScheduledTask|Remove-Item|Set-ScheduledTask)\b/);
  assert.match(SUPERVISOR_DIAGNOSTIC_SCRIPT_SHA256,/^[0-9a-f]{64}$/);
  let invoked=0;
  const outcome=await inspectOwnerWindowsHost({
    expectedHead:HEAD,platform:"win32",scriptPath:script.pathname,
    source:async()=>({head:HEAD,channel:"main"}),
    run:async(program,args,options)=>{
      invoked++;
      assert.equal(program,"powershell.exe");
      assert.deepEqual(args.slice(0,3),["-NoProfile","-NonInteractive","-File"]);
      assert.equal(args.length,4);
      assert.equal(options.shell,undefined);
      return {stdout:JSON.stringify(sample()),stderr:""};
    }
  });
  assert.equal(invoked,1);
  assert.equal(outcome.taskEvents[0].resultCode,"1");
  assert.equal(outcome.processOwnershipVerified,false);
  assert.equal((await inspectOwnerWindowsHost({
    expectedHead:HEAD,platform:"win32",source:async()=>({head:OTHER,channel:"main"})
  })).code,"DIAGNOSTIC_EXACT_MAIN_UNVERIFIABLE");
});
