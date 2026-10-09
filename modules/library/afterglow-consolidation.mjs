import { reconcileAfterglowAcceptedVisuals } from "./afterglow-evidence-reconciliation.mjs";

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
  // Graphic Novel Human approvals have a stable *shot* identity, not an id or
  // an order. Treat each approval as one atomic human decision; never splice
  // sourceKey/narration/timestamp pieces from unrelated saves.
  if (typeof item.anchorRef === "string" && item.anchorRef
      && Number.isInteger(item.position) && item.position >= 1 && item.position <= 25) {
    return "approval:" + item.anchorRef + ":position:" + item.position;
  }
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
  // Accepted image IDs are derived from saved artifact authority, not an
  // atomic pick-one list. Evidence reconciliation below handles all sources.
  if (/^\/build\/(foundations|world)\/acceptedVisualArtifactIds$/.test(path)) return;
  if (current === ABSENT) { reviews.push({path,reason:"possible-deletion"}); return; }
  // Field and note state are indivisible records: approval source, answer,
  // proposal provenance and timestamps must travel together. A latest-date
  // vote must never splice the metadata of one answer onto another.
  const storyField=keys.length===3 && keys[0]==="storyDevelopment" && keys[1]==="fields";
  const authorNote=keys.length===3 && keys[0]==="mindMapNotes"
    && (keys[1]==="fields" || keys[1]==="topics");
  if ((storyField || authorNote) && isRecord(current)) {
    const textKey=storyField?"value":"text";
    const original=isRecord(base)?base[textKey]:undefined;
    if (typeof original==="string" && original.trim()
      && (current[textKey]===null || current[textKey]===undefined
        || typeof current[textKey]==="string" && !current[textKey].trim())) {
      reviews.push({path,reason:"clear-existing-value"}); return;
    }
    edits.push({path,keys,value:copy(current)}); return;
  }
  // Approval records must remain atomic even when the baseline has an older
  // approval for this shot; mixing a source fingerprint with another narration
  // could manufacture a false Human approval.
  if (isRecord(current) && keys.at(-1)?.startsWith("@approval:")) {
    edits.push({path,keys,value:copy(current)}); return;
  }
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
function readAt(target,keys) {
  let node = target;
  for (const name of keys) {
    if (name.startsWith("@")) {
      if (!Array.isArray(node)) return ABSENT;
      node = node.find(item => entityId(item) === name.slice(1));
    } else {
      if (!isRecord(node) || !Object.hasOwn(node,name)) return ABSENT;
      node = node[name];
    }
    if (node === undefined) return ABSENT;
  }
  return node;
}
function restore(target,keys,value) {
  // Explicit Human exclusion only: restore the *provided reference* at this
  // exact automatically included path. Never mutate any saved source.
  if (value !== ABSENT) { apply(target,keys,value); return; }
  const parent = readAt(target,keys.slice(0,-1));
  const last=keys.at(-1);
  if (last?.startsWith("@")) {
    if (!Array.isArray(parent)) throw new Error("Cannot exclude missing creative entity.");
    const index=parent.findIndex(item=>entityId(item)===last.slice(1));
    if(index>=0) parent.splice(index,1);
  } else if (isRecord(parent)) {
    delete parent[last];
  } else {
    throw new Error("Cannot exclude unrecognized story path.");
  }
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
function contributionSignature(path,value) {
  if (isRecord(value) && (/^\/storyDevelopment\/fields\/[^/]+$/.test(path)
    || /^\/mindMapNotes\/(fields|topics)\/[^/]+$/.test(path))) {
    // Re-saved identical answers do not create new creative decisions.
    // Preserve the first source's complete accepted answer and metadata.
    const {updatedAt,...authored}=value;
    return stable(authored);
  }
  if (path.startsWith("/production/graphicNovelTextApprovals/@approval:") && isRecord(value)) {
    // A new approval timestamp from repeated testing is not a new narration.
    const {approvedAt,...content}=value;
    return stable(content);
  }
  return stable(value);
}
function orderGraphicNovelApprovals(project) {
  const approvals = project?.production?.graphicNovelTextApprovals;
  if (!Array.isArray(approvals)) return;
  // Ordering is presentation only. Human authority is (anchorRef, position).
  // Never sort by encoded string position: Shot 15 must follow Shot 2.
  approvals.sort((a,b)=>String(a.anchorRef).localeCompare(String(b.anchorRef))
    || Number(a.position)-Number(b.position));
}
function sourceId(value){return value?.sourceEvidence?.referenceFixture?.sourceId;}

// These are references, not proven, readable local bytes. Inspection must
// include *all source snapshots*: a competing unselected visual array might
// not appear in the proposed candidate yet.
function sourceMediaReferences(projects) {
  const refs = new Set();
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!isRecord(value)) return;
    if (typeof value.assetUrl === "string" && value.assetUrl.trim()) refs.add(value.assetUrl.trim());
    Object.values(value).forEach(visit);
  };
  projects.forEach(visit);
  return [...refs].sort();
}

export function describeAfterglowConsolidationConflict(path) {
  if (path === "/build/foundations/acceptedVisualArtifactIds"
      || path === "/build/world/acceptedVisualArtifactIds") {
    return {kind:"visual-approval-collection",
      label:"Approved image and Storyboard locks",
      requiresSpecialReconciliation:true};
  }
  if (path === "/production/graphicNovelTextApprovals") {
    return {kind:"narration-approval-collection",label:"Graphic Novel narration approvals",
      requiresSpecialReconciliation:true};
  }
  if (path.startsWith("/production/graphicNovelTextApprovals/@approval:")) {
    const number = /:position:(\d+)$/.exec(path);
    return {kind:"shot-narration-approval",
      label:number?"Graphic Novel narration — Shot "+number[1]:"Graphic Novel narration approval",
      requiresSpecialReconciliation:true};
  }
  if (path.startsWith("/storyDevelopment/fields/") && path.endsWith("/updatedAt")) {
    return {kind:"authorship-metadata",label:"Story-field edit date (not a story decision)",
      requiresSpecialReconciliation:true};
  }
  if (/^\/storyDevelopment\/fields\/[^/]+$/.test(path)
      || path.startsWith("/storyDevelopment/fields/") && path.endsWith("/value")) {
    return {kind:"story-field-content",label:"Authored answer and its original approval evidence",
      requiresSpecialReconciliation:false};
  }
  return {kind:"other",label:"Story project change",requiresSpecialReconciliation:false};
}
function questionEvidenceFor({baseline,projects,sourceKeys,changes,questions,needsReview}) {
  if (questions !== undefined && (!isRecord(questions)
     || Object.values(questions).some(q=>typeof q!=="string" || !q.trim()))) {
    throw new Error("Canonical story questions must be a validated field-to-question map.");
  }
  const known=questions ?? {};
  const fields=[...new Set([...Object.keys(baseline.storyDevelopment?.fields??{}),
    ...projects.flatMap(p=>Object.keys(p.storyDevelopment?.fields??{}))])].sort();
  const rows=[];
  for (const fieldId of fields) {
    const key="/storyDevelopment/fields/"+fieldId.replaceAll("~","~0").replaceAll("/","~1");
    if (![...changes.keys()].some(path=>path===key || path.startsWith(key+"/")))continue;
    const sources=projects.filter(p=>p.storyDevelopment?.fields?.[fieldId]!==undefined
      && !equal(p.storyDevelopment.fields[fieldId],baseline.storyDevelopment?.fields?.[fieldId]??ABSENT));
    const question=Object.hasOwn(known,fieldId)?known[fieldId]:null;
    const status=questions===undefined?"catalog-not-provided":question?"canonical-question-matched":"unknown-canonical-question";
    if(status==="unknown-canonical-question") {
      needsReview.push({path:key,reason:"unknown-canonical-question",sourceProjectId:sourceKeys[projects.indexOf(sources[0])]??"baseline"});
    }
    rows.push({fieldId,path:key,question,questionStatus:status,
      semanticStatus:"not-assessed",
      sourceProjectIds:sources.map(p=>sourceKeys[projects.indexOf(p)]),
      distinctAnswers:[...new Set(sources.map(p=>contributionSignature(key,p.storyDevelopment.fields[fieldId])))].length});
  }
  return rows;
}
export function planAfterglowConsolidation({baseline,sources,questions}) {
  if(!isRecord(baseline)||sourceId(baseline)!==EXPECTED_REFERENCE
     ||baseline.format!=="2.0-foundation"||!Array.isArray(sources)||!sources.length){
    throw new Error("Consolidation needs the trusted Afterglow baseline and saved projects.");
  }
  const roots=new Set([...AFTERGLOW_DURABLE_FIELDS,...EXCLUDED_PROFILE_METADATA]);
  for(const key of Object.keys(baseline)){
    if(!roots.has(key))throw new Error("Unrecognized Afterglow project field requires review: "+key);
  }
  const ids=new Set();
  const entries=sources.map(x=>{
    const p=x?.project;
    const id=x?.sourceKey??p?.id;
    if(!isRecord(p)||p.format!==baseline.format||sourceId(p)!==EXPECTED_REFERENCE
       ||typeof p.id!=="string"||!p.id || typeof id!=="string"||!id||ids.has(id)
       ||(x?.sourceKey!==undefined && !(id.startsWith("point:") || id==="archived:"+p.id))
       ||typeof p.updatedAt!=="string"||!Number.isFinite(Date.parse(p.updatedAt))
       ||!equal(p.sourceEvidence.referenceFixture,baseline.sourceEvidence.referenceFixture)){
      throw new Error("Consolidation rejected invalid, foreign, altered-source or duplicate Afterglow state.");
    }
    for(const key of Object.keys(p)){
      if(!roots.has(key))throw new Error("Unrecognized saved Afterglow field requires review: "+key);
    }
    ids.add(id);return {project:p,key:id,kind:x?.sourceKey?.startsWith("point:")?"recovery-point":
      x?.sourceKey?.startsWith("archived:")?"archived-copy":"working-copy"};
  }).sort((a,b)=>a.project.updatedAt.localeCompare(b.project.updatedAt)||a.key.localeCompare(b.key));
  const projects=entries.map(entry=>entry.project),sourceKeys=entries.map(entry=>entry.key);
  const changes=new Map(), needsReview=[];
  for(const {project:p,key} of entries){
    const edits=[], reviews=[];
    for(const root of AFTERGLOW_DURABLE_FIELDS){
      collect(Object.hasOwn(baseline,root)?baseline[root]:ABSENT,
        Object.hasOwn(p,root)?p[root]:ABSENT,[root],edits,reviews);
    }
    for(const x of reviews)needsReview.push({...x,sourceProjectId:key});
    for(const x of edits){
      if(!changes.has(x.path))changes.set(x.path,[]);
      changes.get(x.path).push({...x,sourceProjectId:key});
    }
  }
  const questionEvidence=questionEvidenceFor({baseline,projects,sourceKeys,changes,questions,needsReview});
  const candidate=copy(baseline),applied=[],conflicts=[];
  for(const [path,items] of [...changes].sort(([a],[b])=>a.localeCompare(b))){
    const alternatives=[...new Map(items.map(x=>[contributionSignature(path,x.value),x])).values()];
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
    const first=items[0];
    const before=readAt(baseline,first.keys);
    applied.push({path,sources:items.map(x=>x.sourceProjectId),
      baselineAbsent:before===ABSENT,
      baselineValue:before===ABSENT?null:copy(before)});

  }
  const reconciledVisuals=reconcileAfterglowAcceptedVisuals({baseline,projects,sourceKeys,candidate,conflicts});
  candidate.build=reconciledVisuals.candidate.build;
  needsReview.push(...reconciledVisuals.needsReview);
  orderGraphicNovelApprovals(candidate);
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
  return {candidate,sources:entries.map(({project:p,key,kind})=>({id:key,projectId:p.id,kind,revision:p.revision,updatedAt:p.updatedAt})),
    applied,conflicts,needsReview,questionEvidence,
    reconciledVisuals:reconciledVisuals.reconciled,
    sourceMediaReferences:sourceMediaReferences(projects),
    localAssetsToVerify:[...assetRefs].sort(),
    mergeShapeConsistent:conflicts.length===0&&needsReview.length===0,
    readyForHumanCommit:false,packageModified:false};
}


/**
 * Pure, non-persisting Human choice preview for all competing-value conflicts.
 * Decisions: {[canonicalPath]: "baseline" | integer alternative index}.
 * A collision of overlapping paths, deletions, reorders, and missing media
 * remains blocked; never interpret a choice as authority to save or publish.
 */
export function reviewAfterglowConsolidationDecisions(plan, decisions = {}, exclusions = []) {
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
  if (!Array.isArray(exclusions) || new Set(exclusions).size !== exclusions.length
    || exclusions.some(path => typeof path !== "string")) {
    throw new Error("Excluded creative selections must be unique canonical paths.");
  }
  const applied = new Map(plan.applied.map(change=>[change.path,change]));
  for (const path of exclusions) {
    const change = applied.get(path);
    if (!change || typeof change.baselineAbsent !== "boolean") {
      throw new Error("A creative exclusion is outside the automatically merged draft: " + path);
    }
    // Source selection and exclusions cannot target overlapping entities.
    if ([...applied.keys()].some(other=>other!==path&&(other.startsWith(path+"/")||path.startsWith(other+"/")))) {
      throw new Error("Cannot exclude a path with overlapping approved changes: " + path);
    }
  }
  const candidate = structuredClone(plan.candidate);
  for (const path of exclusions) {
    const change=applied.get(path);
    const keys=path.slice(1).split("/").map(segment=>segment.replaceAll("~1","/").replaceAll("~0","~"));
    restore(candidate,keys,change.baselineAbsent?ABSENT:change.baselineValue);
  }
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
  orderGraphicNovelApprovals(candidate);
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
    candidate, resolved, excluded: [...exclusions], unresolvedConflicts,
    needsReview: structuredClone(plan.needsReview),
    localAssetsToVerify: [...localAssetsToVerify].sort(),
    decisionShapeConsistent: unresolvedConflicts.length === 0 && plan.needsReview.length === 0,
    readyForHumanCommit: false,
    packageModified: false,
  };
}
