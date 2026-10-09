/**
 * #2863 – Human-owned creative decision completion.
 * Yellow: current candidate, not yet reviewed this consolidation.
 * Green: explicit Human confirmation/alternative/exclusion for THIS draft.
 *
 * Snapshot/format/media problems are independent blockers. They must never
 * be counted as completed, converted to a Human vote, or silently discarded.
 */
export function afterglowImageSlotKey(item) {
  if(!item || typeof item.characterId!=="string" || typeof item.view!=="string") {
    throw new Error("Image choice needs a character and view identity.");
  }
  return JSON.stringify([item.characterId,item.view]);
}

/** Selecting an image for a view excludes competing versions in the draft. */
export function selectAfterglowImageOption(items,existing,key,choice) {
  if(!Array.isArray(items)||!existing||typeof existing!=="object"||
     !["keep","exclude"].includes(choice))throw new Error("A valid image choice is required.");
  const item=items.find(value=>value.key===key);
  if(!item)throw new Error("Image choice is not in the current recovery inventory.");
  const slot=afterglowImageSlotKey(item);
  const result={...existing};
  if(choice==="keep") {
    for(const competitor of items.filter(value=>afterglowImageSlotKey(value)===slot)) {
      result[competitor.key]="exclude";
    }
  }
  result[key]=choice;
  return result;
}

export function resetAfterglowImageSlot(items,existing,slot) {
  const result={...existing};
  for(const item of items.filter(value=>afterglowImageSlotKey(value)===slot))delete result[item.key];
  return result;
}

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
    const slots=new Map();
    const keys=new Set();
    for(const item of imageOptions){
      if(!item || typeof item.key!=="string" || keys.has(item.key)) {
        throw new Error("Image choices must have unique exact recovery identities.");
      }
      keys.add(item.key);
      const slot=afterglowImageSlotKey(item);
      if(!slots.has(slot))slots.set(slot,[]);
      slots.get(slot).push(item);
    }
    const items=[];
    for(const [slot,versions] of slots) {
      const kept=versions.filter(image=>imageChoices[image.key]==="keep");
      const excluded=versions.filter(image=>imageChoices[image.key]==="exclude");
      if(kept.length>1)throw new Error("Only one image version per character/view can be kept.");
      const reviewed=(kept.length===1 && excluded.length===versions.length-1)
        || excluded.length===versions.length;
      const key="image-slot:"+slot;
      required.add(key);if(reviewed)done.add(key);
      items.push({key,id:slot,label:versions[0].characterName+" — "+versions[0].view,
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
