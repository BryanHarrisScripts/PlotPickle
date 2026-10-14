import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AFTERGLOW_DURABLE_FIELDS, planAfterglowConsolidation, reviewAfterglowConsolidationDecisions } from "../modules/library/afterglow-consolidation.mjs";

function base() {
  return {
    format:"2.0-foundation",id:"original-afterglow",title:"Afterglow",
    revision:556,createdAt:"2026-09-01T00:00:00Z",updatedAt:"2026-09-28T00:00:00Z",
    creativeRoom:{threadId:null},
    foundations:{facts:{}},world:{facts:{}},build:{foundations:{visualArtifacts:[],acceptedVisualArtifactIds:[]}},
    production:{storyboardImages:[]},structure:{miniBlocks:[]},writing:{blocks:{}},
    discovery:{cards:[]},worldMap:{characterVisuals:[]},storyDevelopment:{fields:{}},
    mindMapNotes:{fields:{}},storyIntent:null,
    sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"canonical"}},
  };
}
function version(prior,id,when,intent) {
  const p=structuredClone(prior);p.id=id;p.updatedAt=when;p.revision=557;
  if (intent===undefined) delete p.storyIntent;
  else p.storyIntent=intent;
  return {project:p};
}
const oct1="2026-10-01T12:00:00Z",oct2="2026-10-02T12:00:00Z";
test("#2982 current PPF format/runtime is a durable reviewed field, promotion cannot silently discard it",async()=>{
  assert.ok(AFTERGLOW_DURABLE_FIELDS.includes("storyIntent"));
  const promotion=await readFile(new URL("../scripts/promote-afterglow-packaged-example.mjs",import.meta.url),"utf8");
  assert.match(promotion,/const PROJECT_KEYS = \[[\s\S]*?"storyIntent"/u);
});
test("#2982 older missing/null intent remains unset, never invent a 120 minute feature",()=>{
  const b=base(),p=version(b,"older",oct1,undefined),q=version(b,"null",oct2,null);
  const src=JSON.stringify([p,q]);
  const plan=planAfterglowConsolidation({baseline:b,sources:[q,p]});
  assert.equal(plan.candidate.storyIntent,null);
  assert.ok(!plan.needsReview.some(x=>x.path==="/storyIntent"));
  assert.ok(!plan.conflicts.some(x=>x.path==="/storyIntent"));
  assert.equal(JSON.stringify([p,q]),src);
});
test("#2982 a single explicit Human short-film selection survives without changing 24x96 story evidence",()=>{
  const b=base();
  const source=version(b,"short",oct1,{format:"Short Film",targetMinutes:15});
  const original=structuredClone(source);
  const plan=planAfterglowConsolidation({baseline:b,sources:[source]});
  assert.deepEqual(plan.candidate.storyIntent,{format:"Short Film",targetMinutes:15});
  assert.ok(plan.applied.some(x=>x.path==="/storyIntent"));
  assert.equal(plan.packageModified,false);
  assert.equal(plan.readyForHumanCommit,false);
  assert.deepEqual(source,original,"never modify saved Human-source PPF while comparing");
});
test("#2982 two disagreeing Human runtimes remain one atomic decision, not mixed format and minutes",()=>{
  const b=base();
  const short=version(b,"short",oct1,{format:"Short Film",targetMinutes:15});
  const feature=version(b,"feature",oct2,{format:"Feature",targetMinutes:120});
  const plan=planAfterglowConsolidation({baseline:b,sources:[short,feature]});
  assert.equal(plan.mergeShapeConsistent,false);
  const conflict=plan.conflicts.find(x=>x.path==="/storyIntent");
  assert.ok(conflict,"film intent choices must remain conflicted");
  assert.equal(conflict.reason,"competing-values");
  assert.deepEqual(plan.candidate.storyIntent,null);
  assert.deepEqual(conflict.options,[short.project.storyIntent,feature.project.storyIntent]);
  const selected=reviewAfterglowConsolidationDecisions(plan,{"/storyIntent":0});
  assert.deepEqual(selected.candidate.storyIntent,short.project.storyIntent);
  assert.equal(selected.readyForHumanCommit,false,"a read-only decision is never encrypted Save authority");
});
test("#2982 a missing Human runtime must not clear an earlier baseline choice",()=>{
  const b=base();b.storyIntent={format:"Short Film",targetMinutes:18};
  const legacy=version(b,"legacy",oct1,undefined);
  const plan=planAfterglowConsolidation({baseline:b,sources:[legacy]});
  assert.deepEqual(plan.candidate.storyIntent,b.storyIntent);
  assert.ok(plan.needsReview.some(x=>x.path==="/storyIntent"&&x.reason==="clear-existing-value"));
  assert.equal(plan.mergeShapeConsistent,false);
});
test("#2982 invalid or unknown runtime evidence is rejected, never inferred or silently omitted",()=>{
  const b=base();
  for(const intent of [{format:"Feature",targetMinutes:0},{format:"Short Film",targetMinutes:"15"},
    {format:"Short Film",targetMinutes:241},{format:"Feature",targetMinutes:12.5}]) {
    assert.throws(()=>planAfterglowConsolidation({baseline:b,sources:[version(b,"invalid",oct1,intent)]}),/Invalid saved Afterglow film runtime intent/);
  }
  const future=version(b,"future",oct1,null);future.project.unsupportedPlotPickleField="cannot drop";
  assert.throws(()=>planAfterglowConsolidation({baseline:b,sources:[future]}),/Unrecognized saved Afterglow field requires review/);
});
