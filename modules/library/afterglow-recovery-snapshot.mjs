/**
 * #2863. Read-only Afterglow recovery source classification and creative
 * inventory. This is not generic Data Recovery, a media verifier, or authority
 * to include a historical snapshot in a durable consolidation transaction.
 */
export const AFTERGLOW_REFERENCE_SOURCE = "afterglow-v9-complete-baseline";

export function isAfterglowRecoverySnapshot(project) {
  return Boolean(project && typeof project === "object" && !Array.isArray(project)
    && project.sourceEvidence?.referenceFixture?.sourceId === AFTERGLOW_REFERENCE_SOURCE
    && typeof project.id === "string" && project.id.trim());
}

export function summarizeAfterglowRecoverySnapshot({project,characters}) {
  if (!isAfterglowRecoverySnapshot(project) || !Array.isArray(characters)) {
    throw new Error("Recovery inventory needs a real Afterglow snapshot and its canonical Character roster.");
  }
  const visualPackages=Array.isArray(project.worldMap?.characterVisuals)
    ? project.worldMap.characterVisuals : [];
  const characterReferences=visualPackages.reduce((count,item)=>
    count+(Array.isArray(item?.references)?item.references.length:0),0);
  const lockedCharacterVersions=visualPackages.filter(item=>typeof item?.lockedVersionId==="string"
    && item.lockedVersionId.trim()).length;
  const images=Array.isArray(project.build?.foundations?.visualArtifacts)
    ? project.build.foundations.visualArtifacts : [];
  const accepted=new Set(Array.isArray(project.build?.foundations?.acceptedVisualArtifactIds)
    ? project.build.foundations.acceptedVisualArtifactIds : []);
  const storyboard=images.filter(item=>item?.workflow==="storyboard-frame-webp-v2");
  const storyboardLocked=storyboard.filter(item=>item.reviewState==="accepted" || accepted.has(item.id));
  const names=[...new Set(characters.map(item=>typeof item?.name==="string"?item.name.trim():"").filter(Boolean))];
  return Object.freeze({
    characterNames:names,
    characterCount:characters.length,
    characterImageReferences:characterReferences,
    lockedCharacterVersions,
    storyboardImages:storyboard.length,
    lockedStoryboardImages:storyboardLocked.length,
    approvedNarrationCount:Array.isArray(project.production?.graphicNovelTextApprovals)
      ? project.production.graphicNovelTextApprovals.length:0,
    mediaBytesVerified:false,
    readOnly:true,
  });
}
