/**
 * Server-side verification of the Human's exact choices against SAVED story
 * snapshots. This is never an approval based on a browser "ready" flag.
 * The selected candidate is recomputed independently of browser payloads.
 */
import { createHash, randomUUID } from "node:crypto";
import { planAfterglowConsolidation, reviewAfterglowConsolidationDecisions,
  AFTERGLOW_DURABLE_FIELDS } from "../afterglow-consolidation.mjs";
import { inventoryAfterglowRecoveredWork,afterglowRecoveryItemPath } from "../afterglow-work-recovery.mjs";
import { partitionAfterglowChoices } from "../afterglow-creative-choice-boundary.mjs";
import { listAfterglowImageChoices,applyAfterglowImageChoices } from "../afterglow-image-review.mjs";
import { afterglowReviewProgress } from "../afterglow-review-progress.mjs";

import { reconcileAfterglowTechnicalRecords,AfterglowSaveVerificationError } from "./afterglow-technical-reconciliation.mjs";

const record=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
export const shaAfterglowSnapshot=value=>"sha256:"+createHash("sha256").update(JSON.stringify(value)).digest("hex");
function validSelections(value) {
  if(!record(value)||!record(value.decisions)||!record(value.confirmedCurrent)
    ||!record(value.imageChoices)||!Array.isArray(value.exclusions)) {
    throw new Error("Every selection category must be submitted explicitly.");
  }
  if(Object.values(value.confirmedCurrent).some(v=>v!==true)
    ||Object.values(value.imageChoices).some(v=>v!=="keep"&&v!=="exclude")) {
    throw new Error("Invalid or partial Human decision.");
  }
  return value;
}
function fingerprintSources(sources) {
  return sources.map(s=>({key:s.sourceKey??s.project.id,digest:shaAfterglowSnapshot(s.project)}))
    .sort((a,b)=>a.key.localeCompare(b.key));
}
export function prepareVerifiedAfterglowMaster({
  baseline,sources,fields,questions,manifest,selections,expectedSources,
  masterId,now,
}) {
  validSelections(selections);
  if(!Array.isArray(sources)||!sources.length||!Array.isArray(fields)||
    !record(questions)||!record(manifest)||!Array.isArray(expectedSources)) {
    throw new Error("A complete authenticated Afterglow source inventory is required.");
  }
  const actual=fingerprintSources(sources);
  const expected=expectedSources.map(x=>({key:x?.key,digest:x?.digest}))
    .sort((a,b)=>String(a.key).localeCompare(String(b.key)));
  if(JSON.stringify(actual)!==JSON.stringify(expected)) {
    throw new Error("Saved Afterglow source snapshots changed since Human review. Review again.");
  }
  const plan=planAfterglowConsolidation({baseline,sources,questions});
  const recovery=inventoryAfterglowRecoveredWork({baseline,sources,fields});
  const imageOptions=listAfterglowImageChoices({
    sources:[{project:baseline,sourceKey:"provided-example"},...sources],manifest,
  });
  const paths=new Set(recovery.groups.flatMap(group=>group.items.map(item=>
    afterglowRecoveryItemPath(item,fields)).filter(Boolean)));
  const creative=partitionAfterglowChoices(plan.conflicts,[...paths]);
  const conflicts=[...creative.human,...creative.inRecovered];
  const progress=afterglowReviewProgress({
    groups:recovery.groups.map(group=>({id:group.id,label:group.label,
      items:group.items.map(item=>({id:item.id,label:item.label,kind:item.kind,
        reviewPath:afterglowRecoveryItemPath(item,fields)}))})),
    candidatePaths:plan.applied.map(x=>x.path), conflictPaths:conflicts.map(x=>x.path),
    confirmations:selections.confirmedCurrent,exclusions:selections.exclusions,
    decisions:selections.decisions,
    extraConflicts:creative.human.map(item=>({path:item.path})),
    imageOptions,imageChoices:selections.imageChoices,
  });
  const allowableConfirmations=new Set(plan.applied.map(x=>x.path));
  if(Object.keys(selections.confirmedCurrent).some(k=>!allowableConfirmations.has(k))) {
    throw new Error("A confirmed field was not in the recovered source choices.");
  }
  if(!progress.allCreativeDecided||progress.pending||progress.needsIndependentReview.length) {
    throw new Error("All creative sections and nonstandard recovery records must be resolved before saving.");
  }
  if(plan.questionEvidence.some(x=>x.questionStatus!=="canonical-question-matched")) {
    throw new Error("A recovered answer has no verified canonical question.");
  }
  const reviewed=reconcileAfterglowTechnicalRecords({baseline,sources,
    reviewed:reviewAfterglowConsolidationDecisions(plan,selections.decisions,selections.exclusions)});
  if(reviewed.technicalBlockers.length) throw new AfterglowSaveVerificationError(reviewed.technicalBlockers.join(" "));
  if(reviewed.unresolvedConflicts.length||reviewed.needsReview.length) {
    throw new Error("Saved alternatives remain unresolved; no consolidated master was saved.");
  }
  const images=applyAfterglowImageChoices({
    candidate:reviewed.candidate,items:imageOptions,choices:selections.imageChoices,
  });
  if(images.clearedLocks.length) {
    throw new Error("Removing the last approved frame would clear a saved character lock. Review the complete version first.");
  }
  const candidate=structuredClone(images.candidate);
  candidate.id=masterId||"afterglow-consolidated-"+randomUUID();
  candidate.title=baseline.title;
  candidate.revision=0;
  candidate.createdAt=now||new Date().toISOString();
  candidate.updatedAt=candidate.createdAt;
  if(candidate.sourceEvidence?.referenceFixture?.sourceId!=="afterglow-v9-complete-baseline") {
    throw new Error("Consolidated story has lost the packaged example provenance.");
  }
  // Comparing only canonical creative roots intentionally excludes generated
  // metadata (id/date), never author-written source material.
  for(const root of AFTERGLOW_DURABLE_FIELDS) {
    if(JSON.stringify(candidate[root])!==JSON.stringify(images.candidate[root])) {
      throw new Error("Consolidation changed an unapproved durable story field: "+root);
    }
  }
  return {candidate,progress,sourceProofs:actual,sourceCount:sources.length,
    includedHistorical:sources.filter(x=>x.sourceKey).length,readyForIndependentMedia:true};
}
