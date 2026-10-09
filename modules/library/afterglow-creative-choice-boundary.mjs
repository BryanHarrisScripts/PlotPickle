/**
 * The human's consolidation work list is NOT the raw path-diff list.
 * Only independently meaningful, dated competing story/answer/caption
 * alternatives can request a creative choice. Artifact lineage, hashes,
 * approval keys, timestamps and unrecognized object structure remain
 * unresolved verification work, never arbitrary 'pick a JSON blob' buttons.
 *
 * Pure classifier; it does not resolve or delete anything from the planner.
 */
function hasHumanReadableValue(value) {
  if(typeof value==="string")return Boolean(value.trim());
  if(!value || typeof value!=="object" || Array.isArray(value))return false;
  if(typeof value.value==="string" && value.value.trim())return true;
  if(typeof value.text==="string" && value.text.trim())return true;
  if(value.noText===true)return true;
  if(typeof value.narration==="string" && value.narration.trim())return true;
  return Array.isArray(value.bubbles)&&value.bubbles.some(bubble=>
    bubble&&typeof bubble==="object"&&
    [bubble.text,bubble.dialogue,bubble.content].some(text=>typeof text==="string"&&text.trim()));
}
export function afterglowChoiceKind(conflict) {
  const path=conflict?.path;
  if (conflict?.reason!=="competing-values" || typeof path!=="string"
      || !Array.isArray(conflict.options) || conflict.options.length<2
      || !conflict.options.every(hasHumanReadableValue)) return "verification";
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
