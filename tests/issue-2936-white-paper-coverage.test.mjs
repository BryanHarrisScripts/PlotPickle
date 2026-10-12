import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extractWhitePaperUnits, coverageDigest, validateWhitePaperCoverage, renderWhitePaperCoverage } from "../lib/verification/development/white-paper-coverage.mjs";

const source = Array.from({length:13},(_,index)=>`## ${index+1} Test scope\n\nPreserve approved meaning ${index+1}. Never promote a fixture to device proof.`).join("\n\n");
function fixture() {
  const units=extractWhitePaperUnits(source);
  const inventoryFiles=new Map([["tests/legacy.test.mjs",{bytes:Buffer.from("test source"),catalogueIds:["existing-owner"],truthRefs:[]}]]);
  const document={schemaVersion:1,source:{path:"docs/white-papers/AI_Programming_Evolution_White_Paper.md",version:"3.0",digest:coverageDigest(source)},completion:"AUDIT_PROPOSAL",review:{status:"PENDING_HUMAN_REVIEW"},sourceUnits:units.map(({text,...unit})=>({...unit,classification:"CANDIDATE_REQUIREMENT",rationale:"Meaning needs Human review",review:"PENDING_HUMAN_REVIEW"})),requirements:units.map(unit=>({id:`${unit.id}.R01`,sourceUnit:unit.id,sourceFragment:unit.text,fragmentDigest:coverageDigest(unit.text),interpretation:unit.text,interpretationReview:"PENDING_HUMAN_REVIEW",owner:"Verification",expectedOutcome:"Observe agreement with the confirmed promise",negativeControl:"Fixture PASS lacks device observation",limits:"Controlled proposal only",followUpIssues:[2936],enforcement:{status:"UNASSESSED",references:[]},observation:{status:"UNPROVEN",receipts:[]},contractRefs:[],testTargets:[]})),legacyInventory:{revision:"a".repeat(40),files:[{path:"tests/legacy.test.mjs",digest:coverageDigest(Buffer.from("test source")),catalogueIds:["existing-owner"],truthRefs:[],semanticReview:"UNREVIEWED",claimScope:"ENGINEERING_ONLY"}]},engineeringEvidence:[],measurementBaseline:{status:"UNKNOWN",values:null,thresholds:null}};
  return {document,options:{source,inventoryFiles,enforcementFiles:new Map()}};
}
const assess=(f)=>validateWhitePaperCoverage(f.document,f.options);

test("#2936 complete source accounting remains a proposal with zero certified product outcomes",()=>{
  const f=fixture(), result=assess(f);
  assert.equal(result.status,"VALID_AUDIT_PROPOSAL");
  assert.equal(result.productConformance,"UNPROVEN");
  assert.equal(result.humanReview,"PENDING");
  assert.equal(result.sourceUnits,13);
  assert.match(renderWhitePaperCoverage(f.document,result),/Human semantic review pending/u);
});

test("#2936 missing source units, omitted fragments, stale locations and duplicate meaning fail integrity",()=>{
  for(const variant of ["unit","fragment","location","duplicate"]){
    const f=fixture();
    if(variant==="unit")f.document.sourceUnits.pop();
    if(variant==="fragment"){f.document.requirements[0].sourceFragment="Preserve approved meaning 1.";f.document.requirements[0].fragmentDigest=coverageDigest(f.document.requirements[0].sourceFragment);}
    if(variant==="location")f.document.sourceUnits[0].startLine+=1;
    if(variant==="duplicate")f.document.requirements.push(structuredClone(f.document.requirements[0]));
    assert.equal(assess(f).status,"INVALID",variant);
  }
});

test("#2936 execution-only or fixture receipts cannot become observed device/provider conformance",()=>{
  for(const variant of ["observed","mock","approved","complete","engineering"]){
    const f=fixture();
    if(variant==="observed")f.document.requirements[0].observation.status="OBSERVED";
    if(variant==="mock")f.document.requirements[0].observation.receipts=[{scope:"real-device",result:"PASS",mocked:true}];
    if(variant==="approved")f.document.review.status="APPROVED";
    if(variant==="complete")f.document.completion="COMPLETE";
    if(variant==="engineering")f.document.engineeringEvidence=[{scope:"PRODUCT_OBSERVED",revision:"a".repeat(40),url:"https://github.com/example/run",limits:"none"}];
    assert.equal(assess(f).status,"INVALID",variant);
  }
});

test("#2936 baseline inventory detects dropped bytes, altered owners and invented semantic certification",()=>{
  for(const variant of ["missing","digest","owner","binding","certified"]){
    const f=fixture();
    if(variant==="missing")f.document.legacyInventory.files=[];
    if(variant==="digest")f.document.legacyInventory.files[0].digest="0".repeat(64);
    if(variant==="owner")f.document.legacyInventory.files[0].catalogueIds=[];
    if(variant==="binding")f.document.legacyInventory.files[0].truthRefs=[{truthId:"imagined",obligationId:"T1"}];
    if(variant==="certified")f.document.legacyInventory.files[0].semanticReview="AUDITED";
    assert.equal(assess(f).status,"INVALID",variant);
  }
});

test("#2936 partial enforcement is source-pinned, scoped and never whole-paper assurance",()=>{
  const f=fixture(), text="bounded authority guard";
  f.options.enforcementFiles.set("lib/verification/guard.mjs",text);
  f.document.requirements[0].enforcement={status:"PARTIAL",references:[{path:"lib/verification/guard.mjs",digest:coverageDigest(text),scope:"source-only"}]};
  assert.equal(assess(f).status,"VALID_AUDIT_PROPOSAL");
  f.options.enforcementFiles.set("lib/verification/guard.mjs","changed authority");
  assert.equal(assess(f).status,"INVALID");
  f.document.requirements[0].enforcement.status="ENFORCED";
  assert.equal(assess(f).status,"INVALID");
});

test("#2936 real revision-pinned catalogue and source audit keeps all outcomes unproven",()=>{
  const output=execFileSync(process.execPath,["scripts/verification-white-paper-coverage.mjs"],{encoding:"utf8",timeout:60000,maxBuffer:2*1024*1024});
  const result=JSON.parse(output);
  assert.equal(result.status,"VALID_AUDIT_PROPOSAL");
  assert.equal(result.findings.length,0);
  assert.equal(result.productConformance,"UNPROVEN");
  assert.equal(result.humanReview,"PENDING");
  assert.equal(result.sourceUnits,95);
  assert.equal(result.legacyFiles,1287);
});

 test("#2936 unknown test/contract references and invented benefit measurements fail integrity",()=>{
  for(const variant of ["test","contract","benefit"]){
    const f=fixture();
    if(variant==="test")f.document.requirements[0].testTargets=["tests/unregistered.test.mjs"];
    if(variant==="contract")f.document.requirements[0].contractRefs=["PP-NARR-SEQ-001@approved-by-agent"];
    if(variant==="benefit")f.document.measurementBaseline={status:"IMPROVED",values:{escapedFailures:0},thresholds:null};
    assert.equal(assess(f).status,"INVALID",variant);
  }
});
