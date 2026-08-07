"use client";

import type { PlotPickleProject } from "@/lib/project";
import { proposalsForAsset, type ImageToStoryProposal } from "@/lib/image-to-story-proposals";

export default function ImageToStoryProposals({
  project,
  sourceAssetId,
  onAccept,
  onEdit,
  onReject,
  onDefer,
}: {
  project: PlotPickleProject;
  sourceAssetId: string;
  onAccept: (proposalId: string) => void;
  onEdit: (proposal: ImageToStoryProposal) => void;
  onReject: (proposalId: string) => void;
  onDefer: (proposalId: string) => void;
}) {
  const proposals = proposalsForAsset(project, sourceAssetId);

  return (
    <section className="editor-page image-to-story-proposals" aria-label="Image-to-story proposals">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Image-to-Story Proposals</span>
          <h2>Let the visual suggest. You decide what changes the story.</h2>
          <p>Visual discoveries can propose character, world, scene, action or dialogue changes. Nothing edits the story until you explicitly accept or edit a proposal.</p>
        </div>
      </header>

      {proposals.length ? (
        <div className="proposal-list">
          {proposals.map((proposal) => (
            <article className={`proposal-card proposal-card-${proposal.status}`} key={proposal.id} tabIndex={0}>
              <header>
                <span className="eyebrow">{proposal.targetKind}</span>
                <strong>{proposal.targetLabel || proposal.fieldPath}</strong>
                <span>{proposal.status}</span>
              </header>
              <div className="form-grid two-columns">
                <section>
                  <h3>Current text</h3>
                  <p>{proposal.currentText || "No existing text."}</p>
                </section>
                <section>
                  <h3>Proposed change</h3>
                  <p>{proposal.proposedText || "No proposed text."}</p>
                </section>
              </div>
              <section>
                <h3>Why the visual suggests this</h3>
                <p>{proposal.rationale || "No rationale recorded."}</p>
              </section>
              <small>Origin: {proposal.sourceAssetId || proposal.sourceCandidateId || "Selected visual"}</small>
              {proposal.status === "proposed" || proposal.status === "deferred" ? (
                <div className="creative-direction-actions">
                  <button type="button" className="small-button" onClick={() => onAccept(proposal.id)}>Accept</button>
                  <button type="button" className="text-button" onClick={() => onEdit(proposal)}>Edit then accept</button>
                  <button type="button" className="text-button" onClick={() => onDefer(proposal.id)}>Defer</button>
                  <button type="button" className="text-button" onClick={() => onReject(proposal.id)}>Reject</button>
                </div>
              ) : null}
              {proposal.humanDecision ? <p className="field-help">Human decision: {proposal.humanDecision}</p> : null}
            </article>
          ))}
        </div>
      ) : <div className="empty-state"><p>No story proposals from this visual yet.</p></div>}

      <p className="field-help">Accepted proposals enter normal revision history with the originating asset, before/after text and the human decision preserved.</p>
    </section>
  );
}
