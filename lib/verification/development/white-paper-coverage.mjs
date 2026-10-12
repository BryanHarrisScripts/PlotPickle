import { createHash } from "node:crypto";

export const coverageDigest = (value) => createHash("sha256").update(value).digest("hex");
const textDigest = (value) => coverageDigest(value.replaceAll("\r\n", "\n"));
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

export function coverageInventoryPaths(tracked, catalog) {
  const paths = [...new Set([
    ...tracked.filter((file) => file.startsWith("tests/") || file.startsWith(".github/workflows/") ||
      (file.startsWith("scripts/") && /(?:proof|smoke|verification|casebook|uat|test|validate)/iu.test(file))),
    ...catalog.entries.flatMap((entry) => entry.runner.targets),
  ])];
  paths.sort();
  return paths;
}

// Preserve every prose/model paragraph, including examples and explanatory material.
// Extraction assigns locations; it does not confer normative authority.
export function extractWhitePaperUnits(source) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const units = [];
  let section = "front", paragraph = [], firstLine = 0;
  const counts = new Map();
  const flush = (endLine) => {
    if (!paragraph.length) return;
    const ordinal = (counts.get(section) || 0) + 1;
    counts.set(section, ordinal);
    const text = paragraph.join("\n");
    units.push({ id: `WP3.${section}.P${String(ordinal).padStart(2,"0")}`, section, startLine:firstLine, endLine, digest:textDigest(text), text });
    paragraph = [];
  };
  for (let index=0; index<lines.length; index+=1) {
    const line = lines[index];
    if (/^#/u.test(line)) {
      flush(index);
      if (/^## /u.test(line)) {
        const numbered = line.match(/^## (\d+) /u);
        section = numbered ? `S${String(numbered[1]).padStart(2,"0")}` : line.includes("References") ? "references" : line.includes("Executive") ? "summary" : "fundamental";
      }
    } else if (!line.trim()) flush(index);
    else { if (!paragraph.length) firstLine=index+1; paragraph.push(line); }
  }
  flush(lines.length);
  return units;
}

export function validateWhitePaperCoverage(document, { source, inventoryFiles, enforcementFiles = new Map(), catalogueTargets = new Set(), approvedEditions = new Set(), catalog, sourceFiles = new Map() }) {
  const findings = [];
  const fail = (code, target, detail) => findings.push({code,target,detail});
  if (document?.schemaVersion !== 1 || document?.source?.version !== "3.0" || document?.source?.path !== "docs/white-papers/AI_Programming_Evolution_White_Paper.md" || document.source.digest !== textDigest(source)) fail("source-provenance", "source", "Approved edition and complete source digest must match.");
  if (document?.review?.status !== "PENDING_HUMAN_REVIEW" || document?.completion !== "AUDIT_PROPOSAL") fail("unauthorized-completion", "review", "This proposal does not admit Human approval or full-paper completion.");
  const units = extractWhitePaperUnits(source);
  const records = Array.isArray(document?.sourceUnits) ? document.sourceUnits : [];
  const seen = new Set();
  for (const unit of units) {
    const matches = records.filter((row) => row.id === unit.id);
    if (matches.length !== 1) { fail("source-accounting",unit.id,"Every substantive source unit must appear exactly once."); continue; }
    const row = matches[0]; seen.add(row.id);
    if (row.digest !== unit.digest || row.startLine !== unit.startLine || row.endLine !== unit.endLine || row.section !== unit.section) fail("source-location",unit.id,"Source location or content is stale.");
    if (!["CANDIDATE_REQUIREMENT","EXAMPLE","EXPLANATION","METADATA","REFERENCE","MODEL_EXPRESSION"].includes(row.classification) || !nonempty(row.rationale) || row.review !== "PENDING_HUMAN_REVIEW") fail("source-classification",unit.id,"Classification and exclusion rationale need explicit pending Human review.");
    if (row.classification === "CANDIDATE_REQUIREMENT" && !document.requirements?.some((requirement)=>requirement.sourceUnit===unit.id)) fail("unmapped-candidate",unit.id,"Candidate meaning cannot disappear from the requirement map.");
  }
  for (const row of records) if (!seen.has(row.id)) fail("unknown-source-unit",row.id,"Unit is not in the approved source.");
  const ids = new Set();
  for (const row of document?.requirements || []) {
    if (!nonempty(row.id) || ids.has(row.id)) fail("requirement-identity",row.id,"Requirement IDs must be unique.");
    ids.add(row.id);
    const unit = units.find((candidate)=>candidate.id===row.sourceUnit);
    if (!unit || !nonempty(row.sourceFragment) || !unit.text.includes(row.sourceFragment) || row.fragmentDigest !== textDigest(row.sourceFragment)) fail("requirement-source",row.id,"Exact candidate fragment must belong to its named source unit.");
    if (row.interpretationReview !== "PENDING_HUMAN_REVIEW" || !nonempty(row.interpretation) || !nonempty(row.owner) || !nonempty(row.expectedOutcome) || !nonempty(row.negativeControl) || !nonempty(row.limits) || !row.followUpIssues?.every(Number.isInteger) || !row.followUpIssues?.length) fail("requirement-review",row.id,"Meaning, owner, outcome, negative control, limits and follow-up ownership are required.");
    if (!["UNASSESSED","PARTIAL","NOT_ENFORCED"].includes(row.enforcement?.status)) fail("enforcement-scope",row.id,"This audit has not established comprehensive enforcement.");
    if (row.enforcement?.status === "PARTIAL" && !row.enforcement.references?.length) fail("missing-enforcement",row.id,"Partial enforcement requires scoped source references.");
    for (const ref of row.enforcement?.references || []) {
      const actual = enforcementFiles.get(ref.path);
      if (typeof actual !== "string" || textDigest(actual) !== ref.digest || !nonempty(ref.scope)) fail("stale-enforcement",row.id,"Enforcement reference is missing, stale or unscoped.");
    }
    if (row.observation?.status !== "UNPROVEN" || row.observation?.receipts?.length !== 0) fail("unsupported-product-promotion",row.id,"No independently admitted product receipt is supplied by this audit. Execution-only evidence cannot establish observation.");
    if (!Array.isArray(row.contractRefs) || !Array.isArray(row.testTargets)) fail("mapping-shape",row.id,"Explicit empty or bounded contract/test references are required.");
    else {
      for (const target of row.testTargets) if (!catalogueTargets.has(target)) fail("unknown-test-reference",row.id,"Test reference is absent from the pinned catalogue.");
      for (const ref of row.contractRefs) if (typeof ref !== "string" || !approvedEditions.has(ref.split(";")[0])) fail("unknown-contract-reference",row.id,"Contract edition is not in the approved source index.");
    }
  }
  for (const unit of units) {
    if (!document.requirements?.some(row=>row.sourceUnit===unit.id)) continue;
    const fragments = document.requirements.filter(row=>row.sourceUnit===unit.id).map(row=>row.sourceFragment).join(" ");
    if (fragments.replace(/\s+/gu," ").trim() !== unit.text.replace(/\s+/gu," ").trim()) fail("fragment-accounting",unit.id,"Mapped fragments must preserve the complete candidate paragraph without omissions or duplicates.");
  }
  const sections = new Set((document?.requirements || []).map(row=>units.find(unit=>unit.id===row.sourceUnit)?.section));
  for(let number=1;number<=13;number+=1)if(!sections.has(`S${String(number).padStart(2,"0")}`))fail("missing-numbered-section",String(number),"Every numbered section must retain candidate meaning for review.");
  const inventory = document?.legacyInventory;
  if (!/^[a-f0-9]{40}$/u.test(inventory?.revision || "") || !Array.isArray(inventory?.files) || !(inventoryFiles instanceof Map)) fail("inventory-provenance","legacyInventory","A revision-pinned complete baseline inventory is required.");
  else {
    const inventorySeen = new Set();
    for (const row of inventory.files) {
      const actual = inventoryFiles.get(row.path);
      if (inventorySeen.has(row.path) || !actual || row.digest !== coverageDigest(actual.bytes) || JSON.stringify(row.catalogueIds) !== JSON.stringify(actual.catalogueIds) || JSON.stringify(row.truthRefs) !== JSON.stringify(actual.truthRefs)) fail("inventory-integrity",row.path,"Baseline file bytes, owners or bindings differ.");
      inventorySeen.add(row.path);
      if (row.semanticReview !== "UNREVIEWED" || row.claimScope !== "ENGINEERING_ONLY") fail("legacy-certification",row.path,"A binding or file inventory does not audit assertion fidelity or certify product behavior.");
    }
    for(const file of inventoryFiles.keys())if(!inventorySeen.has(file))fail("missing-inventory-file",file,"No baseline test/fixture/target may silently disappear.");
    for(const file of inventorySeen)if(!inventoryFiles.has(file))fail("unknown-inventory-file",file,"File is not part of the pinned baseline.");
  }
  if (document?.measurementBaseline?.status !== "UNKNOWN" || document.measurementBaseline.values !== null || document.measurementBaseline.thresholds !== null) fail("unsupported-benefit", "measurementBaseline", "No comparative outcome measurements or predeclared thresholds have been admitted by this audit.");
  for (const run of document?.engineeringEvidence || []) if (run.scope !== "ENGINEERING_ONLY" || !/^[a-f0-9]{40}$/u.test(run.revision || "") || !nonempty(run.url) || !nonempty(run.limits)) fail("engineering-evidence-scope","engineeringEvidence","Execution receipts must stay revision-bound and engineering-only.");
  if (catalog) {
    const indexed = catalog.truthGovernance.approvedTruths.find((truth)=>truth.id==="WHITE-PAPER-V3");
    if (document.source.digest !== indexed?.sourceDigest || document.source.version !== indexed?.version) fail("approved-source-index","source","Source must match the existing approved edition, not a self-updated digest.");
    const expectedLayers = [...new Set(catalog.entries.map((entry)=>entry.ownerLayer))].sort();
    const layers = document?.layerInventory || [];
    if (JSON.stringify(layers.map((row)=>row.layer).sort()) !== JSON.stringify(expectedLayers)) fail("layer-accounting","layers","All seven baseline layers must be represented exactly once.");
    for (const row of layers) {
      const entries = catalog.entries.filter((entry)=>entry.ownerLayer===row.layer);
      if (JSON.stringify([...row.catalogueIds].sort()) !== JSON.stringify(entries.map((entry)=>entry.id).sort()) ||
        JSON.stringify(row.targets) !== JSON.stringify([...new Set(entries.flatMap((entry)=>entry.runner.targets))].sort()) ||
        row.semanticReview !== "UNREVIEWED" || row.observationStatus !== "UNPROVEN") fail("layer-integrity",row.layer,"Layer inventory differs or retrospectively certifies assertions.");
    }
    const expected = catalog.truthGovernance.approvedTruths.filter((truth)=>["PP-SAVE-001","PP-NARR-001"].includes(truth.id));
    const product = document?.productContracts || [];
    if (new Set(product.map((row)=>row.id)).size !== product.length || product.length !== expected.reduce((count,truth)=>count+truth.obligations.length,0)) fail("product-accounting","contracts","Every approved Save and narration obligation needs one unique row.");
    for (const truth of expected) for (const obligation of truth.obligations) {
      const row = product.find((item)=>item.id===`${truth.id}/${obligation.id}`);
      const content = sourceFiles.get(truth.source);
      const start = content?.indexOf(obligation.start) ?? -1;
      const end = content?.indexOf(obligation.end,start+obligation.start.length) ?? -1;
      const fragment = start>=0 ? content.slice(start,end<0?content.length:end).trim() : "";
      if (!row || !fragment || row.source !== truth.source || row.version !== truth.version || row.contractId !== truth.id || row.obligationId !== obligation.id || row.sourceDigest !== truth.sourceDigest || textDigest(content) !== truth.sourceDigest || row.sourceFragment !== fragment || row.fragmentDigest !== textDigest(fragment) || row.startLine !== content.slice(0,start).split("\n").length) fail("product-provenance",`${truth.id}/${obligation.id}`,"Approved edition, anchors and exact obligation fragment must match.");
      if (row && (row.observationStatus !== "UNPROVEN" || row.evidenceRefs?.length !== 0 || !row.followUpIssues?.length || !nonempty(row.requiredObservation) || !nonempty(row.limits))) fail("product-observation",row.id,"Absent live receipts cannot be promoted; ownership and gaps must remain explicit.");
      for (const target of row?.testTargets || []) if (!catalogueTargets.has(target)) fail("unknown-product-target",row.id,"Product mapping needs existing catalogue targets.");
      for (const id of row?.catalogueIds || []) if (!catalog.entries.some((entry)=>entry.id===id && row.testTargets?.some((target)=>entry.runner.targets.includes(target)))) fail("unknown-product-owner",row.id,"Product catalogue owner must actually own a mapped test.");
    }
    for (const issue of [2932,2934,2936,2847,2855]) if (!document.consolidatedIssues?.includes(issue)) fail("consolidation-accounting",String(issue),"Each requested issue must remain in the consolidated accounting.");
    for (const id of ["DSDD-TRUSTED-RECEIPT","WINDOWS-NORMAL-LAUNCHER","LOCAL-WRITER-PIXELS","MODEL-CORRESPONDENCE","COMPOSITION-MIGRATION"]) {
      const gap = document.observationGaps?.find((row)=>row.id===id);
      if (!gap || gap.status !== "UNPROVEN" || !Number.isInteger(gap.issue) || !nonempty(gap.owner) || !nonempty(gap.detail)) fail("missing-observation-gap",id,"Unobserved scope requires owned and linked follow-up; it cannot silently disappear.");
    }
    if (!document.interpretationConflicts?.some((row)=>row.id==="NARR-NO-BUBBLE-EDITION")) fail("missing-interpretation-conflict","No Bubble","Retain the explicit old-contract/new-direction conflict for Human review.");
  }
  for (const conflict of document?.interpretationConflicts || []) if (conflict.status !== "PENDING_HUMAN_REVIEW" || !conflict.sources?.length || !conflict.followUpIssues?.length || !nonempty(conflict.detail)) fail("interpretation-conflict",conflict.id,"Conflicting meaning must retain both provenance and Human review.");
  return {status:findings.length?"INVALID":"VALID_AUDIT_PROPOSAL",findings,requirementCandidates:ids.size,sourceUnits:units.length,legacyFiles:inventory?.files?.length||0,productConformance:"UNPROVEN",humanReview:"PENDING",limits:"Integrity does not prove semantic completeness, assertion fidelity, device/provider behavior or reduced Human burden."};
}

export function renderWhitePaperCoverage(document, result) {
  const rows = ["# White paper v3.0 coverage audit", "", "Status: audit proposal; Human semantic review pending. Product conformance UNPROVEN.", "", `${result.requirementCandidates} sentence-level review candidates, including context and hypotheses; ${result.sourceUnits} source units; ${result.legacyFiles} baseline test/fixture/proof/workflow files. Counts do not certify coverage.`, "", "| Section | Candidates | Partial enforcement references | Observed product outcomes |", "| --- | ---: | ---: | ---: |"];
  for (let number=1;number<=13;number+=1) {
    const section=`S${String(number).padStart(2,"0")}`;
    const units = new Set(document.sourceUnits.filter(unit=>unit.section===section).map(unit=>unit.id));
    const candidates=document.requirements.filter(row=>units.has(row.sourceUnit));
    rows.push(`| ${number} | ${candidates.length} | ${candidates.filter(row=>row.enforcement.status==="PARTIAL").length} | 0 |`);
  }
  rows.push("", "Each paragraph and candidate is located in the companion JSON map. Normative/explanatory classification, applicability and interpretation are proposals, not new approved obligations.", "", "## Remaining work", "", "- #2936: Human requirement interpretation and semantic legacy review.", "- #2937: independently admitted real workflow observations.", "- #2938: safety/progress and model correspondence.", "- #2939: contract composition and migration/recovery.", "- #2940: reliability/rework and Human-burden baseline measurements.", "", "## Candidate requirements", "");
  for(const row of document.requirements){
    const unit=document.sourceUnits.find((item)=>item.id===row.sourceUnit);
    rows.push(`### ${row.id}`, "", row.interpretation, "", `Source: ${row.sourceUnit}; lines ${unit.startLine}–${unit.endLine} of ${document.source.path}, edition ${document.source.version}, SHA-256 ${document.source.digest}. Interpretation pending Human review. Owner: ${row.owner}.`, "", `Enforcement: ${row.enforcement.status}; product observation: ${row.observation.status}.`, "", `Expected observation: ${row.expectedOutcome}`, "", `Negative control to plan: ${row.negativeControl}`, "", `Limits: ${row.limits}`, "");
  }
  if (document.productContracts?.length) {
    rows.push("## Approved product obligation accounting", "", "These exact approved fragments remain authoritative. Mapped tests are engineering references; real-device conformance is unproven.", "", "| Obligation | Edition | Source line | Enforcement | Product observation | Follow-ups |", "| --- | --- | ---: | --- | --- | --- |");
    for(const row of document.productContracts)rows.push(`| ${row.id} | ${row.version} | ${row.startLine} | ${row.enforcementStatus} | ${row.observationStatus} | ${row.followUpIssues.map((id)=>`#${id}`).join(", ")} |`);
  }
  return `${rows.join("\n")}\n`;
}
