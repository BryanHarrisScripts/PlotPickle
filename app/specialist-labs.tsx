"use client";

/* eslint-disable @next/next/no-img-element -- Canonical projects can contain user-supplied local and remote reference images. */

import { useMemo, useState } from "react";
import {
  aiRevisionPlaybooks,
  buildGuidedRevisionPrompt,
  revisionOperations,
  revisionResponseContract,
  revisionScopes,
  type RevisionOperation,
  type RevisionScope,
} from "@/lib/ai-revision-playbooks";
import { dialogueGuidedPasses } from "./learning-dialogue-in-motion";
import VisualReferenceLibrary from "./visual-reference-library";
import AfterglowLegacyVisuals from "./afterglow-legacy-visuals";
import { legacyVisualProposalText, type AfterglowLegacyVisual, type AfterglowVisualDecision } from "@/lib/afterglow-legacy-visuals";
import type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";
import {
  applySpecialistSuggestion,
  attachProjectDocumentToCanonBinder,
  buildSpecialistProjectContext,
  canonProjectDocumentAttachedAt,
  canonProjectDocuments,
  createSpecialistSuggestion,
  projectGeneratedAssets,
  savedSpecialistPasses,
  type CanonProjectDocumentKind,
  type SpecialistLabKind,
  type SpecialistSuggestion,
} from "@/lib/specialist-labs";
import styles from "./specialist-labs.module.css";

type Props = {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
};

type LabTab = SpecialistLabKind | "passes";
type AiResponse = { text?: string; message?: string };

const labTabs: Array<{ id: LabTab; label: string; description: string }> = [
  { id: "prompt", label: "AI Prompt Lab", description: "Build bounded revision prompts from the active story." },
  { id: "dialogue", label: "Dialogue Lab", description: "Compare a line or passage before approving a revision." },
  { id: "research", label: "Research & Canon", description: "Bind sourced facts and canon decisions to the project." },
  { id: "visual", label: "Visual Bible", description: "Unify mood, references and generated visual direction." },
  { id: "provenance", label: "Provenance", description: "Record prompts, models, outputs and generated assets." },
  { id: "passes", label: "Saved Passes", description: "Review approved before-and-after specialist work." },
];

const revisionLayers = ["Story First", "Craft Layer", "Polish Layer"] as const;

function lineLabel(element: ScreenplayDraftElement) {
  const preview = element.text.trim().replace(/\s+/g, " ").slice(0, 72) || "Empty screenplay element";
  return `Scene ${element.sceneNumber} · ${element.type} · ${preview}`;
}

function metadataLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

export default function SpecialistLabs({ project, onProjectChange }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>("prompt");
  const [review, setReview] = useState<SpecialistSuggestion | null>(null);
  const [status, setStatus] = useState("Choose a lab and prepare a suggestion for review.");
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");

  const [playbookId, setPlaybookId] = useState(aiRevisionPlaybooks[0].id);
  const [revisionOperation, setRevisionOperation] = useState<RevisionOperation>(aiRevisionPlaybooks[0].defaultOperation);
  const [selectedScopes, setSelectedScopes] = useState<RevisionScope[]>([aiRevisionPlaybooks[0].reads[0]]);
  const [promptGoal, setPromptGoal] = useState("");
  const selectedPlaybook = aiRevisionPlaybooks.find((playbook) => playbook.id === playbookId) ?? aiRevisionPlaybooks[0];

  const dialogueElements = useMemo(() => project.screenplay.draftElements.filter((element) => ["dialogue", "dual-dialogue", "action", "parenthetical"].includes(element.type)), [project.screenplay.draftElements]);
  const [dialogueElementId, setDialogueElementId] = useState("");
  const [dialogueDirection, setDialogueDirection] = useState("");
  const [dialoguePassId, setDialoguePassId] = useState(dialogueGuidedPasses[0].id);
  const selectedDialogue = dialogueElements.find((element) => element.id === dialogueElementId) ?? dialogueElements[0];
  const selectedDialoguePass = dialogueGuidedPasses.find((pass) => pass.id === dialoguePassId) ?? dialogueGuidedPasses[0];

  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceCreator, setSourceCreator] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLicence, setSourceLicence] = useState("");
  const [canonEntry, setCanonEntry] = useState("");

  const [visualDirection, setVisualDirection] = useState("");
  const [visualMode, setVisualMode] = useState<"project" | "afterglow" | "library">("project");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [operation, setOperation] = useState("image");
  const [provenancePrompt, setProvenancePrompt] = useState("");
  const [provenanceOutput, setProvenanceOutput] = useState("");
  const [assetUrl, setAssetUrl] = useState("");

  const savedPasses = useMemo(() => savedSpecialistPasses(project), [project]);
  const generatedAssets = useMemo(() => projectGeneratedAssets(project), [project]);
  const recommendedPlaybooks = useMemo(() => {
    const ids = project.screenplay.draftElements.length
      ? ["diagnose-only", "pacing-repetition", "dialogue-voiceprint"]
      : ["structure-causality", "character-choice-arc", "conflict-stakes-escalation"];
    return ids.map((id) => aiRevisionPlaybooks.find((playbook) => playbook.id === id)).filter((playbook): playbook is (typeof aiRevisionPlaybooks)[number] => Boolean(playbook));
  }, [project.screenplay.draftElements.length]);

  function choosePlaybook(nextId: string) {
    const next = aiRevisionPlaybooks.find((playbook) => playbook.id === nextId) ?? aiRevisionPlaybooks[0];
    setPlaybookId(next.id);
    setRevisionOperation(next.defaultOperation);
    setSelectedScopes(next.reads.length ? [next.reads[0]] : []);
  }

  async function requestText(instructions: string, prompt: string) {
    setAiState("working");
    try {
      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions, prompt }),
      });
      const result = await response.json() as AiResponse;
      if (!response.ok || !result.text) throw new Error(result.message || "The connected AI provider returned no suggestion.");
      setAiState("idle");
      return result.text.trim();
    } catch (error) {
      setAiState("error");
      setStatus(error instanceof Error ? error.message : "AI assistance is unavailable.");
      return "";
    }
  }

  function buildPromptSuggestion() {
    if (!selectedScopes.length) return;
    const result = buildGuidedRevisionPrompt({
      playbook: selectedPlaybook,
      operation: revisionOperation,
      scopes: selectedScopes,
      contextSummary: buildSpecialistProjectContext(project),
      writerGoal: promptGoal.trim() || undefined,
      includedFacts: [project.story.logline, project.story.dramaticQuestion].filter(Boolean),
      canonLocks: [project.world.rules, project.story.theme].filter(Boolean),
    });
    setReview(createSpecialistSuggestion({
      lab: "prompt",
      title: selectedPlaybook.title,
      summary: `${selectedPlaybook.layer} guided pass for ${selectedScopes.join(", ")}. Recommended destination: ${selectedPlaybook.destination}.`,
      target: `${selectedPlaybook.destination} · ${revisionOperation} · ${selectedScopes.join(", ")}`,
      before: "No approved guided revision prompt exists for this pass, operation and canonical scope.",
      after: result,
      prompt: promptGoal.trim() || selectedPlaybook.problem,
      generated: false,
      metadata: {
        collection: "AI-Assisted Revision",
        playbookId: selectedPlaybook.id,
        layer: selectedPlaybook.layer,
        operation: revisionOperation,
        scopes: selectedScopes.join(", "),
        destination: selectedPlaybook.destination,
        responseContract: revisionResponseContract.join("; "),
        sourceResources: selectedPlaybook.sourceResources.join(", "),
        approvalBoundary: "Prompt assembled locally; no project text changed and no AI call was required.",
      },
    }));
    setStatus("Guided revision prompt is ready for review and manual copy. No AI call was made and the project has not changed.");
  }

  async function buildDialogueSuggestion() {
    if (!selectedDialogue) return;
    const character = project.characters.find((candidate) => selectedDialogue.text.toUpperCase().includes(candidate.name.toUpperCase()));
    const result = await requestText(
      `Act as a screenplay dialogue editor. ${selectedDialoguePass.instruction} Preserve story facts, intention, formatting and locked continuity. Return a diagnosis when the pass is critique only; otherwise return only the proposed screenplay text. Do not add facts not contained in project context.`,
      `${buildSpecialistProjectContext(project)}\n\nCurrent screenplay text: ${selectedDialogue.text}\nCharacter context: ${character ? `${character.name}; ${character.voice}; ${character.rhythmSentenceShape}; ${character.vocabularyMetaphors}` : "Use the cast voice distinctions in the project."}\nGuided dialogue pass: ${selectedDialoguePass.label}
Pass instruction: ${selectedDialoguePass.instruction}
Free-form writer direction: ${dialogueDirection.trim() || "No added direction; use the bounded pass only."}`,
    );
    if (!result) return;
    setReview(createSpecialistSuggestion({
      lab: "dialogue",
      title: `Dialogue pass · Scene ${selectedDialogue.sceneNumber}`,
      summary: "Character- and pressure-aware revision of one selected screenplay element.",
      target: selectedDialogue.id,
      before: selectedDialogue.text,
      after: result,
      prompt: dialogueDirection.trim() || selectedDialoguePass.instruction,
      generated: true,
      metadata: { guidedPass: selectedDialoguePass.label, passInstruction: selectedDialoguePass.instruction, approvalBoundary: "Original and proposed versions remain separate until explicit writer approval." },
    }));
    setStatus("Dialogue revision is ready for comparison. The screenplay has not changed.");
  }

  function attachProjectDocument(kind: CanonProjectDocumentKind) {
    const next = attachProjectDocumentToCanonBinder(project, kind);
    onProjectChange(next);
    const label = canonProjectDocuments.find((item) => item.kind === kind)?.label || kind;
    setStatus(`${label} was attached to the Canon Binder as a current project snapshot.`);
  }

  function prepareCanonEntry() {
    if (!sourceTitle.trim() || !canonEntry.trim()) return;
    setReview(createSpecialistSuggestion({
      lab: "research",
      title: sourceTitle.trim(),
      summary: "Sourced research or canon decision prepared for the project binder.",
      target: "canon-binder",
      before: "Not yet present in the canonical research binder.",
      after: canonEntry.trim(),
      prompt: "Writer-entered research and canon record.",
      generated: false,
      metadata: {
        sourceTitle: sourceTitle.trim(),
        creator: sourceCreator.trim(),
        sourceUrl: sourceUrl.trim(),
        licence: sourceLicence.trim(),
      },
    }));
    setStatus("Canon entry is ready for source review. Nothing has been added yet.");
  }

  function prepareLegacyVisualDecision(visual: AfterglowLegacyVisual, decision: AfterglowVisualDecision) {
    setReview(createSpecialistSuggestion({
      lab: "visual",
      title: `Legacy visual decision · ${visual.title}`,
      summary: "Writer-controlled decision for a bundled legacy Afterglow source visual.",
      target: `${decision.scope}:${decision.target}`,
      before: "The legacy image remains historical source material and is not approved for current use.",
      after: legacyVisualProposalText(visual, decision),
      prompt: decision.writerNote || "Writer-selected legacy visual decision.",
      generated: false,
      metadata: {
        collection: "Legacy Afterglow Visuals",
        referenceId: visual.id,
        sourceFilename: visual.source.originalFilename,
        sourceSha: visual.source.originalSha,
        mappingStatus: visual.mappingStatus,
        proposedBlocks: visual.proposedBlockNumbers.join(", "),
        action: decision.action,
        scope: decision.scope,
        provenance: "Bundled legacy source visual; not a new AI generation event.",
        approvalBoundary: "Nothing changes until the writer approves this specialist pass.",
      },
    }));
    setStatus("Legacy visual decision is ready for review. No Block cover, pitch asset or project reference has changed.");
  }

  async function buildVisualSuggestion() {
    if (!visualDirection.trim()) return;
    const result = await requestText(
      "Create a concise visual-bible direction for a film project. Return practical visual rules covering palette, contrast, texture, lighting, lenses or framing, recurring imagery and continuity. Do not imitate a living artist or claim copyrighted references are owned by the writer.",
      `${buildSpecialistProjectContext(project)}\n\nCurrent visual language: ${project.world.visualLanguage}\nWriter direction: ${visualDirection.trim()}`,
    );
    if (!result) return;
    setReview(createSpecialistSuggestion({
      lab: "visual",
      title: "Visual Bible direction",
      summary: "A unified mood and continuity proposal for the active story.",
      target: "world.visualLanguage",
      before: project.world.visualLanguage || "No visual language recorded.",
      after: result,
      prompt: visualDirection.trim(),
      generated: true,
      metadata: {},
    }));
    setStatus("Visual Bible proposal is ready for review. Existing visual direction is unchanged.");
  }

  function prepareProvenanceRecord() {
    if (!provider.trim() || !model.trim() || !provenancePrompt.trim() || !provenanceOutput.trim()) return;
    setReview(createSpecialistSuggestion({
      lab: "provenance",
      title: `${provider.trim()} · ${model.trim()}`,
      summary: "Prompt, model, output and retained-asset provenance prepared for approval.",
      target: assetUrl.trim() || "generated-output",
      before: "No provenance record attached to this output.",
      after: provenanceOutput.trim(),
      prompt: provenancePrompt.trim(),
      generated: false,
      metadata: {
        provider: provider.trim(),
        model: model.trim(),
        operation,
        assetUrl: assetUrl.trim(),
        humanDecision: "The writer reviewed this output and chose to retain its record.",
      },
    }));
    setStatus("Provenance record is ready for approval. It has not been added yet.");
  }

  function approveSuggestion() {
    if (!review) return;
    const next = applySpecialistSuggestion(project, review);
    onProjectChange(next);
    setStatus(`${review.title} was approved, applied and saved as a canonical specialist pass.`);
    setReview(null);
  }

  function discardSuggestion() {
    setReview(null);
    setStatus("Suggestion discarded. The canonical project was not changed.");
  }

  return (
    <section className={styles.workspace} aria-labelledby="labs-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PlotPickle 0.15 · Specialist Labs</p>
          <h1 id="labs-title">Experiment beside the story, not inside it.</h1>
          <p>Every lab reads the same active schema 1.7 project. Suggestions remain temporary until the writer reviews and explicitly approves them.</p>
        </div>
        <div className={styles.guardrail}>
          <span>Approval boundary</span>
          <strong>Nothing changes automatically.</strong>
          <p>Generate or prepare → compare before and after → approve or discard → record the decision and provenance.</p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Specialist labs">
        {labTabs.map((tab) => <button type="button" className={activeTab === tab.id ? styles.activeTab : ""} key={tab.id} onClick={() => setActiveTab(tab.id)}><strong>{tab.label}</strong><span>{tab.description}</span></button>)}
      </nav>

      <div className={styles.labLayout}>
        <main className={styles.labPanel}>
          {activeTab === "prompt" ? <section>
            <div className={styles.sectionHeading}><span>AI Prompt Lab · Guided revision</span><h2>Choose the craft problem before choosing what AI may do.</h2><p>PlotPickle assembles the prompt locally from the active project, selected pass, operation and canonical scope. You can copy it manually, use no AI at all or send it through any connected provider.</p></div>
            <div className={styles.projectDocuments}>
              <header><div><span>Contextual recommendations</span><h3>{project.screenplay.draftElements.length ? "A draft is available for diagnosis and focused craft passes." : "Build the story foundation before polishing pages."}</h3></div><p>Recommendations are optional and never run automatically.</p></header>
              <div>{recommendedPlaybooks.map((playbook) => <article key={playbook.id}><strong>{playbook.title}</strong><span>{playbook.problem}</span><button type="button" onClick={() => choosePlaybook(playbook.id)}>Use this pass</button><small>{playbook.layer} · {playbook.destination}</small></article>)}</div>
            </div>
            <div className={styles.twoColumns}>
              <label>Guided revision pass<select value={selectedPlaybook.id} onChange={(event) => choosePlaybook(event.target.value)}>{revisionLayers.map((layer) => <optgroup label={layer} key={layer}>{aiRevisionPlaybooks.filter((playbook) => playbook.layer === layer).map((playbook) => <option value={playbook.id} key={playbook.id}>{playbook.title}</option>)}</optgroup>)}</select></label>
              <label>Operation<select value={revisionOperation} onChange={(event) => setRevisionOperation(event.target.value as RevisionOperation)}>{revisionOperations.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
            </div>
            <label>Canonical scope<select multiple size={6} value={selectedScopes} onChange={(event) => setSelectedScopes(Array.from(event.currentTarget.selectedOptions, (option) => option.value as RevisionScope))}>{revisionScopes.map((scope) => <option value={scope} key={scope} disabled={!selectedPlaybook.reads.includes(scope)}>{scope}{selectedPlaybook.reads.includes(scope) ? "" : " · not recommended for this pass"}</option>)}</select><small>Select one or more supported project areas. Hold Ctrl or Command to select several.</small></label>
            <div className={styles.twoColumns}>
              <div className={styles.binder}><h3>Use when</h3><ul>{selectedPlaybook.useWhen.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className={styles.binder}><h3>Avoid when</h3><ul>{selectedPlaybook.avoidWhen.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <div className={styles.projectDocuments}><header><div><span>Pass contract</span><h3>{selectedPlaybook.layer} · Route to {selectedPlaybook.destination}</h3></div><p>{selectedPlaybook.problem}</p></header><div><article><strong>Evaluate with</strong><span>{selectedPlaybook.evaluation.join(" · ")}</span></article><article><strong>Watch for AI failure modes</strong><span>{selectedPlaybook.failureModes.join(" · ")}</span></article><article><strong>Structured response</strong><span>{revisionResponseContract.join(" · ")}</span></article></div></div>
            <label>Writer goal or added direction<textarea rows={5} value={promptGoal} onChange={(event) => setPromptGoal(event.target.value)} placeholder={`Optional: describe the exact concern. Otherwise PlotPickle uses: ${selectedPlaybook.problem}`} /></label>
            <button type="button" className={styles.primary} disabled={!selectedScopes.length} onClick={buildPromptSuggestion}>Prepare reviewable guided prompt</button>
          </section> : null}

          {activeTab === "dialogue" ? <section>
            <div className={styles.sectionHeading}><span>Dialogue Lab</span><h2>Hear the difference before replacing a line.</h2><p>Select one screenplay element, choose a bounded craft pass and compare the original with the suggestion. Manual writing and free-form direction remain available.</p><a href="/dialogue-in-motion">Open Dialogue Blueprint, proof and table-read workspace</a></div>
            {dialogueElements.length ? <>
              <label>Screenplay element<select value={selectedDialogue?.id || ""} onChange={(event) => setDialogueElementId(event.target.value)}>{dialogueElements.map((element) => <option value={element.id} key={element.id}>{lineLabel(element)}</option>)}</select></label>
              <label>Guided dialogue pass<select value={dialoguePassId} onChange={(event) => setDialoguePassId(event.target.value)}>{dialogueGuidedPasses.map((pass) => <option value={pass.id} key={pass.id}>{pass.label}</option>)}</select><small>{selectedDialoguePass.instruction}</small></label>
              <label>Free-form writer direction<textarea rows={6} value={dialogueDirection} onChange={(event) => setDialogueDirection(event.target.value)} placeholder="Optional: clarify the subtext, keep the refusal indirect and make the power shift audible." /></label>
              <button type="button" className={styles.primary} disabled={aiState === "working"} onClick={buildDialogueSuggestion}>{aiState === "working" ? "Generating…" : "Generate dialogue comparison"}</button>
            </> : <p className={styles.empty}>Write or import screenplay dialogue and action before running this lab.</p>}
          </section> : null}

          {activeTab === "research" ? <section>
            <div className={styles.sectionHeading}><span>Structured Research & Canon Binder</span><h2>Separate sourced evidence from story canon.</h2><p>Record the source, licence and exact canon decision. AI-generated claims should not be treated as verified research.</p></div>
            <div className={styles.projectDocuments}><header><div><span>Attach current project documents</span><h3>Keep beats, outline and pitch beside the verified canon.</h3></div><p>Each button replaces its previous snapshot so the binder shows the latest approved project state.</p></header><div>{canonProjectDocuments.map((document) => { const attachedAt = canonProjectDocumentAttachedAt(project, document.kind); return <article key={document.kind}><strong>{document.label}</strong><span>{document.description}</span><button type="button" onClick={() => attachProjectDocument(document.kind)}>{attachedAt ? "Refresh attachment" : "Attach to Canon Binder"}</button>{attachedAt ? <small>Last attached {new Date(attachedAt).toLocaleString()}</small> : null}</article>; })}</div></div>
            <div className={styles.twoColumns}>
              <label>Source or canon title<input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} /></label>
              <label>Creator or authority<input value={sourceCreator} onChange={(event) => setSourceCreator(event.target.value)} /></label>
              <label>Source URL<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
              <label>Licence or permission<input value={sourceLicence} onChange={(event) => setSourceLicence(event.target.value)} /></label>
            </div>
            <label>Verified finding or canon decision<textarea rows={8} value={canonEntry} onChange={(event) => setCanonEntry(event.target.value)} placeholder="State what the story may rely on, what remains uncertain and which details must remain consistent." /></label>
            <button type="button" className={styles.primary} disabled={!sourceTitle.trim() || !canonEntry.trim()} onClick={prepareCanonEntry}>Prepare canon entry for review</button>
            <div className={styles.binder}><h3>Current binder</h3>{project.rights.attributions.length ? project.rights.attributions.map((item) => <article key={item.id}><strong>{item.title}</strong><span>{item.creator} · {item.licence}</span><p>{item.notes}</p></article>) : <p>No structured research sources have been approved yet.</p>}</div>
          </section> : null}

          {activeTab === "visual" ? <section>
            <div className={styles.sectionHeading}><span>Visual Bible & Mood Boards</span><h2>Build an original visual system from project evidence and deliberate references.</h2><p>Bundled references remain separate from project-owned images. Nothing changes until the writer opens and approves a Visual Bible proposal.</p></div>
            <div className={styles.actions}><button type="button" className={visualMode === "project" ? styles.primary : ""} onClick={() => setVisualMode("project")}>Project Mood Board</button><button type="button" className={visualMode === "afterglow" ? styles.primary : ""} onClick={() => setVisualMode("afterglow")}>Legacy Afterglow Visuals</button><button type="button" className={visualMode === "library" ? styles.primary : ""} onClick={() => setVisualMode("library")}>Reference Library</button></div>
            {visualMode === "project" ? <>
              <div className={styles.assetGrid}>{generatedAssets.length ? generatedAssets.map((asset) => <article key={`${asset.kind}-${asset.id}`}><img src={asset.src} alt={asset.label} /><div><span>{asset.kind}</span><strong>{asset.label}</strong>{asset.prompt ? <small>{asset.prompt}</small> : null}</div></article>) : <p className={styles.empty}>Add character, location or storyboard images to populate the Project Mood Board.</p>}</div>
              <label>Visual direction to explore<textarea rows={7} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Define lighting, contrast, texture, recurring shapes, camera distance and continuity rules." /></label>
              <button type="button" className={styles.primary} disabled={!visualDirection.trim() || aiState === "working"} onClick={buildVisualSuggestion}>{aiState === "working" ? "Generating…" : "Generate Visual Bible proposal"}</button>
            </> : visualMode === "afterglow" ? <><AfterglowLegacyVisuals project={project} mode="gallery" onPrepareDecision={prepareLegacyVisualDecision} /><details><summary>Pitch & Vision legacy boards</summary><AfterglowLegacyVisuals project={project} mode="pitch" onPrepareDecision={prepareLegacyVisualDecision} /></details></> : <VisualReferenceLibrary project={project} onPrepareSuggestion={(suggestion) => setReview(suggestion)} onStatus={setStatus} />}
          </section> : null}

          {activeTab === "provenance" ? <section>
            <div className={styles.sectionHeading}><span>Prompt & Generated-Asset Provenance</span><h2>Keep the creative chain visible.</h2><p>Record the provider, model, prompt, output, retained asset and human approval decision without storing API credentials.</p></div>
            <div className={styles.twoColumns}>
              <label>Provider<input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="OpenAI, local model, other" /></label>
              <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
              <label>Operation<select value={operation} onChange={(event) => setOperation(event.target.value)}><option value="image">Image</option><option value="brainstorm">Brainstorm</option><option value="rewrite">Rewrite</option><option value="dialogue">Dialogue</option><option value="analysis">Analysis</option></select></label>
              <label>Generated asset URL or local path<input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} /></label>
            </div>
            <label>Prompt used<textarea rows={6} value={provenancePrompt} onChange={(event) => setProvenancePrompt(event.target.value)} /></label>
            <label>Output retained or asset description<textarea rows={6} value={provenanceOutput} onChange={(event) => setProvenanceOutput(event.target.value)} /></label>
            <button type="button" className={styles.primary} disabled={!provider.trim() || !model.trim() || !provenancePrompt.trim() || !provenanceOutput.trim()} onClick={prepareProvenanceRecord}>Prepare provenance record</button>
            <div className={styles.binder}><h3>Current AI and generated-asset records</h3>{project.rights.aiProvenance.length ? project.rights.aiProvenance.map((item) => <article key={item.id}><strong>{item.provider} · {item.model}</strong><span>{item.operation} · {item.retained ? "Retained" : "Not retained"}</span><p>{item.promptSummary}</p><small>{item.outputSummary}</small></article>) : <p>No AI provenance has been approved yet.</p>}</div>
          </section> : null}

          {activeTab === "passes" ? <section>
            <div className={styles.sectionHeading}><span>Saved Specialist Passes</span><h2>Every approved change keeps its before and after.</h2><p>Passes are stored inside canonical revision snapshots, so they travel with exported PlotPickle projects.</p></div>
            <div className={styles.passList}>{savedPasses.length ? savedPasses.map((pass) => <article key={pass.id}><header><div><span>{pass.lab} lab</span><h3>{pass.title}</h3></div><time>{new Date(pass.approvedAt).toLocaleString()}</time></header><p>{pass.summary}</p><div className={styles.comparison}><div><span>Before</span><pre>{pass.before}</pre></div><div><span>After</span><pre>{pass.after}</pre></div></div><small>Target and pass metadata: {pass.target}{pass.provenanceId ? ` · Provenance: ${pass.provenanceId}` : " · Human-reviewed local pass"}</small></article>) : <p className={styles.empty}>No specialist pass has been approved yet.</p>}</div>
          </section> : null}
        </main>

        <aside className={styles.reviewPanel}>
          <div className={styles.reviewHeading}><span>Review gate</span><h2>{review ? review.title : "No suggestion waiting"}</h2><p>{review ? review.summary : "Prepare a lab suggestion to compare it here."}</p></div>
          {review ? <>
            <div className={styles.comparison}><div><span>Before</span><pre>{review.before}</pre></div><div><span>Suggested after</span><pre>{review.after}</pre></div></div>
            <div className={styles.reviewMeta}><span>Target</span><strong>{review.target}</strong><span>Source</span><strong>{review.generated ? "AI-assisted suggestion" : review.metadata.collection ? "Guided prompt assembled locally" : "Writer-entered record"}</strong>{Object.entries(review.metadata).filter(([, value]) => value).map(([key, value]) => <><span key={`${key}-label`}>{metadataLabel(key)}</span><strong key={`${key}-value`}>{value}</strong></>)}</div>
            <p className={styles.warning}>Nothing changes until you approve this suggestion.</p>
            <div className={styles.reviewActions}><button type="button" className={styles.primary} onClick={approveSuggestion}>Apply approved suggestion</button><button type="button" onClick={discardSuggestion}>Discard suggestion</button></div>
          </> : <div className={styles.reviewEmpty}><strong>Review first.</strong><p>PlotPickle does not automatically insert prompts, rewrite dialogue, declare research as canon, replace visual rules or retain provenance records.</p></div>}
        </aside>
      </div>

      <p className={aiState === "error" ? styles.errorStatus : styles.status} aria-live="polite">{status}</p>
    </section>
  );
}
