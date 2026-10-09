/**
 * #2863 – Human-owned creative decision completion.
 * Yellow: current candidate, not yet reviewed this consolidation.
 * Green: explicit Human confirmation/alternative/exclusion for THIS draft.
 *
 * Snapshot/format/media problems are independent blockers. They must never
 * be counted as completed, converted to a Human vote, or silently discarded.
 */
export function afterglowReviewProgress({
  groups, candidatePaths, conflictPaths, confirmations, exclusions, decisions,
  extraConflicts, imageOptions, imageChoices,
}) {
  if(!Array.isArray(groups)||!Array.isArray(candidatePaths)||
    !Array.isArray(conflictPaths)||!Array.isArray(exclusions)||
    !Array.isArray(extraConflicts)||!Array.isArray(imageOptions)||
    !confirmations||typeof confirmations!=="object"||
    !decisions||typeof decisions!=="object"||
    !imageChoices||typeof imageChoices!=="object") {
    throw new Error("Creative completion requires the current candidate and all selection evidence.");
  }
  const auto=new Set(candidatePaths),competing=new Set(conflictPaths);
  const done=new Set(), required=new Set(), sections=[], needsIndependentReview=[];
  for(const group of groups) {
    if(group.id==="visuals")continue;
    const items=[];
    for(const item of group.items??[]) {
      const path=typeof item.reviewPath==="string"?item.reviewPath:"";
      if(!path || (!auto.has(path)&&!competing.has(path))) {
        needsIndependentReview.push({groupId:group.id,id:item.id,reason:"not an independently selectable creative field"});
        continue;
      }
      const key="field:"+path;
      if(items.some(x=>x.key===key))continue;
      const choice = decisions[path];
      const excluded=exclusions.includes(path);
      const confirmed=Boolean(confirmations[path]);
      const selected=competing.has(path) ? choice!==undefined
        : (excluded||confirmed);
      items.push({key,id:item.id,label:item.label,path,reviewed:selected,
        status:selected?"confirmed":"current"});
      required.add(key);
      if(selected)done.add(key);
    }
    if(items.length)sections.push({id:group.id,label:group.label,
      completed:items.filter(item=>item.reviewed).length,total:items.length,items});
  }
  const extra=extraConflicts.filter(conflict=>!required.has("field:"+conflict.path));
  if(extra.length) {
    const items=extra.map(conflict=>{
      const key="field:"+conflict.path, reviewed=decisions[conflict.path]!==undefined;
      required.add(key);
      if(reviewed)done.add(key);
      return {key,id:conflict.path,label:conflict.label??"Creative story choice",
        path:conflict.path,reviewed,status:reviewed?"confirmed":"current"};
    });
    sections.push({id:"narration",label:"Narration & Graphic Novel",
      total:items.length,completed:items.filter(item=>item.reviewed).length,items});
  }
  if(imageOptions.length){
    const unique=new Set(),items=[];
    for(const item of imageOptions){
      if(!item || typeof item.key!=="string" || unique.has(item.key)){
        throw new Error("Image choices must have unique exact recovery identities.");
      }
      unique.add(item.key);
      const choice=imageChoices[item.key];
      if(choice!==undefined && choice!=="keep" && choice!=="exclude") {
        throw new Error("Unknown image decision cannot complete a recovery review.");
      }
      const key="image:"+item.key,reviewed=choice!==undefined;
      required.add(key);if(reviewed)done.add(key);
      items.push({key,id:item.id,label:item.characterName+" — "+item.view,
        reviewed,status:reviewed?"confirmed":"current"});
    }
    sections.push({id:"images",label:"Characters & Images",
      total:items.length,completed:items.filter(item=>item.reviewed).length,items});
  }
  const total=required.size,completed=done.size;
  return {sections,total,completed,pending:total-completed,
    allCreativeDecided:total>0 && completed===total,
    needsIndependentReview};
}
