import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildVerificationReview } from "../scripts/verification-orchestrator.mjs";

function record(statuses=Array(9).fill("PASS")){
  const categories=["Architecture","Architecture","Curriculum","Production Build","Local AI / Pi","Local AI / Pi","BUZZ","UI / UX UAT","Writer Journey"];
  const stages=statuses.map((status,index)=>({number:index+1,name:`${index+1} of 9 - Stage ${index+1}`,category:categories[index],status,exitCode:status==="PASS"?0:1,detail:""}));
  const passCount=stages.filter(stage=>stage.status==="PASS").length;
  return{runId:"verification-test-12345678",plotPickleVersion:"test",git:{commit:"a".repeat(40),ref:"main"},startedAt:"2026-08-17T10:00:00Z",completedAt:"2026-08-17T10:10:00Z",deterministicResult:passCount===9?"PASS":"FAIL",passCount,totalStages:9,headline:`${passCount}/9`,stages,categoryResults:[...new Set(categories)].map(category=>({category,status:stages.filter(stage=>stage.category===category).every(stage=>stage.status==="PASS")?"PASS":"FAIL"})),failureSummaries:stages.filter(stage=>stage.status!=="PASS").map(stage=>({stage:stage.name,status:stage.status,summary:"deterministic failure"})),integrity:{agentMayOverrideResult:false}};
}

test("clean Full Verification review invents no repair or deterministic failure",()=>{
  const review=buildVerificationReview(record(),null,null);
  assert.equal(review.originalDeterministicResult,"PASS");
  assert.equal(review.repairRequired,false);
  assert.deepEqual(review.deterministicFailures,[]);
  assert.deepEqual(review.likelyProductDefects,[]);
  assert.deepEqual(review.agentObservations,[]);
  assert.deepEqual(review.recommendedRepairOrder,[]);
  assert.match(review.summary,/No repair is required and no findings were invented/);
});

test("agents are advisory and deterministic runner remains sole PASS FAIL authority",()=>{
  const review=buildVerificationReview(record(),{sageConversation:{completed:2},observations:[{kind:"confusion",severity:"medium",summary:"Writer was unsure what to do next",route:"/?workspace=learn",source:"writer",turn:1}],visualReview:{screens:[{}]},diary:[{area:"WYRMWOOD",route:"/?workspace=wyrmwood"}]},{findings:[],harnessFindings:[]});
  const byId=Object.fromEntries(review.participants.map(item=>[item.id,item]));
  assert.equal(byId["deterministic-runner"].authority,"sole-pass-fail-authority");
  assert.equal(byId["sage-brinewick"].authority,"observation-only");
  assert.equal(byId["avery-north"].authority,"synthetic-writer-observation-only");
  assert.equal(byId["visual-observer"].authority,"read-only-rendered-layout-facts");
  assert.equal(byId.wyrmwood.authority,"test-persona-no-grading");
  assert.equal(byId.pi.authority,"bounded-repair-no-grading");
  assert.equal(byId.buzz.authority,"transport-coordination-only");
  assert.equal(review.authority.agentsMayOverridePassFail,false);
});

test("deterministic failure stays failed regardless of advisory observations",()=>{
  const statuses=Array(9).fill("PASS");statuses[7]="FAIL";
  const review=buildVerificationReview(record(statuses),{observations:[{kind:"positive",severity:"low",summary:"Writer liked the screen",source:"writer",turn:1}]},{findings:[],harnessFindings:[]});
  assert.equal(review.originalDeterministicResult,"FAIL");
  assert.equal(review.repairRequired,true);
  assert.equal(review.deterministicFailures.length,1);
  assert.equal(review.agentObservations.length,1);
  assert.match(review.summary,/deterministic failure/);
});

test("runner saves immutable result before advisory orchestration and centralizes GitHub reporting",async()=>{
  const [runner,batch,orchestrator,recordWriter]=await Promise.all([
    readFile(new URL("../scripts/run-plotpickle-full-check.ps1",import.meta.url),"utf8"),
    readFile(new URL("../Run-PlotPickle-Full-Check.bat",import.meta.url),"utf8"),
    readFile(new URL("../scripts/verification-orchestrator.mjs",import.meta.url),"utf8"),
    readFile(new URL("../scripts/verification-record.mjs",import.meta.url),"utf8"),
  ]);
  assert.match(runner,/\$RunId = Write-StructuredVerificationRecord/);
  assert.match(runner,/Invoke-VerificationOrchestrator \$RunId/);
  assert.doesNotMatch(runner,/run-exhaustive-ui-uat\.mjs", "--github-report"/);
  assert.doesNotMatch(runner,/run-writer-in-residence\.mjs", "--github-report"/);
  assert.match(batch,/--github-report/);assert.match(batch,/--repair/);assert.match(batch,/--retest-of/);
  assert.match(orchestrator,/commits\/\$\{record\.git\.commit\}\/comments/);
  assert.match(orchestrator,/run-uat-repair-agent\.mjs/);
  assert.match(orchestrator,/deterministicSuccessClaimed:false/);
  assert.match(recordWriter,/kind: "retest-of"/);
  assert.match(recordWriter,/flag: "wx"/);
});

test("GitHub handoff is one sanitized commit-linked review, not issue flooding",async()=>{
  const source=await readFile(new URL("../scripts/verification-orchestrator.mjs",import.meta.url),"utf8");
  assert.match(source,/const REPO = "BryanHarrisScripts\/PlotPickle"/);
  assert.match(source,/gh.*api/s);
  assert.match(source,/commits\/\$\{record\.git\.commit\}\/comments/);
  assert.doesNotMatch(source,/"issue",\s*"create"/);
  assert.match(source,/redactVerificationText/);
  assert.match(source,/Deterministic tests remain the sole PASS\/FAIL authority/);
});
