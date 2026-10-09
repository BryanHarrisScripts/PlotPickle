/**
 * #2863 Phase 2C — pure and deliberately NON-AUTHORIZING master-save preflight.
 * The sole purpose is exposing blockers BEFORE any Library mutation. It can
 * never authorize persistence: durable round-trip, Human confirmation and
 * authenticated save are separate gates, not assumed by this report.
 */
import { AFTERGLOW_DURABLE_FIELDS } from "./afterglow-consolidation.mjs";
import { inventoryAfterglowMedia } from "./afterglow-media-integrity.mjs";

const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const SHA = /^sha256:[a-f0-9]{64}$/i;
function stable(v) {
  if (Array.isArray(v)) return "["+v.map(stable).join(",")+"]";
  if (record(v)) return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}";
  return JSON.stringify(v);
}
const equal=(a,b)=>stable(a)===stable(b);

function validateProofs(proofs, sourceIds, blockers, phase) {
  if(!Array.isArray(proofs)||proofs.length!==sourceIds.length){
    blockers.push({code:"incomplete-snapshot-fingerprints",detail:phase+" must include exactly every saved source."});return null;
  }
  const map=new Map();
  for(const item of proofs) {
    if(!record(item)||typeof item.id!=="string"||!item.id
       ||!Number.isInteger(item.revision)||item.revision<0
       ||typeof item.updatedAt!=="string" || !Number.isFinite(Date.parse(item.updatedAt))
       ||typeof item.digest!=="string" || !SHA.test(item.digest)
       ||map.has(item.id)) {
      blockers.push({code:"invalid-snapshot-fingerprint",detail:phase+" contains missing/duplicate/invalid proof."});return null;
    }
    map.set(item.id,item);
  }
  for(const id of sourceIds) if(!map.has(id)) {
    blockers.push({code:"missing-source-fingerprint",detail:phase+" is missing a saved version."});return null;
  }
  return map;
}

/**
 * Inputs are immutable, captured from the authenticated profile's local vault
 * snapshots. Hashes prove byte-for-byte equality between the review and this
 * check, NOT server persistence, semantic relevance, nor ownership alone.
 */
export function preflightAfterglowMasterSave({
  plan, reviewed, initialProofs, currentProofs, sourceSnapshots,
  mediaReport, normalizedCandidate,
}) {
  if(!record(plan)||!record(plan.candidate)||!Array.isArray(plan.sources)
     ||plan.readyForHumanCommit!==false || plan.packageModified!==false
     ||!record(reviewed)||!record(reviewed.candidate)
     ||reviewed.readyForHumanCommit!==false ||reviewed.packageModified!==false) {
    throw new Error("Master preflight requires validated, read-only Afterglow plan and selection.");
  }
  const blockers=[];
  const sources=plan.sources;
  if(!sources.length || new Set(sources.map(x=>x.id)).size!==sources.length) {
    blockers.push({code:"invalid-source-set",detail:"Saved versions must have unique project IDs."});
  }
  const ids=sources.map(x=>x.id);
  const initial=validateProofs(initialProofs,ids,blockers,"Initial review");
  const current=validateProofs(currentProofs,ids,blockers,"Current Library");
  if(initial&&current) {
    for(const source of sources) {
      const before=initial.get(source.id),now=current.get(source.id);
      if(before.revision!==source.revision || before.updatedAt!==source.updatedAt) {
        blockers.push({code:"review-source-mismatch",detail:"A captured review revision does not match its saved source."});
      }
      if(before.revision!==now.revision || before.updatedAt!==now.updatedAt ||before.digest!==now.digest) {
        blockers.push({code:"source-changed",detail:"A saved Afterglow source changed after the review; restart the review."});
      }
    }
  }
  if(!Array.isArray(reviewed.unresolvedConflicts) || reviewed.unresolvedConflicts.length) {
    blockers.push({code:"unresolved-creative-conflicts",detail:"Different story answers still require evidence-based resolution."});
  }
  if(!Array.isArray(reviewed.needsReview) || reviewed.needsReview.length) {
    blockers.push({code:"unresolved-structural-review",detail:"A deletion, media identity or structural exception is unresolved."});
  }
  if(!Array.isArray(plan.questionEvidence) || plan.questionEvidence.some(x=>
    x.questionStatus!=="canonical-question-matched")) {
    blockers.push({code:"unverified-question-identity",detail:"Some changed story fields do not map to a verified canonical question."});
  }
  if(Array.isArray(plan.questionEvidence) && plan.questionEvidence.some(x=>
    x.semanticStatus!=="verified-grounded")) {
    blockers.push({code:"question-answer-relevance-pending",detail:"Original question identity is known, but independent evidence-grounded answer assessment is still pending."});
  }
  const candidate=reviewed.candidate;
  if(!record(normalizedCandidate)) {
    blockers.push({code:"roundtrip-not-tested",detail:"The draft has not passed PlotPickle's normalizer."});
  } else {
    for(const root of AFTERGLOW_DURABLE_FIELDS) if(!equal(candidate[root],normalizedCandidate[root])) {
      blockers.push({code:"normalization-data-loss",detail:"Normalization changes durable story data at root "+root+"."});
    }
  }
  if(!Array.isArray(sourceSnapshots)||sourceSnapshots.length!==ids.length
     ||new Set(sourceSnapshots.map(x=>x?.project?.id)).size!==ids.length) {
    blockers.push({code:"incomplete-source-snapshots",detail:"Every saved project snapshot must be present."});
  } else {
    const snapshotIds=new Set(sourceSnapshots.map(x=>x?.project?.id));
    if(ids.some(x=>!snapshotIds.has(x)))blockers.push({code:"source-snapshot-mismatch",detail:"Review and media snapshots differ."});
  }
  if(!record(mediaReport)||!Array.isArray(mediaReport.results)
    ||mediaReport.readyForHumanCommit!==false||mediaReport.packageModified!==false) {
    blockers.push({code:"media-not-inspected",detail:"Actual image byte/readback evidence is missing."});
  } else if(Array.isArray(sourceSnapshots)) {
    const mediaInventory=inventoryAfterglowMedia({candidate,sources:sourceSnapshots});
    const observed=mediaReport.results;
    const all=new Set(mediaInventory.map(x=>x.url));
    const actual=new Set(observed.map(x=>x?.url));
    if(actual.size!==observed.length || actual.size!==all.size || [...all].some(url=>!actual.has(url))) {
      blockers.push({code:"stale-media-inventory",detail:"Media readback does not cover the complete current source and draft set."});
    } else {
      for(const item of mediaInventory) {
        const result=observed.find(x=>x.url===item.url);
        if(result.selected!==item.selected)blockers.push({code:"changed-media-selection",detail:"Selected media differs from the inspected draft."});
        if(result.status==="verified-pinned")continue;
        if(result.status==="verified-current"||result.status==="readable-unpinned") {
          blockers.push({code:"unproven-original-media-hash",detail:"Media is readable now but lacks original save-time identity proof."});
        } else {
          blockers.push({code:"unreadable-or-altered-media",detail:"Media is missing, unsupported, corrupt or hash-mismatched."});
        }
        if(!item.selected)blockers.push({code:"historical-media-not-retained",detail:"A saved source includes media absent from the draft. Reconcile or preserve that source as recoverable history."});
      }
    }
  }
  // These are not claims of authorization; a later mutation must independently
  // revalidate exact source bytes, approval authority and remote readback.
  blockers.push({code:"durable-save-not-implemented",detail:"No atomic account-owned master creation, encrypted write/readback or restart proof exists yet."});
  return {
    sourceCount:ids.length,
    questionCount:Array.isArray(plan.questionEvidence)?plan.questionEvidence.length:0,
    selectedMediaCount:mediaReport?.selectedCount??0,
    blockers:[...new Map(blockers.map(x=>[x.code+"|"+x.detail,x])).values()],
    readyForHumanCommit:false,
    packageModified:false,
  };
}
