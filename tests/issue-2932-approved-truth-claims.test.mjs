import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { runLayer, emitEvidence, planVerification } from "../lib/verification/verification-core.mjs";
import { validateEvidenceRecord } from "../lib/verification/verification-contracts.mjs";
import { assessObligationProof } from "../lib/verification/development/proof-routing.mjs";
import { evaluateEvidenceUpdate } from "../build/dsdd/dsdd-evidence-contract.mjs";
import { evaluateCaseRun, loadCasebook } from "../scripts/casebook-contract.mjs";
import { createCaseEvidenceManifest, appendCaseEvidenceArtifact, caseRunFromEvidenceManifest } from "../scripts/casebook-evidence.mjs";
import { runShadowLayer } from "../scripts/verification-shadow.mjs";

const json = async (file) => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
const architecture = await json("architecture/plotpickle.architecture.json");
const caseDefinition = await json("docs/behavioral-contracts/PP-SAVE-001.casebook.json");
const commit = "a".repeat(40);
const verification = { testedCommit: commit, environment: "isolated-test", configuration: "profile-project-artifact-v1", verifiedArtifactRefs: ["artifact://observer/1"] };
const obligation = { contractId: "PP-SAVE-001", contractVersion: "1.0.0", obligationId: "T6",
  promise: caseDefinition.behavioralContract.obligations.find((item) => item.id === "T6").promise,
  scope: "real-product-observation", verifierSource: caseDefinition.independentVerification.source };
const observation = (overrides = {}) => ({ ...obligation, ...verification, ref: "artifact://observer/1",
  source: obligation.verifierSource, finding: "supports", action: "Stop process and reopen project",
  observedResult: "Recovered independently expected identity and approval", independent: true, simulated: false, ...overrides });

function layerFixture(layerId, extra = []) {
  const selectedTests = [{ id: "probe", reasons: [] }, ...extra];
  const layer = { layerId, impacted: true, selectedTests, skippedTests: [], changedFiles: [], riskTokens: [] };
  return { plan: { status: "ready", platform: "linux", mode: "impact", layers: [layer] },
    catalog: { entries: selectedTests.map(({ id }) => ({ id, architectureComponents: [layerId], runner: {kind: "node-test", targets: [`tests/${id}.mjs`]} })) },
    architecture, layerId, commitSha: commit };
}

test("#2932 all seven layers reject missing/unknown runner results and preserve explicit results", async () => {
  for (const layer of architecture.layers) {
    const fixture = layerFixture(layer.id);
    for (const [outcome, expected] of [[{}, "unproven"], [{result:"skipped"}, "unproven"], [{result:"blocked"}, "blocked"], [{result:"pass"}, "pass"], [{result:"fail"}, "fail"]]) {
      const run = await runLayer({...fixture, runners: {"node-test": async () => outcome}});
      assert.equal(run.result, expected, layer.id);
      const evidence = emitEvidence({...fixture, run});
      assert.equal(evidence.result, expected);
      assert.equal(evidence.claims[0].productStatus, "UNPROVEN");
      assert.equal(evidence.claims[0].scope, "execution-only");
    }
  }
});

test("#2932 selection, forged aggregate PASS, partial and duplicate results cannot establish execution", () => {
  const fixture = layerFixture("verification", [{id:"second", reasons:[]}]);
  for (const run of [undefined, {result:"pass", results:[]}, {result:"pass", results:[{id:"probe",result:"pass"}]},
    {result:"pass",results:[{id:"probe",result:"pass"},{id:"probe",result:"pass"}]},
    {result:"unknown",results:[{id:"probe",result:"pass"},{id:"second",result:"pass"}]}]) {
    assert.equal(emitEvidence({...fixture, run}).result, "unproven");
  }
  assert.equal(emitEvidence({...fixture,run:{result:"pass",results:[{id:"probe",result:"fail"}]}}).result,"fail");
  const forged = emitEvidence(fixture);
  forged.result = "pass";
  assert.match(validateEvidenceRecord({evidence: forged, architecture}).join(" "), /PASS requires/u);
  delete forged.claims;
  assert.match(validateEvidenceRecord({evidence: forged, architecture}).join(" "), /bounded execution claims/u);
});

test("#2932 skipped and unaffected execution never prove a product promise", () => {
  const fixture = layerFixture("verification");
  fixture.plan.layers[0].selectedTests=[];
  fixture.plan.layers[0].skippedTests=[{id:"probe",reasonCode:"native-not-authorized",reason:"Native dependency unavailable"}];
  const evidence=emitEvidence(fixture);
  assert.equal(evidence.result,"skipped");
  assert.equal(evidence.claims[0].executionStatus,"UNPROVEN");
  assert.equal(evidence.claims[0].productStatus,"UNPROVEN");
  fixture.plan.layers[0].impacted=false;
  assert.equal(emitEvidence(fixture).result,"not-impacted-beyond-baseline");
});

test("#2932 obligation evidence requires exact approved identity and independently validated product scope", () => {
  assert.equal(assessObligationProof({obligation,evidence:[observation()],...verification}).status,"PASS");
  for (const change of [{contractVersion:"0.9"},{obligationId:"T7"},{testedCommit:"b".repeat(40)},
    {environment:"other-machine"},{configuration:"different-model"},{promise:"Saved flag was set"},
    {scope:"mock"},{simulated:true},{independent:false},{source:"implementation"},{action:""},{observedResult:""}]) {
    assert.equal(assessObligationProof({obligation,evidence:[observation(change)],...verification}).status,"UNPROVEN",JSON.stringify(change));
  }
  assert.equal(assessObligationProof({obligation,evidence:[observation()],...verification,verifiedArtifactRefs:[]}).status,"UNPROVEN");
  assert.equal(assessObligationProof({obligation,evidence:[observation({finding:"blocked",blocker:"Store unavailable"})],...verification}).status,"BLOCKED");
  assert.equal(assessObligationProof({obligation,evidence:[observation(),observation({finding:"contradicts"}),observation({finding:"blocked",blocker:"Store unavailable"})],...verification}).status,"FAIL");
});

test("#2932 DSDD binds product claims to locked requirement and cannot truncate away a contradiction", () => {
  const intentDigest="b".repeat(64);
  const context={...verification,intentVersion:1,intentDigest,requirementId:"R1",promise:obligation.promise,verifierSource:obligation.verifierSource};
  const proof={...observation(),intentVersion:1,intentDigest,requirementId:"R1",testedSource:"PlotPickle",summary:"Observed outcome",proofType:"runtime"};
  assert.equal(evaluateEvidenceUpdate({...context,evidence:[proof]}).status,"PASS");
  for (const change of [{proofType:"test"},{proofType:"ci"},{requirementId:"R2"},{configuration:"changed"},{independent:false}]) {
    assert.equal(evaluateEvidenceUpdate({...context,evidence:[{...proof,...change}]}).status,"UNPROVEN");
  }
  assert.equal(evaluateEvidenceUpdate({...context,verifiedArtifactRefs:[],evidence:[proof],status:"PASS"}).status,"UNPROVEN");
  assert.equal(evaluateEvidenceUpdate({...context,evidence:[{...proof,finding:"blocked",blocker:"Runtime unavailable"}]}).status,"BLOCKED");
  assert.equal(evaluateEvidenceUpdate({...context,evidence:[...Array(12).fill(proof),{...proof,finding:"contradicts"}],status:"PASS"}).status,"FAIL");
});

function contractRun() {
  return {...verification,steps:caseDefinition.humanJourney.map(({id})=>({id,status:"pass"})),
    evidence:[...caseDefinition.requiredEvidence.map(({id,kind})=>({id,kind,status:"verified",independent:true,source:obligation.verifierSource})),
      ...caseDefinition.behavioralContract.obligations.map((item)=>({...observation(),id:`obligation-${item.id}`,status:"verified",obligationId:item.id,promise:item.promise}))]};
}

test("#2932 Casebook requires all approved Save obligations; mock restart remains UNPROVEN", () => {
  const run=contractRun();
  const pass=evaluateCaseRun(caseDefinition,run);
  assert.equal(pass.claimStatus,"PASS");
  assert.equal(pass.obligations.length,8);
  const missing=evaluateCaseRun(caseDefinition,{...run,evidence:run.evidence.filter((item)=>item.obligationId!=="T6")});
  assert.equal(missing.claimStatus,"UNPROVEN");
  assert.equal(missing.obligations.find((item)=>item.obligationId==="T6").status,"UNPROVEN");
  const mocked=evaluateCaseRun(caseDefinition,{...run,evidence:run.evidence.map((item)=>item.obligationId==="T6"?{...item,simulated:true}:item)});
  assert.equal(mocked.claimStatus,"UNPROVEN");
  const failed=evaluateCaseRun(caseDefinition,{...run,blockers:["App unavailable"],evidence:[...run.evidence,observation({finding:"contradicts"})]});
  assert.equal(failed.claimStatus,"FAIL");
});

test("#2932 legacy Casebook contradiction is not hidden by an environment blocker", async () => {
  const casebook=await loadCasebook();
  assert.equal(evaluateCaseRun(casebook.cases[0],{blockers:["Native dependency unavailable"],outcomeContradicted:true}).claimStatus,"FAIL");
  assert.equal(evaluateCaseRun(casebook.cases[0],{}).claimStatus,"UNPROVEN");
});

test("#2932 manifest preserves obligation evidence; verification identity is owned by evaluator", () => {
  const manifest=createCaseEvidenceManifest(caseDefinition,{...verification});
  appendCaseEvidenceArtifact(manifest,{id:"recovery",status:"verified",source:obligation.verifierSource,ref:observation().ref,independent:true,
    obligationEvidence:{...observation(),source:"implementation",ref:"fake",id:"override"}});
  const run=caseRunFromEvidenceManifest(caseDefinition,manifest,verification);
  assert.equal(run.evidence[0].source,obligation.verifierSource);
  assert.equal(run.evidence[0].ref,observation().ref);
  assert.equal(run.evidence[0].id,"recovery");
  assert.equal(run.evidence[0].obligationId,"T6");
  assert.equal(run.testedCommit,commit);
  assert.equal(caseRunFromEvidenceManifest(caseDefinition,manifest).testedCommit,undefined);
});

test("#2932 governance regression belongs to the existing Layer 7 catalogue", async () => {
  const configuration={architecture,phase0Inventory:await json("config/verification/phase-0-inventory.json"),vocabulary:await json("config/verification/phase-1-vocabulary.json"),
    catalog:await json("config/verification/test-catalog.json"),ownership:await json("config/verification/ownership-map.json")};
  const plan=planVerification({...configuration,changedFiles:["lib/verification/development/proof-routing.mjs"],platform:"linux"});
  assert.equal(plan.status,"ready");
  const selected=plan.layers.find((item)=>item.layerId==="verification").selectedTests.map((item)=>item.id);
  const owner=configuration.catalog.entries.find((item)=>item.id==="verification.phase2-core");
  assert.ok(selected.includes(owner.id));
  assert.ok(owner.runner.targets.includes("tests/issue-2932-approved-truth-claims.test.mjs"));
});

test("#2932 CI and local evidence reject a supplied revision different from checked-out HEAD", async () => {
  await assert.rejects(runShadowLayer({layerId:"verification",commitSha:"0".repeat(40)}), /checked-out HEAD/u);
  const result=spawnSync(process.execPath,["scripts/verification-core.mjs","run-layer","experience-skins","--commit-sha","0".repeat(40)],{encoding:"utf8"});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/checked-out HEAD/u);
});
