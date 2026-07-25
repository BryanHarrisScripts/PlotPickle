"use client";

import { useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import {
  approvePurposeAwareLogline,
  buildLoglineAlternatives,
  createPurposeAwareCandidate,
  loglinePurposes,
  loglineShapes,
  projectLoglineIngredients,
  savePurposeAwareCandidate,
  type LoglineAlternative,
  type LoglineApprovalTargets,
  type LoglineIngredients,
  type LoglinePurpose,
  type LoglineShape,
  type PurposeAwareLoglineCandidate,
} from "@/lib/logline-lab";
import LoglineRubric from "./logline-rubric";
import styles from "./pitch-review-workspace.module.css";

const defaultTargets: LoglineApprovalTargets = {
  primary: true,
  oneSentencePitch: false,
  pitchPackage: false,
  purposeVariant: true,
  createRevisionSnapshot: true,
};

function purposeLabel(id?: LoglinePurpose) {
  return loglinePurposes.find((item) => item.id === id)?.label ?? "Unlabelled candidate";
}

function shapeLabel(id?: LoglineShape) {
  return loglineShapes.find((item) => item.id === id)?.label ?? "Manual sentence";
}

export default function LoglineLab({ project, onProjectChange }: { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void }) {
  const initialIngredients = useMemo(() => projectLoglineIngredients(project), [project]);
  const [purpose, setPurpose] = useState<LoglinePurpose>("development");
  const [customPurpose, setCustomPurpose] = useState("");
  const [audience, setAudience] = useState(loglinePurposes[0].audience);
  const [ingredients, setIngredients] = useState<LoglineIngredients>(initialIngredients);
  const [selectedShapes, setSelectedShapes] = useState<LoglineShape[]>(["causal-engine", "irony-contradiction", "relationship-pressure"]);
  const [alternatives, setAlternatives] = useState<LoglineAlternative[]>([]);
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [rationale, setRationale] = useState("");
  const [writerNotes, setWriterNotes] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [approvalTargets, setApprovalTargets] = useState<LoglineApprovalTargets>(defaultTargets);
  const [approvalNote, setApprovalNote] = useState("");
  const candidates = project.review.loglineCandidates as PurposeAwareLoglineCandidate[];
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0];
  const purposeDefinition = loglinePurposes.find((item) => item.id === purpose) ?? loglinePurposes[0];

  function changePurpose(next: LoglinePurpose) {
    setPurpose(next);
    const definition = loglinePurposes.find((item) => item.id === next);
    if (definition) setAudience(definition.audience);
  }

  function updateIngredient(key: keyof LoglineIngredients, value: string) {
    setIngredients((current) => ({ ...current, [key]: value }));
  }

  function toggleShape(shape: LoglineShape) {
    setSelectedShapes((current) => current.includes(shape) ? current.filter((item) => item !== shape) : [...current, shape]);
  }

  function buildAlternatives() {
    const next = buildLoglineAlternatives(ingredients, selectedShapes.length ? selectedShapes : ["causal-engine"]);
    setAlternatives(next);
    setEditedTexts(Object.fromEntries(next.map((item) => [item.shape, item.text])));
  }

  function saveAlternative(alternative: LoglineAlternative) {
    const text = editedTexts[alternative.shape] || alternative.text;
    const deliberateOmissions = ingredients.withheld.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
    const candidate = createPurposeAwareCandidate(text, {
      purpose,
      customPurpose: purpose === "custom" ? customPurpose : "",
      intendedAudience: audience,
      shape: alternative.shape,
      ingredients,
      rationale: rationale || alternative.rationale,
      linkedProjectEvidence: alternative.communicated,
      deliberateOmissions,
      writerNotes,
      reviewStatus: "draft",
      sourceType: "workshop",
    }, "Purpose-aware workshop");
    const next = savePurposeAwareCandidate(project, candidate);
    onProjectChange(next);
    setSelectedCandidateId(candidate.id);
  }

  function approveCandidate() {
    if (!selectedCandidate) return;
    onProjectChange(approvePurposeAwareLogline(project, selectedCandidate.id, approvalTargets, approvalNote));
  }

  return <>
    <section className={styles.panel}>
      <div className={styles.panelTitle}><div><span>Step 1</span><h2>Choose purpose and audience</h2></div><small>One primary logline, many intentional variants</small></div>
      <label>Purpose<select value={purpose} onChange={(event) => changePurpose(event.target.value as LoglinePurpose)}>{loglinePurposes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      {purpose === "custom" ? <label>Custom purpose<input value={customPurpose} onChange={(event) => setCustomPurpose(event.target.value)} placeholder="What decision must this sentence support?" /></label> : null}
      <label>Intended audience<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label>
      <article className={styles.card}><strong>{purposeDefinition.guidance}</strong><p>{purposeDefinition.disclosure}</p><small>{purposeDefinition.suggestedLength}</small></article>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelTitle}><div><span>Step 2</span><h2>Confirm story evidence</h2></div><small>Edit or exclude every ingredient</small></div>
      <div className={styles.twoColumn}>
        <label>Protagonist or central subject<input value={ingredients.protagonist} onChange={(event) => updateIngredient("protagonist", event.target.value)} /></label>
        <label>Specific identity or contradiction<input value={ingredients.identity} onChange={(event) => updateIngredient("identity", event.target.value)} /></label>
        <label>Catalytic condition<textarea value={ingredients.disruption} onChange={(event) => updateIngredient("disruption", event.target.value)} /></label>
        <label>Active objective<textarea value={ingredients.goal} onChange={(event) => updateIngredient("goal", event.target.value)} /></label>
        <label>Meaningful opposition<textarea value={ingredients.opposition} onChange={(event) => updateIngredient("opposition", event.target.value)} /></label>
        <label>Consequences or stakes<textarea value={ingredients.stakes} onChange={(event) => updateIngredient("stakes", event.target.value)} /></label>
        <label>Genre promise<input value={ingredients.genre} onChange={(event) => updateIngredient("genre", event.target.value)} /></label>
        <label>Tonal experience<input value={ingredients.tone} onChange={(event) => updateIngredient("tone", event.target.value)} /></label>
        <label>World, setting or rule<textarea value={ingredients.worldRule} onChange={(event) => updateIngredient("worldRule", event.target.value)} /></label>
        <label>Relationship, fear or longing<textarea value={ingredients.relationshipPressure} onChange={(event) => updateIngredient("relationshipPressure", event.target.value)} /></label>
        <label>Genuine urgency<textarea value={ingredients.urgency} onChange={(event) => updateIngredient("urgency", event.target.value)} /></label>
        <label>Signature distinction<textarea value={ingredients.distinction} onChange={(event) => updateIngredient("distinction", event.target.value)} /></label>
      </div>
      <label>Information deliberately withheld for this purpose<textarea value={ingredients.withheld} onChange={(event) => updateIngredient("withheld", event.target.value)} placeholder="Ending direction, antagonist identity, world reveal…" /></label>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelTitle}><div><span>Steps 3–4</span><h2>Choose emphasis and build alternatives</h2></div><small>Deterministic and fully usable without AI</small></div>
      <div className={styles.stack}>{loglineShapes.map((shape) => <label className={styles.card} key={shape.id}><span><input type="checkbox" checked={selectedShapes.includes(shape.id)} onChange={() => toggleShape(shape.id)} /> {shape.label}</span><p>{shape.explanation}</p><small>{shape.bestFor}</small></label>)}</div>
      <button type="button" className={styles.primary} onClick={buildAlternatives}>Build labelled alternatives</button>
      {alternatives.length ? <div className={styles.stack}>{alternatives.map((alternative) => <article className={styles.card} key={alternative.shape}>
        <span>{alternative.label}</span><p>{alternative.rationale}</p>
        <textarea value={editedTexts[alternative.shape] || alternative.text} onChange={(event) => setEditedTexts({ ...editedTexts, [alternative.shape]: event.target.value })} />
        <small>Communicates: {alternative.communicated.join(" · ") || "No confirmed project evidence"}</small>
        {alternative.omitted.length ? <small>Deliberately omitted: {alternative.omitted.join(" · ")}</small> : null}
        {alternative.addedAssumptions.length ? <small>Review assumption: {alternative.addedAssumptions.join(" · ")}</small> : null}
        <label>Rationale<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Why this shape suits this purpose" /></label>
        <label>Writer notes<textarea value={writerNotes} onChange={(event) => setWriterNotes(event.target.value)} placeholder="What to preserve or test in feedback" /></label>
        <button type="button" className={styles.primary} onClick={() => saveAlternative(alternative)}>Save editable candidate</button>
      </article>)}</div> : null}
    </section>

    <section className={styles.panel}>
      <div className={styles.panelTitle}><div><span>Steps 5–8</span><h2>Compare evidence, review and approve</h2></div><small>No candidate becomes canonical automatically</small></div>
      <div className={styles.stack}>{candidates.length ? candidates.map((candidate) => <button type="button" className={candidate.id === selectedCandidate?.id ? styles.selectedCard : styles.card} key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)}>
        <span>{purposeLabel(candidate.purpose)} · {shapeLabel(candidate.shape)} · {candidate.sourceType || candidate.source}</span>
        <p>{candidate.text}</p>
        <small>{candidate.wordCount ?? candidate.text.split(/\s+/).filter(Boolean).length} words · {candidate.reviewStatus || (candidate.selected ? "approved-primary" : "draft")}</small>
        {candidate.intendedAudience ? <small>Audience: {candidate.intendedAudience}</small> : null}
        {candidate.importedEvidence?.length ? <small>Imported evidence: {candidate.importedEvidence.join(" · ")}</small> : null}
        {candidate.uncertainInterpretations?.length ? <small>Uncertain interpretations: {candidate.uncertainInterpretations.join(" · ")}</small> : null}
      </button>) : <p className={styles.empty}>No saved candidates yet.</p>}</div>
      {selectedCandidate ? <>
        <LoglineRubric project={project} text={selectedCandidate.text} deliberateOmissions={selectedCandidate.deliberateOmissions} />
        <div className={styles.stack}>
          <label><input type="checkbox" checked={approvalTargets.primary} onChange={(event) => setApprovalTargets({ ...approvalTargets, primary: event.target.checked })} /> Set as primary story logline</label>
          <label><input type="checkbox" checked={approvalTargets.oneSentencePitch} onChange={(event) => setApprovalTargets({ ...approvalTargets, oneSentencePitch: event.target.checked })} /> Synchronize one-sentence pitch</label>
          <label><input type="checkbox" checked={approvalTargets.pitchPackage} onChange={(event) => setApprovalTargets({ ...approvalTargets, pitchPackage: event.target.checked })} /> Synchronize pitch package</label>
          <label><input type="checkbox" checked={approvalTargets.purposeVariant} onChange={(event) => setApprovalTargets({ ...approvalTargets, purposeVariant: event.target.checked })} /> Keep as labelled purpose variant</label>
          <label><input type="checkbox" checked={approvalTargets.createRevisionSnapshot} onChange={(event) => setApprovalTargets({ ...approvalTargets, createRevisionSnapshot: event.target.checked })} /> Create named revision snapshot preserving the previous primary</label>
          <label>Approval note<textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Why this candidate and these synchronization targets?" /></label>
          <button type="button" className={styles.primary} onClick={approveCandidate}>Approve selected targets deliberately</button>
        </div>
      </> : null}
    </section>
  </>;
}
