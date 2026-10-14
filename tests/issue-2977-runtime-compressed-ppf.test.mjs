import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { projectRuntimeGrid } from "../modules/write/model/selected-ppf-runtime-grid.mjs";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const wait = () => new Promise(resolve => setImmediate(resolve));
function film(intent) {
  return {
    id: "current-brotherly-ppf",
    revision: 4,
    title: ".",
    structure: { blocks: Array.from({length:24}, (_, index) => ({
      number: index+1,
      miniBlocks: Array.from({length:4}, (_, ordinal) => ({
        ordinal: ordinal+1,
        stages: { plan: { state:"available", content:"", acceptedAt:null } },
      })),
    })) },
    sourceEvidence: { screenplay: { passages: [{id:"immutable-1",text:"Original source text",blockNumber:1,miniBlockNumber:1}] } },
    writing: { entries:[] },
    storyIntent: intent,
  };
}

test("#2977 compressed 24x96 timing preserves exact structural identities and every frame", () => {
  for (const minutes of [1, 5, 13, 15, 90, 120, 180, 240]) {
    const original = film({format: minutes===120?"Feature":"Short Film",targetMinutes:minutes});
    const unchanged = JSON.stringify(original);
    const grid = projectRuntimeGrid(original);
    assert.equal(grid.status, "runtime-configured");
    assert.equal(grid.projectId, original.id);
    assert.equal(grid.revision, 4);
    assert.deepEqual(grid.structuralCounts, {acts:4,sequences:12,blocks:24,miniBlocks:96});
    assert.equal(grid.blocks.length,24);
    assert.equal(grid.miniBlocks.length,96);
    assert.equal(grid.totalFrames,minutes*60*24);
    assert.equal(grid.blocks.reduce((n,i)=>n+i.durationFrames,0),grid.totalFrames);
    assert.equal(grid.miniBlocks.reduce((n,i)=>n+i.durationFrames,0),grid.totalFrames);
    assert.equal(grid.blocks.at(-1).endFrame,grid.totalFrames);
    assert.equal(grid.miniBlocks.at(-1).endFrame,grid.totalFrames);
    for (let i=0;i<96;i++) {
      const mini=grid.miniBlocks[i];
      assert.equal(mini.blockNumber,Math.floor(i/4)+1);
      assert.equal(mini.ordinal,i%4+1);
      assert.equal(mini.globalNumber,i+1);
      assert.equal(mini.durationFrames,minutes*15);
      assert.equal(mini.startFrame,minutes*15*i);
      if (i) assert.equal(grid.miniBlocks[i-1].endFrame,mini.startFrame);
      if(i%4===0) assert.equal(grid.blocks[i/4].startFrame,mini.startFrame);
      if(i%4===3) assert.equal(grid.blocks[Math.floor(i/4)].endFrame,mini.endFrame);
    }
    assert.equal(grid.shotPlanningSlotSeconds,(minutes*60)/2400);
    assert.equal(grid.defaultThreeSecondPresetFits,minutes===120);
    assert.equal(grid.requiresTimingReview,minutes!==120);
    assert.equal(grid.mediaGenerated,false);
    assert.equal(grid.canonicalStoryChanged,false);
    assert.equal(Object.isFrozen(grid.miniBlocks),true);
    assert.equal(JSON.stringify(original),unchanged,"the screenplay/plan and film identity must remain unchanged");
  }
});
test("#2977 preexisting PPF and invalid inputs never invent a feature runtime", () => {
  const missing=film(undefined);
  const x=projectRuntimeGrid(missing);
  assert.equal(x.status,"runtime-unset");
  assert.match(x.reason,/No feature default was inferred/);
  assert.equal("targetMinutes" in x,false);
  for (const bad of [{format:"Short Film",targetMinutes:0},{format:"Feature",targetMinutes:241},
    {format:"Short Film",targetMinutes:12.5},{format:"Feature",targetMinutes:"120"},
    {format:"Unknown",targetMinutes:15}]) {
    assert.equal(projectRuntimeGrid(film(bad)).status,"runtime-invalid");
  }
  assert.throws(()=>projectRuntimeGrid(null),/selected Library PPF/);
  const broken=film({format:"Short Film",targetMinutes:15});
  broken.structure.blocks.pop();
  assert.throws(()=>projectRuntimeGrid(broken),/canonical 24 Blocks and 96 Mini-Blocks/);
});
function actualFilmProfileHandler(source) {
  const start=source.indexOf("  async function saveFilmProfile() {");
  const end=source.indexOf("  function useSourceAsStartingPoint()",start);
  assert.ok(start>0 && end>start,"must use the real installed Write Save handler");
  return stripTypeScriptTypes(source.slice(start,end))+"\nsaveFilmProfile";
}
async function runProfileSave({reject=false, switched=false, title="Brotherly Love", format="Short Film", minutes="15", dirty=false, priorIntent=null}={}) {
  const write=await read("modules/write/ui/block-native-write-workspace.tsx");
  const original=film(priorIntent);const untouchedSource=JSON.stringify(original.sourceEvidence);
  const state={project:original,visibleProject:original,status:"",calls:[],saving:false,activeId:original.id,
    summary:{id:original.id,title:original.title,format:"Imported screenplay"}};
  let finish,abort;
  const encryptedWrite=new Promise((resolve,reject)=>{finish=resolve;abort=reject});
  const ctx={
    project:original, dirty, filmTitleInput:title,filmFormatInput:format,filmMinutesInput:minutes,
    filmSaveInFlightRef:{current:false}, saveInFlightRef:{current:false}, savingWorkingText:false,
    setSavingFilmProfile(x){state.saving=x;},
    setStatus(x){state.status=x;},
    setProject(x){state.visibleProject=x; state.calls.push("verified-display");},
    normalizeLibraryStoryIntent(x){
      if(!["Short Film","Feature"].includes(x.format)||!Number.isInteger(x.targetMinutes)
        ||x.targetMinutes<1||x.targetMinutes>240)return null;
      return x;
    },
    listLibraryProjects(){return [state.summary];},
    saveActiveLibraryProject(x,formatOverride){
      state.project=x;
      state.summary={...state.summary,title:x.title,format:formatOverride||x.storyIntent?.format||state.summary.format};
      state.calls.push("stage:"+x.revision);
      return x;
    },
    loadActiveLibraryProject(){return state.project;},
    sessionActiveProjectId(){return state.activeId;},
    async persistActiveProfileProject(token,id){state.calls.push("encrypted:"+id);await encryptedWrite;},
    async flushProfilePrivateWrites(){state.calls.push("flush");},
    Date, String, Number, Error,
  };
  const run=vm.runInNewContext(actualFilmProfileHandler(write),ctx);
  const promise=run();
  await wait();
  if (state.calls.includes("encrypted:"+original.id)) {
    assert.equal(state.saving,true,"Save remains visibly pending during encryption");
    assert.equal(state.calls.includes("verified-display"),false,"staged cache is not confirmed");
    if(switched)state.activeId="other-profile-project";
    if(reject)abort(new Error("Injected protected vault rejection"));else finish();
  }
  await promise;
  assert.equal(state.saving,false);
  assert.equal(ctx.filmSaveInFlightRef.current,false);
  assert.equal(JSON.stringify(state.project.sourceEvidence),untouchedSource);
  return state;
}
test("#2977 real Write film profile Save awaits encrypted confirmation and retains imported screenplay",async()=>{
  const x=await runProfileSave();
  assert.deepEqual(x.calls,["stage:5","encrypted:current-brotherly-ppf","flush","verified-display"]);
  assert.equal(x.visibleProject.title,"Brotherly Love");
  assert.deepEqual(JSON.parse(JSON.stringify(x.visibleProject.storyIntent)),{format:"Short Film",targetMinutes:15});
  assert.equal(x.visibleProject.revision,5);
  assert.deepEqual(x.summary,{id:"current-brotherly-ppf",title:"Brotherly Love",format:"Short Film"});
  assert.equal(projectRuntimeGrid(x.visibleProject).miniBlocks[0].durationSeconds,9.375);
  assert.match(x.status,/Encrypted PPF film profile confirmed/);
});
test("#2977 rejected encrypted write fails closed and restores previous current PPF snapshot",async()=>{
  const x=await runProfileSave({reject:true});
  assert.deepEqual(x.calls,["stage:5","encrypted:current-brotherly-ppf","stage:4"]);
  assert.equal(x.project.title,".");
  assert.equal(x.project.storyIntent,null);
  assert.deepEqual(x.summary,{id:"current-brotherly-ppf",title:".",format:"Imported screenplay"});
  assert.equal(x.visibleProject.revision,4);
  assert.match(x.status,/Save not confirmed/);
});
test("#2977 changed selected PPF cannot produce false confirmed runtime",async()=>{
  const x=await runProfileSave({switched:true});
  assert.equal(x.calls.includes("verified-display"),false);
  assert.match(x.status,/Save not confirmed/);
});
test("#2977 invalid or unsaved Human input never mutates the PPF",async()=>{
  for(const overrides of [{title:"."},{format:""},{minutes:"12.5"},{minutes:""},{minutes:"241"},{dirty:true}]) {
    const x=await runProfileSave(overrides);
    assert.equal(x.calls.length,0,JSON.stringify(overrides));
    assert.equal(x.project.title,".");
    assert.equal(x.visibleProject.title,".");
    assert.doesNotMatch(x.status,/confirmed:/);
  }
});
test("#2977 no unnecessary new revision for already confirmed identity",async()=>{
  const x=await runProfileSave({priorIntent:{format:"Short Film",targetMinutes:15},title:".",format:"Short Film",minutes:"15"});
  // A punctuation-only title still cannot be silently accepted as confirmed.
  assert.equal(x.calls.length,0);
  assert.match(x.status,/actual film title/);
});
test("#2977 real Write binds current PPF runtime, explicit Human choices and no fake 3s timing",async()=>{
  const [write,contract,store]=await Promise.all([
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("core/storage/library-project.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);
  assert.match(write,/projectRuntimeGrid\(project\)/);
  assert.match(write,/data-selected-ppf-runtime-status=\{runtimeGrid.status\}/);
  assert.match(write,/Shot and motion timing need a separately authored review/);
  assert.match(write,/filmTitleInput/);
  assert.match(write,/filmFormatInput/);
  assert.match(write,/filmMinutesInput/);
  assert.match(write,/persistActiveProfileProject\("", saveProjectId\)/);
  assert.match(write,/flushProfilePrivateWrites\(\)/);
  assert.match(write,/reread\.storyIntent\?\.format/);
  assert.match(contract,/normalizeLibraryStoryIntent\(source\.storyIntent\)/);
  assert.match(store,/initialized\.activeProject\.storyIntent/);
  assert.match(store,/format: selectedFormat/);
  assert.match(write,/confirmedSummary\.format !== intent\.format/);
  assert.doesNotMatch(write,/setFilmMinutesInput\("120"\)/);
});
