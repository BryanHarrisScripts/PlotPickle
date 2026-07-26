"use client";

import type { PlotPickleProject, ReviewThreadStatus } from "@/lib/project";

const statusOrder: ReviewThreadStatus[] = ["open", "in-review", "deferred", "resolved"];

export default function FeedbackWorkspace({ project }: { project: PlotPickleProject }) {
  const counts = Object.fromEntries(statusOrder.map((status) => [status, project.review.threads.filter((thread) => thread.status === status).length])) as Record<ReviewThreadStatus, number>;
  const unresolved = project.review.threads.filter((thread) => thread.status !== "resolved");

  return (
    <div className="dashboard-shell feedback-workspace">
      <aside className="workspace-subnav" aria-label="Feedback sections">
        <p className="eyebrow">Feedback</p>
        <strong>Review without losing context</strong>
        <a href="#feedback-overview">Overview <span>{unresolved.length}</span></a>
        <a href="#feedback-human">Human review <span>{counts.open + counts["in-review"]}</span></a>
        <a href="#feedback-ai">AI review</a>
        <a href="#feedback-history">Resolution history <span>{counts.resolved}</span></a>
        <div className="method-note">
          <span>Anchored review</span>
          <strong>{project.review.threads.length} threads</strong>
          <p>Feedback targets the same project, Block, scene, screenplay element or character IDs used everywhere else.</p>
        </div>
      </aside>

      <section className="dashboard-main" id="feedback-overview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Unified review workspace</p>
            <h1>Collect, compare and resolve feedback around the current work.</h1>
            <p>Existing review threads, revision snapshots, diagnostics and optional AI proposals remain anchored to canonical story records. Suggestions do not overwrite the screenplay automatically.</p>
          </div>
        </div>

        <div className="dashboard-status-grid">
          {statusOrder.map((status) => <article className="status-card" key={status}><span className="status-card-label">{status.replace("-", " ")}</span><strong>{counts[status]}</strong><p>{status === "resolved" ? "Completed decisions retained for history." : "Review items still visible in the active project."}</p></article>)}
        </div>

        <section className="guide-grid" id="feedback-human">
          <article className="guide-card"><p className="eyebrow">Human review</p><h2>Anchored comments and collaborator proposals</h2><p>Reuse local review threads, Pitch & Review records and GitHub proposal history.</p></article>
          <article className="guide-card" id="feedback-ai"><p className="eyebrow">Optional AI review</p><h2>Proposal-only assistance</h2><p>AI findings must show provider, provenance and an explicit apply decision. Credentials remain outside the project package.</p></article>
          <article className="guide-card" id="feedback-history"><p className="eyebrow">Resolution history</p><h2>{counts.resolved} resolved threads</h2><p>Named revisions and decisions remain available instead of disappearing when a comment is closed.</p></article>
        </section>

        {unresolved.length ? (
          <section className="form-section">
            <h2>Current unresolved feedback</h2>
            <div className="guide-grid">
              {unresolved.slice(0, 6).map((thread) => (
                <article className="guide-card" key={thread.id}>
                  <p className="eyebrow">{thread.priority} · {thread.status}</p>
                  <h3>{thread.title}</h3>
                  <p>{thread.anchor.label}</p>
                  <small>{thread.comments.length} comment{thread.comments.length === 1 ? "" : "s"}</small>
                </article>
              ))}
            </div>
          </section>
        ) : <article className="guide-card"><p className="eyebrow">Review queue</p><h2>No unresolved feedback</h2><p>New human, diagnostic or AI proposals will appear here while preserving their original target and source.</p></article>}
      </section>
    </div>
  );
}
