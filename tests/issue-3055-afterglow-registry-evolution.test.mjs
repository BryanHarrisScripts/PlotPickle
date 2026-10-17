import assert from "node:assert/strict";
import test from "node:test";
import { AFTERGLOW_DURABLE_FIELDS, planAfterglowConsolidation } from "../modules/library/afterglow-consolidation.mjs";

const registry = () => ({version:"1.0.0",assets:[],extensions:{}});
const baseline = () => ({
  id:"packaged",format:"2.0-foundation",revision:7,
  createdAt:"2026-10-01T00:00:00Z",updatedAt:"2026-10-01T00:00:00Z",
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"canonical"}},
  assetRegistry:registry(),storyDevelopment:{fields:{}},mindMapNotes:{fields:{}},
});
const saved = (base,id,alter=()=>{}) => {
  const project=structuredClone(base);
  project.id=id;
  project.updatedAt="2026-10-16T00:00:00Z";
  alter(project);
  return {project};
};

test("#3055 equal canonical empty registries are valid Afterglow fields, not unknown future roots",()=>{
  const base=baseline(),input=saved(base,"working"),before=structuredClone(input);
  assert.ok(AFTERGLOW_DURABLE_FIELDS.includes("assetRegistry"));
  const plan=planAfterglowConsolidation({baseline:base,sources:[input]});
  assert.equal(plan.needsReview.some(x=>x.path==="/assetRegistry"),false);
  assert.deepEqual(plan.candidate.assetRegistry,registry());
  assert.deepEqual(input,before,"review is read-only");
});

test("#3055 legacy PPF with no registry can reopen alongside normalized empty registry",()=>{
  const base=baseline();
  delete base.assetRegistry;
  const input=saved({...base,assetRegistry:registry()},"working");
  const plan=planAfterglowConsolidation({baseline:base,sources:[input]});
  assert.equal(plan.needsReview.some(x=>x.path==="/assetRegistry"),false);
  assert.equal(plan.conflicts.some(x=>x.path==="/assetRegistry"),false);
  assert.equal(plan.readyForHumanCommit,false,"no synthetic fixture grants save authority");
});

test("#3055 different registry with real project-owned media identity requires review before any merge",()=>{
  const base=baseline();
  const draft=saved(base,"working",p=>{
    p.assetRegistry.assets.push({id:"asset-01",kind:"image",approvedVariationId:"",
      variations:[{id:"variation-01",source:"/api/local-ai/assets/shot.webp",
        contentHash:"sha256:"+"a".repeat(64),approval:"unreviewed"}]});
  });
  const before=structuredClone(draft);
  const plan=planAfterglowConsolidation({baseline:base,sources:[draft]});
  assert.ok(plan.needsReview.some(x=>x.path==="/assetRegistry" && x.reason==="asset-registry-requires-media-review"));
  assert.deepEqual(plan.candidate.assetRegistry,registry(),
    "unverified source registry cannot become a verified merged master or accepted image");
  assert.deepEqual(draft,before,"saved source identity and approval remain unchanged");
  assert.equal(plan.readyForHumanCommit,false);
});

test("#3055 competing registry versions do not splice approvals and baseline remains unchanged",()=>{
  const base=baseline(),one=saved(base,"one",p=>{p.assetRegistry.assets=[{id:"a",approval:"approved"}];});
  const two=saved(base,"two",p=>{p.assetRegistry.assets=[{id:"b",approval:"unreviewed"}];});
  const result=planAfterglowConsolidation({baseline:base,sources:[one,two]});
  assert.equal(result.needsReview.filter(x=>x.path==="/assetRegistry").length,2);
  assert.deepEqual(result.candidate.assetRegistry,registry());
  assert.deepEqual(base.assetRegistry,registry());
});

test("#3055 unknown future project roots still fail instead of being silently discarded",()=>{
  const base=baseline(),future=saved(base,"future",p=>{p.unreviewedNewCanon={secret:"do not promote"};});
  assert.throws(()=>planAfterglowConsolidation({baseline:base,sources:[future]}),
    /Unrecognized saved Afterglow field requires review/);
});
