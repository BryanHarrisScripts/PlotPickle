/** Saved record reconciliation. No new image approval or creative selection. */
const scopes=["foundations","world"];
const stable=v=>Array.isArray(v)?JSON.stringify(v):v&&typeof v==="object"
  ?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}":JSON.stringify(v);
const visualPath=path=>/^\/build\/(foundations|world)\/(visualArtifacts|acceptedVisualArtifactIds)(?:\/|$)/.test(path);
const signature=artifact=>{
  const {sourceDecisionKeys,parentArtifactId,createdAt,updatedAt,reviewState,...content}=artifact;
  return stable(content);
};
export function reconcileAfterglowTechnicalRecords({baseline,sources,reviewed}) {
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
      const current=witnesses.filter(x=>x.project!==baseline);
      // A baseline reference is not competing user authority, but a different
      // image under its ID still cannot be replaced through bookkeeping.
      if(new Set(witnesses.map(x=>signature(x.artifact))).size!==1){
        blockers.push(label+": saved versions contain different image content or shot details. Compare the images before consolidating.");continue;
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
    if(!candidate.build)candidate.build={};
    candidate.build[scope]={...candidate.build[scope],visualArtifacts:artifacts,acceptedVisualArtifactIds:accepted};
  }
  const remainingConflicts=reviewed.unresolvedConflicts.filter(x=>!visualPath(x.path));
  const remainingReviews=reviewed.needsReview.filter(x=>!visualPath(x.path));
  for(const item of [...remainingConflicts,...remainingReviews])blockers.push(
    "A saved story change outside image bookkeeping still needs verification ("+item.reason+"). Your completed creative selections are preserved.");
  return {...reviewed,candidate,unresolvedConflicts:remainingConflicts,needsReview:remainingReviews,
    technicalBlockers:[...new Set(blockers)],decisionShapeConsistent:!blockers.length};
}
