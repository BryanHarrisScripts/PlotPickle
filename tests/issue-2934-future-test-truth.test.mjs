import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessTestTruthAdmission, assessRepositoryTestTruth, extractApprovedOracle, testSourceDigest, validateTestTruthGovernance } from "../lib/verification/development/test-truth-admission.mjs";
import { runShadowLayer } from "../scripts/verification-shadow.mjs";

const architecture=JSON.parse(await readFile("architecture/plotpickle.architecture.json","utf8"));
const sourcePath="docs/behavioral-contracts/PP-NARR-001.md";
const normative="# Narration\n**Status:** APPROVED HUMAN TRUTH\n**Contract version:** 1.0.0\n\n**B1 — Scope**\nOnly the selected Shot can supply the result.\n**B2 — Execution**\nA mock does not prove inference.\n";
const target="tests/future-scope.test.mjs", input="tests/fixtures/scope.json", code="test('selected Shot',()=>assert.equal(result.shot,expected.shot));\n";
function fixture(layer="verification") {
  const truth={id:"PP-NARR-001",version:"1.0.0",source:sourcePath,sourceDigest:testSourceDigest(normative),approvalRef:"Human-approved contract 1.0.0",obligations:[{id:"B1",start:"**B1 —",end:"**B2 —"}]};
  const binding={target,targetDigest:testSourceDigest(code),catalogueIds:["scope-case"],truthRefs:[{truthId:truth.id,obligationId:"B1"}],scopes:["unit-fixture"],limits:"Fixture scope only; actual model execution remains UNPROVEN.",inputs:[{path:input,digest:testSourceDigest('{"shot":1}')} ]};
  const catalog={entries:[{id:"scope-case",ownerLayer:layer,runner:{kind:"node-test",targets:[target]}}],truthGovernance:{schemaVersion:1,approvedTruths:[truth],bindings:[binding]}};
  const current=new Map([[sourcePath,normative],[target,code],[input,'{"shot":1}']]);
  const base=new Map(current);
  const read=(map)=>async(file)=>{if(!map.has(file))throw new Error("Missing source");return map.get(file);};
  return {catalog,baseCatalog:{entries:structuredClone(catalog.entries)},current,base,
    readCurrent:read(current),readBase:read(base),baseSha:"a".repeat(40),changedFiles:[target]};
}

test("#2934 every architecture layer admits only registered, bound tests using prior approved meaning",async()=>{
  for(const layer of architecture.layers){const f=fixture(layer.id),r=await assessTestTruthAdmission(f);assert.equal(r.status,"ready");assert.deepEqual(r.bindings[0].ownerLayers,[layer.id]);assert.equal(r.bindings[0].truthRefs[0].obligationId,"B1");assert.equal(r.bindings[0].truthRefs[0].oracleDigest,testSourceDigest(extractApprovedOracle(normative,f.catalog.truthGovernance.approvedTruths[0].obligations[0])));}
});

test("#2934 new or revised cases and helper inputs cannot keep a stale approved binding",async()=>{
  for(const [file,value] of [[target,`${code}test('new case',()=>true);`],[input,'{"shot":2}']]){const f=fixture();f.current.set(file,value);f.changedFiles=[file];const r=await assessTestTruthAdmission(f);assert.equal(r.status,"blocked");assert.ok(r.findings.some(x=>x.code==="stale-test-binding"));}
});

test("#2934 new unregistered tests, catalogue targets and renames require explicit truth admission",async()=>{
  for(const variant of ["file","target","rename"]){const f=fixture(),next="tests/unregistered.test.mjs";f.current.set(next,code);if(variant==="target")f.catalog.entries[0].runner.targets.push(next);else f.changedFiles.push(next);if(variant==="rename")f.removedFiles=[target];const r=await assessTestTruthAdmission(f);assert.equal(r.status,"blocked");assert.ok(r.findings.some(x=>x.code==="missing-approved-truth-binding"));}
  const f=fixture();f.catalog.truthGovernance.bindings[0].catalogueIds=["not-an-owner"];assert.ok((await assessTestTruthAdmission(f)).findings.some(x=>x.code==="unregistered-test-target"));
});

test("#2934 untouched legacy tests remain execution-only and do not require invented approval",async()=>{
  const f=fixture();f.catalog.truthGovernance.bindings=[];f.changedFiles=[];assert.equal((await assessTestTruthAdmission(f)).status,"ready");
  f.changedFiles=[target];assert.equal((await assessTestTruthAdmission(f)).status,"blocked");
});

test("#2934 adding an old target to a new catalogue group cannot bypass future-test admission",async()=>{
  const f=fixture();f.changedFiles=[];f.catalog.truthGovernance.bindings=[];f.catalog.entries.push({id:"other-group",ownerLayer:"provider-runtime",runner:{kind:"node-test",targets:[target]}});assert.ok((await assessTestTruthAdmission(f)).findings.some(x=>x.code==="missing-approved-truth-binding"));
});

test("#2934 a proposed truth, wrong version, unknown obligation or same-PR approval cannot serve as oracle",async()=>{
  for(const kind of ["proposal","version","obligation","same-pr","new-document","digest"]){const f=fixture(),truth=f.catalog.truthGovernance.approvedTruths[0];if(kind==="proposal"){const proposal=normative.replace("APPROVED HUMAN TRUTH","PROPOSED Human-truth refinement");f.current.set(sourcePath,proposal);f.base.set(sourcePath,proposal);truth.sourceDigest=testSourceDigest(proposal);}if(kind==="version")truth.version="2.0.0";if(kind==="obligation")f.catalog.truthGovernance.bindings[0].truthRefs[0].obligationId="not-approved";if(kind==="same-pr"){const changed=normative.replace("Only the selected Shot","Any Shot");f.current.set(sourcePath,changed);truth.sourceDigest=testSourceDigest(changed);}if(kind==="new-document")f.base.delete(sourcePath);if(kind==="digest")truth.sourceDigest="0".repeat(64);assert.equal((await assessTestTruthAdmission(f)).status,"blocked",kind);}
});

test("#2934 approval references and existing obligations cannot be amended or removed by test implementation",async()=>{
  for(const kind of ["approval","anchor","remove-source","remove-obligation"]){const f=fixture();f.baseCatalog.truthGovernance=structuredClone(f.catalog.truthGovernance);if(kind==="approval")f.catalog.truthGovernance.approvedTruths[0].approvalRef="Agent self approval";if(kind==="anchor")f.catalog.truthGovernance.approvedTruths[0].obligations[0].start="**B2 —";if(kind==="remove-source")f.catalog.truthGovernance.approvedTruths=[];if(kind==="remove-obligation")f.catalog.truthGovernance.bindings[0].truthRefs=[{truthId:"PP-NARR-001",obligationId:"other"}];assert.equal((await assessTestTruthAdmission(f)).status,"blocked",kind);}
});

test("#2934 missing comparison authority blocks all seven execution adapters before runners",async()=>{
  assert.equal((await assessTestTruthAdmission({...fixture(),baseSha:"unknown"})).status,"blocked");
  for(const layer of architecture.layers)await assert.rejects(runShadowLayer({layerId:layer.id,baseRef:"refs/heads/2934-missing-approved-base"}),/Approved test truth admission BLOCKED/u);
  assert.equal((await assessRepositoryTestTruth({baseRef:"refs/heads/2934-missing-approved-base"})).status,"blocked");
});

test("#2934 unsafe paths and untyped evidence scope cannot become admitted proof",()=>{
  const f=fixture();f.catalog.truthGovernance.bindings[0].target="../outside.test.mjs";f.catalog.truthGovernance.bindings[0].scopes=["everything-works"];assert.ok(validateTestTruthGovernance(f.catalog.truthGovernance).length>0);
});

 test("#2934 briefs and generated proof reports are not executable test inputs", async () => {
  const f = fixture();
  f.changedFiles = ["docs/developer-briefs/2934-future-test-approved-truth.md", ".artifacts/proof-test.json", "reports/future-smoke.js"];
  assert.equal((await assessTestTruthAdmission(f)).status, "ready");
  f.changedFiles = ["scripts/future-proof.mjs"];
  assert.equal((await assessTestTruthAdmission(f)).status, "blocked");
});
