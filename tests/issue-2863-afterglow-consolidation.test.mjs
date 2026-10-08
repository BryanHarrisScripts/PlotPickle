import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { planAfterglowConsolidation, AFTERGLOW_DURABLE_FIELDS } from "../modules/library/afterglow-consolidation.mjs";

const baseline = () => ({
  format:"2.0-foundation", id:"packaged", title:"Afterglow",
  revision:556,createdAt:"2026-09-01T00:00:00Z",updatedAt:"2026-09-28T00:00:00Z",
  creativeRoom:{threadId:null},
  foundations:{facts:{"premise":"Humanity questions its reflection"}},
  world:{facts:{}}, build:{foundations:{visualArtifacts:[]}},
  production:{storyboardImages:[{id:"shot-01",locked:true,assetUrl:"/assets/library/examples/afterglow/current/shot1.webp"}]},
  structure:{miniBlocks:[]},writing:{blocks:{}},discovery:{cards:[]},
  worldMap:{characterVisuals:[]},
  storyDevelopment:{fields:{"world:a":{value:"original"}}},
  mindMapNotes:{fields:{}},
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"canonical"}},
});
const working = (base,id,time,edit) => {
  const p=structuredClone(base);
  p.id=id;p.updatedAt=time;p.revision=600;
  edit(p);
  return {project:p};
};
const oct5="2026-10-05T10:00:00Z", oct8="2026-10-08T22:29:42Z";
test("#2863 all durable roots are declared and the package path includes Mind Map fields", async () => {
  for(const field of ["foundations","world","build","production","structure","writing","discovery",
    "worldMap","storyDevelopment","mindMapNotes","sourceEvidence"]) {
    assert.ok(AFTERGLOW_DURABLE_FIELDS.includes(field),field);
  }
  const promotion=await readFile(new URL("../scripts/promote-afterglow-packaged-example.mjs",import.meta.url),"utf8");
  assert.match(promotion, /"storyDevelopment",\s*"mindMapNotes"/u);
  const packageKeys=promotion.slice(promotion.indexOf("const PROJECT_KEYS = ["),promotion.indexOf("];",promotion.indexOf("const PROJECT_KEYS = [")));
  for(const field of AFTERGLOW_DURABLE_FIELDS) assert.ok(packageKeys.includes('"'+field+'"'),"promotion omitted "+field);
});
test("#2863 no newest-wins loss: merge distinct earlier Mind Map, World Map and Shot edits", () => {
  const base=baseline();
  const a=working(base,"old",oct5,p=>{
    p.storyDevelopment.fields["world:b"]={value:"character desires belonging"};
    p.worldMap.characterVisuals.push({id:"amy-front",locked:true,assetUrl:"/api/local-ai/assets/amy-front.webp"});
  });
  const b=working(base,"latest",oct8,p=>{
    p.mindMapNotes.fields["theme:1"]={text:"identity is a choice"};
    p.production.storyboardImages.push({id:"shot-20",locked:true,assetUrl:"/api/local-ai/assets/shot20.webp"});
  });
  const input=structuredClone([a,b]),original=structuredClone(base);
  const result=planAfterglowConsolidation({baseline:base,sources:[b,a]});
  assert.equal(result.conflicts.length,0,JSON.stringify(result.conflicts));
  assert.equal(result.needsReview.length,0,JSON.stringify(result.needsReview));
  assert.equal(result.mergeShapeConsistent,true);
  assert.equal(result.readyForHumanCommit,false,"pure comparison cannot authorize account mutation");
  assert.equal(result.packageModified,false);
  assert.deepEqual(result.sources.map(x=>x.id),["old","latest"]);
  assert.equal(result.candidate.storyDevelopment.fields["world:b"].value,"character desires belonging");
  assert.equal(result.candidate.mindMapNotes.fields["theme:1"].text,"identity is a choice");
  assert.equal(result.candidate.worldMap.characterVisuals[0].id,"amy-front");
  assert.equal(result.candidate.production.storyboardImages.length,2);
  assert.equal(result.candidate.production.storyboardImages[0].locked,true);
  assert.deepEqual(result.localAssetsToVerify,["/api/local-ai/assets/amy-front.webp","/api/local-ai/assets/shot20.webp"]);
  assert.deepEqual(base,original,"preview cannot mutate provided example");
  assert.deepEqual([a,b],input,"preview cannot mutate saved Human working copies");
});
test("#2863 identical changed fields converge but competing Human truth remains unresolved", () => {
  const base=baseline();
  const common=working(base,"common",oct5,p=>{p.storyDevelopment.fields["world:a"].value="Amy returns home";});
  const identical=working(base,"identical",oct8,p=>{p.storyDevelopment.fields["world:a"].value="Amy returns home";});
  const good=planAfterglowConsolidation({baseline:base,sources:[common,identical]});
  assert.equal(good.mergeShapeConsistent,true);
  assert.equal(good.candidate.storyDevelopment.fields["world:a"].value,"Amy returns home");
  const incompatible=working(base,"conflicting",oct8,p=>{p.storyDevelopment.fields["world:a"].value="Ren refuses the invitation";});
  const blocked=planAfterglowConsolidation({baseline:base,sources:[common,incompatible]});
  assert.equal(blocked.mergeShapeConsistent,false);
  assert.equal(blocked.conflicts.length,1);
  assert.match(blocked.conflicts[0].path,/storyDevelopment\/fields\/world:a\/value/u);
  assert.equal(blocked.candidate.storyDevelopment.fields["world:a"].value,"original",
    "never silently prefer newest or older contrary decision");
});
test("#2863 clears, deletions and reordered identifiable collections need Human review", () => {
  const base=baseline();
  base.worldMap.characterVisuals=[{id:"amy",locked:true},{id:"ren",locked:true}];
  const altered=working(base,"altered",oct8,p=>{
    p.storyDevelopment.fields["world:a"].value="";
    p.worldMap.characterVisuals.reverse();
    p.production.storyboardImages=[];
  });
  const result=planAfterglowConsolidation({baseline:base,sources:[altered]});
  assert.equal(result.mergeShapeConsistent,false);
  assert.ok(result.needsReview.some(x=>x.reason==="clear-existing-value"));
  assert.ok(result.needsReview.some(x=>x.reason==="collection-reordered"));
  assert.ok(result.needsReview.some(x=>x.reason==="possible-deletion"));
  assert.equal(result.candidate.storyDevelopment.fields["world:a"].value,"original");
  assert.equal(result.candidate.production.storyboardImages[0].locked,true);
});
test("#2863 rejects foreign projects, modified screenplay source identity and duplicate snapshots", () => {
  const base=baseline();
  const a=working(base,"a",oct5,p=>{});
  const foreign=working(base,"foreign",oct8,p=>{p.sourceEvidence.referenceFixture.sourceId="elsewhere";});
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[a,foreign]}),/foreign|invalid|altered/u);
  const changed=working(base,"other",oct8,p=>{p.sourceEvidence.referenceFixture.immutableId="not canonical";});
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[a,changed]}),/foreign|invalid|altered/u);
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[a,a]}),/duplicate/u);
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[]}),/saved projects/u);
});
test("#2863 anonymous/positional competing arrays are never blindly concatenated", () => {
  const base=baseline();base.production.graphicNovelTextApprovals=[];
  const a=working(base,"a",oct5,p=>{
    p.production.graphicNovelTextApprovals=[{position:13,text:"One canonical decision"}];
  });
  const b=working(base,"b",oct8,p=>{
    p.production.graphicNovelTextApprovals=[{position:17,text:"Another canonical decision"}];
  });
  const result=planAfterglowConsolidation({baseline:base,sources:[a,b]});
  assert.equal(result.mergeShapeConsistent,false);
  assert.ok(result.conflicts.some(x=>x.path.includes("graphicNovelTextApprovals")));
  assert.deepEqual(result.candidate.production.graphicNovelTextApprovals,[]);
});
