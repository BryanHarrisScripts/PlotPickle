/**
 * The human's consolidation work list is NOT the raw path-diff list.
 * Only independently meaningful, dated competing story/answer/caption
 * alternatives can request a creative choice. Artifact lineage, hashes,
 * approval keys, timestamps and unrecognized object structure remain
 * unresolved verification work, never arbitrary 'pick a JSON blob' buttons.
 *
 * Pure classifier; it does not resolve or delete anything from the planner.
 */
export function afterglowChoiceKind(conflict) {
  const path=conflict?.path;
  if (conflict?.reason!=="competing-values" || typeof path!=="string"
      || !Array.isArray(conflict.options) || conflict.options.length<2) return "verification";
  if (/^\/production\/graphicNovelTextApprovals\/@approval:/.test(path)) return "narration";
  if (/^\/(?:foundations|world)\/lessons\/[^/]+\/answers\/[^/]+$/.test(path)) return "answer";
  if (/^\/storyDevelopment\/fields\/[^/]+(?:\/value)?$/.test(path)) return "answer";
  return "verification";
}

export function partitionAfterglowChoices(conflicts, recoveredPaths = []) {
  if (!Array.isArray(conflicts) || !Array.isArray(recoveredPaths)) {
    throw new Error("Creative choices require the current verified draft paths.");
  }
  const recovered=new Set(recoveredPaths);
  const human=[],verification=[],inRecovered=[];
  for(const conflict of conflicts) {
    const kind=afterglowChoiceKind(conflict);
    if(kind==="verification") verification.push(conflict);
    else if(recovered.has(conflict.path)) inRecovered.push(conflict);
    else human.push({...conflict,creativeKind:kind});
  }
  return {human,verification,inRecovered};
}
