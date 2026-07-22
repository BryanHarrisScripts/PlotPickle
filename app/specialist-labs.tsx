"use client";

/* eslint-disable @next/next/no-img-element -- Canonical projects can contain user-supplied local and remote reference images. */

import { useMemo, useState } from "react";
import type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";
import {
  applySpecialistSuggestion,
  buildSpecialistProjectContext,
  createSpecialistSuggestion,
  projectGeneratedAssets,
  savedSpecialistPasses,
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
  { id: "prompt", label: "AI Prompt Lab", description: "Build reusable prompts from the active story." },
  { id: "dialogue", label: "Dialogue Lab", description: "Compare a line or passage before approving a revision." },
  { id: "research", label: "Research & Canon", description: "Bind sourced facts and canon decisions to the project." },
  { id: "visual", label: "Visual Bible", description: "Unify mood, references and generated visual direction." },
  { id: "provenance", label: "Provenance", description: "Record prompts, models, outputs and generated assets." },
  { id: "passes", label: "Saved Passes", description: "Review approved before-and-after specialist work." },
];

function lineLabel(element: ScreenplayDraftElement) {
  const preview = element.text.trim().replace(/\s+/g, " ").slice(0, 72) || "Empty screenplay element";
  return `Scene ${element.sceneNumber} · ${element.type} · ${preview}`;
}

export default function SpecialistLabs({ project, onProjectChange }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>("prompt");
  const [review, setReview] = useState<SpecialistSuggestion | null>(null);
  const [status, setStatus] = useState("Choose a lab and prepare a suggestion for review.");
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");

  const [promptGoal, setPromptGoal] = useState("");
  const dialogueElements = useMemo(() => project.screenplay.draftElements.filter((element) => ["dialogue", "action", "parenthetical"].includes(element.type)), [project.screenplay.draftElements]);
  const [dialogueElementId, setDialogueElementId] = useState("");
  const [dialogueDirection, setDialogueDirection] = useState("");
  const selectedDialogue = dialogueElements.find((element) => element.id === dialogueElementId) ?? dialogueElements[0];

  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceCreator, setSourceCreator] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLicence, setSourceLicence] = useState("");
  const [canonEntry, setCanonEntry] = useState("");

  const [visualDirection, setVisualDirection] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [operation, setOperation] = useState("image");
  const [provenancePrompt, setProvenancePrompt] = useState("");
  const [provenanceOutput, setProvenanceOutput] = useState("");
  const [assetUrl, setAssetUrl] = useState("");

  const savedPasses = useMemo(() => savedSpecialistPasses(project), [project]);
  const generatedAssets = useMemo(() => projectGeneratedAssets(project), [project]);

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

  async function buildPromptSuggestion() {
    if (!promptGoal.trim()) return;
    const result = await requestText(
      "Create one reusable production-quality prompt for a story-development assistant. Return the prompt only. It must preserve writer control, distinguish project facts from suggestions, request concise output and never apply changes automatically.",
      `${buildSpecialistProjectContext(project)}\n\nWriter's prompt goal: ${promptGoal.trim()}`,
    );
    if (!result) return;
    setReview(createSpecialistSuggestion({
      lab: "prompt",
      title: promptGoal.trim().slice(0, 64),
      summary: "Reusable AI prompt assembled from the canonical story context.",
      target: "prompt-library",
      before: "No approved specialist prompt saved for this goal.",
      after: result,
      prompt: promptGoal.trim(),
      generated: true,
      metadata: {},
    }));
    setStatus("Prompt suggestion is ready for review. The project has not changed.");
  }

  async function buildDialogueSuggestion() {
    if (!selectedDialogue || !dialogueDirection.trim()) return;
    const character = project.characters.find((candidate) => selectedDialogue.text.toUpperCase().includes(candidate.name.toUpperCase()));
    const result = await requestText(
      "Act as a dialogue editor. Return only the revised screenplay text. Preserve story facts and intention. Strengthen character-specific voice, subtext, status pressure and playable rhythm. Do not add facts not contained in the project context.",
      `${buildSpecialistProjectContext(project)}\n\nCurrent screenplay text: ${selectedDialogue.text}\nCharacter context: ${character ? `${character.name}; ${character.voice}; ${character.rhythmSentenceShape}; ${character.vocabularyMetaphors}` : "Use the cast voice distinctions in the project."}\nWriter direction: ${dialogueDirection.trim()}`,
    );
    if (!result) return;
    setReview(createSpecialistSuggestion({
      lab: "dialogue",
      title: `Dialogue pass · Scene ${selectedDialogue.sceneNumber}`,
      summary: "Character- and pressure-aware revision of one selected screenplay element.",
      target: selectedDialogue.id,
      before: selectedDialogue.text,
      after: result,
      prompt: dialogueDirection.trim(),
      generated: true,
      metadata: {},
    }));
    setStatus("Dialogue revision is ready for comparison. The screenplay has not changed.");
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
            <div className={styles.sectionHeading}><span>AI Prompt Lab</span><h2>Turn the canonical story into a reusable, bounded prompt.</h2><p>The lab supplies project context but asks the AI to return a prompt, not to rewrite the project.</p></div>
            <label>What should the prompt help the writer do?<textarea rows={7} value={promptGoal} onChange={(event) => setPromptGoal(event.target.value)} placeholder="For example: test three alternative Act II complications without changing the protagonist's objective." /></label>
            <button type="button" className={styles.primary} disabled={!promptGoal.trim() || aiState === "working"} onClick={buildPromptSuggestion}>{aiState === "working" ? "Generating…" : "Generate reviewable prompt"}</button>
          </section> : null}

          {activeTab === "dialogue" ? <section>
            <div className={styles.sectionHeading}><span>Dialogue Lab</span><h2>Hear the difference before replacing a line.</h2><p>Select one screenplay element, define the craft problem and compare the original with the suggestion.</p></div>
            {dialogueElements.length ? <>
              <label>Screenplay element<select value={selectedDialogue?.id || ""} onChange={(event) => setDialogueElementId(event.target.value)}>{dialogueElements.map((element) => <option value={element.id} key={element.id}>{lineLabel(element)}</option>)}</select></label>
              <label>Dialogue-pass direction<textarea rows={6} value={dialogueDirection} onChange={(event) => setDialogueDirection(event.target.value)} placeholder="Clarify the subtext, keep the refusal indirect and make the power shift audible." /></label>
              <button type="button" className={styles.primary} disabled={!dialogueDirection.trim() || aiState === "working"} onClick={buildDialogueSuggestion}>{aiState === "working" ? "Generating…" : "Generate dialogue comparison"}</button>
            </> : <p className={styles.empty}>Write or import screenplay dialogue and action before running this lab.</p>}
          </section> : null}

          {activeTab === "research" ? <section>
            <div className={styles.sectionHeading}><span>Structured Research & Canon Binder</span><h2>Separate sourced evidence from story canon.</h2><p>Record the source, licence and exact canon decision. AI-generated claims should not be treated as verified research.</p></div>
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
            <div className={styles.sectionHeading}><span>Visual Bible & Mood Boards</span><h2>Unify images into production rules.</h2><p>The mood board reads character, location and storyboard assets already attached to the canonical project.</p></div>
            <div className={styles.assetGrid}>{generatedAssets.length ? generatedAssets.map((asset) => <article key={`${asset.kind}-${asset.id}`}><img src={asset.src} alt={asset.label} /><div><span>{asset.kind}</span><strong>{asset.label}</strong>{asset.prompt ? <small>{asset.prompt}</small> : null}</div></article>) : <p className={styles.empty}>Add character, location or storyboard images to populate the mood board.</p>}</div>
            <label>Visual direction to explore<textarea rows={7} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Define lighting, contrast, texture, recurring shapes, camera distance and continuity rules." /></label>
            <button type="button" className={styles.primary} disabled={!visualDirection.trim() || aiState === "working"} onClick={buildVisualSuggestion}>{aiState === "working" ? "Generating…" : "Generate Visual Bible proposal"}</button>
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
            <div className={styles.passList}>{savedPasses.length ? savedPasses.map((pass) => <article key={pass.id}><header><div><span>{pass.lab} lab</span><h3>{pass.title}</h3></div><time>{new Date(pass.approvedAt).toLocaleString()}</time></header><p>{pass.summary}</p><div className={styles.comparison}><div><span>Before</span><pre>{pass.before}</pre></div><div><span>After</span><pre>{pass.after}</pre></div></div><small>Target: {pass.target}{pass.provenanceId ? ` · Provenance: ${pass.provenanceId}` : " · Human-entered pass"}</small></article>) : <p className={styles.empty}>No specialist pass has been approved yet.</p>}</div>
          </section> : null}
        </main>

        <aside className={styles.reviewPanel}>
          <div className={styles.reviewHeading}><span>Review gate</span><h2>{review ? review.title : "No suggestion waiting"}</h2><p>{review ? review.summary : "Prepare a lab suggestion to compare it here."}</p></div>
          {review ? <>
            <div className={styles.comparison}><div><span>Before</span><pre>{review.before}</pre></div><div><span>Suggested after</span><pre>{review.after}</pre></div></div>
            <div className={styles.reviewMeta}><span>Target</span><strong>{review.target}</strong><span>Source</span><strong>{review.generated ? "AI-assisted suggestion" : "Writer-entered record"}</strong></div>
            <p className={styles.warning}>Nothing changes until you approve this suggestion.</p>
            <div className={styles.reviewActions}><button type="button" className={styles.primary} onClick={approveSuggestion}>Apply approved suggestion</button><button type="button" onClick={discardSuggestion}>Discard suggestion</button></div>
          </> : <div className={styles.reviewEmpty}><strong>Review first.</strong><p>PlotPickle does not automatically insert prompts, rewrite dialogue, declare research as canon, replace visual rules or retain provenance records.</p></div>}
        </aside>
      </div>

      <p className={aiState === "error" ? styles.errorStatus : styles.status} aria-live="polite">{status}</p>
    </section>
  );
}
