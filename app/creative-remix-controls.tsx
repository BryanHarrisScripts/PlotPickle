"use client";

import { useMemo, useState } from "react";
import type { CreativeExplorationCandidate } from "@/lib/creative-candidates";
import {
  buildProviderNeutralRemixRequest,
  type CreativeRemixRecipe,
  type ProviderNeutralRemixRequest,
  type RemixQuality,
} from "@/lib/creative-remix";

const QUALITY_OPTIONS = ["face", "identity", "composition", "mood", "colour", "camera", "lighting", "wardrobe", "action", "continuity"];

export default function CreativeRemixControls({
  candidates,
  onRemix,
}: {
  candidates: CreativeExplorationCandidate[];
  onRemix: (request: ProviderNeutralRemixRequest) => void;
}) {
  const anchor = candidates[0];
  const [selections, setSelections] = useState<RemixQuality[]>([]);
  const [overallDirection, setOverallDirection] = useState("");

  const addSelection = () => {
    if (!anchor) return;
    setSelections((current) => [...current, { sourceCandidateId: anchor.id, quality: "composition", note: "" }]);
  };

  const updateSelection = (index: number, patch: Partial<RemixQuality>) => {
    setSelections((current) => current.map((selection, itemIndex) => itemIndex === index ? { ...selection, ...patch } : selection));
  };

  const recipe: CreativeRemixRecipe | null = useMemo(() => anchor ? {
    version: 1,
    target: anchor.target,
    mediaType: anchor.mediaType,
    selections,
    overallDirection,
  } : null, [anchor, selections, overallDirection]);

  if (!anchor) return <section className="empty-state"><p>Add at least one candidate before combining qualities.</p></section>;

  return (
    <section className="form-section creative-remix-controls" aria-label="Combine and remix selected qualities">
      <div className="subsection-title">
        <div>
          <span>Combine and Remix</span>
          <p className="field-help">Borrow only the qualities you want from different candidates. The result stays a candidate until you explicitly approve it later.</p>
        </div>
        <button type="button" className="small-button" onClick={addSelection}>Add quality</button>
      </div>

      <div className="remix-quality-list">
        {selections.map((selection, index) => (
          <div className="form-grid three-columns" key={`${selection.sourceCandidateId}-${index}`}>
            <label className="form-field">
              <span className="field-label">Source candidate</span>
              <select value={selection.sourceCandidateId} onChange={(event) => updateSelection(index, { sourceCandidateId: event.target.value })}>
                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.target.label} · {candidate.mediaType}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Quality to reuse</span>
              <select value={selection.quality} onChange={(event) => updateSelection(index, { quality: event.target.value })}>
                {QUALITY_OPTIONS.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Direction</span>
              <textarea value={selection.note} onChange={(event) => updateSelection(index, { note: event.target.value })} placeholder="What exactly should carry over?" />
            </label>
          </div>
        ))}
      </div>

      <label className="form-field">
        <span className="field-label">Overall direction</span>
        <span className="field-help">Optional: describe how these qualities should work together.</span>
        <textarea value={overallDirection} onChange={(event) => setOverallDirection(event.target.value)} />
      </label>

      <button
        type="button"
        className="small-button"
        disabled={!recipe || !selections.length}
        onClick={() => recipe && onRemix(buildProviderNeutralRemixRequest(recipe, candidates))}
      >
        Create combined candidate
      </button>
    </section>
  );
}
