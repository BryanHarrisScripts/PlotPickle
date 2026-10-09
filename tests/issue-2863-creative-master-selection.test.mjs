import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {planAfterglowConsolidation,reviewAfterglowConsolidationDecisions} from "../modules/library/afterglow-consolidation.mjs";
import {inventoryAfterglowRecoveredWork,afterglowRecoveryItemPath} from "../modules/library/afterglow-work-recovery.mjs";

const date=i=>"2026-10-"+String(i).padStart(2,"0")+"T12:00:00.000Z";
const key="character:characters-engine:output-1";
const definitions=[
  {canonicalId:"world:genres:output-1",topicId:"world",lessonId:"genres",lessonTitle:"Genres",fieldId:"output-1"},
  {canonicalId:"world:story-bible:output-1",topicId:"world",lessonId:"story-bible",lessonTitle:"Story Bible",fieldId:"output-1"},
  {canonicalId:key,topicId:"character",lessonId:"characters-engine",lessonTitle:"Character engine",fieldId:"output-1"},
];
function baseline(){
  return {
    id:"provided",format:"2.0-foundation",title:"Afterglow",revision:0,
    createdAt:date(1),updatedAt:date(1),
    sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"fixed"}},
    world:{lessons:{genres:{answers:{"output-1":"Drama"}},"story-bible":{answers:{"output-1":"Original Bible"}}}},
    storyDevelopment:{fields:{}},mindMapNotes:{fields:{},topics:{}},
    production:{graphicNovelTextApprovals:[]},
    build:{foundations:{visualArtifacts:[],acceptedVisualArtifactIds:[]},
      world:{visualArtifacts:[],acceptedVisualArtifactIds:[]}},
    worldMap:{characterVisuals:[]},
  };
}
function saved(base,id,day,change){
  const project=structuredClone(base);project.id=id;project.updatedAt=date(day);project.revision=day;
  change(project);return {project};
}
const field = (value,day)=>({
  value,acceptedSource:"human",proposal:"",proposalSourceRef:null,proposalGeneratedAt:null,updatedAt:date(day),
});
const prompt={ [key]:"How does the character confront opposition?" };
const plan = (base,versions)=>planAfterglowConsolidation({baseline:base,sources:versions,questions:prompt});

test("#2863 N to one read-only candidate accepts October 8 and 9 together with original copies unchanged",()=>{
  const base=baseline();
  const a=saved(base,"oct-08",8,p=>{p.world.lessons.genres.answers["output-1"]="Drama / action";p.storyDevelopment.fields[key]=field("Joy confronts Kai",8);});
  const b=saved(base,"oct-09",9,p=>{p.world.lessons["story-bible"].answers["output-1"]="Joy and Kai form an AI family";p.storyDevelopment.fields[key]=field("Joy protects Jai",9);});
  const untouched=structuredClone([a,b]);
  const original=plan(base,[a,b]);
  const conflict=original.conflicts.find(item=>item.path==="/storyDevelopment/fields/"+key);
  assert.ok(conflict);
  const draft=reviewAfterglowConsolidationDecisions(original,{[conflict.path]:1});
  assert.equal(draft.candidate.storyDevelopment.fields[key].value,"Joy protects Jai");
  assert.equal(draft.candidate.world.lessons.genres.answers["output-1"],"Drama / action");
  assert.equal(draft.candidate.world.lessons["story-bible"].answers["output-1"],"Joy and Kai form an AI family");
  assert.deepEqual([a,b],untouched);
  assert.equal(draft.readyForHumanCommit,false);
  assert.equal(draft.packageModified,false);
});
test("#2863 excludes one compatible genres edit without removing another compatible Story Bible edit",()=>{
  const base=baseline();
  const a=saved(base,"oct-08",8,p=>{p.world.lessons.genres.answers["output-1"]="Drama / action";});
  const b=saved(base,"oct-09",9,p=>{p.world.lessons["story-bible"].answers["output-1"]="The AI family travels";});
  const p=plan(base,[a,b]), path="/world/lessons/genres/answers/output-1";
  const original=structuredClone(p);
  assert.ok(p.applied.some(item=>item.path===path));
  const excluded=reviewAfterglowConsolidationDecisions(p,{},[path]);
  assert.equal(excluded.candidate.world.lessons.genres.answers["output-1"],"Drama");
  assert.equal(excluded.candidate.world.lessons["story-bible"].answers["output-1"],"The AI family travels");
  assert.deepEqual(excluded.excluded,[path]);
  const restored=reviewAfterglowConsolidationDecisions(p,{},[]);
  assert.equal(restored.candidate.world.lessons.genres.answers["output-1"],"Drama / action");
  assert.deepEqual(p,original);
});
test("#2863 excluding a newly authored Character field removes only that new draft field",()=>{
  const base=baseline();
  const a=saved(base,"oct-08",8,p=>{
    p.storyDevelopment.fields[key]=field("Kai wants freedom",8);
    p.mindMapNotes.fields["theme:1"]={text:"Freedom requires trust",updatedAt:date(8)};
  });
  const p=plan(base,[a]), path="/storyDevelopment/fields/"+key;
  assert.equal(p.applied.find(item=>item.path===path).baselineAbsent,true);
  const excluded=reviewAfterglowConsolidationDecisions(p,{},[path]);
  assert.equal(Object.hasOwn(excluded.candidate.storyDevelopment.fields,key),false);
  assert.equal(excluded.candidate.mindMapNotes.fields["theme:1"].text,"Freedom requires trust");
  assert.equal(a.project.storyDevelopment.fields[key].value,"Kai wants freedom");
});
test("#2863 deliberate exclusions cannot target unreviewed, duplicate or conflicting approved paths",()=>{
  const base=baseline();
  const a=saved(base,"oct-08",8,p=>{p.storyDevelopment.fields[key]=field("Kai is loyal",8);});
  const b=saved(base,"oct-09",9,p=>{p.storyDevelopment.fields[key]=field("Kai leaves",9);});
  const p=plan(base,[a,b]),path="/storyDevelopment/fields/"+key;
  assert.throws(()=>reviewAfterglowConsolidationDecisions(p,{},[path]),/outside the automatically merged draft/u);
  assert.throws(()=>reviewAfterglowConsolidationDecisions(p,{},["/unknown"]),/outside the automatically merged draft/u);
  assert.throws(()=>reviewAfterglowConsolidationDecisions(p,{},["/unknown","/unknown"]),/unique canonical paths/u);
  assert.throws(()=>reviewAfterglowConsolidationDecisions(p,{},[null]),/unique canonical paths/u);
  assert.equal(reviewAfterglowConsolidationDecisions(p,{[path]:"baseline"}).candidate.storyDevelopment.fields[key],undefined);
});
test("#2863 recovery labels map to canonical World and Character destinations, not media/Agent proposals",()=>{
  const base=baseline();
  const a=saved(base,"oct-08",8,p=>{
    p.world.lessons.genres.answers["output-1"]="Drama / action";
    p.world.lessons["story-bible"].answers["output-1"]="The AI family travels";
    p.storyDevelopment.fields[key]=field("Joy protects Kai",8);
    p.mindMapNotes.fields[key]={text:"Keep this character tension",updatedAt:date(8)};
    p.storyDevelopment.fields[key].proposal="Unaccepted alternative";
  });
  const recovered=inventoryAfterglowRecoveredWork({baseline:base,sources:[a],fields:definitions});
  const items=recovered.groups.flatMap(g=>g.items);
  const paths=items.map(item=>[item.kind,afterglowRecoveryItemPath(item,definitions)]);
  assert.ok(paths.some(([kind,path])=>kind==="saved-answer" && path==="/world/lessons/genres/answers/output-1"));
  assert.ok(paths.some(([kind,path])=>kind==="saved-answer" && path==="/world/lessons/story-bible/answers/output-1"));
  assert.ok(paths.some(([kind,path])=>kind==="saved-answer" && path==="/storyDevelopment/fields/"+key));
  assert.ok(paths.some(([kind,path])=>kind==="human-note" && path==="/mindMapNotes/fields/"+key));
  assert.ok(paths.some(([kind,path])=>kind==="unaccepted-agent-suggestion" && path===null));
});
test("#2863 selected Graphic Novel caption stays whole and maintains saved approval provenance",()=>{
  const base=baseline(),shot="storyboard-anchor:block:block-01:mini-1";
  const approval=(caption,day)=>({anchorRef:shot,position:1,sourceKey:"shot-original",
    narration:caption,bubbles:[],noText:false,approvedAt:date(day)});
  const a=saved(base,"oct-08",8,p=>{p.production.graphicNovelTextApprovals=[approval("Hello Kai",8)];});
  const b=saved(base,"oct-09",9,p=>{p.production.graphicNovelTextApprovals=[approval("Goodbye Kai",9)];});
  const p=plan(base,[a,b]);
  assert.equal(p.conflicts.length,1);
  const selected=reviewAfterglowConsolidationDecisions(p,{[p.conflicts[0].path]:1});
  assert.deepEqual(selected.candidate.production.graphicNovelTextApprovals[0],approval("Goodbye Kai",9));
  assert.equal(selected.candidate.production.graphicNovelTextApprovals[0].sourceKey,"shot-original");
  assert.deepEqual(a.project.production.graphicNovelTextApprovals,[approval("Hello Kai",8)]);
});
test("#2863 new creative review actions remain read-only with a single pending master save",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(ui,/Build one current Afterglow/u);
  assert.match(ui,/afterglowRecoveryItemPath\(item,canonicalFields\)/u);
  assert.match(ui,/Exclude from draft/u);
  assert.match(ui,/Restore to draft/u);
  assert.match(ui,/Use this saved version/u);
  assert.match(ui,/Compare saved creative decisions/u);
  assert.match(ui,/reviewAfterglowConsolidationDecisions\(preview.plan, decisions, exclusions\)/u);
  assert.match(ui,/selectionFingerprint = JSON.stringify\(\{ decisions, exclusions \}\)/u);
  assert.match(ui,/mediaState\.choices === selectionFingerprint/u);
  assert.match(ui,/No Save Current Master action is enabled/u);
  assert.doesNotMatch(ui,/saveActiveLibraryProject|commitAfterglowMaster|deleteArchivedLibraryProject/u);
});
