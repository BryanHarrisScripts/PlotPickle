/**
 * Phase 2C: deterministic, offline visual-approval reconciliation.
 * One recorded acceptance is not a new Human approval request.
 * No byte-read, session authority, persistence or semantic story judgement.
 */
const SCOPES=Object.freeze([["foundations",75],["world",100]]);
const record=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const copy=v=>structuredClone(v);
const distinct=items=>[...new Set(items)];
const pathFor=(scope,id)=>"/build/"+scope+"/visualArtifacts/@id:"+id;
function hasDuplicates(ids){return new Set(ids).size!==ids.length}
function list(group,key){return Array.isArray(group?.[key])?group[key]:[]}
function validIds(ids){return ids.every(x=>typeof x==="string"&&x.length>0)}
function sourceProof(artifact,scope) {
  if (!record(artifact)||typeof artifact.id!=="string"||!artifact.id
      ||typeof artifact.assetUrl!=="string"||!artifact.assetUrl.trim()
      ||artifact.reviewState!=="accepted")return false;
  if(scope==="foundations"&&artifact.workflow==="storyboard-frame-webp-v2"
     &&!(artifact.sourceDecisionKeys??[]).includes("storyboard-local-save:v1"))return false;
  return true;
}
export function reconcileAfterglowAcceptedVisuals({baseline,projects,candidate,conflicts}) {
  if(!record(baseline)||!Array.isArray(projects)||!projects.length
     ||!record(candidate)||!Array.isArray(conflicts))throw new Error("Valid consolidation evidence required.");
  const proposed=copy(candidate),reconciled=[],needsReview=[];
  for(const [scope,limit] of SCOPES){
    const base=baseline.build?.[scope]??{};
    const original=list(base,"acceptedVisualArtifactIds");
    const originals=list(base,"visualArtifacts");
    const snapshots=projects.map(p=>({id:p.id,group:p.build?.[scope]??{}}));
    const acceptedBySource=new Map();
    const allIds=distinct([...original,...snapshots.flatMap(x=>list(x.group,"acceptedVisualArtifactIds"))]);
    const path="/build/"+scope+"/acceptedVisualArtifactIds";
    if(!validIds(allIds)||hasDuplicates(original)){
      needsReview.push({path,reason:"invalid-approval-identity",sourceProjectId:"baseline"});
      continue;
    }
    if(allIds.length===0) continue;
    const candidateGroup=proposed.build?.[scope];
    if(!record(candidateGroup)) {
      if(allIds.length)needsReview.push({path,reason:"missing-candidate-artifact-collection",sourceProjectId:"baseline"});
      continue;
    }
    const existing=list(candidateGroup,"visualArtifacts");
    const safeIds=[];
    for(const id of allIds) {
      const baselineAccepted=original.includes(id);
      const witnesses=[];
      let invalid=false;
      for(const {id:sourceProjectId,group} of snapshots){
        const accepts=list(group,"acceptedVisualArtifactIds");
        const artifacts=list(group,"visualArtifacts");
        if(hasDuplicates(accepts)||!validIds(accepts)) {
          needsReview.push({path,reason:"duplicate-or-invalid-approval-ids",sourceProjectId});
          invalid=true;continue;
        }
        const artifact=artifacts.find(x=>x?.id===id);
        if(accepts.includes(id)){
          if(!sourceProof(artifact,scope)){
            needsReview.push({path:pathFor(scope,id),reason:"acceptance-evidence-missing-or-unsaved",sourceProjectId});
            invalid=true;
          }else witnesses.push({sourceProjectId,artifact});
        }else if(artifact&&
          (baselineAccepted || snapshots.some(other=>list(other.group,"acceptedVisualArtifactIds").includes(id)))){
          // An explicit saved draft/unlock for an existing artifact cannot be
          // overridden by an acceptance found in another copy.
          needsReview.push({path:pathFor(scope,id),reason:"competing-acceptance-or-unlock",sourceProjectId});
          invalid=true;
        }else if(baselineAccepted&&!artifact) {
          needsReview.push({path:pathFor(scope,id),reason:"missing-previously-approved-artifact",sourceProjectId});
          invalid=true;
        }
      }
      const current=existing.find(x=>x?.id===id);
      if(witnesses.length&&(!sourceProof(current,scope)
          || witnesses.some(w=>w.artifact.assetUrl!==current?.assetUrl))){
        needsReview.push({path:pathFor(scope,id),reason:"candidate-artifact-or-media-mismatch",sourceProjectId:witnesses[0].sourceProjectId});
        invalid=true;
      }
      const conflict=conflicts.some(x=>x.path===pathFor(scope,id)
        ||x.path.startsWith(pathFor(scope,id)+"/")
        ||pathFor(scope,id).startsWith(x.path+"/"));
      if(conflict){needsReview.push({path:pathFor(scope,id),reason:"unresolved-artifact-conflict",sourceProjectId:witnesses[0]?.sourceProjectId??"baseline"});invalid=true;}
      if(baselineAccepted&&!originals.some(x=>x?.id===id)){
        needsReview.push({path:pathFor(scope,id),reason:"baseline-acceptance-has-no-artifact",sourceProjectId:"baseline"});
        invalid=true;
      }
      if(!invalid) {
        safeIds.push(id);
        if(!baselineAccepted&&witnesses.length){
          reconciled.push({path:pathFor(scope,id),artifactId:id,scope,
            sources:witnesses.map(x=>x.sourceProjectId),kind:"preserved-existing-human-acceptance"});
        }
      }
    }
    if(existing.length>limit||allIds.length>limit){
      needsReview.push({path,reason:"artifact-collection-exceeds-roundtrip-limit",sourceProjectId:"baseline"});
    }
    // If any accepted ID is unsafe keep original approved IDs in the candidate;
    // never silently promote some subset into a proposed final authority.
    if(!needsReview.some(x=>x.path===path||x.path.startsWith("/build/"+scope+"/visualArtifacts/"))){
      candidateGroup.acceptedVisualArtifactIds=distinct([...original,...safeIds.filter(id=>!original.includes(id))]);
    }
  }
  return {candidate:proposed,reconciled,needsReview};
}
