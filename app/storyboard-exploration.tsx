"use client";

import type { PlotPickleProject } from "@/lib/project";
import type { VisualWritingTarget } from "@/lib/visual-writing-session";
import {
  buildStoryboardFrameDirection,
  storyboardApprovalWarnings,
  storyboardFramesForTarget,
  type StoryboardFrameCandidate,
} from "@/lib/storyboard-exploration";

export default function StoryboardExploration({
  project,
  target,
  onAddFrame,
  onApprove,
  onExplore,
}: {
  project: PlotPickleProject;
  target: VisualWritingTarget;
  onAddFrame: (frame: StoryboardFrameCandidate) => void;
  onApprove: (frameId: string) => void;
  onExplore?: (target: VisualWritingTarget) => void;
}) {
  const direction = buildStoryboardFrameDirection(project, target);
  const frames = storyboardFramesForTarget(project, target);
  const warnings = storyboardApprovalWarnings(project, target);

  const importManualFrame = () => {
    const now = new Date().toISOString();
    onAddFrame({
      id: `storyboard-frame-${now.replace(/[^0-9]/g, "")}`,
      target,
      sourceKind: "manual-import",
      sourceLabel: "Manual image",
      assetRef: "",
      direction,
      status: "candidate",
      supersedesCandidateId: "",
      supersededByCandidateId: "",
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <section className="editor-page storyboard-exploration" aria-label="Storyboard exploration">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Storyboard Exploration</span>
          <h2>{target.label}</h2>
          <p>Translate story movement into coherent frames using approved identity, location and continuity by default.</p>
        </div>
        <div className="creative-direction-actions">
          {onExplore ? <button type="button" className="small-button" onClick={() => onExplore(target)}>Explore staging</button> : null}
          <button type="button" className="text-button" onClick={importManualFrame}>Add manual image</button>
        </div>
      </header>

      <div className="form-grid two-columns">
        <section className="form-section">
          <h3>Frame direction</h3>
          <dl className="canon-meta">
            <div><dt>Story purpose</dt><dd>{direction.storyPurpose || "Not set"}</dd></div>
            <div><dt>Action</dt><dd>{direction.action || "Not set"}</dd></div>
            <div><dt>Emotional turn</dt><dd>{direction.emotionalTurn || "Not set"}</dd></div>
            <div><dt>Characters</dt><dd>{direction.characterIds.length}</dd></div>
            <div><dt>Locations</dt><dd>{direction.locationIds.length}</dd></div>
            <div><dt>Approved canon</dt><dd>{direction.approvedCanonItemIds.length} items</dd></div>
          </dl>
        </section>

        <section className="form-section">
          <h3>Continuity</h3>
          {direction.continuityNotes.length ? <ul>{direction.continuityNotes.map((note) => <li key={note}>{note}</li>)}</ul> : <p>No continuity locks apply.</p>}
          {warnings.length ? (
            <div className="continuity-warning" role="alert">
              <strong>Resolve before approval</strong>
              <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : <p className="field-help">No continuity conflicts block approval.</p>}
        </section>
      </div>

      <section className="form-section">
        <h3>Alternate frames</h3>
        {frames.length ? (
          <div className="candidate-grid">
            {frames.map((frame) => (
              <article key={frame.id} className={`candidate-card candidate-card-${frame.status}`} tabIndex={0}>
                <div>
                  <strong>{frame.sourceKind === "manual-import" ? "Manual image" : "Generated frame"}</strong>
                  <span>{frame.status}</span>
                </div>
                <p>{frame.sourceLabel || frame.direction.staging || frame.direction.shot || "Storyboard frame"}</p>
                <small>{frame.direction.storyPurpose}</small>
                {frame.status === "candidate" ? (
                  <button type="button" className="small-button" disabled={warnings.length > 0} onClick={() => onApprove(frame.id)}>Approve frame</button>
                ) : null}
                {frame.supersedesCandidateId ? <small>Supersedes {frame.supersedesCandidateId}</small> : null}
                {frame.supersededByCandidateId ? <small>Superseded by {frame.supersededByCandidateId}</small> : null}
              </article>
            ))}
          </div>
        ) : <p>No frame candidates yet. Explore with a configured image route or add a manual image; both enter the same review history.</p>}
      </section>

      <p className="field-help">Approving a new frame preserves prior versions as superseded history. Generated and manually imported frames follow the same candidate review model.</p>
    </section>
  );
}
