import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {planAfterglowConsolidation,reviewAfterglowConsolidationDecisions} from "../modules/library/afterglow-consolidation.mjs";
import {inventoryAfterglowRecoveredWork} from "../modules/library/afterglow-work-recovery.mjs";
import {collectAfterglowReviewSources} from "../modules/library/afterglow-review-sources.mjs";
import {inventoryAfterglowMedia} from "../modules/library/afterglow-media-integrity.mjs";

const date=day=>"2026-10-"+String(day).padStart(2,"0")+"T13:00:00.000Z";
function baseline(){
  return {format:"2.0-foundation",id:"packaged",createdAt:date(1),updatedAt:date(1),revision:0,
    sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"original"}},
    foundations:{lessons:{}}, world:{lessons:{genres:{answers:{"output-1":"Drama"}}}},
    storyDevelopment:{fields:{}},mindMapNotes:{fields:{},topics:{}},
    worldMap:{characterVisuals:[]},production:{graphicNovelTextApprovals:[]},
    build:{foundations:{acceptedVisualArtifactIds:[],visualArtifacts:[]},
      world:{acceptedVisualArtifactIds:[],visualArtifacts:[]}},
  };
}
function copy(base,id,day,edit){
  const project=structuredClone(base);
  project.id=id;project.updatedAt=date(day);project.revision=day;
  edit(project);return project;
}
const summary=project=>({id:project.id,updatedAt:project.updatedAt,
  sourceKind:"example",sourceId:"afterglow-v9",archivedAt:null});
const field={canonicalId:"world:genres:output-1",topicId:"world",lessonId:"genres",
  fieldId:"output-1",lessonTitle:"Genres",scope:"project-wide",validActs:[1]};
const results=sources=>inventoryAfterglowRecoveredWork({baseline:baseline(),sources,fields:[field]});
function assemble(base){
  const work=Array.from({length:5},(_,i)=>copy(base,"active-"+i,8+(i===4?1:0),p=>{
    p.mindMapNotes.fields["note-"+i]={text:"October working note "+i,updatedAt:date(8)};
  }));
  const olderProjectId="retained-story";
  const previous=copy(base,olderProjectId,7,p=>{
    p.world.lessons.genres.answers["output-1"]="Drama, action and found family";
    p.mindMapNotes.fields["lost-character-development"]={text:"Joy and Kai's original backstory"};
    p.worldMap.characterVisuals=[{id:"joy-ref",characterId:"joy",characterName:"Joy",
      lockedVersionId:"v1",references:[{id:"front",versionId:"v1",view:"front",
        reviewState:"approved",assetUrl:"/api/local-ai/assets/joy-front.webp"}]}];
  });
  const early=copy(base,olderProjectId,7,p=>{
    p.world.lessons.genres.answers["output-1"]="Mystery and emotional drama";
    p.mindMapNotes.fields["earlier-note"]={text:"The beach meeting drives Act 1"};
  });
  const points=[
    {id:"recovery-3pm",createdAt:"2026-10-07T15:17:00Z",projectId:olderProjectId,project:previous},
    {id:"recovery-9am",createdAt:"2026-10-07T09:13:00Z",projectId:olderProjectId,project:early},
  ];
  return {work,points};
}
test("#2863 five active plus two dated snapshots really enter the same merge candidate",()=>{
  const base=baseline(),{work,points}=assemble(base);
  const originals=structuredClone({work,points,base});
  const registry=Object.fromEntries(work.map(p=>[p.id,p]));
  const collected=collectAfterglowReviewSources({
    active:work.map(summary),archived:[],recoveryPoints:points,id:"unused",
    load:id=>registry[id]??null,
  });
  assert.equal(collected.warnings.length,0);
  assert.equal(collected.sources.length,7);
  assert.equal(collected.sources.filter(x=>x.sourceKind==="recovery-point").length,2);
  assert.deepEqual(collected.sources.filter(x=>x.sourceKind==="recovery-point").map(x=>x.project.id),
    ["retained-story","retained-story"]);
  const plan=planAfterglowConsolidation({baseline:base,sources:collected.sources,
    questions:{"world:genres:output-1":"Name the genres of the story."}});
  assert.equal(plan.sources.length,7);
  assert.ok(plan.sources.some(x=>x.id==="point:recovery-3pm"&&x.projectId==="retained-story"));
  assert.ok(plan.sources.some(x=>x.id==="point:recovery-9am"&&x.projectId==="retained-story"));
  assert.equal(plan.candidate.mindMapNotes.fields["lost-character-development"].text,"Joy and Kai's original backstory");
  assert.equal(plan.candidate.mindMapNotes.fields["earlier-note"].text,"The beach meeting drives Act 1");
  for(let i=0;i<5;i++)assert.equal(plan.candidate.mindMapNotes.fields["note-"+i].text,"October working note "+i);
  assert.equal(plan.candidate.worldMap.characterVisuals.length,1,"historical character art must enter draft");
  assert.ok(plan.sourceMediaReferences.includes("/api/local-ai/assets/joy-front.webp"));
  const genre=plan.conflicts.find(x=>x.path==="/world/lessons/genres/answers/output-1");
  assert.ok(genre,"dated October 7 conflict must be selectable in the SAME draft");
  assert.deepEqual(genre.optionSources.slice().sort(),["point:recovery-3pm","point:recovery-9am"]);
  const selected=reviewAfterglowConsolidationDecisions(plan,{[genre.path]:0});
  assert.ok(["Drama, action and found family","Mystery and emotional drama"]
    .includes(selected.candidate.world.lessons.genres.answers["output-1"]));
  assert.equal(selected.readyForHumanCommit,false);
  const item=results(collected.sources).groups.find(x=>x.id==="genres").items[0];
  assert.deepEqual(item.alternatives.flatMap(x=>x.sources.map(s=>s.id)).sort(),
    ["point:recovery-3pm","point:recovery-9am"]);
  assert.deepEqual({work,points,base},originals,"all original profile states remain unchanged");
});
test("#2863 two recovery points with the same parent project ID are distinct; identical point IDs reject",()=>{
  const base=baseline(),{work,points}=assemble(base);
  const a=points[0],b=points[1];
  assert.doesNotThrow(()=>planAfterglowConsolidation({baseline:base,sources:[
    {project:a.project,sourceKey:"point:"+a.id,savedAt:a.createdAt},
    {project:b.project,sourceKey:"point:"+b.id,savedAt:b.createdAt},
  ]}));
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[
    {project:a.project},{project:b.project},
  ]}),/duplicate/u,"unkeyed project-ID reuse remains prohibited");
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[
    {project:a.project,sourceKey:"point:duplicate"},
    {project:b.project,sourceKey:"point:duplicate"},
  ]}),/duplicate/u);
  assert.throws(()=>collectAfterglowReviewSources({active:[],archived:[],recoveryPoints:[a,a],
    load:()=>null}),/counted more than once/u);
});
test("#2863 foreign, mismatched or unreadable recovery sources are never silently merged",()=>{
  const base=baseline(),{points}=assemble(base);
  const bad={...points[0],id:"bad-point",projectId:"different"};
  const foreign={...points[0],id:"foreign",project:{
    ...points[0].project,sourceEvidence:{referenceFixture:{sourceId:"different-example"}},
  }};
  const collected=collectAfterglowReviewSources({
    active:[],archived:[],recoveryPoints:[bad,foreign,points[1]],load:()=>null,
  });
  assert.equal(collected.sources.length,1);
  assert.equal(collected.warnings.length,1);
  assert.equal(collected.sources[0].sourceKey,"point:recovery-9am");
  assert.throws(()=>collectAfterglowReviewSources({active:[summary(points[0].project)],
    archived:[],recoveryPoints:[],load:()=>null}),/cannot be read/u);
  assert.throws(()=>planAfterglowConsolidation({baseline:base,
    sources:[{project:foreign.project,sourceKey:"point:foreign"}]}),/invalid|foreign/u);
});
test("#2863 recovery-to-merge UI includes old point choices and blocks mistaken historical save authorization",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(ui,/collectAfterglowReviewSources\(/u);
  assert.match(ui,/recoveryPoints:listProfileRecoveryPoints\(\)/u);
  assert.match(ui,/archived:archivedAfterglowSummaries\(\)/u);
  assert.match(ui,/sources: complete,/u);
  assert.match(ui,/source\.kind==="recovery-point"/u);
  assert.match(ui,/includedHistoricalSources/u);
  assert.match(ui,/original saves and Data Recovery history remain unchanged/u);
  assert.match(ui,/durable master save readiness requires independent encrypted snapshot provenance/u);
  assert.doesNotMatch(ui,/commitAfterglowMaster\(/u);
  assert.doesNotMatch(ui,/restoreRecoveryPoint\(/u);
});

test("#2863 character identity evidence and historical media provenance are traced to the exact recovery snapshot",()=>{
  const base=baseline(),{points}=assemble(base);
  const state=points[0].project;
  state.sourceEvidence.characterTruth={principalCharacterIds:["joy"],claims:[{
    id:"joy-identity",kind:"identity",characterIds:["joy"],summary:"Joy",
    reviewState:"human-approved",handling:"writer-reference",
  }]};
  const sources=[{project:state,sourceKey:"point:"+points[0].id,savedAt:points[0].createdAt}];
  const found=results(sources);
  const character=found.groups.find(group=>group.id==="character").items[0];
  assert.equal(character.kind,"saved-character-truth");
  assert.match(character.alternatives[0].text,/Joy.*human-approved/u);
  assert.equal(character.alternatives[0].sources[0].id,"point:recovery-3pm");
  const media=inventoryAfterglowMedia({candidate:base,sources});
  assert.ok(media.find(entry=>entry.url==="/api/local-ai/assets/joy-front.webp"
    && entry.sourceProjectIds.includes("point:recovery-3pm")));
  assert.equal(base.sourceEvidence.characterTruth,undefined,"inspection does not modify baseline");
});
