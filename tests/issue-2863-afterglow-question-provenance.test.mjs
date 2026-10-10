import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {planAfterglowConsolidation,reviewAfterglowConsolidationDecisions} from "../modules/library/afterglow-consolidation.mjs";

const time=(day)=>"2026-10-"+String(day).padStart(2,"0")+"T12:00:00Z";
function baseline(){
  return {
    format:"2.0-foundation",id:"baseline",revision:0,createdAt:time(1),updatedAt:time(1),
    sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"v9"}},
    storyDevelopment:{fields:{}},mindMapNotes:{fields:{},topics:{}},
    build:{foundations:{visualArtifacts:[],acceptedVisualArtifactIds:[]},
      world:{visualArtifacts:[],acceptedVisualArtifactIds:[]}},
    production:{graphicNovelTextApprovals:[]},
  };
}
function version(base,id,day,edit){
  const project=structuredClone(base);project.id=id;project.revision=day;project.updatedAt=time(day);
  edit(project);return {project};
}
function answer(value,day,acceptedSource="human") {
  return {value,updatedAt:time(day),acceptedSource,proposal:"",proposalSourceRef:null,
    proposalGeneratedAt:null};
}
const key="character:original-question:output-1";
const question="How does this character's choice reveal the central conflict?";

test("#2863 identical accepted answers and notes from repeated tests preserve first approval dates and all source identities",()=>{
  const b=baseline(),a=version(b,"original",3,p=>{
    p.storyDevelopment.fields[key]=answer("Ren chooses to return.",3);
    p.mindMapNotes.fields[key]={text:"Character arc depends on memory.",updatedAt:time(3)};
  }),c=version(b,"retest",7,p=>{
    p.storyDevelopment.fields[key]=answer("Ren chooses to return.",7);
    p.mindMapNotes.fields[key]={text:"Character arc depends on memory.",updatedAt:time(7)};
  });
  const untouched=structuredClone([a,c]);
  const params={baseline:b,sources:[c,a],questions:{[key]:question}};
  const p=planAfterglowConsolidation(params);
  assert.deepEqual(p.conflicts,[]);
  assert.deepEqual(p.needsReview,[]);
  assert.equal(p.candidate.storyDevelopment.fields[key].updatedAt,time(3));
  assert.equal(p.candidate.storyDevelopment.fields[key].acceptedSource,"human");
  assert.equal(p.candidate.mindMapNotes.fields[key].updatedAt,time(3));
  assert.equal(p.applied.find(x=>x.path==="/storyDevelopment/fields/"+key).sources.length,2);
  assert.equal(p.applied.find(x=>x.path==="/mindMapNotes/fields/"+key).sources.length,2);
  assert.deepEqual(p.questionEvidence.map(x=>x.question),[question]);
  assert.deepEqual(p.questionEvidence[0].sourceProjectIds,["original","retest"]);
  assert.equal(p.questionEvidence[0].distinctAnswers,1);
  assert.equal(p.questionEvidence[0].questionStatus,"canonical-question-matched");
  assert.equal(p.questionEvidence[0].semanticStatus,"not-assessed");
  const reversed=planAfterglowConsolidation({...params,sources:[a,c]});
  assert.deepEqual(reversed.candidate,p.candidate);
  assert.deepEqual([a,c],untouched);
  assert.equal(p.readyForHumanCommit,false);
});
test("#2863 different answers never splice source, approved value or date",()=>{
  const b=baseline(),a=version(b,"one",3,p=>{
    p.storyDevelopment.fields[key]=answer("Ren confesses.",3,"human");
  }),c=version(b,"two",7,p=>{
    p.storyDevelopment.fields[key]=answer("Ren refuses.",7,"agent-proposal");
  });
  const p=planAfterglowConsolidation({baseline:b,sources:[a,c],questions:{[key]:question}});
  assert.equal(p.conflicts.length,1);
  assert.equal(p.conflicts[0].path,"/storyDevelopment/fields/"+key);
  assert.equal(p.questionEvidence[0].distinctAnswers,2);
  assert.equal(p.candidate.storyDevelopment.fields[key],undefined);
  assert.deepEqual(p.conflicts[0].options.map(x=>[x.value,x.acceptedSource,x.updatedAt]),[
    ["Ren confesses.","human",time(3)],
    ["Ren refuses.","agent-proposal",time(7)],
  ]);
  const selected=reviewAfterglowConsolidationDecisions(p,{[p.conflicts[0].path]:1});
  assert.deepEqual(selected.candidate.storyDevelopment.fields[key],answer("Ren refuses.",7,"agent-proposal"));
  assert.equal(selected.readyForHumanCommit,false);
});
test("#2863 explicit clearing previously authored answer or note cannot be interpreted as duplicate",()=>{
  const b=baseline();b.storyDevelopment.fields[key]=answer("Original choice.",2);
  b.mindMapNotes.topics.character={text:"Original note",updatedAt:time(2)};
  const a=version(b,"clear",7,p=>{
    p.storyDevelopment.fields[key]=answer("",7);
    p.mindMapNotes.topics.character={text:"",updatedAt:time(7)};
  });
  const p=planAfterglowConsolidation({baseline:b,sources:[a],questions:{[key]:question}});
  assert.equal(p.needsReview.filter(x=>x.reason==="clear-existing-value").length,2);
  assert.equal(p.candidate.storyDevelopment.fields[key].value,"Original choice.");
  assert.equal(p.candidate.mindMapNotes.topics.character.text,"Original note");
  assert.equal(p.mergeShapeConsistent,false);
});
test("#2863 conflicting note text retains complete metadata for targeted review",()=>{
  const b=baseline();
  const a=version(b,"one",3,p=>{p.mindMapNotes.topics.character={text:"Memory is fragile",updatedAt:time(3)};});
  const c=version(b,"two",7,p=>{p.mindMapNotes.topics.character={text:"Memory is inherited",updatedAt:time(7)};});
  const p=planAfterglowConsolidation({baseline:b,sources:[a,c]});
  assert.equal(p.conflicts.length,1);
  assert.equal(p.conflicts[0].path,"/mindMapNotes/topics/character");
  assert.deepEqual(p.conflicts[0].options.map(x=>x.updatedAt),[time(3),time(7)]);
});
test("#2863 question catalog is required for live-UI provenance, unknown fields fail closed and semantics are not claimed",()=>{
  const b=baseline();const a=version(b,"one",3,p=>{p.storyDevelopment.fields[key]=answer("Ren grows.",3);});
  const unknown=planAfterglowConsolidation({baseline:b,sources:[a],questions:{"another":question}});
  assert.ok(unknown.needsReview.some(x=>x.reason==="unknown-canonical-question"));
  assert.equal(unknown.questionEvidence[0].questionStatus,"unknown-canonical-question");
  assert.equal(unknown.mergeShapeConsistent,false);
  assert.equal(unknown.readyForHumanCommit,false);
  const noCatalog=planAfterglowConsolidation({baseline:b,sources:[a]});
  assert.equal(noCatalog.questionEvidence[0].questionStatus,"catalog-not-provided");
  assert.equal(noCatalog.questionEvidence[0].semanticStatus,"not-assessed");
  assert.throws(()=>planAfterglowConsolidation({baseline:b,sources:[a],questions:{[key]:""}}),
    /validated field-to-question/u);
});
test("#2863 real Settings panel supplies original prompts and clearly states limits of verification",async()=>{
  const source=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(source,/questions: Object\.fromEntries\(questionByField\)/u);
  assert.match(source,/questionEvidence: result\.questionEvidence/u);
  assert.match(source,/Question-to-answer evidence/u);
  assert.match(source,/Textual relevance has not been independently assessed/u);
  assert.match(source,/questionByField/u);
});
