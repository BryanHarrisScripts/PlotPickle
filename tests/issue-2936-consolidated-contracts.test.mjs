import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {validateWhitePaperCoverage,coverageInventoryPaths} from "../lib/verification/development/white-paper-coverage.mjs";

const document=JSON.parse(await readFile("docs/verification/2936-white-paper-coverage.json","utf8"));
const revision=document.legacyInventory.revision;
const git=(args)=>execFileSync("git",args,{maxBuffer:32*1024*1024});
const catalog=JSON.parse(git(["show",`${revision}:config/verification/test-catalog.json`]).toString());
const tracked=git(["ls-tree","-r","--name-only",revision]).toString().trim().split("\n");
const owners=new Map();
for(const entry of catalog.entries)for(const file of entry.runner.targets){const ids=owners.get(file)||[];ids.push(entry.id);owners.set(file,ids);}
const inventoryFiles=new Map();
for(const file of coverageInventoryPaths(tracked,catalog)){
  const binding=catalog.truthGovernance.bindings.find((item)=>item.target===file);
  inventoryFiles.set(file,{bytes:git(["show",`${revision}:${file}`]),catalogueIds:(owners.get(file)||[]).sort(),truthRefs:binding?.truthRefs||[]});
}
const enforcementFiles=new Map();
for(const file of new Set(document.requirements.flatMap((row)=>row.enforcement.references.map((ref)=>ref.path))))enforcementFiles.set(file,await readFile(file,"utf8"));
const sourceFiles=new Map();
for(const truth of catalog.truthGovernance.approvedTruths)sourceFiles.set(truth.source,await readFile(truth.source,"utf8"));
const options={source:sourceFiles.get(document.source.path),catalog,sourceFiles,inventoryFiles,enforcementFiles,catalogueTargets:new Set(owners.keys()),approvedEditions:new Set(catalog.truthGovernance.approvedTruths.map((truth)=>`${truth.id}@${truth.version}`))};

test("consolidated audit preserves all seven layers and every Save/narration obligation without product certification",()=>{
  const result=validateWhitePaperCoverage(document,options);
  assert.equal(result.status,"VALID_AUDIT_PROPOSAL");
  assert.equal(document.layerInventory.length,7);
  assert.equal(document.productContracts.length,17);
  assert.equal(document.productContracts.every((row)=>row.observationStatus==="UNPROVEN"),true);
  assert.equal(document.interpretationConflicts[0].status,"PENDING_HUMAN_REVIEW");
  assert.equal(document.consolidatedIssues.includes(2847)&&document.consolidatedIssues.includes(2855),true);
});

test("consolidated obligation provenance rejects missing, forged, duplicate and stale contract rows",()=>{
  for(const variant of ["missing","duplicate","fragment","edition","mock","target"]){
    const input=structuredClone(document);
    if(variant==="missing")input.productContracts.pop();
    if(variant==="duplicate")input.productContracts[1]=structuredClone(input.productContracts[0]);
    if(variant==="fragment")input.productContracts[0].sourceFragment="Agent-defined replacement";
    if(variant==="edition")input.productContracts[0].version="new-unapproved";
    if(variant==="mock")input.productContracts[0].observationStatus="OBSERVED";
    if(variant==="target")input.productContracts[0].testTargets=["tests/imagined-proof.test.mjs"];
    assert.equal(validateWhitePaperCoverage(input,options).status,"INVALID",variant);
  }
});

test("consolidated baseline cannot omit a layer or certify unreviewed legacy assertions",()=>{
  for(const variant of ["layer","owner","target","certified"]){
    const input=structuredClone(document);
    if(variant==="layer")input.layerInventory.pop();
    if(variant==="owner")input.layerInventory[0].catalogueIds=[];
    if(variant==="target")input.layerInventory[0].targets=[];
    if(variant==="certified")input.layerInventory[0].observationStatus="OBSERVED";
    assert.equal(validateWhitePaperCoverage(input,options).status,"INVALID",variant);
  }
});

test("consolidated audit includes uncatalogued proof lanes and keeps No Bubble meaning unresolved",()=>{
  assert.equal(inventoryFiles.has(".github/workflows/product-gate.yml"),true);
  assert.equal(inventoryFiles.has("scripts/casebook-live-verifiers.mjs"),true);
  const input=structuredClone(document);input.interpretationConflicts[0].status="APPROVED_BY_IMPLEMENTER";
  assert.equal(validateWhitePaperCoverage(input,options).status,"INVALID");
});
