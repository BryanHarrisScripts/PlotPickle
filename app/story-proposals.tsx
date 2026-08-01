"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import type { StoryProposalGroupId } from "@/lib/story-proposals";
import CollaborationInvitations, { type CollaborationAccess } from "./collaboration-invitations";
import styles from "./story-proposals.module.css";

type ProposalState = "open" | "draft" | "approved" | "merged" | "declined";
type ProposalItem = {
  number: number;
  title: string;
  url: string;
  state: ProposalState;
  author: string;
  branchName: string;
  updatedAt: string;
  mergedAt: string;
};

type SemanticGroup = {
  id: StoryProposalGroupId;
  label: string;
  description: string;
  changed: boolean;
  summary: string;
  filePaths: string[];
};

type ProposalReview = {
  proposal: ProposalItem;
  baseCommit: string;
  headCommit: string;
  projectRoot: string;
  groups: SemanticGroup[];
  diff: {
    create: number;
    update: number;
    delete: number;
    unchanged: number;
    changed: number;
    changedPaths: string[];
  };
};

type JsonError = Error & { response?: Record<string, unknown> };

const DEFAULT_ACCESS: CollaborationAccess = {
  connected: false,
  role: null,
  roleLabel: "Project Lead",
  isProjectLead: true,
  readOnly: false,
  canSubmitProposals: true,
  acceptingProposals: true,
  verificationState: "lead",
  verificationMessage: "",
  remoteCommit: "",
  primaryWorkspace: "/",
  workspaceDefaults: ["/", "/settings"],
  invitationId: "",
  recipientName: "",
  projectTitle: "",
  revokedInvitationIds: [],
};

async function request(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Story Proposals are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof value.message === "string" ? value.message : "The Story Proposal operation failed.") as JsonError;
    error.response = value;
    throw error;
  }
  return value;
}

function proposalList(value: unknown): ProposalItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const number = Number(record.number) || 0;
    if (!number) return [];
    const state = ["open", "draft", "approved", "merged", "declined"].includes(String(record.state))
      ? String(record.state) as ProposalState
      : "open";
    return [{
      number,
      title: typeof record.title === "string" ? record.title : "Story Proposal",
      url: typeof record.url === "string" ? record.url : "",
      state,
      author: typeof record.author === "string" ? record.author : "unknown",
      branchName: typeof record.branchName === "string" ? record.branchName : "",
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
      mergedAt: typeof record.mergedAt === "string" ? record.mergedAt : "",
    }];
  });
}

function semanticGroups(value: unknown): SemanticGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = String(record.id) as StoryProposalGroupId;
    if (!["story", "dialogue", "characters", "scenes", "world", "production", "review", "assets", "rights"].includes(id)) return [];
    return [{
      id,
      label: typeof record.label === "string" ? record.label : id,
      description: typeof record.description === "string" ? record.description : "",
      changed: Boolean(record.changed),
      summary: typeof record.summary === "string" ? record.summary : "",
      filePaths: Array.isArray(record.filePaths) ? record.filePaths.filter((path): path is string => typeof path === "string") : [],
    }];
  });
}

function reviewFrom(value: Record<string, unknown>): ProposalReview {
  const proposal = proposalList(value.proposal ? [value.proposal] : [])[0];
  if (!proposal) throw new Error("The selected Story Proposal could not be read.");
  const diffValue = value.diff && typeof value.diff === "object" ? value.diff as Record<string, unknown> : {};
  return {
    proposal,
    baseCommit: String(value.baseCommit ?? ""),
    headCommit: String(value.headCommit ?? ""),
    projectRoot: String(value.projectRoot ?? "project"),
    groups: semanticGroups(value.groups),
    diff: {
      create: Number(diffValue.create) || 0,
      update: Number(diffValue.update) || 0,
      delete: Number(diffValue.delete) || 0,
      unchanged: Number(diffValue.unchanged) || 0,
      changed: Number(diffValue.changed) || 0,
      changedPaths: Array.isArray(diffValue.changedPaths) ? diffValue.changedPaths.filter((path): path is string => typeof path === "string") : [],
    },
  };
}

function stateLabel(state: ProposalState) {
  if (state === "approved") return "Approved selectively";
  if (state === "merged") return "Merged in GitHub";
  if (state === "declined") return "Declined";
  if (state === "draft") return "Draft review";
  return "Awaiting decision";
}

function stateClass(state: ProposalState) {
  if (state === "approved" || state === "merged") return styles.proposalApproved;
  if (state === "declined") return styles.proposalDeclined;
  if (state === "draft") return styles.proposalDraft;
  return styles.proposalOpen;
}

function applyApprovedProject(current: PlotPickleProject, incoming: PlotPickleProject, remoteCommit: string) {
  const now = new Date().toISOString();
  return {
    ...incoming,
    metadata: { ...incoming.metadata, updatedAt: now },
    collaboration: {
      ...incoming.collaboration,
      ...current.collaboration,
      provider: "github" as const,
      syncEnabled: true,
      lastPulledCommit: remoteCommit,
      updatedAt: now,
    },
  };
}

export default function StoryProposals({
  project,
  onChange,
  ready,
  branch,
  onNotice,
}: {
  project: PlotPickleProject;
  onChange: (project: PlotPickleProject) => void;
  ready: boolean;
  branch: string;
  onNotice: (message: string) => void;
}) {
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [review, setReview] = useState<ProposalReview | null>(null);
  const [selected, setSelected] = useState<StoryProposalGroupId[]>([]);
  const [title, setTitle] = useState(`Story Proposal: ${project.metadata.title}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<CollaborationAccess>(DEFAULT_ACCESS);

  const effectiveReady = ready || access.connected;
  const openCount = useMemo(() => items.filter((item) => item.state === "open" || item.state === "draft").length, [items]);
  const submissionBlocked = !access.acceptingProposals
    ? "The Project Lead has paused new Story Proposals. Local work and approved-story refresh remain available."
    : access.readOnly
      ? "This role is read-only and cannot submit Story Proposals."
      : !access.canSubmitProposals
        ? access.verificationMessage || "This invitation must be verified before it can submit Story Proposals."
        : "";

  async function loadProposals() {
    if (!effectiveReady) {
      setItems([]);
      setReview(null);
      return;
    }
    try {
      const value = await request("/api/local-github/proposals");
      setItems(proposalList(value.proposals));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Story Proposals could not be loaded.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProposals(); }, 0);
    return () => window.clearTimeout(timer);
    // Refresh whenever GitHub or invitation readiness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveReady, access.verificationState]);

  async function submit() {
    setBusy(true);
    try {
      await request("/api/local-projects/save", "POST", { project });
      const value = await request("/api/local-github/submit-proposal", "POST", {
        project,
        title,
        note,
        baseRevision: project.collaboration.lastPulledCommit,
      });
      const commitSha = String(value.commitSha ?? "");
      const number = Number(value.pullRequestNumber) || 0;
      const url = String(value.pullRequestUrl ?? "");
      onChange({
        ...project,
        collaboration: {
          ...project.collaboration,
          provider: "github",
          syncEnabled: true,
          lastPushedCommit: commitSha,
          updatedAt: new Date().toISOString(),
        },
      });
      setNote("");
      onNotice(`Story Proposal #${number} created from changed canonical files. The approved ${branch} version is unchanged.`);
      await loadProposals();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The Story Proposal could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function inspect(item: ProposalItem) {
    setBusy(true);
    try {
      const value = await request(`/api/local-github/proposal-review?number=${encodeURIComponent(item.number)}`);
      const next = reviewFrom(value);
      setReview(next);
      setSelected(access.isProjectLead ? next.groups.map((group) => group.id) : []);
      onNotice(access.isProjectLead
        ? `Story Proposal #${item.number} is ready for semantic review. No approved files have changed.`
        : `Story Proposal #${item.number} opened in read-only semantic review.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The Story Proposal could not be reviewed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(group: StoryProposalGroupId) {
    if (!access.isProjectLead) return;
    setSelected((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);
  }

  async function approve() {
    if (!review || !access.isProjectLead) return;
    setBusy(true);
    try {
      const value = await request("/api/local-github/approve-proposal", "POST", {
        number: review.proposal.number,
        expectedBaseCommit: review.baseCommit,
        selectedGroups: selected,
      });
      const incoming = value.project as PlotPickleProject;
      const remoteCommit = String(value.remoteCommit ?? "");
      onChange(applyApprovedProject(project, incoming, remoteCommit));
      onNotice(`Story Proposal #${review.proposal.number} approved. ${selected.length} semantic group${selected.length === 1 ? "" : "s"} became the new approved version.`);
      setReview(null);
      setSelected([]);
      await loadProposals();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The selected Story Proposal groups could not be approved.");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!review || !access.isProjectLead) return;
    if (!window.confirm(`Decline Story Proposal #${review.proposal.number}? The approved story will remain unchanged.`)) return;
    setBusy(true);
    try {
      await request("/api/local-github/decline-proposal", "POST", { number: review.proposal.number });
      onNotice(`Story Proposal #${review.proposal.number} was declined. The approved story was not changed.`);
      setReview(null);
      setSelected([]);
      await loadProposals();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The Story Proposal could not be declined.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshApproved() {
    setBusy(true);
    try {
      const value = await request("/api/local-github/refresh-approved", "POST");
      const incoming = value.project as PlotPickleProject;
      const remoteCommit = String(value.remoteCommit ?? "");
      onChange(applyApprovedProject(project, incoming, remoteCommit));
      onNotice("The local story now matches the latest Project Lead-approved canonical folder.");
      setReview(null);
      await loadProposals();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The approved story could not be refreshed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CollaborationInvitations project={project} ready={ready} onNotice={onNotice} onAccessChange={setAccess} />

      <section className={`${styles.panel} ${styles.storyProposalWorkspace}`}>
        <header>
          <div>
            <p>Story Proposals</p>
            <h3>{openCount} proposal{openCount === 1 ? "" : "s"} awaiting a Project Lead decision</h3>
            <span>{access.isProjectLead
              ? "Proposal branches contain only changed canonical project files. Select dialogue, character, scene, production or other semantic groups independently."
              : `${access.roleLabel} access keeps local work separate until an authorized Story Proposal is submitted. Approval remains controlled by the Project Lead.`}</span>
          </div>
          <div className={styles.actions}>
            <button type="button" disabled={!effectiveReady || busy} onClick={() => void loadProposals()}>Refresh proposals</button>
            <button type="button" className={styles.primary} disabled={!effectiveReady || busy} onClick={() => void refreshApproved()}>Refresh approved story</button>
          </div>
        </header>

        <div className={styles.proposalComposer}>
          <div>
            <strong>Create a Story Proposal</strong>
            <p>PlotPickle compares your local canonical folder with the approved branch and commits only changed project files to a new proposal branch.</p>
          </div>
          {submissionBlocked ? <p className={styles.help}><b>Submission unavailable:</b> {submissionBlocked}</p> : null}
          <div className={styles.form}>
            <label className={styles.wide}><span>Proposal title</span><input value={title} disabled={Boolean(submissionBlocked)} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className={styles.wide}><span>Contributor note</span><textarea rows={4} value={note} disabled={Boolean(submissionBlocked)} onChange={(event) => setNote(event.target.value)} placeholder="Explain the creative intent, the areas changed and anything the Project Lead should inspect closely." /></label>
          </div>
          <div className={styles.baseState}><span>Known approved commit</span><code>{project.collaboration.lastPulledCommit || "Refresh the approved story before creating a proposal"}</code></div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={!effectiveReady || busy || Boolean(submissionBlocked) || !project.collaboration.lastPulledCommit} onClick={() => void submit()}>Create Story Proposal</button>
          </div>
        </div>

        <div className={styles.proposalLayout}>
          <div className={styles.proposalQueue}>
            <strong>Proposal queue</strong>
            {items.length ? items.map((item) => (
              <article key={item.number} className={review?.proposal.number === item.number ? styles.proposalActive : ""}>
                <button type="button" disabled={busy || item.state === "approved" || item.state === "merged" || item.state === "declined"} onClick={() => void inspect(item)}>
                  <span className={`${styles.proposalState} ${stateClass(item.state)}`}>{stateLabel(item.state)}</span>
                  <b>#{item.number} · {item.title}</b>
                  <small>{item.author} · {item.updatedAt || "No update time"}</small>
                </button>
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open review in GitHub</a> : null}
              </article>
            )) : <p className={styles.help}>No Story Proposals are listed yet.</p>}
          </div>

          <div className={styles.proposalReview}>
            {review ? (
              <>
                <div className={styles.proposalReviewHeader}>
                  <div><span>{access.isProjectLead ? "Semantic review" : "Read-only semantic review"}</span><strong>#{review.proposal.number} · {review.proposal.title}</strong><small>{review.diff.changed} changed canonical file{review.diff.changed === 1 ? "" : "s"} · base {review.baseCommit.slice(0, 10)}</small></div>
                  <button type="button" disabled={busy} onClick={() => { setReview(null); setSelected([]); }}>Close review</button>
                </div>
                <div className={styles.semanticGrid}>
                  {review.groups.map((group) => {
                    const checked = selected.includes(group.id);
                    return (
                      <label key={group.id} className={`${styles.semanticCard} ${checked ? styles.semanticSelected : ""}`}>
                        <input type="checkbox" checked={checked} disabled={!access.isProjectLead} onChange={() => toggle(group.id)} />
                        <span><b>{group.label}</b><small>{group.summary}</small><em>{group.description}</em></span>
                        <code>{group.filePaths.length} file path{group.filePaths.length === 1 ? "" : "s"}</code>
                      </label>
                    );
                  })}
                </div>
                <p className={styles.help}>{access.isProjectLead
                  ? "Selected groups are rebuilt into one guarded approved-project commit. Unselected groups are excluded rather than silently merged."
                  : "You can inspect each semantic group, but only the Project Lead can approve or decline the proposal."}</p>
                {access.isProjectLead ? (
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} disabled={busy || !selected.length} onClick={() => void approve()}>Approve selected groups</button>
                    <button type="button" className={styles.dangerAction} disabled={busy} onClick={() => void decline()}>Decline proposal</button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.proposalEmpty}>
                <strong>Select an open Story Proposal</strong>
                <p>PlotPickle compares the approved and proposed canonical projects, then separates the changes into filmmaker-facing semantic groups.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
