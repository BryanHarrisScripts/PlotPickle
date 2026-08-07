"use client";

import { useMemo, useState } from "react";
import type { CreativeExplorationCandidate } from "@/lib/creative-candidates";
import {
  buildProviderNeutralCreativeRequest,
  createBlankCreativeDirection,
  CREATIVE_DIRECTION_DIMENSIONS,
  type KeepChangeTryDirection,
  type ProviderNeutralCreativeRequest,
} from "@/lib/creative-direction";

export default function CreativeDirectionControls({
  sourceCandidate,
  onDirect,
}: {
  sourceCandidate: CreativeExplorationCandidate;
  onDirect: (request: ProviderNeutralCreativeRequest) => void;
}) {
  const [direction, setDirection] = useState<KeepChangeTryDirection>(() => createBlankCreativeDirection());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const request = useMemo(() => buildProviderNeutralCreativeRequest(sourceCandidate, direction), [sourceCandidate, direction]);

  const update = (key: "keep" | "change" | "try" | "advancedPrompt", value: string) => {
    setDirection((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="form-section creative-direction-controls" aria-label="Direct the next version">
      <div className="subsection-title">
        <div>
          <span>Direct the next version</span>
          <p className="field-help">Describe what to preserve, what to change and what you want to explore. PlotPickle handles provider details elsewhere.</p>
        </div>
      </div>

      <div className="form-grid three-columns">
        <label className="form-field">
          <span className="field-label">Keep</span>
          <span className="field-help">What already works and must survive the next version?</span>
          <textarea value={direction.keep} onChange={(event) => update("keep", event.target.value)} placeholder="Keep the silhouette, warm window light and restrained expression." />
        </label>
        <label className="form-field">
          <span className="field-label">Change</span>
          <span className="field-help">What should be corrected, reduced, removed or made clearer?</span>
          <textarea value={direction.change} onChange={(event) => update("change", event.target.value)} placeholder="Change the camera height and simplify the background." />
        </label>
        <label className="form-field">
          <span className="field-label">Try</span>
          <span className="field-help">What new creative direction should the next version explore?</span>
          <textarea value={direction.try} onChange={(event) => update("try", event.target.value)} placeholder="Try a more intimate over-the-shoulder composition." />
        </label>
      </div>

      <details className="creative-direction-details">
        <summary>Direct specific qualities</summary>
        <div className="form-grid two-columns">
          {CREATIVE_DIRECTION_DIMENSIONS.map((dimension) => (
            <label className="form-field" key={dimension.id}>
              <span className="field-label">{dimension.label}</span>
              <span className="field-help">{dimension.help}</span>
              <textarea
                value={direction.notes[dimension.id]}
                onChange={(event) => setDirection((current) => ({
                  ...current,
                  notes: { ...current.notes, [dimension.id]: event.target.value },
                }))}
              />
            </label>
          ))}
        </div>
      </details>

      <div className="creative-direction-actions">
        <button type="button" className="small-button" onClick={() => onDirect(request)}>Create next candidate</button>
        <button type="button" className="text-button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced((value) => !value)}>
          {showAdvanced ? "Hide advanced prompt" : "Advanced prompt"}
        </button>
      </div>

      {showAdvanced ? (
        <label className="form-field creative-direction-advanced">
          <span className="field-label">Advanced prompt override</span>
          <span className="field-help">Optional. Normal directing does not require model, endpoint or workflow knowledge.</span>
          <textarea value={direction.advancedPrompt} onChange={(event) => update("advancedPrompt", event.target.value)} />
        </label>
      ) : null}
    </section>
  );
}
