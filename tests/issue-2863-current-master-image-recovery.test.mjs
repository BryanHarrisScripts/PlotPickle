import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {build} from "esbuild";
const bundled=await build({entryPoints:["core/contracts/world-map/index.ts"],bundle:true,platform:"node",format:"esm",write:false});
const {normalizeWorldMapState}=await import("data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].text).toString("base64"));
import {missingAfterglowCharacterImages,restoreMissingAfterglowCharacterImages} from "../modules/library/afterglow-image-review.mjs";
import {prepareVerifiedAfterglowMaster,shaAfterglowSnapshot} from "../modules/library/master/afterglow-master-authority.mjs";
import {createProfilePrivateStorageService} from "../core/storage/profile-private/profile-private-storage-core.mjs";
const date="2026-10-11T10:00:00.000Z";
const ref=(id)=>({id,characterId:"ren",characterName:"Ren",versionId:"approved-v1",view:"front-full-body",
  assetUrl:"/api/local-ai/assets/"+id+".webp",prompt:"Synthetic fixture",provider:"fixture",model:"fixture",createdAt:date,reviewState:"approved"});
const master=()=>({id:"afterglow-consolidated-original",title:"Human's master",revision:0,createdAt:date,updatedAt:date,
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}},
  storyDevelopment:{fields:{genre:{value:"Human's resolved genre"}}},
  screenplay:{narration:"Human's resolved narration"},
  worldMap:{version:1,characterVisuals:[{characterId:"ren",characterName:"Ren",references:[ref("kept")],lockedVersionId:"approved-v1",approvedAt:date,updatedAt:date}]}});
const history=()=>{const p=master();p.id="original-source";p.title="Older title";
  p.storyDevelopment.fields.genre.value="Unwanted old alternative";p.worldMap.characterVisuals[0].references.push(ref("missing"),ref("unselected"));return p;};
const sources=()=>[{project:master()},{project:history(),sourceKey:"archived:original-source"}];
const options=()=>missingAfterglowCharacterImages({master:master(),sources:sources(),manifest:{assets:[]}});
const selections=()=>({mode:"missing-character-images",masterSourceId:master().id,decisions:{},exclusions:[],confirmedCurrent:{},imageChoices:{[options()[0].key]:"keep"}});
function prepared(rows=sources(),choices=selections()) {return prepareVerifiedAfterglowMaster({baseline:history(),sources:rows,
  fields:[],questions:{},manifest:{assets:[]},selections:choices,
  expectedSources:rows.map(s=>({key:s.sourceKey??s.project.id,digest:shaAfterglowSnapshot(s.project)})),masterId:"afterglow-consolidated-repaired",now:date});}
test("missing-only recovery preserves every prior decision and existing approved reference",()=>{
  const original=master(),past=history();
  const result=restoreMissingAfterglowCharacterImages({master:original,items:options(),choices:selections().imageChoices});
  const pack=result.worldMap.characterVisuals[0];
  assert.deepEqual(result.storyDevelopment,original.storyDevelopment);
  assert.deepEqual(result.screenplay,original.screenplay);assert.equal(result.title,original.title);
  assert.deepEqual(pack.references[0],original.worldMap.characterVisuals[0].references[0]);
  assert.equal(pack.lockedVersionId,"approved-v1");assert.equal(pack.approvedAt,date);
  assert.equal(pack.references[1].reviewState,"draft");assert.notEqual(pack.references[1].versionId,pack.lockedVersionId);
  assert.deepEqual(normalizeWorldMapState(result.worldMap),result.worldMap,"normalization must preserve drafts and approval exactly");
  assert.equal(pack.references[1].assetUrl,ref("missing").assetUrl);assert.equal(pack.references.length,2);
  assert.deepEqual(master(),original);assert.deepEqual(history(),past);
  assert.equal(prepared().progress.pending,0);
});
test("recovery rejects forged choices, conflicting metadata, narrative changes and stale source bytes",()=>{
  assert.throws(()=>prepared(sources(),{...selections(),decisions:{genre:0}}),/cannot change prior story/);
  assert.throws(()=>prepared(sources(),{...selections(),imageChoices:{forged:"keep"}}),/unambiguous recovery/);
  assert.throws(()=>prepared(sources(),{...selections(),imageChoices:{[options()[0].key]:"exclude"}}),/unambiguous recovery/);
  const rows=sources();rows[0].sourceKey="archived:current";
  assert.throws(()=>prepared(rows),/single current verified/);
  const item={...options()[0],id:"kept"};
  assert.throws(()=>restoreMissingAfterglowCharacterImages({master:master(),items:[item],choices:{[item.key]:"keep"}}),/unambiguous recovery/);
  const args={baseline:history(),sources:sources(),fields:[],questions:{},manifest:{assets:[]},selections:selections(),expectedSources:[]};
  assert.throws(()=>prepareVerifiedAfterglowMaster(args),/snapshots changed/);
});
for (const reusedIdentity of [false,true]) test(`encrypted repair survives fresh storage session and requires the prior master ledger${reusedIdentity?" with historical identity reuse":""}`,async t=>{
  const archived=history();
  if(reusedIdentity)archived.worldMap.characterVisuals[0].references=[{...ref("kept"),assetUrl:"/api/local-ai/assets/historical-kept.webp",view:"secondary-stance"}];
  let repairSelections;
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-2863-recovery-"));
  const auth={resolveSession:()=>({profileId:"profile_fixture_2863"}),createProfileVaultCapability:c=>({profileId:c.profileId,wrapSecret:async({secret})=>({payload:Buffer.from(secret).toString("base64")}),unwrapSecret:async({envelope})=>Uint8Array.from(Buffer.from(envelope.payload,"base64"))}),registerVaultCleanupHook:()=>()=>{}};
  const context={profileId:"profile_fixture_2863",sessionId:"first"};
  const gate=input=>{
    if(input.selections?.mode!=="missing-character-images")return {authorized:true,mediaPins:[]};
    const rows=[...input.originals.map(x=>({project:x.project})),...input.historical];
    const recomputed=prepared(rows,input.selections).candidate;
    assert.deepEqual(input.candidate,recomputed);
    return {authorized:true,mediaPins:[]};
  };
  const make=()=>createProfilePrivateStorageService({root,authService:auth,normalizeProject:p=>structuredClone(p),authorizeAfterglowMasterCommit:gate});
  let store=make();t.after(async()=>{store.close();await rm(root,{recursive:true,force:true});});
  const proofs=async()=>Promise.all((await store.listProjects(context)).filter(s=>!s.archivedAt).map(async s=>{const p=await store.loadProject(context,s.projectId);return {projectId:s.projectId,revision:p.revision,updatedAt:s.updatedAt,digest:shaAfterglowSnapshot(p)};}));
  await store.saveProject(context,{project:archived,summary:{sourceKind:"example",sourceId:"afterglow-v9"},activate:false});
  await store.commitAfterglowMaster(context,{master:master(),sources:await proofs()});
  const rows=[{project:await store.loadAfterglowCurrentMaster(context)},{project:await store.loadProject(context,history().id),sourceKey:"archived:"+history().id}];
  const inventory=missingAfterglowCharacterImages({master:rows[0].project,sources:rows,manifest:{assets:[]}});
  repairSelections={...selections(),imageChoices:{[inventory[0].key]:"keep"}};
  const preparedResult=prepared(rows,repairSelections);
  await store.commitAfterglowMaster(context,{master:preparedResult.candidate,sources:await proofs(),selections:repairSelections,expectedSources:preparedResult.sourceProofs});
  store.close();store=make();
  const reopened=await store.loadAfterglowCurrentMaster({...context,sessionId:"restarted"});
  assert.deepEqual(reopened,preparedResult.candidate);
  assert.deepEqual(await store.loadProject(context,master().id),master());
  assert.deepEqual(await store.loadProject(context,history().id),archived);
  if(reusedIdentity)assert.equal(missingAfterglowCharacterImages({master:reopened,sources:rows,manifest:{assets:[]}}).length,0);
  const fake=master();fake.id="afterglow-consolidated-unverified";
  await store.saveProject(context,{project:fake,summary:{sourceKind:"example",sourceId:"afterglow-v9"},activate:false});
  await assert.rejects(store.commitAfterglowMaster(context,{master:{...fake,id:"afterglow-consolidated-rejected"},sources:await proofs(),selections:{...selections(),masterSourceId:fake.id}}),/single current verified/);
});
test("a convincing master ID without an encrypted commit receipt cannot authorize recovery",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pp-2863-no-ledger-"));
  const context={profileId:"profile_fixture_2863",sessionId:"first"};
  const auth={resolveSession:()=>({profileId:context.profileId}),
    createProfileVaultCapability:()=>({profileId:context.profileId,
      wrapSecret:async({secret})=>({payload:Buffer.from(secret).toString("base64")}),
      unwrapSecret:async({envelope})=>Uint8Array.from(Buffer.from(envelope.payload,"base64"))}),registerVaultCleanupHook:()=>()=>{}};
  let called=false;
  const store=createProfilePrivateStorageService({root,authService:auth,normalizeProject:p=>structuredClone(p),
    authorizeAfterglowMasterCommit:()=>{called=true;return true;}});
  t.after(async()=>{store.close();await rm(root,{recursive:true,force:true});});
  await store.saveProject(context,{project:master(),summary:{sourceKind:"example",sourceId:"afterglow-v9"},activate:false});
  const project=await store.loadProject(context,master().id);
  const summary=(await store.listProjects(context))[0];
  const proof={projectId:project.id,revision:project.revision,updatedAt:summary.updatedAt,digest:shaAfterglowSnapshot(project)};
  await assert.rejects(store.commitAfterglowMaster(context,{master:prepared().candidate,sources:[proof],selections:selections()}),/encrypted master receipt/);
  assert.equal(called,false,"unverified master must fail before the trusted recomputation gate");
  assert.deepEqual(await store.loadProject(context,master().id),project);
  assert.equal((await store.listProjects(context)).filter(s=>s.archivedAt).length,0);
});


test("historical ID reuse restores a distinct draft without replacing an approved frame or repeating recovery",()=>{
  const current=master(),past=history();
  const alternate={...ref("kept"),assetUrl:"/api/local-ai/assets/historical-kept.webp",view:"secondary-stance"};
  past.worldMap.characterVisuals[0].references=[alternate];
  const rows=[{project:current},{project:past,sourceKey:"archived:original-source"}];
  const inventory=missingAfterglowCharacterImages({master:current,sources:rows,manifest:{assets:[]}});
  assert.equal(inventory.length,1);
  const result=restoreMissingAfterglowCharacterImages({master:current,items:inventory,choices:{[inventory[0].key]:"keep"}});
  const pack=result.worldMap.characterVisuals[0];
  assert.deepEqual(pack.references[0],current.worldMap.characterVisuals[0].references[0]);
  assert.equal(pack.lockedVersionId,"approved-v1");assert.equal(pack.approvedAt,date);
  assert.equal(pack.references.length,2);assert.notEqual(pack.references[1].id,alternate.id);
  assert.equal(pack.references[1].assetUrl,alternate.assetUrl);assert.equal(pack.references[1].reviewState,"draft");
  assert.deepEqual(normalizeWorldMapState(result.worldMap),result.worldMap);
  assert.deepEqual(result.storyDevelopment,current.storyDevelopment);assert.deepEqual(result.screenplay,current.screenplay);
  const reopened=JSON.parse(JSON.stringify(result));
  assert.equal(missingAfterglowCharacterImages({master:reopened,sources:rows,manifest:{assets:[]}}).length,0);
  assert.deepEqual(restoreMissingAfterglowCharacterImages({master:current,items:inventory,choices:{[inventory[0].key]:"keep"}}),result,"copy identity is deterministic");
  assert.throws(()=>restoreMissingAfterglowCharacterImages({master:reopened,items:inventory,choices:{[inventory[0].key]:"keep"}}),/unambiguous recovery/);
});
