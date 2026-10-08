/**
 * Truth-first Afterglow consolidation planner (#2863).
 * No mutation, persistence, external calls, account selection, or package update.
 * Unresolved collisions are evidence for the Human, never implicit newest wins.
 */
export const AFTERGLOW_DURABLE_FIELDS = Object.freeze([
  "title", "learning", "foundations", "world", "build", "production",
  "structure", "sourceEvidence", "writing", "discovery", "worldMap",
  "storyDevelopment", "mindMapNotes",
]);
// Only profile/session and storage metadata are excluded. New durable project
// roots must be reviewed explicitly, not silently omitted from consolidation.
const EXCLUDED_PROFILE_METADATA = ["format", "id", "revision", "createdAt", "updatedAt", "creativeRoom"];
const EXPECTED_REFERENCE = "afterglow-v9-complete-baseline";
const ABSENT = Symbol("absent");
const isRecord = v => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = v => v === ABSENT ? ABSENT : structuredClone(v);
function stable(v) {
  if (v === ABSENT) return '"<ABSENT>"';
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (isRecord(v)) return "{" + Object.keys(v).sort().map(k => JSON.stringify(k)+":"+stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
const equal = (a,b) => stable(a) === stable(b);
const pathLabel = keys => "/" + keys.map(s=>s.replaceAll("~","~0").replaceAll("/","~1")).join("/");
function entityId(item) {
  if (!isRecord(item)) return null;
  if (typeof item.id === "string" && item.id) return "id:" + item.id;
  if (typeof item.shotId === "string" && item.shotId) return "shot:" + item.shotId;
  if (typeof item.characterId === "string" && item.characterId) return "character:" + item.characterId;
  if (typeof item.anchorRef === "string" && Number.isInteger(item.order)) return "anchor:" + item.anchorRef + ":order:" + item.order;
  return null;
}
function keyed(value) {
  if (!Array.isArray(value)) return null;
  if (!value.length) return new Map();
  const keys = value.map(entityId);
  return keys.some(id => id === null) || new Set(keys).size !== keys.length
    ? null : new Map(keys.map((key,i) => [key,value[i]]));
}
function collect(base, current, keys, edits, reviews) {
  if (equal(base,current)) return;
  const path = pathLabel(keys);
  if (current === ABSENT) { reviews.push({path,reason:"possible-deletion"}); return; }
  // A newly added entity must remain one atomic record with its stable ID.
  if (base === ABSENT && isRecord(current) && keys.at(-1)?.startsWith("@")) {
    edits.push({path,keys,value:copy(current)}); return;
  }
  if ((isRecord(base) && isRecord(current)) || (base === ABSENT && isRecord(current))) {
    const prior = isRecord(base) ? base : {};
    const names = [...new Set([...Object.keys(prior),...Object.keys(current)])].sort();
    for (const name of names) {
      collect(Object.hasOwn(prior,name)?prior[name]:ABSENT,
        Object.hasOwn(current,name)?current[name]:ABSENT,
        [...keys,name],edits,reviews);
    }
    return;
  }
  if ((Array.isArray(base) || base === ABSENT) && Array.isArray(current)) {
    const old = base === ABSENT ? new Map() : keyed(base), next = keyed(current);
    if (old && next && (old.size || next.size)) {
      const oldOrder = [...old.keys()].filter(id => next.has(id));
      const newOrder = [...next.keys()].filter(id => old.has(id));
      if (!equal(oldOrder,newOrder)) reviews.push({path,reason:"collection-reordered"});
      for (const id of [...new Set([...old.keys(),...next.keys()])].sort()) {
        collect(old.has(id)?old.get(id):ABSENT,next.has(id)?next.get(id):ABSENT,
          [...keys,"@"+id],edits,reviews);
      }
      return;
    }
  }
  if (base !== ABSENT && (current === "" || current === null
       || Array.isArray(current) && current.length === 0)) {
    reviews.push({path,reason:"clear-existing-value"});
    return;
  }
  edits.push({path,keys,value:copy(current)});
}
function apply(target,keys,value) {
  let node = target;
  for (let i=0;i<keys.length;i++) {
    const name=keys[i], last=i===keys.length-1;
    if (name.startsWith("@")) {
      if (!Array.isArray(node)) throw new Error("Expected an entity array at "+pathLabel(keys.slice(0,i)));
      const id=name.slice(1);
      let index=node.findIndex(x=>entityId(x)===id);
      if(index<0){node.push({});index=node.length-1;}
      if(last)node[index]=copy(value);
      else node=node[index];
    } else {
      if (!isRecord(node)) throw new Error("Expected a project object at "+pathLabel(keys.slice(0,i)));
      if (last) node[name]=copy(value);
      else {
        if(!Object.hasOwn(node,name)||node[name]===null)node[name]=keys[i+1].startsWith("@")?[]:{};
        node=node[name];
      }
    }
  }
}
function sourceId(value){return value?.sourceEvidence?.referenceFixture?.sourceId;}
export function planAfterglowConsolidation({baseline,sources}) {
  if(!isRecord(baseline)||sourceId(baseline)!==EXPECTED_REFERENCE
     ||baseline.format!=="2.0-foundation"||!Array.isArray(sources)||!sources.length){
    throw new Error("Consolidation needs the trusted Afterglow baseline and saved projects.");
  }
  const roots=new Set([...AFTERGLOW_DURABLE_FIELDS,...EXCLUDED_PROFILE_METADATA]);
  for(const key of Object.keys(baseline)){
    if(!roots.has(key))throw new Error("Unrecognized Afterglow project field requires review: "+key);
  }
  const ids=new Set();
  const projects=sources.map(x=>{
    const p=x?.project;
    if(!isRecord(p)||p.format!==baseline.format||sourceId(p)!==EXPECTED_REFERENCE
       ||typeof p.id!=="string"||!p.id||ids.has(p.id)
       ||typeof p.updatedAt!=="string"||!Number.isFinite(Date.parse(p.updatedAt))
       ||!equal(p.sourceEvidence.referenceFixture,baseline.sourceEvidence.referenceFixture)){
      throw new Error("Consolidation rejected invalid, foreign, altered-source or duplicate Afterglow state.");
    }
    for(const key of Object.keys(p)){
      if(!roots.has(key))throw new Error("Unrecognized saved Afterglow field requires review: "+key);
    }
    ids.add(p.id);return p;
  }).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
  const changes=new Map(), needsReview=[];
  for(const p of projects){
    const edits=[], reviews=[];
    for(const root of AFTERGLOW_DURABLE_FIELDS){
      collect(Object.hasOwn(baseline,root)?baseline[root]:ABSENT,
        Object.hasOwn(p,root)?p[root]:ABSENT,[root],edits,reviews);
    }
    for(const x of reviews)needsReview.push({...x,sourceProjectId:p.id});
    for(const x of edits){
      if(!changes.has(x.path))changes.set(x.path,[]);
      changes.get(x.path).push({...x,sourceProjectId:p.id});
    }
  }
  const candidate=copy(baseline),applied=[],conflicts=[];
  for(const [path,items] of [...changes].sort(([a],[b])=>a.localeCompare(b))){
    const alternatives=[...new Map(items.map(x=>[stable(x.value),x])).values()];
    if(alternatives.length>1){
      conflicts.push({path,reason:"competing-values",sources:items.map(x=>x.sourceProjectId),
        optionSources:alternatives.map(x=>x.sourceProjectId),
        options:alternatives.map(x=>copy(x.value))});
      continue;
    }
    if([...changes.keys()].some(other=>other!==path&&(other.startsWith(path+"/")||path.startsWith(other+"/")))){
      conflicts.push({path,reason:"overlapping-paths",sources:items.map(x=>x.sourceProjectId)});
      continue;
    }
    apply(candidate,items[0].keys,items[0].value);
    applied.push({path,sources:items.map(x=>x.sourceProjectId)});
  }
  // Local asset bytes must be checked by the authenticated runtime before the
  // Human can commit a merged copy, then copied into the repo only on promotion.
  const assetRefs=new Set();
  const visit=value=>{
    if(typeof value==="string" && value.startsWith("/api/local-ai/assets/"))assetRefs.add(value);
    else if(Array.isArray(value))value.forEach(visit);
    else if(isRecord(value))Object.values(value).forEach(visit);
  };
  visit(candidate);
  // Project ID, timestamps, profile session and revision are deliberately
  // assigned only by the later authenticated commit.
  return {candidate,sources:projects.map(p=>({id:p.id,revision:p.revision,updatedAt:p.updatedAt})),
    applied,conflicts,needsReview,localAssetsToVerify:[...assetRefs].sort(),
    mergeShapeConsistent:conflicts.length===0&&needsReview.length===0,
    readyForHumanCommit:false,packageModified:false};
}


/**
 * Pure, non-persisting Human choice preview for all competing-value conflicts.
 * Decisions: {[canonicalPath]: "baseline" | integer alternative index}.
 * A collision of overlapping paths, deletions, reorders, and missing media
 * remains blocked; never interpret a choice as authority to save or publish.
 */
export function reviewAfterglowConsolidationDecisions(plan, decisions = {}) {
  if (!isRecord(plan) || !isRecord(plan.candidate) ||
      !Array.isArray(plan.conflicts) || !Array.isArray(plan.needsReview) ||
      !isRecord(decisions) || plan.packageModified !== false ||
      plan.readyForHumanCommit !== false) {
    throw new Error("Consolidation decisions require an uncommitted, validated preview.");
  }
  const paths = new Set(plan.conflicts.map(conflict => conflict.path));
  for (const path of Object.keys(decisions)) {
    if (!paths.has(path)) throw new Error("Decision references a conflict outside the current review: " + path);
  }
  const candidate = structuredClone(plan.candidate);
  const resolved = [], unresolvedConflicts = [];
  for (const conflict of plan.conflicts) {
    const selected = decisions[conflict.path];
    if (selected === undefined || conflict.reason !== "competing-values") {
      unresolvedConflicts.push(structuredClone(conflict));
      continue;
    }
    if (selected !== "baseline" &&
      (!Number.isInteger(selected) || selected < 0 ||
        !Array.isArray(conflict.options) || selected >= conflict.options.length)) {
      throw new Error("A conflict decision is not one of its validated alternatives: " + conflict.path);
    }
    const keys = conflict.path.slice(1).split("/").map(segment =>
      segment.replaceAll("~1", "/").replaceAll("~0", "~"));
    // Non-commuting parent/child paths were already flagged as overlapping by
    // the planner. Never apply those decisions even if a caller sends a choice.
    const overlaps = plan.conflicts.some(other => other !== conflict &&
      (other.path.startsWith(conflict.path + "/") || conflict.path.startsWith(other.path + "/")));
    if (overlaps) {
      unresolvedConflicts.push(structuredClone(conflict));
      continue;
    }
    if (selected !== "baseline") apply(candidate, keys, conflict.options[selected]);
    resolved.push({ path: conflict.path, choice: selected });
  }
  // Resolve image URLs from the actual reviewed candidate. A choice might
  // introduce an image the original unselected planner candidate did not use.
  const localAssetsToVerify = new Set();
  const visit = value => {
    if (typeof value === "string" && value.startsWith("/api/local-ai/assets/")) {
      localAssetsToVerify.add(value);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (isRecord(value)) Object.values(value).forEach(visit);
  };
  visit(candidate);
  return {
    candidate, resolved, unresolvedConflicts,
    needsReview: structuredClone(plan.needsReview),
    localAssetsToVerify: [...localAssetsToVerify].sort(),
    decisionShapeConsistent: unresolvedConflicts.length === 0 && plan.needsReview.length === 0,
    readyForHumanCommit: false,
    packageModified: false,
  };
}
