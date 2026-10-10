import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
// Durable review and technical reconciliation execute in the canonical Afterglow lane.
import "./issue-2890-afterglow-resumable-review.test.mjs";
import "./issue-2894-afterglow-technical-reconciliation.test.mjs";
import {prepareVerifiedAfterglowMaster,shaAfterglowSnapshot}
  from "../modules/library/master/afterglow-master-authority.mjs";

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
test("#2863 proposals not accepted by the Human are preserved in history without becoming a decision",async()=>{
  const {afterglowReviewProgress}=await import("../modules/library/afterglow-review-progress.mjs");
  const result=afterglowReviewProgress({
    groups:[{id:"notes",label:"Working notes",items:[
      {id:"agent-1",kind:"unaccepted-agent-suggestion",label:"Agent proposal",reviewPath:null},
      {id:"genre",kind:"saved-answer",label:"Genre",reviewPath:genre},
    ]}],
    candidatePaths:[genre],conflictPaths:[],
    confirmations:{[genre]:true},exclusions:[],decisions:{},
    extraConflicts:[],imageOptions:[],imageChoices:{},
  });
  assert.equal(result.total,1);
  assert.equal(result.completed,1);
  assert.equal(result.needsIndependentReview.length,0);
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

test("#2863 post-save receipt must prove exact master is available in Library, not merely authenticated",async()=>{
  const browser=await readFile(new URL("../core/storage/profile-private-browser.ts",import.meta.url),"utf8");
  const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(browser,/masterSummary = listAfterglowExampleProjects\(\)\.find/u);
  assert.match(browser,/item\.id === receipt\.masterId && !item\.archivedAt/u);
  assert.match(browser,/loadLibraryProjectSnapshot\(receipt\.masterId\)/u);
  assert.match(browser,/masterSnapshot\.sourceEvidence\.referenceFixture\?\.sourceId/u);
  assert.match(browser,/resumeSessionActiveProject\(receipt\.masterId\)/u);
  assert.doesNotMatch(browser,/libraryRefreshed=profilePrivateBrowserReadyFor\(profileId\);/u);
  assert.match(panel,/Library opening is not verified/u);
  assert.match(panel,/role="alert"/u);
  assert.match(panel,/Saved master ID: \{saveReceipt\.masterId\}/u);
  assert.match(panel,/Do not create another example/u);
});

test("#2863 rejected Save is visibly not saved at the action and remains auditable after navigation",async()=>{
  const [api,browser,panel,library]=await Promise.all([
    "../app/api/auth/profile-private/route.ts",
    "../core/storage/profile-private-browser.ts",
    "../modules/library/ui/afterglow-management-panel.tsx",
    "../modules/library/ui/library-workspace.tsx",
  ].map(url=>readFile(new URL(url,import.meta.url),"utf8")));
  assert.match(api,/objectId: "afterglow-master-last-attempt"/u);
  assert.match(api,/status: "started"/u);
  assert.match(api,/status: "blocked", stage, message: reason/u);
  assert.match(api,/status: "saved", stage: "complete", masterId: result\.masterId/u);
  assert.match(api,/afterglowSaveAudit/u);
  assert.match(browser,/readAfterglowMasterSaveAudit/u);
  assert.match(panel,/NOT SAVED — consolidated Afterglow was rejected/u);
  assert.match(panel,/NOT SAVED — last consolidation attempt was blocked/u);
  const savePanel=panel.slice(panel.indexOf('aria-label="Save Consolidated Afterglow"'));
  assert.match(savePanel,/\{saveError \? <div role="alert" className=\{styles\.saveFailure\}/u);
  assert.match(panel,/setLastSaveAudit\(await readAfterglowMasterSaveAudit\(\)\)/u);
  assert.match(library,/const saveAudit = await readAfterglowMasterSaveAudit\(\)/u);
  assert.match(library,/Last saved attempt was blocked at/u);
});

test("#2863 Save invokes independent technical verification after Human decisions",async()=>{
  const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(panel,/const technicalSaveBlockers = preview \?/u);
  assert.match(panel,/preview\.plan\.needsReview\.map/u);
  assert.match(panel,/creativeChoices\.verification\.map/u);
  assert.match(panel,/item\.questionStatus !== "canonical-question-matched"/u);
  assert.match(panel,/textReviewed\?\.unresolvedConflicts/u);
  assert.doesNotMatch(panel,/&& !technicalSaveBlockers\.length/u);
  assert.match(panel,/disabled=\{busy\|\|mediaBusy\|\|preflightBusy\|\|!canSaveMaster\}/u);
  assert.match(panel,/checks[\s\S]*the saved images and approvals automatically/u);
  assert.match(panel,/All green creative decisions remain selected/u);
  assert.match(panel,/if\(!preview \|\| !reviewed \|\| !canSaveMaster \|\| busy \|\| mediaBusy \|\| preflightBusy\)/u);
});
test("#2863 after encrypted readback, success receipt is scrolled and focused into view",async()=>{
  const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(panel,/const savedConfirmationRef = useRef<HTMLElement \| null>\(null\)/u);
  assert.match(panel,/savedConfirmationRef\.current\?\.scrollIntoView\(\{ block: "center" \}\)/u);
  assert.match(panel,/savedConfirmationRef\.current\?\.focus\(\)/u);
  assert.match(panel,/ref=\{savedConfirmationRef\} tabIndex=\{-1\}/u);
  assert.match(panel,/setSaveReceipt\(receipt\);[\s\S]*setPreview\(null\);/u);
  assert.match(panel,/Save Consolidated Afterglow/u);
});

test('#2894 completed creative review reaches independently recomputed master despite image bookkeeping conflicts',()=>{
 const first=source('science fiction','a'),second=source('science fiction','b');
 const image={id:'saved-frame',assetUrl:'/api/local-ai/assets/frame.webp',reviewState:'accepted',workflow:'storyboard-frame-webp-v2',sourceDecisionKeys:['storyboard-local-save:v1'],parentArtifactId:null};
 for(const item of [first,second])item.project.build.foundations={visualArtifacts:[structuredClone(image)],acceptedVisualArtifactIds:['saved-frame']};
 second.project.build.foundations.visualArtifacts[0].sourceDecisionKeys.push('historically-recorded-key');
 const prepared=prepareVerifiedAfterglowMaster(input([first,second],{confirmedCurrent:{[genre]:true}}));
 assert.equal(prepared.progress.pending,0);assert.deepEqual(prepared.candidate.build.foundations.acceptedVisualArtifactIds,['saved-frame']);
 assert.equal(prepared.candidate.world.lessons.genres.answers.genre,'science fiction');
});
