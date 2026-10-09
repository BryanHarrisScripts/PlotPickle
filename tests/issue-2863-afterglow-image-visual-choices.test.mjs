import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {listAfterglowImageChoices, applyAfterglowImageChoices,
  imageIncludedInCandidate} from "../modules/library/afterglow-image-review.mjs";

const ren="world-map-character-ren-05e3ec53-37c1-4f36-88d3-ce5fa99d7d67-right-thr-1790543203621.webp";
const local="/api/local-ai/assets/"+ren;
const packaged="/assets/library/examples/afterglow/current/generated/"+ren;
const manifest={assets:[{publicUrl:packaged,target:"generated/"+ren,
  contentHash:"sha256:4fbb177ace5acb99f8041572bbf0b09c8dc4e51c497b7a6b7be31d16c4cbae07"}]};
const ref=(characterId,id,url,versionId="v1")=>({
  characterId,id,versionId,characterName:characterId==="ren"?"Ren":"Joy",
  view:"right-three-quarter",assetUrl:url,reviewState:"approved",prompt:"Portrait",provider:"local",
  model:"ComfyUI",createdAt:"2026-10-07T15:17:00Z",
});
const pack=(characterId,references,lockedVersionId="v1")=>({
  characterId,characterName:characterId==="ren"?"Ren":"Joy",
  references,lockedVersionId,approvedAt:"2026-10-07T15:18:00Z",
  updatedAt:"2026-10-07T15:19:00Z",
});
function project(refs=[],id="oct7"){
  return {id,worldMap:{version:1,characterVisuals:refs}};
}
const sources=[
  {project:project([pack("ren",[ref("ren","right",local)])]),sourceKey:"point:oct7"},
  {project:project([pack("joy",[ref("joy","right","/api/local-ai/assets/joy-right.webp")])],"oct8"),sourceKey:"copy:oct8"},
];
const catalog=()=>listAfterglowImageChoices({sources,manifest});
test("#2863 Ren WebP is an exact packaged match with separate original and GitHub views",()=>{
  const entries=catalog();
  const renImage=entries.find(item=>item.characterId==="ren");
  const joyImage=entries.find(item=>item.characterId==="joy");
  assert.equal(renImage.url,local);
  assert.equal(renImage.packagedPublicUrl,packaged);
  assert.equal(renImage.packagedContentHash,manifest.assets[0].contentHash);
  assert.equal(renImage.githubUrl,"https://github.com/BryanHarrisScripts/PlotPickle/blob/main/public/assets/library/examples/afterglow/current/generated/"+ren);
  assert.equal(joyImage.githubUrl,null,"no fictional GitHub URL for unlisted local image");
  assert.deepEqual(renImage.sourceIds,["point:oct7"]);
});
test("#2863 Keep from historical source is an exact reference, not inferred from filename",()=>{
  const items=catalog(),image=items.find(item=>item.characterId==="ren");
  const original=project([pack("joy",[ref("joy","right","/api/local-ai/assets/joy-right.webp")])],"candidate");
  const saved=structuredClone([original,sources]);
  const chosen=applyAfterglowImageChoices({candidate:original,items,
    choices:{[image.key]:"keep"}});
  assert.equal(imageIncludedInCandidate(chosen.candidate,image),true);
  assert.equal(chosen.candidate.worldMap.characterVisuals.length,2);
  assert.equal(chosen.candidate.worldMap.characterVisuals.find(p=>p.characterId==="ren").lockedVersionId,null,
    "restored partial version does not inherit unverified locked status");
  assert.equal(chosen.readyForHumanCommit,false);
  assert.equal(chosen.packageModified,false);
  assert.deepEqual([original,sources],saved,"all history and unselected images unchanged");
});
test("#2863 Exclude selected image from candidate is reversible and leaves other characters and source locks alone",()=>{
  const items=catalog(),image=items.find(item=>item.characterId==="ren");
  const original=project([pack("ren",[ref("ren","right",local)]),
    pack("joy",[ref("joy","right","/api/local-ai/assets/joy-right.webp")])],"candidate");
  const before=structuredClone(original);
  const excluded=applyAfterglowImageChoices({candidate:original,items,choices:{[image.key]:"exclude"}});
  assert.equal(imageIncludedInCandidate(excluded.candidate,image),false);
  assert.deepEqual(excluded.clearedLocks,[{characterId:"ren",versionId:"v1"}]);
  assert.equal(excluded.candidate.worldMap.characterVisuals[1].lockedVersionId,"v1");
  const restored=applyAfterglowImageChoices({candidate:original,items,choices:{[image.key]:"keep"}});
  assert.equal(imageIncludedInCandidate(restored.candidate,image),true);
  assert.deepEqual(original,before);
});
test("#2863 cannot Keep conflicting reference ID before deliberately excluding competitor",()=>{
  const items=catalog(),image=items.find(item=>item.characterId==="ren");
  const competitor="/api/local-ai/assets/ren-different.webp";
  const candidate=project([pack("ren",[ref("ren","right",competitor)])],"candidate");
  assert.throws(()=>applyAfterglowImageChoices({candidate,items,choices:{[image.key]:"keep"}}),
    /different image holds this reference identity/u);
  const other=listAfterglowImageChoices({sources:[
    {project:candidate,sourceKey:"copy:candidate"},...sources,
  ],manifest});
  const old=other.find(item=>item.url===competitor);
  const next=applyAfterglowImageChoices({candidate,items:other,
    choices:{[old.key]:"exclude",[image.key]:"keep"}});
  assert.equal(imageIncludedInCandidate(next.candidate,image),true);
  assert.equal(next.candidate.worldMap.characterVisuals[0].references.length,1);
});
test("#2863 untrusted, path traversal, unsupported image URLs and unknown decisions fail closed",()=>{
  const invalid=project([pack("ren",[ref("ren","bad","/api/local-ai/assets/../../secret.webp")])]);
  const result=listAfterglowImageChoices({sources:[{project:invalid,sourceKey:"point:bad"}],manifest});
  assert.equal(result.length,0);
  const items=catalog();
  assert.throws(()=>applyAfterglowImageChoices({candidate:project(),items,
    choices:{'["ren","invented","/api/local-ai/assets/invented.webp"]':"keep"}}),
  /not part of the current reviewed snapshot/u);
});
test("#2863 image decisions refuse inconsistent approval metadata instead of silently promoting it",()=>{
  const sourceA={project:project([pack("ren",[ref("ren","right",local)])]),sourceKey:"a"};
  const changed=project([pack("ren",[{...ref("ren","right",local),reviewState:"draft"}])]);
  const item=listAfterglowImageChoices({sources:[sourceA,{project:changed,sourceKey:"b"}],manifest})[0];
  assert.equal(item.conflictingSourceMetadata,true);
  assert.throws(()=>applyAfterglowImageChoices({candidate:project(),items:[item],
    choices:{[item.key]:"keep"}}),/Conflicting image metadata/u);
});
test("#2863 UI links are manifest-grounded, readable and choices included in stale-proof fingerprint",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(ui,/View original WebP/u);
  assert.match(ui,/View on GitHub \(packaged copy\)/u);
  assert.match(ui,/listAfterglowImageChoices\(/u);
  assert.match(ui,/applyAfterglowImageChoices\(/u);
  assert.match(ui,/Keep<\/button>/u);
  assert.match(ui,/Exclude<\/button>/u);
  assert.match(ui,/selectionFingerprint = JSON\.stringify\(\{ decisions, exclusions, imageChoices \}\)/u);
  assert.match(ui,/saved alternative/u);
  assert.match(ui,/No Save Current Master action is enabled/u);
  assert.doesNotMatch(ui,/commitAfterglowMaster\(/u);
});
