/** Saved record reconciliation. No new image approval or creative selection. */
export class AfterglowSaveVerificationError extends Error {}
const scopes=["foundations","world"];
const stable=v=>Array.isArray(v)?JSON.stringify(v):v&&typeof v==="object"
  ?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}":JSON.stringify(v);
const visualPath=path=>/^\/build\/(foundations|world)\/(visualArtifacts|acceptedVisualArtifactIds)(?:\/|$)/.test(path);
const signature=(artifact,verifiedMediaHashes)=>{
  const {sourceDecisionKeys,parentArtifactId,createdAt,updatedAt,reviewState,...content}=artifact;
  // Only hashes calculated by the authenticated server may equate two paths.
  // Recovery markers and browser-supplied digests are not file readback.
  const hash=verifiedMediaHashes[content.assetUrl];
  if(/^sha256:[a-f0-9]{64}$/.test(hash??""))content.assetUrl=hash;
  return stable(content);
};
import {isAfterglowRecordDecision} from "../afterglow-record-review.mjs";
const recordPath=(scope,id)=>"/build/"+scope+"/visualArtifacts/@id:"+id.replaceAll("~","~0").replaceAll("/","~1");
export function afterglowCollidingMediaUrls({baseline,sources,decisions={}}) {
  const urls=new Set();
  for(const scope of scopes){
    const records=new Map();
    for(const project of [baseline,...sources.map(x=>x.project)])
      for(const artifact of project.build?.[scope]?.visualArtifacts??[]){
        if(Object.keys(decisions).some(key=>isAfterglowRecordDecision(key)&&key==="/afterglow-record-review"+recordPath(scope,artifact.id)))continue;
        if(!records.has(artifact.id))records.set(artifact.id,new Set());
        if(artifact.assetUrl)records.get(artifact.id).add(artifact.assetUrl);
      }
    for(const variants of records.values())if(variants.size>1)for(const url of variants)urls.add(url);
  }
  return [...urls].sort();
}
export function reconcileAfterglowTechnicalRecords({baseline,sources,reviewed,verifiedMediaHashes={}}) {
  const candidate=structuredClone(reviewed.candidate),blockers=[];
  for(const scope of scopes){
    const groups=[baseline,...sources.map(source=>source.project)].map(p=>({project:p,group:p.build?.[scope]})).filter(x=>x.group);
    const records=new Map();
    for(const {project,group} of groups){
      const ids=new Set();
      for(const artifact of group.visualArtifacts??[]){
        if(!artifact?.id||ids.has(artifact.id)){blockers.push("A saved image has a missing or duplicated identity.");continue;}
        ids.add(artifact.id);
        if(!records.has(artifact.id))records.set(artifact.id,[]);
        records.get(artifact.id).push({artifact,project,accepted:(group.acceptedVisualArtifactIds??[]).includes(artifact.id)});
      }
      for(const id of group.acceptedVisualArtifactIds??[])if(!ids.has(id))blockers.push("An approved image is missing from its saved version: "+id+". Restore that image before saving.");
    }
    const artifacts=[],accepted=[];
    for(const [id,witnesses] of records){
      const label=witnesses[0].artifact.narrativeIntention||"Saved image "+id;
      if((reviewed.resolvedRecordPaths??[]).includes(recordPath(scope,id))){
        const selected=candidate.build?.[scope]?.visualArtifacts?.find(item=>item.id===id);
        if(!selected)continue; // Explicit Not required; source history stays untouched.
        const isAccepted=(candidate.build[scope].acceptedVisualArtifactIds??[]).includes(id);
        if(isAccepted&&(selected.reviewState!=="accepted"||!selected.assetUrl
          ||scope==="foundations"&&selected.workflow==="storyboard-frame-webp-v2"&&!(selected.sourceDecisionKeys??[]).includes("storyboard-local-save:v1"))){
          blockers.push(label+": selected approval has no confirmed saved image.");continue;
        }
        artifacts.push(structuredClone(selected));if(isAccepted)accepted.push(id);continue;
      }
      const current=witnesses.filter(x=>x.project!==baseline);
      // A baseline reference is not competing user authority, but a different
      // image under its ID still cannot be replaced through bookkeeping.
      if(new Set(witnesses.map(x=>signature(x.artifact,verifiedMediaHashes))).size!==1){
        const fields=[...new Set(witnesses.flatMap(x=>Object.keys(x.artifact)))].filter(key=>
          !["sourceDecisionKeys","parentArtifactId","createdAt","updatedAt","reviewState"].includes(key)
          &&new Set(witnesses.map(x=>stable(key==="assetUrl"?(verifiedMediaHashes[x.artifact[key]]??x.artifact[key]):x.artifact[key]))).size>1);
        blockers.push(label+": saved versions contain different image content or shot details ("+fields.join(", ")+"). Inspect Saved image differences below before consolidating.");continue;
      }
      const lineage=new Map();
      for(const witness of current){
        const prior=lineage.get(witness.project.id),p=witness.project;
        if(!prior||p.revision>prior.project.revision||p.revision===prior.project.revision&&p.updatedAt>prior.project.updatedAt)lineage.set(p.id,witness);
        else if(p.revision===prior.project.revision&&p.updatedAt===prior.project.updatedAt&&witness.accepted!==prior.accepted)
          blockers.push(label+": two saves of the same version disagree about approval. Refresh saved versions before saving.");
      }
      const states=current.length?[...lineage.values()]:witnesses;
      if(states.some(x=>x.accepted)&&states.some(x=>!x.accepted)){
        blockers.push(label+": one saved version approves this image and another unlocks it. Resolve its approval in Storyboard before saving.");continue;
      }
      if(states.some(x=>x.accepted&&(x.artifact.reviewState!=="accepted"||!x.artifact.assetUrl
        ||scope==="foundations"&&x.artifact.workflow==="storyboard-frame-webp-v2"&&!(x.artifact.sourceDecisionKeys??[]).includes("storyboard-local-save:v1")))){
        blockers.push(label+": the image approval has no confirmed saved image. Save the image in Storyboard first.");continue;
      }
      const parents=[...new Set(witnesses.map(x=>x.artifact.parentArtifactId).filter(Boolean))];
      if(parents.length>1){blockers.push(label+": saved versions disagree about the original image it was derived from.");continue;}
      const artifact=structuredClone(witnesses[0].artifact);
      const recordedKeys=[...new Set(witnesses.flatMap(x=>x.artifact.sourceDecisionKeys??[]))];
      if(recordedKeys.length)artifact.sourceDecisionKeys=recordedKeys;
      if(parents.length)artifact.parentArtifactId=parents[0];
      artifact.reviewState=states[0].accepted?"accepted":states[0].artifact.reviewState;
      artifacts.push(artifact);if(states[0].accepted)accepted.push(id);
    }
    const retained=new Set(artifacts.map(item=>item.id));
    for(const artifact of artifacts)if(artifact.parentArtifactId&&!retained.has(artifact.parentArtifactId)&&(reviewed.resolvedRecordPaths??[]).includes(recordPath(scope,artifact.parentArtifactId)))
      blockers.push((artifact.narrativeIntention||artifact.id)+": its original image was left out. Save that original image or leave out this derived image too.");
    if(!candidate.build)candidate.build={};
    candidate.build[scope]={...candidate.build[scope],visualArtifacts:artifacts,acceptedVisualArtifactIds:accepted};
  }
  const remainingConflicts=reviewed.unresolvedConflicts.filter(x=>!visualPath(x.path));
  const remainingReviews=reviewed.needsReview.filter(x=>!visualPath(x.path));
  for(const item of [...remainingConflicts,...remainingReviews])blockers.push(
    "A saved story change still needs verification at "+item.path+" ("+item.reason+"). Inspect Remaining saved field differences below. Your completed creative selections are preserved.");
  return {...reviewed,candidate,unresolvedConflicts:remainingConflicts,needsReview:remainingReviews,
    technicalBlockers:[...new Set(blockers)],decisionShapeConsistent:!blockers.length};
}
