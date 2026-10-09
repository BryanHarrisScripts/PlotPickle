import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {prepareVerifiedAfterglowMaster,shaAfterglowSnapshot}
  from "../modules/library/afterglow-master-authority.mjs";

const date="2026-10-09T09:00:00.000Z";
const base=()=>({
  id:"baseline",format:"2.0-foundation",title:"Afterglow: Reflections of Sentience",
  revision:0,createdAt:date,updatedAt:date,
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}},
  world:{lessons:{genres:{answers:{genre:""}}}},
  foundations:{lessons:{}},
  storyDevelopment:{fields:{}},mindMapNotes:{topics:{},fields:{}},
  worldMap:{version:1,characterVisuals:[]},
  build:{foundations:{acceptedVisualArtifactIds:[],visualArtifacts:[]},
    world:{acceptedVisualArtifactIds:[],visualArtifacts:[]}},
});
const genre="/world/lessons/genres/answers/genre";
const fields=[{topicId:"world",lessonId:"genres",fieldId:"genre",canonicalId:"world:genres:genre",
  lessonTitle:"Genres",validActs:[1,2,3,4],scope:"project-wide",prompt:"What genre is this?"}];
const source=(value,id="working")=>{
  const project=base();project.id=id;project.world.lessons.genres.answers.genre=value;
  return {project,savedAt:date,sourceKind:"working-copy"};
};
const input=(sources,selection={})=>({
  baseline:base(),sources,fields,questions:{"world:genres:genre":"What genre is this?"},
  manifest:{assets:[]},
  selections:{decisions:{},exclusions:[],confirmedCurrent:{},imageChoices:{},...selection},
  expectedSources:sources.map(item=>({key:item.sourceKey??item.project.id,
    digest:shaAfterglowSnapshot(item.project)})),
  masterId:"afterglow-consolidated-tested",now:date,
});
test("#2863 server independent creative authority rejects unchecked yellow current field",()=>{
  const sources=[source("science fiction")],args=input(sources);
  assert.throws(()=>prepareVerifiedAfterglowMaster(args),/All creative sections/u);
  const prepared=prepareVerifiedAfterglowMaster(input(sources,{
    confirmedCurrent:{[genre]:true},
  }));
  assert.equal(prepared.progress.completed,1);
  assert.equal(prepared.progress.pending,0);
  assert.equal(prepared.candidate.world.lessons.genres.answers.genre,"science fiction");
  assert.equal(prepared.candidate.id,"afterglow-consolidated-tested");
  assert.equal(sources[0].project.id,"working","source identity unchanged");
});
test("#2863 exact independent historical snapshot identity and digest must match Human review",()=>{
  const a=source("science fiction");
  const b=source("fantasy");b.sourceKey="point:2026-10-07-557";
  const sources=[a,b];
  const request=input(sources,{decisions:{[genre]:1}});
  const verified=prepareVerifiedAfterglowMaster(request);
  assert.equal(verified.progress.pending,0);
  assert.equal(verified.includedHistorical,1);
  const altered=input(sources,{decisions:{[genre]:1}});
  altered.expectedSources[1]={...altered.expectedSources[1],digest:"sha256:"+"0".repeat(64)};
  assert.throws(()=>prepareVerifiedAfterglowMaster(altered),/source snapshots changed/u);
  const partial=input(sources,{});
  assert.throws(()=>prepareVerifiedAfterglowMaster(partial),/All creative sections/u);
});
test("#2863 no browser approval flag or client-created master is accepted by the authenticated route",async()=>{
  const api=await readFile(new URL("../app/api/auth/profile-private/route.ts",import.meta.url),"utf8");
  const runtime=await readFile(new URL("../core/auth/profile-experience/profile-experience-runtime.ts",import.meta.url),"utf8");
  const storage=await readFile(new URL("../core/storage/profile-private/profile-private-storage-core.mjs",import.meta.url),"utf8");
  assert.match(api,/input.action === "commit-afterglow-master"/u);
  assert.match(api,/prepareServerAfterglowMaster\(/u);
  assert.match(api,/commitAfterglowMaster\(authContext/u);
  assert.doesNotMatch(api,/input\.approved|input\.master\s*[,}]/u);
  assert.match(runtime,/authorizeAfterglowMasterCommit:authorizeServerAfterglowMasterCommit/u);
  assert.match(storage,/ag-history-/u);
  assert.match(storage,/ag-media-/u);
  assert.match(storage,/AFTERGLOW_MEDIA_ESCROW_FAILED/u);
  assert.match(storage,/AFTERGLOW_HISTORY_READBACK_FAILED/u);
  assert.match(storage,/verifiedIndex\.activeProjectId !== masterId/u);
});
test("#2863 user only receives saved confirmation after server encrypted readback",async()=>{
  const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  const browser=await readFile(new URL("../core/storage/profile-private-browser.ts",import.meta.url),"utf8");
  assert.match(panel,/reviewProgress\.allCreativeDecided/u);
  assert.match(panel,/commitConsolidatedAfterglow\(/u);
  assert.match(panel,/Consolidated Afterglow saved successfully/u);
  assert.match(panel,/Library → Examples → Afterglow/u);
  assert.match(panel,/Your original working versions and recovery history remain protected/u);
  assert.match(browser,/await privateMutation\("commit-afterglow-master"/u);
  assert.match(browser,/hydrateProfilePrivateBrowser\(profileId,token,true\)/u);
  assert.match(browser,/receipt\.readbackVerified!==true/u);
});
