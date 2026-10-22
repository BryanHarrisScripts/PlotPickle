import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveActiveLibraryReportsProject,
  summarizeLibraryPpfReport,
} from "../modules/reports/model/library-ppf-report.mjs";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
function syntheticStory(id="current-human-story",title="Synthetic River Story",truncated=false){
  return {
    id,title,revision:7,updatedAt:"2026-10-13T22:00:00.000Z",
    structure:{blocks:Array.from({length:24},(_,i)=>({
      id:`block-${i+1}`,number:i+1,actNumber:Math.floor(i/6)+1,
      title:i===0?"The Choice":`Block ${String(i+1).padStart(2,"0")}`,
      note:i===0?"A real Human plan":"",miniBlocks:Array.from({length:4},(_,j)=>({
        stages:{plan:{acceptedAt:i===0&&j===0?"2026-10-13T22:00:00Z":null},
        storyboard:{acceptedAt:i===0&&j===1?"2026-10-13T22:00:00Z":null}}
      }))
    }))},
    writing:{entries:[{blockNumber:1,miniBlockNumber:1,text:"A new beginning."},{blockNumber:1,miniBlockNumber:2,text:""}]},
    sourceEvidence:{
      screenplay:{sourceFileName:"Synthetic River.fdx",sourceFormat:"fdx",totalPassageCount:truncated?250:3,passagesTruncated:truncated,passages:[
        {id:"p1",sceneId:"s1",sceneNumber:1,type:"action",text:"A river."},
        {id:"p2",sceneId:"s1",sceneNumber:1,type:"dialogue",text:"Hello."},
        {id:"p3",sceneId:"s2",sceneNumber:2,type:"dialogue",text:"Goodbye."}
      ]},
      characterTruth:{claims:[{reviewState:"human-approved",handling:"writer-reference"},
        {reviewState:"proposed",handling:"writer-reference"},
        {reviewState:"human-approved",handling:"sensitive-source"}]}
    },
    storyDevelopment:{fields:{
      a:{value:"Original Human truth",acceptedSource:"human",proposal:"",updatedAt:"2026"},
      b:{value:"",acceptedSource:null,proposal:"Agent suggestion",updatedAt:null},
      c:{value:"Accepted earlier",acceptedSource:"agent-proposal",proposal:"",updatedAt:"2026"}
    }}
  };
}

test("#2956 selected Library PPF identity is necessary and sufficient; never substitute arbitrary legacy state",()=>{
  const current=syntheticStory();
  let calls=0;
  const loadSnapshot=id=>{calls++;assert.equal(id,current.id);return current;};
  assert.equal(resolveActiveLibraryReportsProject({activeProjectId:null,loadSnapshot}),null);
  assert.equal(resolveActiveLibraryReportsProject({activeProjectId:" ",loadSnapshot}),null);
  assert.equal(calls,0,"a missing selection cannot be converted into startup/legacy placeholder");
  assert.strictEqual(resolveActiveLibraryReportsProject({activeProjectId:current.id,loadSnapshot}),current);
  assert.equal(calls,1);
  assert.equal(resolveActiveLibraryReportsProject({activeProjectId:"legacy-unrelated",loadSnapshot:()=>current}),null);
  assert.equal(resolveActiveLibraryReportsProject({activeProjectId:current.id,loadSnapshot:()=>null}),null);
});

test("#2956 active PPF report counts only observed project-owned story evidence",()=>{
  const story=syntheticStory();
  const frozenSource=story.sourceEvidence.screenplay;
  const x=summarizeLibraryPpfReport(story);
  assert.equal(x.id,"current-human-story");assert.equal(x.title,"Synthetic River Story");assert.equal(x.revision,7);
  assert.deepEqual(x.structure,{blocks:24,miniBlocks:96,acts:4,planAccepted:1,storyboardAccepted:1,authoredBlocks:1});
  assert.equal(x.writing.miniBlocksWithText,1);
  assert.equal(x.development.acceptedFields,2);
  assert.equal(x.development.unacceptedProposals,1);
  assert.equal(x.characters.approvedReferenceClaims,1);
  assert.equal(x.characters.countAvailable,false);
  assert.deepEqual(x.imported,{name:"Synthetic River.fdx",format:"fdx",reportedPassages:3,retainedPassages:3,truncated:false});
  assert.deepEqual(x.importedEvidence,{retainedPassages:3,knownSceneReferences:2,dialoguePassages:2,incomplete:false});
  assert.strictEqual(story.sourceEvidence.screenplay,frozenSource);
  assert.equal(story.storyDevelopment.fields.a.value,"Original Human truth");
  assert.equal(story.storyDevelopment.fields.b.acceptedSource,null);
  assert.match(x.unavailable.production,/not certified/i);
  assert.match(x.unavailable.feedback,/not the active Library PPF/i);
  assert.match(x.unavailable.runtime,/not derived/i);
});

test("#2956 imported screenplay retained-only metrics cannot pretend to represent truncated full source",()=>{
  const x=summarizeLibraryPpfReport(syntheticStory("truncated","Synthetic",true));
  assert.equal(x.imported.reportedPassages,250);
  assert.equal(x.imported.retainedPassages,3);
  assert.equal(x.imported.truncated,true);
  assert.equal(x.importedEvidence.incomplete,true);
  assert.equal(x.importedEvidence.dialoguePassages,2);
});

test("#2956 no imported source cannot be interpreted as a truly empty finished film",()=>{
  const story=syntheticStory();story.sourceEvidence.screenplay=null;
  const x=summarizeLibraryPpfReport(story);
  assert.equal(x.imported,null);
  assert.equal(x.importedEvidence.retainedPassages,0);
  assert.equal(x.importedEvidence.incomplete,false);
  assert.match(x.unavailable.scenes,/not verified/i);
  assert.throws(()=>summarizeLibraryPpfReport({id:""}),/identified, selected/i);
});

test("#2956 direct Reports and Matrix exploration both use the same Library-owned route, without legacy fallback",async()=>{
  const [page,surface,dashboard,legacy]=await Promise.all([
    read("app/reports/page.tsx"),
    read("app/reports/library-ppf-reports-workspace.tsx"),
    read("app/_components/dashboard/dashboard-exploration-surface.tsx"),
    read("app/reports-workspace.tsx")
  ]);
  assert.match(page,/sessionActiveProjectId\(\)/);
  assert.match(page,/loadLibraryProjectSnapshot/);
  assert.match(page,/resolveActiveLibraryReportsProject\(/);
  assert.match(page,/PROJECT_LIBRARY_CHANGED_EVENT/);
  assert.match(page,/data-reports-workspace="library-ppf"/);
  for(const notAllowed of ["plotpickle.project.v1","localStorage","createBlankProject","normalizePlotPickleProject","setTimeout"]){
    assert.doesNotMatch(page,new RegExp(notAllowed.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&")),`Reports may not read a legacy/placeholder source: ${notAllowed}`);
  }
  assert.match(dashboard,/import\("\.\.\/\.\.\/reports\/page"\)/);
  assert.match(surface,/data-reports-active-project-id/);
  assert.match(surface,/selectedId \? "Selected story is unavailable"/);
  assert.match(surface,/No active Library story selected/);
  assert.match(surface,/data-reports-evidence="unavailable"/);
  assert.match(surface,/Source coverage/);
  assert.match(surface,/not verified locked image or playable video/i);
  assert.match(legacy,/createConsolidatedReportsModel/,"legacy Reports model remains untouched, not silently migrated into the PPF");
});

test("#2956 Reports is strictly read-only for the selected story, with no alternate data replication",async()=>{
  const [page,model,ui]=await Promise.all([
    read("app/reports/page.tsx"),read("modules/reports/model/library-ppf-report.mjs"),
    read("app/reports/library-ppf-reports-workspace.tsx")
  ]);
  for(const source of [page,model,ui]){
    assert.doesNotMatch(source,/saveActiveLibraryProject|persistActiveProfileProject|writeStoryDevelopmentFieldValue|window\.localStorage|fetch\(\s*["']\/api\//);
  }
  assert.match(ui,/No blank legacy project has been substituted/);
  assert.match(ui,/No legacy project or placeholder has been substituted/);
});

test("#2956 Reports exposes same-tab Dashboard, Library and section-preserving Reload in every selection state", async () => {
  const [surface, styles] = await Promise.all([
    read("app/reports/library-ppf-reports-workspace.tsx"),
    read("app/reports/library-ppf-reports-workspace.module.css"),
  ]);
  assert.match(surface, /aria-label="Reports navigation"/u);
  assert.ok(surface.includes('onClick={onBackDashboard ?? (() => router.push("/skin-v1"))}'));
  assert.ok(surface.includes('onClick={onOpenLibrary ?? (() => router.push("/library"))}'));
  assert.ok(surface.includes('onClick={onRefresh}>Reload Reports</button>'));
  assert.ok(surface.indexOf('aria-label="Reports navigation"') < surface.indexOf('{!checked'));
  assert.match(surface, /Reload Reports/u);
  assert.match(surface, /Refresh Library selection/u);
  assert.doesNotMatch(surface, /<a href="\/(?:skin-v1|library)|href=\{`\/reports|target="_blank"|window\.open\(/u);
  const page = await read("app/reports/page.tsx");
  assert.match(page, /browserProfileAuthGateway\.read\(\)/u);
  assert.match(page, /stageSessionActiveProjectHandoff\(\)/u);
  assert.match(page, /window\.history\.replaceState/u);
  assert.doesNotMatch(page, /location\.assign\(/u);
  assert.match(styles, /\.actions\{display:flex/u);
  assert.match(styles, /\.actions button:focus-visible/u);
  assert.match(styles, /\.stat\[data-hollywood-stage\] strong/u);
});
