"use client";

import { useState } from "react";
import type { ScreenplayDraftElement } from "@/lib/project";

type EditLens = "scene" | "dialogue" | "action" | "pacing" | "continuity";

type EditDecisionPanelProps = {
  element: ScreenplayDraftElement | null;
  lens: EditLens;
  disabled: boolean;
  onAccept: (elementId: string, proposedText: string) => void;
  onRewrite: (elementId: string) => void;
};

const GUIDANCE: Record<EditLens, string> = {
  scene: "Make the visible choice, conflict or turn clearer without changing the scene's intended outcome.",
  dialogue: "Tighten voice, subtext or exposition while preserving the character's intention.",
  action: "Make the action more visual, playable and economical without inventing new canon.",
  pacing: "Remove repetition or friction that slows this story moment without skipping required beats.",
  continuity: "Correct wording only when it conflicts with established characters, location, time or visual canon.",
};

export default function EditDecisionPanel({ element, lens, disabled, onAccept, onRewrite }: EditDecisionPanelProps) {
  const [proposedText, setProposedText] = useState(element?.text ?? "");
  const [compare, setCompare] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [notice, setNotice] = useState("");

  if (!element) {
    return (
      <section className="edit-decision-panel edit-decision-empty" aria-label="Edit proposal decisions">
        <span>Selected suggestion</span>
        <strong>No screenplay element is available in this story moment.</strong>
        <p>Write the moment first, then return here for review decisions.</p>
      </section>
    );
  }

  if (ignored) {
    return (
      <section className="edit-decision-panel" aria-label="Ignored Edit suggestion">
        <span>Suggestion ignored</span>
        <strong>No screenplay text was changed.</strong>
        <p>The proposal remains outside canon unless you reopen and explicitly accept wording.</p>
        <button type="button" className="edit-decision-secondary" onClick={() => { setIgnored(false); setNotice(""); }}>Reopen suggestion</button>
      </section>
    );
  }

  function accept() {
    if (disabled) return;
    if (proposedText === element.text) {
      setNotice("Change the proposed wording first. Accept never creates a fake revision when the text is unchanged.");
      return;
    }
    onAccept(element.id, proposedText);
    setNotice("Accepted. The proposal now updates this same canonical screenplay element.");
  }

  return (
    <section className="edit-decision-panel" aria-label="Edit proposal decisions">
      <span>Selected suggestion</span>
      <strong>{GUIDANCE[lens]}</strong>
      <p>Current screenplay element: {element.type.replace(/-/g, " ")} · S{element.sceneNumber} · B{element.blockNumber}.{element.miniBlockNumber}</p>

      <label htmlFor={`edit-proposal-${element.id}`}>Proposed wording</label>
      <textarea
        id={`edit-proposal-${element.id}`}
        value={proposedText}
        rows={Math.max(3, Math.ceil(proposedText.length / 62))}
        disabled={disabled}
        onChange={(event) => { setProposedText(event.target.value); setNotice(""); }}
      />

      {compare ? (
        <div className="edit-decision-compare" aria-label="Compare current and proposed wording">
          <article><span>Current</span><p>{element.text || "(empty)"}</p></article>
          <article><span>Proposed</span><p>{proposedText || "(empty)"}</p></article>
        </div>
      ) : null}

      <div className="edit-decision-actions" role="group" aria-label="Suggestion decisions">
        <button type="button" className="edit-decision-primary" disabled={disabled} onClick={accept}>Accept change</button>
        <button type="button" className="edit-decision-secondary" disabled={disabled} onClick={() => onRewrite(element.id)}>Rewrite myself</button>
        <button type="button" className="edit-decision-secondary" onClick={() => { setIgnored(true); setCompare(false); setNotice(""); }}>Ignore</button>
        <button type="button" className="edit-decision-secondary" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>Compare</button>
      </div>

      {notice ? <p className="edit-decision-notice" role="status">{notice}</p> : null}
      <small>Nothing changes until Accept change is pressed. Rewrite myself focuses the same screenplay element for manual editing.</small>
    </section>
  );
}
