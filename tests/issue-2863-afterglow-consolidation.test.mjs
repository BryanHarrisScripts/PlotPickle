import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { planAfterglowConsolidation, reviewAfterglowConsolidationDecisions, AFTERGLOW_DURABLE_FIELDS } from "../modules/library/afterglow-consolidation.mjs";

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
  for(const field of ["title","learning","foundations","world","build","production","structure","writing","discovery",
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
test("#2863 every user can consolidate an unbounded number N of owned saved versions", () => {
  const base=baseline();
  // The source count is discovered at runtime. Four is today's example, not a system limit.
  for (const count of [1,2,4,7,12,50]) {
    const versions=Array.from({length:count},(_,i)=>working(
      base, "account-version-"+i,
      "2026-10-"+String(1+Math.floor(i/24)).padStart(2,"0")+"T00:00:"+String(i%60).padStart(2,"0")+"Z",
      project => {project.mindMapNotes.fields["unique-approval-"+i]={text:"Approved idea "+i};}
    ));
    const preview=planAfterglowConsolidation({baseline:base,sources:[...versions].reverse()});
    assert.equal(preview.sources.length,count,"all saved versions must be compared at N="+count);
    assert.equal(preview.conflicts.length,0,"distinct account-approved fields must coexist at N="+count);
    assert.equal(preview.needsReview.length,0,"valid distinct fields must not be lost at N="+count);
    assert.equal(Object.keys(preview.candidate.mindMapNotes.fields).length,count,
      "the consolidated candidate must contain every unique contribution at N="+count);
    for (let i=0;i<count;i++) {
      assert.equal(preview.candidate.mindMapNotes.fields["unique-approval-"+i].text,"Approved idea "+i);
    }
    assert.equal(preview.packageModified,false,"merging must not publish the shared example");
    assert.equal(preview.readyForHumanCommit,false,"the local user must still approve and verify media");
  }
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
test("#2863 any future project fields fail closed instead of silently disappearing", () => {
  const base=baseline();
  const extension=working(base,"extension",oct8,p=>{
    p.futureAuthoringField={question:"new story truth"};
  });
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[extension]}),/Unrecognized saved Afterglow field/u);
  const named=working(base,"named",oct8,p=>{
    p.title="Afterglow — Human's Complete Working Draft";
    p.learning={activeLessonId:"structure",completedLessonIds:["world"]};
  });
  const merged=planAfterglowConsolidation({baseline:base,sources:[named]});
  assert.equal(merged.candidate.title,named.project.title);
  assert.deepEqual(merged.candidate.learning,named.project.learning);
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


test("#2863 Phase 2B every competing decision requires an explicit valid Human selection", () => {
  const base=baseline();
  const older=working(base,"older",oct5,p=>{
    p.storyDevelopment.fields["world:a"].value="Amy faces the truth";
    p.mindMapNotes.fields["theme"]={text:"A choice matters"};
  });
  const newest=working(base,"newer",oct8,p=>{
    p.storyDevelopment.fields["world:a"].value="Ren faces the truth";
    p.mindMapNotes.fields["theme"]={text:"Memory matters"};
  });
  const input=structuredClone([older,newest]);
  const plan=planAfterglowConsolidation({baseline:base,sources:[older,newest]});
  assert.equal(plan.conflicts.length,2);
  const pending=reviewAfterglowConsolidationDecisions(plan,{});
  assert.equal(pending.unresolvedConflicts.length,2);
  assert.equal(pending.resolved.length,0);
  assert.equal(pending.readyForHumanCommit,false);
  const choices=Object.fromEntries(plan.conflicts.map(c=>[c.path,1]));
  const selected=reviewAfterglowConsolidationDecisions(plan,choices);
  assert.equal(selected.unresolvedConflicts.length,0);
  assert.equal(selected.resolved.length,2);
  assert.equal(selected.decisionShapeConsistent,true);
  assert.equal(selected.candidate.storyDevelopment.fields["world:a"].value,"Ren faces the truth");
  assert.equal(selected.candidate.mindMapNotes.fields.theme.text,"Memory matters");
  assert.equal(selected.readyForHumanCommit,false,"human selection is not authorization to persist");
  assert.equal(selected.packageModified,false);
  assert.equal(plan.candidate.storyDevelopment.fields["world:a"].value,"original","pure planner stays unchanged");
  assert.deepEqual([older,newest],input,"saved input snapshots are immutable");
});
test("#2863 Phase 2B baseline is a deliberate alternative and invalid decisions fail closed", () => {
  const base=baseline();
  const a=working(base,"a",oct5,p=>{p.storyDevelopment.fields["world:a"].value="First";});
  const b=working(base,"b",oct8,p=>{p.storyDevelopment.fields["world:a"].value="Second";});
  const plan=planAfterglowConsolidation({baseline:base,sources:[a,b]});
  const path=plan.conflicts[0].path;
  const keep=reviewAfterglowConsolidationDecisions(plan,{[path]:"baseline"});
  assert.equal(keep.candidate.storyDevelopment.fields["world:a"].value,"original");
  assert.equal(keep.resolved.length,1);
  assert.throws(()=>reviewAfterglowConsolidationDecisions(plan,{"/other/path":0}),/outside the current review/u);
  assert.throws(()=>reviewAfterglowConsolidationDecisions(plan,{[path]:3}),/validated alternatives/u);
  assert.throws(()=>reviewAfterglowConsolidationDecisions(plan,{[path]:"latest"}),/validated alternatives/u);
  assert.throws(()=>reviewAfterglowConsolidationDecisions({...plan,packageModified:true},{[path]:0}),/uncommitted/u);
});
test("#2863 Phase 2B different media candidates must carry chosen asset verification forward", () => {
  const base=baseline();
  const a=working(base,"a",oct5,p=>{p.world.facts.location="/api/local-ai/assets/amy-view1.webp";});
  const b=working(base,"b",oct8,p=>{p.world.facts.location="/api/local-ai/assets/amy-view2.webp";});
  const plan=planAfterglowConsolidation({baseline:base,sources:[a,b]});
  const path=plan.conflicts[0].path;
  const reviewed=reviewAfterglowConsolidationDecisions(plan,{[path]:1});
  assert.deepEqual(reviewed.localAssetsToVerify,["/api/local-ai/assets/amy-view2.webp"]);
  assert.equal(reviewed.readyForHumanCommit,false);
});
test("#2863 Phase 2B ambiguous deletions cannot be resolved through a competing-value choice", () => {
  const base=baseline();
  const a=working(base,"a",oct5,p=>{p.storyDevelopment.fields["world:a"].value="";});
  const b=working(base,"b",oct8,p=>{p.world.facts.location="the attic";});
  const plan=planAfterglowConsolidation({baseline:base,sources:[a,b]});
  const result=reviewAfterglowConsolidationDecisions(plan,{});
  assert.ok(result.needsReview.length>=1);
  assert.equal(result.decisionShapeConsistent,false);
  assert.equal(result.readyForHumanCommit,false);
});
