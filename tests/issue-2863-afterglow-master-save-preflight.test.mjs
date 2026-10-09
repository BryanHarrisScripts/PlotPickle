import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {preflightAfterglowMasterSave} from "../modules/library/afterglow-master-save-preflight.mjs";

const sha=s=>"sha256:"+s.repeat(64);
const time="2026-10-09T03:00:00.000Z";
function fixture(count=4){
  const project={
    id:"proposed",format:"2.0-foundation",title:"Afterglow",
    storyDevelopment:{fields:{"character:test":{value:"Character reveals truth.",acceptedSource:"human",updatedAt:time}}},
    mindMapNotes:{fields:{},topics:{}},
    build:{foundations:{visualArtifacts:[],acceptedVisualArtifactIds:[]},world:{visualArtifacts:[],acceptedVisualArtifactIds:[]}},
    production:{graphicNovelTextApprovals:[]},worldMap:{characterVisuals:[]},
  };
  const snapshots=Array.from({length:count},(_,i)=>({project:{
    ...structuredClone(project),id:"saved-"+i,revision:i+1,updatedAt:time,
  }}));
  const proofs=snapshots.map((x,i)=>({id:x.project.id,revision:x.project.revision,
    updatedAt:x.project.updatedAt,digest:sha(String((i%16).toString(16)))}));
  const plan={candidate:structuredClone(project),sources:proofs.map(({id,revision,updatedAt})=>({id,revision,updatedAt})),
    conflicts:[],needsReview:[],readyForHumanCommit:false,packageModified:false,
    questionEvidence:[{fieldId:"character:test",question:"What is the character's central decision?",
      questionStatus:"canonical-question-matched",semanticStatus:"not-assessed",sourceProjectIds:proofs.map(x=>x.id),
      distinctAnswers:1}],
  };
  const reviewed={candidate:structuredClone(project),resolved:[],unresolvedConflicts:[],needsReview:[],
    readyForHumanCommit:false,packageModified:false};
  const mediaReport={results:[],selectedCount:0,historyCount:0,verifiedPinned:0,readableWithoutSavedProof:0,
    failed:0,readyForHumanCommit:false,packageModified:false};
  return {plan,reviewed,initialProofs:proofs,currentProofs:structuredClone(proofs),
    sourceSnapshots:snapshots,mediaReport,normalizedCandidate:structuredClone(project)};
}
const codes=result=>new Set(result.blockers.map(x=>x.code));
test("#2863 exact original snapshot proof includes all four versions and cannot claim save authority",()=>{
  const data=fixture(),before=structuredClone(data);
  const result=preflightAfterglowMasterSave(data);
  assert.equal(result.sourceCount,4);
  assert.equal(result.questionCount,1);
  assert.ok(codes(result).has("question-answer-relevance-pending"));
  assert.ok(codes(result).has("durable-save-not-implemented"));
  assert.equal(result.readyForHumanCommit,false);
  assert.equal(result.packageModified,false);
  assert.deepEqual(data,before,"preflight must not mutate the original authored sources or candidate");
});
test("#2863 50 versions retain exact source identity; no truncation to a convenient subset",()=>{
  const result=preflightAfterglowMasterSave(fixture(50));
  assert.equal(result.sourceCount,50);
  assert.equal(result.readyForHumanCommit,false);
  assert.equal(codes(result).has("incomplete-snapshot-fingerprints"),false);
});
test("#2863 changed bytes with unchanged timestamps or revision are caught by SHA-256",()=>{
  const data=fixture();data.currentProofs[2].digest=sha("f");
  const result=preflightAfterglowMasterSave(data);
  assert.ok(codes(result).has("source-changed"));
});
test("#2863 missing or duplicated saved copy proofs, extra copy, and altered revision fail closed",()=>{
  const missing=fixture();missing.currentProofs.pop();
  assert.ok(codes(preflightAfterglowMasterSave(missing)).has("incomplete-snapshot-fingerprints"));
  const duplicate=fixture();duplicate.currentProofs[3].id=duplicate.currentProofs[2].id;
  assert.ok(codes(preflightAfterglowMasterSave(duplicate)).has("invalid-snapshot-fingerprint"));
  const extra=fixture();extra.currentProofs.push({...extra.currentProofs[0],id:"another"});
  assert.ok(codes(preflightAfterglowMasterSave(extra)).has("incomplete-snapshot-fingerprints"));
  const stale=fixture();stale.initialProofs[1].revision=stale.plan.sources[1].revision+1;
  assert.ok(codes(preflightAfterglowMasterSave(stale)).has("review-source-mismatch"));
});
test("#2863 no silent loss through project normalizer, including accepted visual IDs and narration",()=>{
  const data=fixture();
  data.reviewed.candidate.build.foundations.acceptedVisualArtifactIds=["locked-shot"];
  data.reviewed.candidate.production.graphicNovelTextApprovals=[{anchorRef:"anchor",position:1,sourceKey:"frame",narration:"Ren returns."}];
  data.normalizedCandidate.build.foundations.acceptedVisualArtifactIds=[];
  data.normalizedCandidate.production.graphicNovelTextApprovals=[];
  const result=preflightAfterglowMasterSave(data);
  assert.ok(codes(result).has("normalization-data-loss"));
  assert.ok(result.blockers.some(x=>x.detail.includes("production")));
  assert.ok(result.blockers.some(x=>x.detail.includes("build")));
});
test("#2863 no creative override: unresolved conflicts, erasures or unknown questions remain blocked",()=>{
  const data=fixture();
  data.reviewed.unresolvedConflicts=[{path:"/storyDevelopment/fields/character:test",reason:"competing-values"}];
  data.reviewed.needsReview=[{path:"/build/foundations/visualArtifacts",reason:"possible-deletion"}];
  data.plan.questionEvidence[0].questionStatus="unknown-canonical-question";
  const result=preflightAfterglowMasterSave(data);
  for(const code of ["unresolved-creative-conflicts","unresolved-structural-review","unverified-question-identity"])
    assert.ok(codes(result).has(code),code);
});
test("#2863 media selected in current master must match complete inspected URL set",()=>{
  const data=fixture();
  const url="/api/local-ai/assets/shot-1.webp";
  data.reviewed.candidate.worldMap.characterVisuals=[{assetUrl:url}];
  data.mediaReport.results=[];
  assert.ok(codes(preflightAfterglowMasterSave(data)).has("stale-media-inventory"));
  data.mediaReport.results=[{url,selected:true,status:"verified-current"}];
  assert.ok(codes(preflightAfterglowMasterSave(data)).has("unproven-original-media-hash"));
  data.mediaReport.results=[{url,selected:true,status:"missing"}];
  assert.ok(codes(preflightAfterglowMasterSave(data)).has("unreadable-or-altered-media"));
});
test("#2863 bundled or packaged history never disappears merely because selected media is verified",()=>{
  const data=fixture();
  const url="/assets/library/examples/afterglow/current/shot.webp";
  data.sourceSnapshots[0].project.worldMap.characterVisuals=[{assetUrl:url}];
  data.mediaReport.results=[{url,selected:false,status:"verified-pinned"}];
  const result=preflightAfterglowMasterSave(data);
  assert.ok(codes(result).has("historical-media-not-retained"));
});
test("#2863 read-only real Settings workflow rehashes exact snapshot bytes and checks official normalization",async()=>{
  const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(panel,/libraryProjectSnapshotText\(project\.id\)/u);
  assert.match(panel,/crypto\.subtle\.digest\("SHA-256", new TextEncoder\(\)\.encode\(raw\)\)/u);
  assert.match(panel,/initialProofs:preview\.initialProofs,currentProofs/u);
  assert.match(panel,/normalizeLibraryProject\(reviewed\.candidate\)/u);
  assert.match(panel,/JSON\.stringify\(finalProofs\) !== JSON\.stringify\(currentProofs\)/u);
  assert.match(panel,/Check master save readiness \(read-only\)/u);
  assert.match(panel,/No Save Current Master action is enabled/u);
  assert.doesNotMatch(panel,/createLibraryWorkingCopy|saveActiveLibraryProject|archiveLibraryProject|persistActiveProfileProject/u);
});
