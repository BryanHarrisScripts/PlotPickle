import assert from "node:assert/strict";
import test from "node:test";
import {planAfterglowConsolidation} from "../modules/library/afterglow-consolidation.mjs";

const at="storyboard-anchor:block:block-01:mini-1";
const baseline=()=>({
  format:"2.0-foundation",id:"canonical",title:"Afterglow",revision:1,
  createdAt:"2026-09-01T00:00:00Z",updatedAt:"2026-09-01T00:00:00Z",
  build:{
    foundations:{visualArtifacts:[],acceptedVisualArtifactIds:[]},
    world:{visualArtifacts:[],acceptedVisualArtifactIds:[]},
  },
  production:{graphicNovelTextApprovals:[]},
  storyDevelopment:{fields:{}},
  mindMapNotes:{fields:{}},
  worldMap:{characterVisuals:[]},
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline",immutableId:"v9"}},
});
const working=(base,id,date,edit)=>{
  const p=structuredClone(base);p.id=id;p.updatedAt=date;p.revision=42;edit(p);
  return {project:p};
};
const shot=(id,opts={})=>({
  id,
  assetUrl:"/api/local-ai/assets/"+id+".webp",
  reviewState:"accepted",
  workflow:"storyboard-frame-webp-v2",
  frameNumber:Number(id.replace(/[^0-9]/g,""))||1,
  sourceDecisionKeys:["storyboard-local-save:v1",at],
  ...opts,
});
const approval=(n,date)=>({
  anchorRef:at,position:n,
  sourceKey:"grounded-shot-"+n,narration:"Human-approved caption for shot "+n+".",
  bubbles:[],noText:false,approvedAt:date,
});

test("#2863 union existing accepted shots, not choose between old copies",()=>{
  const b=baseline();
  const a=working(b,"A","2026-10-07T12:00:00Z",p=>{
    p.build.foundations.visualArtifacts.push(shot("shot-1"));
    p.build.foundations.acceptedVisualArtifactIds=["shot-1"];
  });
  const c=working(b,"C","2026-10-08T12:00:00Z",p=>{
    p.build.foundations.visualArtifacts.push(shot("shot-2"));
    p.build.foundations.acceptedVisualArtifactIds=["shot-2"];
  });
  const unchanged=structuredClone([a,c]);
  const plan=planAfterglowConsolidation({baseline:b,sources:[c,a]});
  assert.deepEqual(plan.conflicts,[],"disjoint saved human approvals must not become a competing list");
  assert.deepEqual(plan.needsReview,[],"source-backed locked shots can converge");
  assert.deepEqual(plan.candidate.build.foundations.acceptedVisualArtifactIds,["shot-1","shot-2"]);
  assert.deepEqual(plan.reconciledVisuals.map(x=>x.artifactId),["shot-1","shot-2"]);
  assert.equal(plan.candidate.build.foundations.visualArtifacts.length,2);
  assert.deepEqual(plan.sourceMediaReferences,[
    "/api/local-ai/assets/shot-1.webp","/api/local-ai/assets/shot-2.webp",
  ]);
  assert.equal(plan.readyForHumanCommit,false,"preview alone cannot prove bytes or vault write");
  assert.deepEqual([a,c],unchanged,"never mutate original user working copies");
});

test("#2863 50 duplicate saved approvals collapse to one logical acceptance with source trace",()=>{
  const b=baseline();const sources=Array.from({length:50},(_,i)=>working(
    b,"saved-"+i,"2026-10-08T12:00:"+String(i).padStart(2,"0")+"Z",p=>{
      p.build.foundations.visualArtifacts.push(shot("shot-1"));
      p.build.foundations.acceptedVisualArtifactIds=["shot-1"];
    }
  ));
  const plan=planAfterglowConsolidation({baseline:b,sources});
  assert.deepEqual(plan.conflicts,[]);
  assert.deepEqual(plan.needsReview,[]);
  assert.deepEqual(plan.candidate.build.foundations.acceptedVisualArtifactIds,["shot-1"]);
  assert.equal(plan.reconciledVisuals.length,1);
  assert.equal(plan.reconciledVisuals[0].sources.length,50);
  assert.equal(plan.sources.length,50);
});

test("#2863 no invented lock: accepted ID missing its saved, accepted, locally saved artifact blocks",()=>{
  const b=baseline();
  const p=working(b,"bad","2026-10-08T12:00:00Z",x=>{
    x.build.foundations.acceptedVisualArtifactIds=["unproven-frame"];
  });
  const plan=planAfterglowConsolidation({baseline:b,sources:[p]});
  assert.ok(plan.needsReview.some(x=>x.reason==="acceptance-evidence-missing-or-unsaved"));
  assert.deepEqual(plan.candidate.build.foundations.acceptedVisualArtifactIds,[]);
  assert.equal(plan.mergeShapeConsistent,false);
  const q=working(b,"unlocked","2026-10-08T13:00:00Z",x=>{
    x.build.foundations.visualArtifacts.push(shot("shot-5",{reviewState:"draft"}));
    x.build.foundations.acceptedVisualArtifactIds=["shot-5"];
  });
  assert.ok(planAfterglowConsolidation({baseline:b,sources:[q]}).needsReview.some(x=>
    x.reason==="acceptance-evidence-missing-or-unsaved"));
  const noSave=working(b,"not-saved","2026-10-08T14:00:00Z",x=>{
    x.build.foundations.visualArtifacts.push(shot("shot-5",{sourceDecisionKeys:[at]}));
    x.build.foundations.acceptedVisualArtifactIds=["shot-5"];
  });
  assert.ok(planAfterglowConsolidation({baseline:b,sources:[noSave]}).needsReview.some(x=>
    x.reason==="acceptance-evidence-missing-or-unsaved"));
});

test("#2863 same artifact ID with different media fails closed, never silently chooses a date",()=>{
  const b=baseline();
  const first=working(b,"a","2026-10-07T00:00:00Z",p=>{
    p.build.foundations.visualArtifacts=[shot("shot-1")];
    p.build.foundations.acceptedVisualArtifactIds=["shot-1"];
  });
  const other=working(b,"b","2026-10-08T00:00:00Z",p=>{
    p.build.foundations.visualArtifacts=[shot("shot-1",{assetUrl:"/api/local-ai/assets/other.webp"})];
    p.build.foundations.acceptedVisualArtifactIds=["shot-1"];
  });
  const plan=planAfterglowConsolidation({baseline:b,sources:[first,other]});
  assert.ok(plan.conflicts.some(x=>x.path.includes("@id:shot-1")));
  assert.ok(plan.needsReview.some(x=>x.reason==="candidate-artifact-or-media-mismatch"));
  assert.deepEqual(plan.candidate.build.foundations.acceptedVisualArtifactIds,[]);
  assert.equal(plan.readyForHumanCommit,false);
});

test("#2863 do not override a saved unlock/draft of the same artifact",()=>{
  const b=baseline(),old=working(b,"a","2026-10-07T00:00:00Z",p=>{
    p.build.foundations.visualArtifacts=[shot("shot-1")];
    p.build.foundations.acceptedVisualArtifactIds=["shot-1"];
  }),updated=working(b,"b","2026-10-08T00:00:00Z",p=>{
    p.build.foundations.visualArtifacts=[shot("shot-1",{reviewState:"draft"})];
    p.build.foundations.acceptedVisualArtifactIds=[];
  });
  const plan=planAfterglowConsolidation({baseline:b,sources:[old,updated]});
  assert.ok(plan.needsReview.some(x=>x.reason==="competing-acceptance-or-unlock"));
  assert.deepEqual(plan.candidate.build.foundations.acceptedVisualArtifactIds,[]);
});

test("#2863 serialization limit blocks overlarge accepted collection instead of dropping an image",()=>{
  const b=baseline(),large=working(b,"large","2026-10-08T00:00:00Z",p=>{
    for(let n=1;n<=76;n++){
      p.build.foundations.visualArtifacts.push(shot("shot-"+n));
      p.build.foundations.acceptedVisualArtifactIds.push("shot-"+n);
    }
  });
  const plan=planAfterglowConsolidation({baseline:b,sources:[large]});
  assert.ok(plan.needsReview.some(x=>x.reason==="artifact-collection-exceeds-roundtrip-limit"));
  assert.equal(plan.readyForHumanCommit,false);
});

test("#2863 repeated same-shot approved narration does not conflict just because approvedAt changed",()=>{
  const b=baseline();
  const a=working(b,"older","2026-10-07T00:00:00Z",p=>{
    p.production.graphicNovelTextApprovals=[approval(2,"2026-10-07T10:00:00Z")];
  });
  const c=working(b,"newer","2026-10-08T00:00:00Z",p=>{
    p.production.graphicNovelTextApprovals=[approval(2,"2026-10-08T10:00:00Z"),approval(15,"2026-10-08T11:00:00Z")];
  });
  const plan=planAfterglowConsolidation({baseline:b,sources:[a,c]});
  assert.deepEqual(plan.conflicts,[]);
  assert.deepEqual(plan.candidate.production.graphicNovelTextApprovals.map(x=>x.position),[2,15]);
  assert.equal(plan.candidate.production.graphicNovelTextApprovals[0].approvedAt,"2026-10-08T10:00:00Z");
  assert.equal(plan.readyForHumanCommit,false);
});

test("#2863 changed narration/source fingerprint remains a real shot-level conflict",()=>{
  const b=baseline();
  const a=working(b,"a","2026-10-07T00:00:00Z",p=>{p.production.graphicNovelTextApprovals=[approval(2,"2026-10-07T10:00:00Z")];});
  const c=working(b,"c","2026-10-08T00:00:00Z",p=>{
    p.production.graphicNovelTextApprovals=[{...approval(2,"2026-10-08T10:00:00Z"),sourceKey:"different-image"}];
  });
  const plan=planAfterglowConsolidation({baseline:b,sources:[a,c]});
  assert.equal(plan.conflicts.length,1);
  assert.match(plan.conflicts[0].path,/graphicNovelTextApprovals\/@approval:/u);
});
